import React, { useEffect, useMemo, useRef, useState } from 'react';
import { addDoc, collection, doc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import {
  BellRing,
  Bookmark,
  Bot,
  Building2,
  Calculator,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  FileText,
  Gift,
  HelpCircle,
  History,
  MessageSquare,
  Printer,
  QrCode,
  RotateCcw,
  Search,
  ShoppingBag,
  Star,
  Trash2,
  Truck,
  Wallet,
  Wrench,
  X,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useMarketplace } from '../context/MarketplaceContext';
import { db } from '../lib/firebase';
import { BOOKING_PROGRESS_STEPS, formatINR, SKILL_CATEGORIES } from '../lib/constants';
import { translateAvailability, translateSkillCategory } from '../lib/i18n';
import {
  findNextFreeSlot,
  formatSlotDisplay,
  getBookedSlotSet,
  makeSlotKey,
  SERVICE_TIME_SLOTS,
} from '../lib/availability';
import { computeMaintenanceReminders, triggerMaintenanceBrowserAlert } from '../lib/maintenanceReminders';
import { handleFirestoreError, OperationType } from '../lib/firestoreError';
import type { Product, SavedFavoriteType, ServiceBooking, TechnicianProfile, TechnicianReview } from '../types';
import { ServicePaymentQrModal } from './ServicePaymentQrModal';
import { WeeklyAvailabilityCalendar } from './WeeklyAvailabilityCalendar';

interface CustomerDashboardProps {
  onRequireAuth: () => void;
  preselectedTech?: TechnicianProfile | null;
  preselectedProduct?: Product | null;
  onOpenMarketplaceFeed?: (
    feed: 'technicians' | 'contractors' | 'shops' | 'products' | 'projects',
    searchQuery?: string
  ) => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  onRequireAuth,
  preselectedTech,
  preselectedProduct,
  onOpenMarketplaceFeed,
}) => {
  const {
    user,
    userAccount,
    userPII,
    zones,
    technicians,
    contractors,
    shops,
    technicianReviews,
    savedFavorites,
    products,
    bookings,
    orders,
    complaints,
    platformConfig,
    wallet,
    rewards,
    toggleFavorite,
    createNotification,
    addToWallet,
    payWithWallet,
    awardLoyaltyPoints,
    redeemLoyaltyPoints,
  } = useMarketplace();
  const { language, t } = useLanguage();

  const myBookings = useMemo(() => bookings.filter((b) => b.customerId === user?.uid), [bookings, user]);
  const completedBookings = useMemo(
    () =>
      myBookings
        .filter((b) => b.status === 'Completed')
        .sort((a, b) => (b.scheduledDate || '').localeCompare(a.scheduledDate || '')),
    [myBookings]
  );
  const myOrders = useMemo(() => orders.filter((o) => o.customerId === user?.uid), [orders, user]);
  const myComplaints = useMemo(() => complaints.filter((c) => c.reporterId === user?.uid), [complaints, user]);
  const bookingSectionRef = useRef<HTMLElement | null>(null);

  const reviewsByTech = useMemo(() => {
    const map = new Map<string, TechnicianReview[]>();
    for (const r of technicianReviews) {
      const list = map.get(r.technicianId) || [];
      list.push(r);
      map.set(r.technicianId, list);
    }
    return map;
  }, [technicianReviews]);

  const [bookingZone, setBookingZone] = useState(userAccount?.clusterZone || 'Andheri');
  const [bookingSkill, setBookingSkill] = useState<string>(preselectedTech?.skillCategory || SKILL_CATEGORIES[0]);
  const [matchedTechs, setMatchedTechs] = useState<Array<TechnicianProfile & { matchScore?: number }>>([]);
  const [matchLoading, setMatchLoading] = useState(false);

  const [selectedTech, setSelectedTech] = useState<TechnicianProfile | null>(preselectedTech || null);
  const [scheduledDate, setScheduledDate] = useState(() =>
    preselectedTech
      ? findNextFreeSlot(preselectedTech.busySlots || [], bookings, preselectedTech.ownerId).isoDate
      : new Date().toISOString().slice(0, 10)
  );
  const [scheduledSlot, setScheduledSlot] = useState(() =>
    preselectedTech
      ? findNextFreeSlot(preselectedTech.busySlots || [], bookings, preselectedTech.ownerId).slotId
      : SERVICE_TIME_SLOTS[0].id
  );
  const [bookingPriority, setBookingPriority] = useState<'Standard' | 'Urgent'>('Standard');
  const [serviceNotes, setServiceNotes] = useState('');
  const [estimatedHours, setEstimatedHours] = useState<number>(1);
  const [redeemLoyalty, setRedeemLoyalty] = useState<boolean>(false);
  const [bookingPayMethod, setBookingPayMethod] = useState<'UPI' | 'Wallet' | 'Card'>('UPI');
  const [bookingPayRef, setBookingPayRef] = useState('');

  // Standalone Service Price Estimator state
  const [estSkill, setEstSkill] = useState<string>(SKILL_CATEGORIES[0]);
  const [estZone, setEstZone] = useState<string>(userAccount?.clusterZone || 'Andheri');
  const [estHours, setEstHours] = useState<number>(2);

  // Digital Wallet Top-Up state
  const [walletTopupAmt, setWalletTopupAmt] = useState('500');
  const [walletTopupMethod, setWalletTopupMethod] = useState<'UPI' | 'Card'>('UPI');
  const [walletTopupRef, setWalletTopupRef] = useState('');
  const [walletBusy, setWalletBusy] = useState(false);

  // Help & FAQ state
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  const rewardsSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (preselectedTech) {
      setSelectedTech(preselectedTech);
      setBookingSkill(preselectedTech.skillCategory);
      const next = findNextFreeSlot(preselectedTech.busySlots || [], bookings, preselectedTech.ownerId);
      setScheduledDate(next.isoDate);
      setScheduledSlot(next.slotId);
      setBookingPriority('Standard');
      setEstimatedHours(1);
      setRedeemLoyalty(false);
    }
  }, [preselectedTech]);

  const handleChooseTech = (tech: TechnicianProfile) => {
    setSelectedTech(tech);
    const next = findNextFreeSlot(tech.busySlots || [], bookings, tech.ownerId);
    setScheduledDate(next.isoDate);
    setScheduledSlot(next.slotId);
    setEstimatedHours(1);
    setRedeemLoyalty(false);
    setStatusMsg(null);
  };

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(preselectedProduct || null);
  const [orderQty, setOrderQty] = useState('1');
  const [orderPayMethod, setOrderPayMethod] = useState<'UPI' | 'Wallet' | 'Card'>('UPI');
  const [orderShippingAddr, setOrderShippingAddr] = useState(
    userPII?.fullAddress || `${userAccount?.clusterZone || 'Andheri'}, Mumbai`
  );
  const [enquiryMsg, setEnquiryMsg] = useState('');

  const [utrInputs, setUtrInputs] = useState<Record<string, string>>({});
  const [reviewInputs, setReviewInputs] = useState<Record<string, { rating: number; text: string }>>({});
  const [submittingReviewId, setSubmittingReviewId] = useState<string | null>(null);

  const [compSubject, setCompSubject] = useState('');
  const [compDesc, setCompDesc] = useState('');
  const [receiptBooking, setReceiptBooking] = useState<ServiceBooking | null>(null);
  const [qrBooking, setQrBooking] = useState<ServiceBooking | null>(null);
  const [savedFilter, setSavedFilter] = useState<'all' | SavedFavoriteType>('all');

  const savedSet = useMemo(
    () => new Set(savedFavorites.map((f) => `${f.targetType}_${f.targetId}`)),
    [savedFavorites]
  );

  const filteredSaved = useMemo(
    () =>
      savedFilter === 'all'
        ? savedFavorites
        : savedFavorites.filter((f) => f.targetType === savedFilter),
    [savedFavorites, savedFilter]
  );

  const maintenanceReminders = useMemo(
    () => computeMaintenanceReminders(myBookings),
    [myBookings]
  );

  // Live Price Preview breakdown sourced directly from selected Technician Firestore record
  const pricePreview = useMemo(() => {
    if (!selectedTech) return null;
    const calloutFee =
      typeof selectedTech.calloutFee === 'number' && selectedTech.calloutFee >= 0
        ? selectedTech.calloutFee
        : selectedTech.expectedCharge;
    const hourlyRate =
      typeof selectedTech.hourlyRate === 'number' && selectedTech.hourlyRate >= 0
        ? selectedTech.hourlyRate
        : Math.round((selectedTech.expectedCharge || 0) * 0.45);
    const hours = Math.min(12, Math.max(1, estimatedHours || 1));
    const laborSubtotal = calloutFee + hourlyRate * hours;
    const bookingFee = platformConfig.customerBookingCharge;
    const availablePts = rewards?.pointsBalance ?? 0;
    const maxRedeemablePts = Math.min(availablePts, Math.floor(laborSubtotal * 0.25), 500);
    const pointsToRedeem = redeemLoyalty ? maxRedeemablePts : 0;
    const discountApplied = pointsToRedeem; // 1 loyalty point = ₹1 discount
    const commissionAmount = Math.round(
      ((laborSubtotal - discountApplied) * platformConfig.bookingCommissionPercent) / 100
    );
    const totalEstimated = Math.max(0, laborSubtotal - discountApplied + bookingFee);

    return {
      calloutFee,
      hourlyRate,
      hours,
      laborSubtotal,
      bookingFee,
      maxRedeemablePts,
      pointsToRedeem,
      discountApplied,
      commissionAmount,
      totalEstimated,
    };
  }, [selectedTech, estimatedHours, platformConfig, rewards?.pointsBalance, redeemLoyalty]);

  // Live Standalone Estimator from Firestore technicians
  const estimatorStats = useMemo(() => {
    const exactZone = technicians.filter(
      (tech) => tech.skillCategory === estSkill && tech.clusterZone === estZone
    );
    const skillPool =
      exactZone.length > 0
        ? exactZone
        : technicians.filter((tech) => tech.skillCategory === estSkill);

    if (skillPool.length === 0) {
      const baseCallout = 299;
      const baseHourly = 249;
      const subtotal = baseCallout + baseHourly * estHours;
      return {
        sampleSize: 0,
        zoneMatched: false,
        avgCallout: baseCallout,
        avgHourly: baseHourly,
        minTotal: Math.round(subtotal * 0.9) + platformConfig.customerBookingCharge,
        maxTotal: Math.round(subtotal * 1.2) + platformConfig.customerBookingCharge,
        avgTotal: subtotal + platformConfig.customerBookingCharge,
      };
    }

    const totals = skillPool.map((tech) => {
      const callout =
        typeof tech.calloutFee === 'number' && tech.calloutFee >= 0 ? tech.calloutFee : tech.expectedCharge;
      const hourly =
        typeof tech.hourlyRate === 'number' && tech.hourlyRate >= 0
          ? tech.hourlyRate
          : Math.round((tech.expectedCharge || 0) * 0.45);
      return {
        callout,
        hourly,
        total: callout + hourly * estHours + platformConfig.customerBookingCharge,
      };
    });

    const avgCallout = Math.round(totals.reduce((s, i) => s + i.callout, 0) / totals.length);
    const avgHourly = Math.round(totals.reduce((s, i) => s + i.hourly, 0) / totals.length);
    const avgTotal = Math.round(totals.reduce((s, i) => s + i.total, 0) / totals.length);
    const minTotal = Math.min(...totals.map((i) => i.total));
    const maxTotal = Math.max(...totals.map((i) => i.total));

    return {
      sampleSize: skillPool.length,
      zoneMatched: exactZone.length > 0,
      avgCallout,
      avgHourly,
      minTotal,
      maxTotal,
      avgTotal,
    };
  }, [technicians, estSkill, estZone, estHours, platformConfig.customerBookingCharge]);

  const [supportChannel, setSupportChannel] = useState<'AI Customer Support' | 'AI Call Center'>('AI Customer Support');
  const [supportPrompt, setSupportPrompt] = useState('');
  const [supportReply, setSupportReply] = useState<string | null>(null);
  const [supportBusy, setSupportBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleRebookFromHistory = (booking: ServiceBooking) => {
    setBookingZone(booking.clusterZone);
    setBookingSkill(booking.skillCategory);
    setServiceNotes(booking.serviceNotes || '');

    const providerTech = technicians.find(
      (t) => t.id === booking.technicianId || t.ownerId === booking.technicianId
    );

    if (providerTech) {
      handleChooseTech(providerTech);
      if (providerTech.availabilityStatus !== 'Available') {
        setStatusMsg(
          `${booking.technicianName} is currently ${providerTech.availabilityStatus}. You can check their schedule below or match another ${booking.skillCategory} in ${booking.clusterZone}.`
        );
      } else {
        setStatusMsg(
          `Re-booking ${booking.technicianName} (${booking.skillCategory}). Choose a Free slot below to confirm.`
        );
      }
    } else {
      setSelectedTech(null);
      setStatusMsg(
        `Pre-filled ${booking.skillCategory} in ${booking.clusterZone}. Click "Match Available Techs" to choose an available provider.`
      );
    }

    setTimeout(() => {
      bookingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  if (!user) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900">{t.customer.authTitle}</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          {t.customer.authDesc}
        </p>
        <button
          type="button"
          onClick={onRequireAuth}
          className="min-h-[44px] rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          {t.customer.authCta}
        </button>
      </div>
    );
  }

  const handleFindSmartMatches = async () => {
    setMatchLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/ai/match-technicians', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerZone: bookingZone,
          skillCategory: bookingSkill,
          candidates: technicians,
        }),
      });
      const data = await res.json();
      setMatchedTechs(data.matched || []);
      if ((data.matched || []).length === 0) {
        setStatusMsg(`No Available ${bookingSkill} found within radius of ${bookingZone}. Busy/Unavailable workers are automatically excluded.`);
      }
    } catch {
      setStatusMsg('Could not run AI Booking Manager matching.');
    } finally {
      setMatchLoading(false);
    }
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTech || !pricePreview) return;
    if (selectedTech.availabilityStatus !== 'Available') {
      setStatusMsg('Cannot book a technician marked Busy or Unavailable.');
      return;
    }
    const chosenKey = makeSlotKey(scheduledDate, scheduledSlot);
    const techBusySet = new Set(selectedTech.busySlots || []);
    const techBookedSet = getBookedSlotSet(bookings, selectedTech.ownerId);
    if (techBusySet.has(chosenKey) || techBookedSet.has(chosenKey)) {
      setStatusMsg('Selected time slot is marked Busy or Booked. Please pick a Free green slot from the calendar.');
      return;
    }

    const serviceCharge = pricePreview.laborSubtotal;
    const bookingFee = pricePreview.bookingFee;
    const commissionAmount = pricePreview.commissionAmount;
    const totalAmount = pricePreview.totalEstimated;

    try {
      let paymentStatus: 'Unpaid' | 'Pending Verification' = 'Unpaid';
      let paymentReferenceValue = bookingPayRef.trim();

      if (bookingPayMethod === 'Wallet') {
        if ((wallet?.balance ?? 0) < totalAmount) {
          setStatusMsg(
            `Insufficient Wallet balance (${formatINR(wallet?.balance ?? 0)}). Top up above or choose UPI / Card.`
          );
          return;
        }
        paymentReferenceValue = await payWithWallet(
          totalAmount,
          `booking:${selectedTech.skillCategory}`
        );
        paymentStatus = 'Pending Verification';
      } else if (paymentReferenceValue.length >= 4) {
        paymentStatus = 'Pending Verification';
      }

      if (pricePreview.pointsToRedeem > 0) {
        await redeemLoyaltyPoints(pricePreview.pointsToRedeem);
      }

      const bookingPayload: Record<string, unknown> = {
        customerId: user.uid,
        customerName: userAccount?.displayName || user.displayName || 'Customer',
        technicianId: selectedTech.ownerId,
        technicianName: selectedTech.fullName,
        skillCategory: selectedTech.skillCategory,
        clusterZone: bookingZone,
        serviceNotes: serviceNotes.trim(),
        scheduledDate,
        scheduledSlot,
        priority: bookingPriority,
        status: 'Requested',
        serviceCharge,
        bookingFee,
        commissionAmount,
        totalAmount,
        estimatedHours: pricePreview.hours,
        hourlyRateSnapshot: pricePreview.hourlyRate,
        calloutFeeSnapshot: pricePreview.calloutFee,
        discountApplied: pricePreview.discountApplied,
        loyaltyPointsRedeemed: pricePreview.pointsToRedeem,
        paymentMethod: bookingPayMethod,
        paymentStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (paymentStatus === 'Pending Verification' && paymentReferenceValue) {
        bookingPayload.paymentReference = paymentReferenceValue;
      }

      const ref = await addDoc(collection(db, 'bookings'), bookingPayload);

      await awardLoyaltyPoints(10);

      await createNotification(
        selectedTech.ownerId,
        bookingPriority === 'Urgent' ? '[URGENT] Immediate Service Request' : 'New Service Booking Request',
        `${userAccount?.displayName || 'A customer'} requested ${bookingPriority === 'Urgent' ? 'URGENT ' : ''}${selectedTech.skillCategory} (${pricePreview.hours}h, Est. ${formatINR(totalAmount)}) in ${bookingZone} for ${formatSlotDisplay(scheduledDate, scheduledSlot)}.`,
        'booking'
      );
      setServiceNotes('');
      setBookingPriority('Standard');
      setBookingPayRef('');
      setRedeemLoyalty(false);
      setSelectedTech(null);
      setStatusMsg(
        `Booking request sent to ${selectedTech.fullName} for ${formatSlotDisplay(scheduledDate, scheduledSlot)} (Ref: ${ref.id.slice(0, 8)} · +10 Loyalty Pts earned).`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'bookings');
    }
  };

  const handleWalletTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(walletTopupAmt);
    if (!Number.isFinite(amount) || amount < 50) {
      setStatusMsg('Enter a valid top-up amount (minimum ₹50).');
      return;
    }
    if (walletTopupRef.trim().length < 4) {
      setStatusMsg('Enter a valid UPI UTR or Card reference (min 4 characters).');
      return;
    }
    setWalletBusy(true);
    try {
      await addToWallet(amount, walletTopupMethod, walletTopupRef.trim());
      setWalletTopupRef('');
      setStatusMsg(`Added ${formatINR(amount)} to your Digital Wallet via ${walletTopupMethod}.`);
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Could not complete wallet top-up.');
    } finally {
      setWalletBusy(false);
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    const qty = Math.max(1, Number(orderQty) || 1);
    const gross = qty * selectedProduct.price;
    const discPct = selectedProduct.memberDiscountPercent || 0;
    const memberDiscountApplied = discPct > 0 ? Math.round((gross * discPct) / 100) : 0;
    const shippingFee = selectedProduct.shippingAvailable ? (selectedProduct.shippingFee || 0) : 0;
    const totalAmount = Math.max(0, gross - memberDiscountApplied + shippingFee);

    try {
      let paymentStatus: 'Unpaid' | 'Pending Verification' = 'Unpaid';
      let paymentRef: string | undefined;

      if (orderPayMethod === 'Wallet') {
        if ((wallet?.balance ?? 0) < totalAmount) {
          setStatusMsg(`Insufficient Wallet balance (${formatINR(wallet?.balance ?? 0)}). Top up or use UPI/Card.`);
          return;
        }
        paymentRef = await payWithWallet(totalAmount, `order:${selectedProduct.name}`);
        paymentStatus = 'Pending Verification';
      }

      const orderPayload: Record<string, unknown> = {
        customerId: user.uid,
        customerName: userAccount?.displayName || user.displayName || 'Customer',
        shopId: selectedProduct.shopId,
        shopOwnerId: selectedProduct.ownerId,
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        quantity: qty,
        unitPrice: selectedProduct.price,
        totalAmount,
        memberDiscountApplied,
        shippingFee,
        paymentMethod: orderPayMethod,
        shippingAddress: orderShippingAddr.trim() || `${bookingZone}, Mumbai`,
        clusterZone: bookingZone,
        status: 'Placed',
        paymentStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (paymentRef) {
        orderPayload.paymentReference = paymentRef;
      }

      await addDoc(collection(db, 'orders'), orderPayload);
      const earnedPts = Math.max(2, Math.floor(totalAmount / 100));
      await awardLoyaltyPoints(earnedPts);

      await createNotification(
        selectedProduct.ownerId,
        'New Product Order',
        `${qty}x ${selectedProduct.name} ordered from ${bookingZone} (${formatINR(totalAmount)}).`,
        'booking'
      );
      setSelectedProduct(null);
      setStatusMsg(`Product order placed (${formatINR(totalAmount)} · +${earnedPts} Loyalty Pts).`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'orders');
    }
  };

  const handleSendEnquiry = async () => {
    if (!selectedProduct || !enquiryMsg.trim()) return;
    try {
      await addDoc(collection(db, 'enquiries'), {
        customerId: user.uid,
        customerName: userAccount?.displayName || 'Customer',
        shopId: selectedProduct.shopId,
        shopOwnerId: selectedProduct.ownerId,
        productId: selectedProduct.id,
        message: enquiryMsg.trim(),
        status: 'Open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setEnquiryMsg('');
      setStatusMsg('Enquiry sent to shopkeeper.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'enquiries');
    }
  };

  const handleSubmitPaymentRef = async (
    kind: 'booking' | 'order',
    id: string,
    amount: number,
    commissionAmount: number
  ) => {
    const utr = (utrInputs[id] || '').trim();
    if (utr.length < 4) {
      setStatusMsg('Enter a valid UPI / Bank UTR transaction reference (at least 4 characters).');
      return;
    }
    try {
      await updateDoc(doc(db, kind === 'booking' ? 'bookings' : 'orders', id), {
        paymentStatus: 'Pending Verification',
        paymentReference: utr,
        updatedAt: serverTimestamp(),
      });
      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        userName: userAccount?.displayName || 'Customer',
        txType: kind === 'booking' ? 'booking_payment' : 'order_payment',
        amount,
        commissionAmount,
        referenceId: id,
        utrReference: utr,
        status: 'Pending Verification',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setStatusMsg('Payment UTR submitted for verification.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${kind}s/${id}`);
    }
  };

  const handleSubmitReview = async (booking: ServiceBooking) => {
    const rev = reviewInputs[booking.id] || { rating: 5, text: '' };
    const rating = Math.min(5, Math.max(1, Math.round(rev.rating || 5)));
    const reviewText = rev.text.trim().slice(0, 500);

    if (!reviewText) {
      setStatusMsg('Please write a brief review alongside your star rating.');
      return;
    }

    setSubmittingReviewId(booking.id);
    setStatusMsg(null);
    try {
      const existingTechReviews = technicianReviews.filter(
        (r) => r.technicianId === booking.technicianId && r.id !== booking.id
      );
      const targetTech = technicians.find(
        (t) => t.id === booking.technicianId || t.ownerId === booking.technicianId
      );

      let newCount = existingTechReviews.length + 1;
      let newAvg = rating;
      if (existingTechReviews.length > 0) {
        const sum = existingTechReviews.reduce((acc, r) => acc + r.rating, 0) + rating;
        newAvg = Number((sum / newCount).toFixed(2));
      } else if (targetTech && (targetTech.ratingCount ?? 0) > 0) {
        newCount = (targetTech.ratingCount ?? 0) + 1;
        const prevTotal = (targetTech.ratingAvg ?? rating) * (targetTech.ratingCount ?? 0);
        newAvg = Number(((prevTotal + rating) / newCount).toFixed(2));
      }

      const batch = writeBatch(db);
      batch.update(doc(db, 'bookings', booking.id), {
        rating,
        reviewText,
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'technicianReviews', booking.id), {
        bookingId: booking.id,
        technicianId: booking.technicianId,
        technicianName: booking.technicianName,
        customerId: user.uid,
        customerName: userAccount?.displayName || user.displayName || 'Customer',
        skillCategory: booking.skillCategory,
        clusterZone: booking.clusterZone,
        rating,
        reviewText,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (targetTech) {
        batch.update(doc(db, 'technicians', targetTech.id), {
          ratingAvg: Math.min(5, Math.max(1, newAvg)),
          ratingCount: newCount,
          lastReviewBookingId: booking.id,
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();

      await createNotification(
        booking.technicianId,
        `New ${rating}-Star Customer Review`,
        `${userAccount?.displayName || 'A customer'} rated your ${booking.skillCategory} work ${rating}/5: "${reviewText.slice(0, 90)}"`,
        'booking'
      );

      setReviewInputs((prev) => {
        const next = { ...prev };
        delete next[booking.id];
        return next;
      });
      setStatusMsg('Thank you! Your star rating and review are now live on the technician profile.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `technicianReviews/${booking.id}`);
    } finally {
      setSubmittingReviewId(null);
    }
  };

  const handleSubmitComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'complaints'), {
        reporterId: user.uid,
        reporterName: userAccount?.displayName || 'Customer',
        reporterRole: 'customer',
        subject: compSubject.trim(),
        description: compDesc.trim(),
        status: 'Open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setCompSubject('');
      setCompDesc('');
      setStatusMsg('Complaint submitted to Administrator Dispute Desk.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'complaints');
    }
  };

  const handleConsultSupport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportPrompt.trim()) return;
    setSupportBusy(true);
    try {
      const res = await fetch('/api/ai/support-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentRole: supportChannel,
          message: supportPrompt.trim(),
          clusterZone: bookingZone,
          userRole: 'customer',
        }),
      });
      const data = await res.json();
      setSupportReply(data.reply || data.error || 'Unable to reach AI Support Desk.');
    } catch {
      setSupportReply('Network error reaching AI Support Desk.');
    } finally {
      setSupportBusy(false);
    }
  };

  const visibleTechs = matchedTechs.length > 0 ? matchedTechs : technicians.filter((t) => t.availabilityStatus === 'Available');

  return (
    <div className="space-y-8 pb-12">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-2xl font-bold text-slate-900">{t.customer.hubTitle}</h2>
        <p className="text-sm text-slate-600">
          {t.customer.hubSub}
        </p>
      </div>

      {statusMsg && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900">
          {statusMsg}
        </div>
      )}

      {/* Wallet, Loyalty Rewards & Maintenance Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Digital Wallet
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              Spent: {formatINR(wallet?.totalSpent ?? 0)}
            </span>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatINR(wallet?.balance ?? 0)}
          </div>
          <form onSubmit={handleWalletTopup} className="grid grid-cols-12 gap-1.5 pt-1">
            <input
              type="number"
              min={50}
              max={50000}
              value={walletTopupAmt}
              onChange={(e) => setWalletTopupAmt(e.target.value)}
              aria-label="Wallet top-up amount"
              className="col-span-3 rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-mono"
            />
            <select
              value={walletTopupMethod}
              onChange={(e) => setWalletTopupMethod(e.target.value as 'UPI' | 'Card')}
              aria-label="Top-up method"
              className="col-span-3 rounded-lg border border-slate-300 bg-white px-1.5 py-1.5 text-xs"
            >
              <option value="UPI">UPI</option>
              <option value="Card">Card</option>
            </select>
            <input
              type="text"
              value={walletTopupRef}
              onChange={(e) => setWalletTopupRef(e.target.value)}
              placeholder="UTR / Ref"
              aria-label="Payment reference"
              className="col-span-3 rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-mono"
            />
            <button
              type="submit"
              disabled={walletBusy}
              className="col-span-3 rounded-lg bg-slate-900 px-2 py-1.5 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap"
            >
              {walletBusy ? '...' : 'Add'}
            </button>
          </form>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Loyalty Rewards ({rewards?.tier || 'Silver'})
              </span>
            </div>
            <button
              type="button"
              onClick={() => rewardsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="text-xs font-medium text-amber-700 hover:underline whitespace-nowrap"
            >
              My Rewards
            </button>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {rewards?.pointsBalance ?? 0} <span className="text-sm font-normal text-slate-500">pts</span>
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums">
            Earned {rewards?.lifetimeEarned ?? 0} · Redeemed {rewards?.lifetimeRedeemed ?? 0} · 1 pt = ₹1 off booking
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Service &amp; Maintenance
              </span>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {myBookings.length} bookings
            </span>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {maintenanceReminders.filter((r) => r.isOverdue || r.daysUntilDue <= 14).length}{' '}
            <span className="text-sm font-normal text-slate-500">due reminders</span>
          </div>
          <div className="text-xs text-slate-500">
            {maintenanceReminders[0]
              ? `Next: ${maintenanceReminders[0].skillCategory} (${maintenanceReminders[0].nextDueDate})`
              : 'Complete a booking to activate preventive schedules.'}
          </div>
        </div>
      </div>

      {/* AI Booking Manager: Cluster Smart Search */}
      <section ref={bookingSectionRef} className="rounded-xl border border-slate-200 bg-white p-6 space-y-4 scroll-mt-24">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{t.customer.findTechsTitle}</h3>
            <p className="text-xs text-slate-500">
              {t.customer.findTechsSub}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={bookingZone}
              onChange={(e) => setBookingZone(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
            >
              {zones.map((z) => (
                <option key={z.id} value={z.name}>
                  {z.name}
                </option>
              ))}
            </select>
            <select
              value={bookingSkill}
              onChange={(e) => setBookingSkill(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
            >
              {SKILL_CATEGORIES.map((s) => (
                <option key={s} value={s}>
                  {translateSkillCategory(s, language)}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={matchLoading}
              onClick={handleFindSmartMatches}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
            >
              <Search className="w-3.5 h-3.5" />
              {matchLoading ? t.customer.matching : t.customer.matchTechsBtn}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {visibleTechs.slice(0, 6).map((tech) => {
            const techRevs = reviewsByTech.get(tech.id) || reviewsByTech.get(tech.ownerId) || [];
            const reviewCount = Math.max(techRevs.length, tech.ratingCount ?? 0);
            const avgRating =
              techRevs.length > 0
                ? techRevs.reduce((s, r) => s + r.rating, 0) / techRevs.length
                : tech.ratingAvg ?? 0;
            const latestRev = techRevs[0];
            const nextFree = findNextFreeSlot(tech.busySlots || [], bookings, tech.ownerId);
            return (
              <div key={tech.id} className="rounded-xl border border-slate-200 p-4 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs text-slate-500">
                      {tech.skillCategory} · {tech.clusterZone} · {tech.workingRadiusKm} km
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        toggleFavorite({
                          targetType: 'technician',
                          targetId: tech.id,
                          targetName: tech.fullName,
                          category: tech.skillCategory,
                          clusterZone: tech.clusterZone,
                        })
                      }
                      aria-pressed={savedSet.has(`technician_${tech.id}`)}
                      aria-label={
                        savedSet.has(`technician_${tech.id}`)
                          ? `Remove ${tech.fullName} from saved`
                          : `Save ${tech.fullName} to favorites`
                      }
                      className={`min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-lg border shrink-0 transition-colors ${
                        savedSet.has(`technician_${tech.id}`)
                          ? 'border-amber-300 bg-amber-50 text-amber-700'
                          : 'border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <Bookmark
                        className={`w-3.5 h-3.5 ${
                          savedSet.has(`technician_${tech.id}`) ? 'fill-amber-500 text-amber-600' : ''
                        }`}
                      />
                    </button>
                  </div>
                  <div className="font-semibold text-slate-900">{tech.fullName}</div>
                  <div className="text-xs text-slate-600 font-mono tabular-nums flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="inline-flex items-center gap-1">
                      <Star className={`w-3 h-3 ${reviewCount > 0 ? 'fill-amber-400 text-amber-500' : 'text-slate-400'}`} />
                      {avgRating.toFixed(1)} ({reviewCount})
                    </span>
                    <span>·</span>
                    <span>{tech.experienceYears} yrs</span>
                    <span>·</span>
                    <span>{formatINR(tech.expectedCharge)}</span>
                  </div>
                  <div className="text-[11px] text-emerald-700 font-mono tabular-nums inline-flex items-center gap-1">
                    <Calendar className="w-3 h-3 shrink-0" />
                    <span>Next free: {formatSlotDisplay(nextFree.isoDate, nextFree.slotId)}</span>
                  </div>
                  {latestRev?.reviewText && (
                    <p className="text-xs text-slate-600 italic line-clamp-2 pt-1">
                      &ldquo;{latestRev.reviewText}&rdquo; — {latestRev.customerName}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleChooseTech(tech)}
                  className="min-h-[38px] rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-slate-50"
                >
                  {t.customer.viewSlotsBook}
                </button>
              </div>
            );
          })}
        </div>

        {selectedTech && (
          <form onSubmit={handleConfirmBooking} className="rounded-xl border border-amber-300 bg-amber-50/40 p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">
                  Book {selectedTech.fullName} ({selectedTech.skillCategory})
                </h4>
                <p className="text-xs text-slate-600">
                  Pick any Free slot from {selectedTech.fullName}&rsquo;s weekly schedule below.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTech(null)}
                className="min-h-[36px] rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>

            <WeeklyAvailabilityCalendar
              mode="customer"
              busySlots={selectedTech.busySlots || []}
              bookedSlots={getBookedSlotSet(bookings, selectedTech.ownerId)}
              selectedDate={scheduledDate}
              selectedSlot={scheduledSlot}
              onSelectSlot={(isoDate, slotId) => {
                setScheduledDate(isoDate);
                setScheduledSlot(slotId);
              }}
              disabledReason={
                selectedTech.availabilityStatus !== 'Available'
                  ? `Technician status is currently ${selectedTech.availabilityStatus}. Choose another technician or try later.`
                  : null
              }
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-slate-700 mb-1">Selected Service Window</label>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono tabular-nums text-slate-900">
                  {formatSlotDisplay(scheduledDate, scheduledSlot)}
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-700 mb-1">Estimated Duration (Hours)</label>
                <select
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(Number(e.target.value) || 1)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono tabular-nums"
                >
                  {[1, 2, 3, 4, 5, 6, 8].map((h) => (
                    <option key={h} value={h}>
                      {h} {h === 1 ? 'Hour' : 'Hours'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-700 mb-1">Payment Method</label>
                <select
                  value={bookingPayMethod}
                  onChange={(e) => setBookingPayMethod(e.target.value as 'UPI' | 'Wallet' | 'Card')}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
                >
                  <option value="UPI">UPI / QR</option>
                  <option value="Wallet">Wallet ({formatINR(wallet?.balance ?? 0)})</option>
                  <option value="Card">Debit / Credit Card</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-700 mb-1">Request Priority</label>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-lg border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setBookingPriority('Standard')}
                    aria-pressed={bookingPriority === 'Standard'}
                    className={`min-h-[30px] rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                      bookingPriority === 'Standard'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBookingPriority('Urgent');
                      const earliest = findNextFreeSlot(
                        selectedTech.busySlots || [],
                        bookings,
                        selectedTech.ownerId
                      );
                      setScheduledDate(earliest.isoDate);
                      setScheduledSlot(earliest.slotId);
                    }}
                    aria-pressed={bookingPriority === 'Urgent'}
                    className={`min-h-[30px] rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                      bookingPriority === 'Urgent'
                        ? 'bg-red-600 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Urgent Today
                  </button>
                </div>
              </div>
            </div>

            {/* Live Price Preview Breakdown (Firestore Rates) */}
            {pricePreview && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-semibold text-slate-900 inline-flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5 text-amber-600" />
                    Price Preview (Live Technician Rates)
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">
                    Call-out {formatINR(pricePreview.calloutFee)} + {formatINR(pricePreview.hourlyRate)}/hr
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Minimum Call-out &amp; Inspection Fee</span>
                  <span className="font-mono tabular-nums font-medium text-slate-900">
                    {formatINR(pricePreview.calloutFee)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>
                    Estimated Labor ({pricePreview.hours}h × {formatINR(pricePreview.hourlyRate)}/hr)
                  </span>
                  <span className="font-mono tabular-nums font-medium text-slate-900">
                    {formatINR(pricePreview.hourlyRate * pricePreview.hours)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Platform Booking Fee</span>
                  <span className="font-mono tabular-nums font-medium text-slate-900">
                    {formatINR(pricePreview.bookingFee)}
                  </span>
                </div>
                {pricePreview.maxRedeemablePts > 0 && (
                  <label className="flex items-center justify-between gap-2 pt-1 text-emerald-800 cursor-pointer">
                    <span className="inline-flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={redeemLoyalty}
                        onChange={(e) => setRedeemLoyalty(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      Redeem {pricePreview.maxRedeemablePts} Loyalty Points
                    </span>
                    <span className="font-mono tabular-nums font-semibold">
                      −{formatINR(redeemLoyalty ? pricePreview.maxRedeemablePts : 0)}
                    </span>
                  </label>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
                  <span>Total Estimated Cost</span>
                  <span className="font-mono tabular-nums text-amber-700">
                    {formatINR(pricePreview.totalEstimated)}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={serviceNotes}
                onChange={(e) => setServiceNotes(e.target.value)}
                placeholder="Describe the repair or installation task..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
              />
              {bookingPayMethod !== 'Wallet' && (
                <input
                  type="text"
                  value={bookingPayRef}
                  onChange={(e) => setBookingPayRef(e.target.value)}
                  placeholder={`Optional ${bookingPayMethod} transaction / UTR reference`}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono"
                />
              )}
            </div>

            <button
              type="submit"
              disabled={selectedTech.availabilityStatus !== 'Available'}
              className="min-h-[40px] rounded-lg bg-amber-600 px-4 py-2 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {bookingPriority === 'Urgent'
                ? `Send Urgent Request (${formatINR(pricePreview?.totalEstimated ?? selectedTech.expectedCharge)})`
                : `Confirm Booking (${formatINR(pricePreview?.totalEstimated ?? selectedTech.expectedCharge)})`}
            </button>
          </form>
        )}
      </section>

      {/* Standalone Service Price Estimator */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Calculator className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-base font-semibold text-slate-900">Mumbai Service Price Estimator</h3>
              <p className="text-xs text-slate-500">
                Compare expected visit + hourly charges across registered technicians before booking.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={estSkill}
              onChange={(e) => setEstSkill(e.target.value)}
              aria-label="Estimator trade skill"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
            >
              {SKILL_CATEGORIES.map((s) => (
                <option key={s} value={s}>
                  {translateSkillCategory(s, language)}
                </option>
              ))}
            </select>
            <select
              value={estZone}
              onChange={(e) => setEstZone(e.target.value)}
              aria-label="Estimator Mumbai zone"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
            >
              {zones.map((z) => (
                <option key={z.id} value={z.name}>
                  {z.name}
                </option>
              ))}
            </select>
            <select
              value={estHours}
              onChange={(e) => setEstHours(Number(e.target.value) || 2)}
              aria-label="Estimator hours"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono"
            >
              {[1, 2, 3, 4, 6, 8].map((h) => (
                <option key={h} value={h}>
                  {h} hrs
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-slate-500">Avg. Call-out Fee</div>
            <div className="text-base font-bold font-mono tabular-nums text-slate-900 mt-0.5">
              {formatINR(estimatorStats.avgCallout)}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-slate-500">Avg. Hourly Rate</div>
            <div className="text-base font-bold font-mono tabular-nums text-slate-900 mt-0.5">
              {formatINR(estimatorStats.avgHourly)}/hr
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-slate-500">Price Range ({estHours}h)</div>
            <div className="text-base font-bold font-mono tabular-nums text-slate-900 mt-0.5">
              {formatINR(estimatorStats.minTotal)} – {formatINR(estimatorStats.maxTotal)}
            </div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
            <div className="text-amber-900 font-medium">
              Est. Total ({estimatorStats.sampleSize > 0 ? `${estimatorStats.sampleSize} pros` : 'Std ref'})
            </div>
            <div className="text-base font-bold font-mono tabular-nums text-amber-800 mt-0.5">
              {formatINR(estimatorStats.avgTotal)}
            </div>
          </div>
        </div>
      </section>

      {/* Quick Product Order / Enquiry */}
      {selectedProduct && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Order or Enquire: {selectedProduct.name} ({formatINR(selectedProduct.price)})
              </h3>
              <p className="text-xs text-slate-500">
                {(selectedProduct.memberDiscountPercent || 0) > 0
                  ? `Member Discount: ${selectedProduct.memberDiscountPercent}% off · `
                  : ''}
                {selectedProduct.shippingAvailable
                  ? `Shipping ${formatINR(selectedProduct.shippingFee || 0)} (${selectedProduct.courierPartner || 'Local Courier'} · ${selectedProduct.deliveryEta || '24-48h'})`
                  : 'Local Pickup / Shop Dispatch'}
              </p>
            </div>
            <button type="button" onClick={() => setSelectedProduct(null)} className="text-xs text-slate-500">
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <form onSubmit={handlePlaceOrder} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={selectedProduct.stock}
                  value={orderQty}
                  onChange={(e) => setOrderQty(e.target.value)}
                  className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                />
                <select
                  value={orderPayMethod}
                  onChange={(e) => setOrderPayMethod(e.target.value as 'UPI' | 'Wallet' | 'Card')}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs"
                >
                  <option value="UPI">UPI</option>
                  <option value="Wallet">Wallet</option>
                  <option value="Card">Card</option>
                </select>
                <input
                  type="text"
                  value={orderShippingAddr}
                  onChange={(e) => setOrderShippingAddr(e.target.value)}
                  placeholder="Mumbai delivery address"
                  className="flex-1 min-w-[160px] rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
              <button
                type="submit"
                className="min-h-[40px] rounded-lg bg-amber-600 px-4 py-2 text-xs font-medium text-white"
              >
                Place Order (
                {formatINR(
                  Math.max(
                    0,
                    (Number(orderQty) || 1) * selectedProduct.price -
                      Math.round(
                        (((Number(orderQty) || 1) * selectedProduct.price) *
                          (selectedProduct.memberDiscountPercent || 0)) /
                          100
                      ) +
                      (selectedProduct.shippingAvailable ? selectedProduct.shippingFee || 0 : 0)
                  )
                )}
                )
              </button>
            </form>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={enquiryMsg}
                onChange={(e) => setEnquiryMsg(e.target.value)}
                placeholder="Ask shopkeeper about bulk price or delivery..."
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
              <button
                type="button"
                onClick={handleSendEnquiry}
                className="min-h-[40px] rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white"
              >
                Send Enquiry
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Bookings & Orders Tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h3 className="text-base font-semibold text-slate-900">{t.customer.yourBookings}</h3>
          {myBookings.length === 0 ? (
            <p className="text-sm text-slate-500">No bookings yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {myBookings.map((b) => (
                <div key={b.id} className="py-3.5 space-y-2.5">
                  <div className="flex justify-between">
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        {b.technicianName} · {b.skillCategory}
                      </div>
                      <div className="text-xs text-slate-500">
                        {b.clusterZone} · {formatSlotDisplay(b.scheduledDate, b.scheduledSlot)} · Status: {b.status} · Payment: {b.paymentStatus}
                        {b.paymentMethod ? ` (${b.paymentMethod})` : ''}
                      </div>
                      {(b.estimatedHours || b.discountApplied) && (
                        <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                          {b.estimatedHours ? `${b.estimatedHours}h est.` : ''}
                          {typeof b.calloutFeeSnapshot === 'number' ? ` · Call-out ${formatINR(b.calloutFeeSnapshot)}` : ''}
                          {b.discountApplied ? ` · Saved ${formatINR(b.discountApplied)}` : ''}
                        </div>
                      )}
                    </div>
                    <div className="text-sm font-bold font-mono tabular-nums">{formatINR(b.totalAmount)}</div>
                  </div>
                  {(b.status === 'Accepted' || b.status === 'In Progress' || b.status === 'Completed' || b.progressLabel) && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 space-y-1.5">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {BOOKING_PROGRESS_STEPS.map((step, stepIdx) => {
                          const activeIdx = b.progressLabel ? BOOKING_PROGRESS_STEPS.indexOf(b.progressLabel) : -1;
                          const done = b.status === 'Completed' || (activeIdx >= 0 && stepIdx <= activeIdx);
                          return (
                            <div
                              key={step}
                              className={`rounded-md px-2 py-1 text-[11px] font-medium border ${
                                done
                                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                                  : 'border-slate-200 bg-white text-slate-500'
                              }`}
                            >
                              {step}
                            </div>
                          );
                        })}
                      </div>
                      {b.progressNote && (
                        <div className="text-xs text-slate-700">
                          Technician note: <span className="font-medium">{b.progressNote}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {b.paymentStatus === 'Unpaid' && b.status !== 'Cancelled' && b.status !== 'Rejected' && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={utrInputs[b.id] || ''}
                        onChange={(e) => setUtrInputs((prev) => ({ ...prev, [b.id]: e.target.value }))}
                        placeholder="Enter UPI UTR after payment"
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleSubmitPaymentRef('booking', b.id, b.totalAmount, b.commissionAmount)}
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                      >
                        Submit UTR
                      </button>
                    </div>
                  )}
                  {b.status === 'Completed' && (
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => setQrBooking(b)}
                        className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-slate-50 whitespace-nowrap"
                      >
                        <QrCode className="w-3.5 h-3.5 text-amber-600" />
                        <span>{t.customer.generateQrCode}</span>
                      </button>
                    </div>
                  )}
                  {b.status === 'Completed' && !b.rating && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-medium text-slate-800">
                          Service completed · Rate {b.technicianName}
                        </span>
                        <div className="flex items-center gap-0.5" role="group" aria-label={`Rate ${b.technicianName}`}>
                          {[1, 2, 3, 4, 5].map((starValue) => {
                            const currentRating = reviewInputs[b.id]?.rating ?? 5;
                            const active = starValue <= currentRating;
                            return (
                              <button
                                key={starValue}
                                type="button"
                                aria-label={`Rate ${starValue} out of 5 stars`}
                                onClick={() =>
                                  setReviewInputs((prev) => ({
                                    ...prev,
                                    [b.id]: { rating: starValue, text: prev[b.id]?.text || '' },
                                  }))
                                }
                                className="min-h-[36px] min-w-[32px] inline-flex items-center justify-center rounded hover:bg-amber-100/70 transition-colors"
                              >
                                <Star
                                  className={`w-4 h-4 ${
                                    active ? 'fill-amber-400 text-amber-500' : 'text-slate-300'
                                  }`}
                                />
                              </button>
                            );
                          })}
                          <span className="ml-1.5 text-xs font-mono tabular-nums font-semibold text-slate-700">
                            {reviewInputs[b.id]?.rating ?? 5}/5
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          maxLength={500}
                          value={reviewInputs[b.id]?.text || ''}
                          onChange={(e) =>
                            setReviewInputs((prev) => ({
                              ...prev,
                              [b.id]: { rating: prev[b.id]?.rating ?? 5, text: e.target.value },
                            }))
                          }
                          placeholder="Write a review about punctuality, workmanship, and pricing..."
                          className="flex-1 min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                        />
                        <button
                          type="button"
                          disabled={submittingReviewId === b.id}
                          onClick={() => handleSubmitReview(b)}
                          className="min-h-[40px] rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-60 whitespace-nowrap"
                        >
                          {submittingReviewId === b.id ? 'Posting...' : 'Submit Review'}
                        </button>
                      </div>
                    </div>
                  )}
                  {b.status === 'Completed' && Boolean(b.rating) && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-3.5 h-3.5 ${
                                s <= (b.rating || 0) ? 'fill-amber-400 text-amber-500' : 'text-slate-300'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs font-mono tabular-nums font-semibold text-slate-800">
                          Your rating: {b.rating}/5
                        </span>
                      </div>
                      {b.reviewText && (
                        <p className="text-xs text-slate-600">&ldquo;{b.reviewText}&rdquo;</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h3 className="text-base font-semibold text-slate-900">{t.customer.yourOrders}</h3>
          {myOrders.length === 0 ? (
            <p className="text-sm text-slate-500">No product orders yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {myOrders.map((o) => (
                <div key={o.id} className="py-3.5 space-y-2">
                  <div className="flex justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        {o.productName} × {o.quantity}
                      </div>
                      <div className="text-xs text-slate-500">
                        Status: {o.status} · Payment: {o.paymentStatus}
                        {o.paymentMethod ? ` (${o.paymentMethod})` : ''}
                      </div>
                      {(o.memberDiscountApplied || o.shippingFee || o.shippingAddress) && (
                        <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                          {o.memberDiscountApplied ? `Member Disc −${formatINR(o.memberDiscountApplied)} · ` : ''}
                          {typeof o.shippingFee === 'number' ? `Shipping ${formatINR(o.shippingFee)} · ` : ''}
                          {o.shippingAddress || o.clusterZone}
                        </div>
                      )}
                      {(o.shippingStatus || o.courierName || o.trackingId) && (
                        <div className="mt-1.5 inline-flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700">
                          <Truck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="font-semibold">{o.shippingStatus || o.status}</span>
                          {o.courierName && <span>· {o.courierName}</span>}
                          {o.trackingId && <span className="font-mono">AWB: {o.trackingId}</span>}
                        </div>
                      )}
                    </div>
                    <div className="text-sm font-bold font-mono tabular-nums shrink-0">{formatINR(o.totalAmount)}</div>
                  </div>
                  {o.paymentStatus === 'Unpaid' && o.status !== 'Cancelled' && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={utrInputs[o.id] || ''}
                        onChange={(e) => setUtrInputs((prev) => ({ ...prev, [o.id]: e.target.value }))}
                        placeholder="Enter UPI UTR reference"
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleSubmitPaymentRef('order', o.id, o.totalAmount, 0)}
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                      >
                        Submit UTR
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Service History (Past Completed Bookings, Receipt & Re-book) */}
      <section
        aria-labelledby="service-history-heading"
        className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-2.5">
            <History className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <h3 id="service-history-heading" className="text-base font-semibold text-slate-900">
                {t.customer.serviceHistoryTitle}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {t.customer.serviceHistorySub}
              </p>
            </div>
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-600">
            {completedBookings.length} ·{' '}
            <span className="font-semibold text-slate-900">
              {formatINR(completedBookings.reduce((sum, b) => sum + b.totalAmount, 0))}
            </span>
          </div>
        </div>

        {completedBookings.length === 0 ? (
          <div className="py-6 text-center space-y-1.5">
            <p className="text-sm font-medium text-slate-700">No completed services in your history yet.</p>
            <p className="text-xs text-slate-500">
              Once a technician completes your booked service, it will appear here with its original receipt and a re-book option.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {completedBookings.map((b) => (
              <div
                key={b.id}
                className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <div className="text-xs text-slate-500 font-mono tabular-nums">
                    {formatSlotDisplay(b.scheduledDate, b.scheduledSlot)} · Ref #{b.id.slice(0, 8).toUpperCase()}
                  </div>
                  <div className="text-sm font-semibold text-slate-900">
                    {b.technicianName}{' '}
                    <span className="font-normal text-slate-600">
                      · {translateSkillCategory(b.skillCategory, language)} · {b.clusterZone}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                    <span className="font-mono tabular-nums font-semibold text-slate-900">
                      {formatINR(b.totalAmount)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      {b.paymentStatus}
                    </span>
                    {b.rating && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                          {b.rating}/5
                        </span>
                      </>
                    )}
                  </div>
                  {b.serviceNotes && (
                    <p className="text-xs text-slate-500 line-clamp-1">{b.serviceNotes}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setQrBooking(b)}
                    className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 hover:bg-slate-50 whitespace-nowrap"
                  >
                    <QrCode className="w-3.5 h-3.5 text-amber-600" />
                    <span>{t.customer.generateQrCode}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptBooking(b)}
                    className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-600" />
                    <span>{t.customer.viewReceipt}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRebookFromHistory(b)}
                    className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t.customer.rebook}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Saved Favorites (Technicians, Contractors & Shops) */}
      <section
        aria-labelledby="saved-bookmarks-heading"
        className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-2.5">
            <Bookmark className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <h3 id="saved-bookmarks-heading" className="text-base font-semibold text-slate-900">
                {t.customer.savedTitle}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {t.customer.savedSub}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 w-fit">
            {(
              [
                ['all', `${t.customer.savedAll} (${savedFavorites.length})`],
                ['technician', `${t.marketplace.tabTechnicians} (${savedFavorites.filter((f) => f.targetType === 'technician').length})`],
                ['contractor', `${t.marketplace.tabContractors} (${savedFavorites.filter((f) => f.targetType === 'contractor').length})`],
                ['shop', `${t.marketplace.tabShops} (${savedFavorites.filter((f) => f.targetType === 'shop').length})`],
              ] as const
            ).map(([tabKey, tabLabel]) => (
              <button
                key={tabKey}
                type="button"
                onClick={() => setSavedFilter(tabKey)}
                className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  savedFilter === tabKey
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tabLabel}
              </button>
            ))}
          </div>
        </div>

        {filteredSaved.length === 0 ? (
          <div className="py-6 text-center space-y-2.5">
            <p className="text-sm font-medium text-slate-700">
              {savedFavorites.length === 0
                ? 'No saved technicians, contractors, or shops yet.'
                : `No saved ${savedFilter}s in this filter.`}
            </p>
            <p className="text-xs text-slate-500">
              Tap the bookmark icon on any technician, contractor, or shop card to save them here.
            </p>
            {onOpenMarketplaceFeed && (
              <button
                type="button"
                onClick={() =>
                  onOpenMarketplaceFeed(
                    savedFilter === 'contractor'
                      ? 'contractors'
                      : savedFilter === 'shop'
                        ? 'shops'
                        : 'technicians'
                  )
                }
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50"
              >
                {t.customer.savedBrowseDir}
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredSaved.map((fav) => {
              const liveTech =
                fav.targetType === 'technician'
                  ? technicians.find((t) => t.id === fav.targetId || t.ownerId === fav.targetId)
                  : undefined;
              const liveContractor =
                fav.targetType === 'contractor'
                  ? contractors.find((c) => c.id === fav.targetId || c.ownerId === fav.targetId)
                  : undefined;
              const liveShop =
                fav.targetType === 'shop'
                  ? shops.find((s) => s.id === fav.targetId || s.ownerId === fav.targetId)
                  : undefined;

              const TypeIcon =
                fav.targetType === 'technician'
                  ? Wrench
                  : fav.targetType === 'contractor'
                    ? Building2
                    : ShoppingBag;

              const displayName =
                liveTech?.fullName || liveContractor?.companyName || liveShop?.shopName || fav.targetName;
              const displayZone =
                liveTech?.clusterZone || liveContractor?.clusterZone || liveShop?.clusterZone || fav.clusterZone;
              const displayCategory =
                liveTech?.skillCategory ||
                liveContractor?.specialization ||
                (liveShop ? `${liveShop.sellerPlan} Plan` : fav.category || fav.targetType);

              return (
                <div
                  key={fav.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0">
                      <TypeIcon className="w-4 h-4 text-slate-700" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="text-xs text-slate-500 capitalize">
                        {fav.targetType} · {displayCategory} · {displayZone}
                      </div>
                      <div className="text-sm font-semibold text-slate-900 truncate">{displayName}</div>
                      {liveTech && (
                        <div className="text-xs font-mono tabular-nums text-slate-600">
                          {translateAvailability(liveTech.availabilityStatus, language)} · {(liveTech.ratingAvg ?? 0).toFixed(1)} stars ·{' '}
                          {formatINR(liveTech.expectedCharge)}
                        </div>
                      )}
                      {liveContractor && (
                        <div className="text-xs font-mono tabular-nums text-slate-600">
                          {liveContractor.packageTier} tier · {liveContractor.contactName}
                        </div>
                      )}
                      {liveShop && (
                        <div className="text-xs text-slate-600 truncate">
                          {liveShop.address} · {liveShop.ownerName}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {fav.targetType === 'technician' && liveTech && (
                      <button
                        type="button"
                        onClick={() => {
                          handleChooseTech(liveTech);
                          setTimeout(() => {
                            bookingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }, 50);
                        }}
                        className="min-h-[38px] rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap"
                      >
                        {t.customer.viewSlotsBook}
                      </button>
                    )}
                    {fav.targetType === 'contractor' && onOpenMarketplaceFeed && (
                      <button
                        type="button"
                        onClick={() => onOpenMarketplaceFeed('projects', displayName)}
                        className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                      >
                        {t.marketplace.viewProjects}
                      </button>
                    )}
                    {fav.targetType === 'shop' && onOpenMarketplaceFeed && (
                      <button
                        type="button"
                        onClick={() => onOpenMarketplaceFeed('products', displayName)}
                        className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                      >
                        {t.marketplace.browseProducts}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        toggleFavorite({
                          targetType: fav.targetType,
                          targetId: fav.targetId,
                          targetName: displayName,
                          category: displayCategory,
                          clusterZone: displayZone,
                        })
                      }
                      aria-label={`Remove ${displayName} from saved`}
                      className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* My Rewards & Recurring Maintenance Reminders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section
          ref={rewardsSectionRef}
          className="rounded-xl border border-slate-200 bg-white p-6 space-y-4 scroll-mt-24"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-amber-600" />
              <div>
                <h3 className="text-base font-semibold text-slate-900">My Rewards &amp; Loyalty Tier</h3>
                <p className="text-xs text-slate-500">
                  Earn +10 pts per service booking &amp; redeem directly on future estimates.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-semibold text-amber-700">
              {rewards?.tier || 'Silver'} Member
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-slate-500">Available Points</div>
              <div className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                {rewards?.pointsBalance ?? 0}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-slate-500">Lifetime Earned</div>
              <div className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                {rewards?.lifetimeEarned ?? 0}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-slate-500">Lifetime Redeemed</div>
              <div className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                {rewards?.lifetimeRedeemed ?? 0}
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-600">
            Reach <span className="font-mono font-semibold">250</span> lifetime pts for Gold and{' '}
            <span className="font-mono font-semibold">750</span> pts for Platinum status.
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <BellRing className="w-5 h-5 text-emerald-700" />
              <div>
                <h3 className="text-base font-semibold text-slate-900">Recurring Maintenance Reminders</h3>
                <p className="text-xs text-slate-500">
                  Preventive service alerts calculated from your past bookings.
                </p>
              </div>
            </div>
          </div>
          {maintenanceReminders.length === 0 ? (
            <p className="text-xs text-slate-500">
              No completed bookings yet. Once an AC, RO, Electrical, or Automotive service is booked, your next preventive cycle appears here.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {maintenanceReminders.slice(0, 4).map((rem) => (
                <div key={rem.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-slate-900">
                      {rem.skillCategory} ·{' '}
                      <span className={rem.isOverdue ? 'text-red-600' : 'text-emerald-700'}>
                        {rem.isOverdue ? `Overdue since ${rem.nextDueDate}` : `Due ${rem.nextDueDate}`}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">{rem.recommendedAction}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
                          Notification.requestPermission().then((perm) => {
                            if (perm === 'granted') triggerMaintenanceBrowserAlert(rem);
                          });
                        } else {
                          const sent = triggerMaintenanceBrowserAlert(rem);
                          setStatusMsg(
                            sent
                              ? `Browser reminder sent for ${rem.skillCategory}.`
                              : `Next ${rem.skillCategory} checkup scheduled on ${rem.nextDueDate}.`
                          );
                        }
                      }}
                      className="min-h-[34px] rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                    >
                      Alert Me
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBookingSkill(rem.skillCategory);
                        setBookingZone(rem.clusterZone);
                        bookingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className="min-h-[34px] rounded-lg bg-slate-900 px-3 py-1 text-[11px] font-medium text-white hover:bg-slate-800 whitespace-nowrap"
                    >
                      Re-book Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Help & Support FAQ Accordion */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <HelpCircle className="w-5 h-5 text-amber-600" />
          <div>
            <h3 className="text-base font-semibold text-slate-900">Help &amp; Support FAQs</h3>
            <p className="text-xs text-slate-500">
              Quick answers on Price Preview estimates, Wallet payments, verified technicians, and courier orders.
            </p>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {[
            {
              q: 'How is the Price Preview total calculated before I confirm a booking?',
              a: 'Your Price Preview combines the technician’s live Call-out & Inspection Fee, Hourly Rate multiplied by your estimated hours, and the standard platform booking fee—minus any Loyalty Points you choose to redeem.',
            },
            {
              q: 'How can I use Wallet, UPI, or Card for service and product checkouts?',
              a: 'Top up your Digital Wallet in seconds using your UPI UTR or Card reference, or pay directly at checkout. Every Wallet transaction records a verifiable receipt in Firebase.',
            },
            {
              q: 'What do Grade A / B / C technician ratings mean?',
              a: 'Every registered specialist submits credentials and practical assessments reviewed by All in One Skill admins. Grade A indicates Master Senior expertise, Grade B Verified Specialist, and Grade C Field Apprentice.',
            },
            {
              q: 'How do I track courier deliveries from Mumbai hardware & parts shopkeepers?',
              a: 'Once a shopkeeper dispatches your order, your Orders tracker displays live courier status (Packed, Shipped, In Transit, Out for Delivery, Delivered) along with the courier partner name and tracking ID.',
            },
          ].map((faq, idx) => {
            const isOpen = openFaqIdx === idx;
            return (
              <div key={faq.q} className="py-2.5">
                <button
                  type="button"
                  onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-3 text-left text-xs font-semibold text-slate-900 py-1"
                >
                  <span>{faq.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                </button>
                {isOpen && <p className="text-xs text-slate-600 pt-1.5 leading-relaxed">{faq.a}</p>}
              </div>
            );
          })}
        </div>
      </section>

      {/* AI Support Desk & Complaints */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-amber-600" />
              <h3 className="text-base font-semibold text-slate-900">{t.customer.aiSupportTitle}</h3>
            </div>
            <select
              value={supportChannel}
              onChange={(e) => setSupportChannel(e.target.value as 'AI Customer Support' | 'AI Call Center')}
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs"
            >
              <option value="AI Customer Support">AI Customer Support</option>
              <option value="AI Call Center">AI Call Center</option>
            </select>
          </div>
          <form onSubmit={handleConsultSupport} className="space-y-3">
            <textarea
              rows={2}
              value={supportPrompt}
              onChange={(e) => setSupportPrompt(e.target.value)}
              placeholder="Ask about booking status, Mumbai cluster availability, or dispute steps..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={supportBusy}
              className="min-h-[40px] rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
            >
              {supportBusy ? t.auth.connecting : t.customer.askAiSupport}
            </button>
          </form>
          {supportReply && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-800">
              {supportReply}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-slate-700" />
            <h3 className="text-base font-semibold text-slate-900">{t.customer.complaintTitle}</h3>
          </div>
          <form onSubmit={handleSubmitComplaint} className="space-y-3">
            <input
              type="text"
              required
              value={compSubject}
              onChange={(e) => setCompSubject(e.target.value)}
              placeholder="Complaint subject (e.g. Late arrival, quality issue)"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <textarea
              rows={2}
              required
              value={compDesc}
              onChange={(e) => setCompDesc(e.target.value)}
              placeholder="Provide booking or order details..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="min-h-[40px] rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-900 hover:bg-slate-50"
            >
              {t.customer.submitComplaint} ({myComplaints.length})
            </button>
          </form>
        </section>
      </div>

      {/* Original Service Receipt Modal */}
      {receiptBooking && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Original service receipt for booking ${receiptBooking.id}`}
        >
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-mono tabular-nums text-slate-500">
                  All in One Skill · Original Service Receipt
                </div>
                <h4 className="text-lg font-bold text-slate-900 mt-0.5">
                  Booking #{receiptBooking.id.slice(0, 10).toUpperCase()}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setReceiptBooking(null)}
                aria-label="Close receipt modal"
                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-slate-500">Service Date &amp; Window</div>
                  <div className="font-mono tabular-nums font-medium text-slate-900 mt-0.5">
                    {formatSlotDisplay(receiptBooking.scheduledDate, receiptBooking.scheduledSlot)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Mumbai Cluster</div>
                  <div className="font-medium text-slate-900 mt-0.5">{receiptBooking.clusterZone}</div>
                </div>
                <div>
                  <div className="text-slate-500">Service Provider</div>
                  <div className="font-semibold text-slate-900 mt-0.5">{receiptBooking.technicianName}</div>
                </div>
                <div>
                  <div className="text-slate-500">Trade Category</div>
                  <div className="font-medium text-slate-900 mt-0.5">{receiptBooking.skillCategory}</div>
                </div>
                <div>
                  <div className="text-slate-500">Customer</div>
                  <div className="font-medium text-slate-900 mt-0.5">{receiptBooking.customerName}</div>
                </div>
                <div>
                  <div className="text-slate-500">Payment Status</div>
                  <div className="font-medium text-slate-900 mt-0.5">
                    {receiptBooking.paymentStatus}
                    {receiptBooking.paymentReference ? ` · UTR ${receiptBooking.paymentReference}` : ''}
                  </div>
                </div>
              </div>

              {receiptBooking.serviceNotes && (
                <div className="border-t border-slate-100 pt-3 text-xs">
                  <span className="text-slate-500">Work Description: </span>
                  <span className="text-slate-800">{receiptBooking.serviceNotes}</span>
                </div>
              )}

              <div className="border-t border-slate-200 pt-3 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Technician Service Charge</span>
                  <span className="font-mono tabular-nums font-medium text-slate-900">
                    {formatINR(receiptBooking.serviceCharge)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Platform Booking Fee</span>
                  <span className="font-mono tabular-nums font-medium text-slate-900">
                    {formatINR(receiptBooking.bookingFee)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
                  <span>Total Amount</span>
                  <span className="font-mono tabular-nums">{formatINR(receiptBooking.totalAmount)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Receipt</span>
              </button>
              <div className="flex flex-wrap items-center gap-2">
                {receiptBooking.status === 'Completed' && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = receiptBooking;
                      setReceiptBooking(null);
                      setQrBooking(target);
                    }}
                    className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 hover:bg-slate-100"
                  >
                    <QrCode className="w-3.5 h-3.5 text-amber-600" />
                    <span>{t.customer.generateQrCode}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const target = receiptBooking;
                    setReceiptBooking(null);
                    handleRebookFromHistory(target);
                  }}
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Re-book Provider</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Service Payment UPI QR Code Modal */}
      {qrBooking && (
        <ServicePaymentQrModal
          booking={
            myBookings.find((item) => item.id === qrBooking.id) || qrBooking
          }
          technician={
            technicians.find(
              (tech) => tech.id === qrBooking.technicianId || tech.ownerId === qrBooking.technicianId
            ) || null
          }
          utrValue={utrInputs[qrBooking.id] || ''}
          onChangeUtr={(val) =>
            setUtrInputs((prev) => ({
              ...prev,
              [qrBooking.id]: val,
            }))
          }
          onSubmitUtr={() =>
            handleSubmitPaymentRef(
              'booking',
              qrBooking.id,
              qrBooking.totalAmount,
              qrBooking.commissionAmount
            )
          }
          onClose={() => setQrBooking(null)}
        />
      )}
    </div>
  );
};
