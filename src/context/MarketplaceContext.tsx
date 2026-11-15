import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  ConfirmationResult,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import {
  ADMIN_EMAIL,
  DEFAULT_PLATFORM_CONFIG,
  MUMBAI_INITIAL_CLUSTERS,
} from '../lib/constants';
import { handleFirestoreError, OperationType } from '../lib/firestoreError';
import type {
  AIDecisionProposal,
  AppNotification,
  CartItem,
  Complaint,
  ContractorProfile,
  Enquiry,
  PlatformConfig,
  Product,
  ProductOrder,
  ProjectRequirement,
  RevenueTransaction,
  SavedFavorite,
  SavedFavoriteType,
  ServiceBooking,
  ShopProfile,
  TechnicianCredential,
  TechnicianProfile,
  TechnicianReview,
  TechnicianTestAttempt,
  UserAccount,
  UserPrivatePII,
  UserRewards,
  UserRole,
  UserWallet,
  WorkforceHire,
  ZoneCluster,
} from '../types';

interface MarketplaceContextValue {
  user: User | null;
  authReady: boolean;
  userAccount: UserAccount | null;
  userPII: UserPrivatePII | null;
  isAdmin: boolean;
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;

  // Catalogs & Config
  zones: ZoneCluster[];
  platformConfig: PlatformConfig;
  technicians: TechnicianProfile[];
  shops: ShopProfile[];
  products: Product[];
  contractors: ContractorProfile[];
  projects: ProjectRequirement[];

  // User-scoped / Admin live streams
  bookings: ServiceBooking[];
  orders: ProductOrder[];
  hires: WorkforceHire[];
  enquiries: Enquiry[];
  complaints: Complaint[];
  notifications: AppNotification[];
  transactions: RevenueTransaction[];
  aiDecisions: AIDecisionProposal[];
  allUsers: UserAccount[];
  technicianTests: TechnicianTestAttempt[];
  technicianCredentials: TechnicianCredential[];
  technicianReviews: TechnicianReview[];
  savedFavorites: SavedFavorite[];
  wallet: UserWallet | null;
  rewards: UserRewards | null;
  cart: CartItem[];

  // Auth helpers
  signInWithGoogle: (preferredRole?: UserRole, clusterZone?: string) => Promise<void>;
  sendPhoneOtp: (phoneE164: string, recaptchaContainerId: string) => Promise<ConfirmationResult>;
  confirmPhoneOtp: (
    confirmation: ConfirmationResult,
    otpCode: string,
    displayName: string,
    preferredRole: UserRole,
    clusterZone: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  updateUserRoleAndZone: (role: UserRole, clusterZone: string, displayName?: string) => Promise<void>;
  savePrivatePII: (pii: Partial<UserPrivatePII>) => Promise<void>;
  toggleFavorite: (item: {
    targetType: SavedFavoriteType;
    targetId: string;
    targetName: string;
    category?: string;
    clusterZone: string;
  }) => Promise<boolean>;
  createNotification: (
    recipientId: string,
    title: string,
    body: string,
    category: AppNotification['category'],
    channel?: AppNotification['channel']
  ) => Promise<void>;
  addToWallet: (amount: number, method: 'UPI' | 'Card', referenceCode: string) => Promise<void>;
  payWithWallet: (amount: number, referenceLabel: string) => Promise<string>;
  awardLoyaltyPoints: (points: number) => Promise<void>;
  redeemLoyaltyPoints: (points: number) => Promise<number>;
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartQty: (productId: string, quantity: number) => void;
  clearCart: () => void;
  checkoutCart: (params: {
    paymentMethod: 'UPI' | 'Wallet' | 'Card';
    shippingAddress: string;
    utrReference?: string;
    applyMemberDiscount?: boolean;
  }) => Promise<number>;
}

const MarketplaceContext = createContext<MarketplaceContextValue | null>(null);

export const MarketplaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [userPII, setUserPII] = useState<UserPrivatePII | null>(null);
  const [isAdminDoc, setIsAdminDoc] = useState(false);
  const [activeRole, setActiveRole] = useState<UserRole>('customer');

  const [zones, setZones] = useState<ZoneCluster[]>(
    MUMBAI_INITIAL_CLUSTERS.map((z) => ({
      id: z.id,
      name: z.name,
      city: 'Mumbai',
      state: 'Maharashtra',
      subZones: z.subZones,
      active: true,
    }))
  );
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>(DEFAULT_PLATFORM_CONFIG);
  const [technicians, setTechnicians] = useState<TechnicianProfile[]>([]);
  const [shops, setShops] = useState<ShopProfile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [contractors, setContractors] = useState<ContractorProfile[]>([]);
  const [projects, setProjects] = useState<ProjectRequirement[]>([]);

  const [customerBookings, setCustomerBookings] = useState<ServiceBooking[]>([]);
  const [techBookings, setTechBookings] = useState<ServiceBooking[]>([]);
  const [customerOrders, setCustomerOrders] = useState<ProductOrder[]>([]);
  const [shopOrders, setShopOrders] = useState<ProductOrder[]>([]);
  const [contractorHires, setContractorHires] = useState<WorkforceHire[]>([]);
  const [techHires, setTechHires] = useState<WorkforceHire[]>([]);
  const [customerEnquiries, setCustomerEnquiries] = useState<Enquiry[]>([]);
  const [shopEnquiries, setShopEnquiries] = useState<Enquiry[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [transactions, setTransactions] = useState<RevenueTransaction[]>([]);
  const [aiDecisions, setAiDecisions] = useState<AIDecisionProposal[]>([]);
  const [allUsers, setAllUsers] = useState<UserAccount[]>([]);
  const [technicianTests, setTechnicianTests] = useState<TechnicianTestAttempt[]>([]);
  const [technicianCredentials, setTechnicianCredentials] = useState<TechnicianCredential[]>([]);
  const [technicianReviews, setTechnicianReviews] = useState<TechnicianReview[]>([]);
  const [savedFavorites, setSavedFavorites] = useState<SavedFavorite[]>([]);
  const [wallet, setWallet] = useState<UserWallet | null>(null);
  const [rewards, setRewards] = useState<UserRewards | null>(null);
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('aios_cart_v1');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('aios_cart_v1', JSON.stringify(cart));
    } catch {
      // ignore storage quota errors
    }
  }, [cart]);

  const isAdmin = useMemo(() => {
    if (!user) return false;
    return isAdminDoc || (user.email === ADMIN_EMAIL && user.emailVerified);
  }, [user, isAdminDoc]);

  // Listen to Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const adminSnap = await getDoc(doc(db, 'admins', firebaseUser.uid));
          setIsAdminDoc(adminSnap.exists());
        } catch {
          setIsAdminDoc(false);
        }
      } else {
        setIsAdminDoc(false);
        setUserAccount(null);
        setUserPII(null);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Public catalog listeners
  useEffect(() => {
    const unsubs: Array<() => void> = [];

    unsubs.push(
      onSnapshot(
        collection(db, 'zones'),
        (snap) => {
          const firestoreZones = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ZoneCluster, 'id'>),
          }));
          const byName = new Map<string, ZoneCluster>();
          firestoreZones.forEach((z) => byName.set(z.name.toLowerCase(), z));

          const merged: ZoneCluster[] = [];
          MUMBAI_INITIAL_CLUSTERS.forEach((def) => {
            const match = byName.get(def.name.toLowerCase());
            if (match) {
              merged.push(match);
              byName.delete(def.name.toLowerCase());
            } else {
              merged.push({
                id: def.id,
                name: def.name,
                city: 'Mumbai',
                state: 'Maharashtra',
                subZones: def.subZones,
                active: true,
              });
            }
          });
          byName.forEach((extra) => merged.push(extra));
          setZones(merged);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'zones')
      )
    );

    unsubs.push(
      onSnapshot(
        doc(db, 'platformConfig', 'default'),
        (snap) => {
          if (snap.exists()) {
            setPlatformConfig(snap.data() as PlatformConfig);
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, 'platformConfig/default')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'technicians'),
        (snap) => setTechnicians(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TechnicianProfile, 'id'>) }))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'technicians')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'shops'),
        (snap) => setShops(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ShopProfile, 'id'>) }))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'shops')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'products'),
        (snap) => setProducts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Product, 'id'>) }))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'products')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'contractors'),
        (snap) => setContractors(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ContractorProfile, 'id'>) }))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'contractors')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'projects'),
        (snap) => setProjects(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ProjectRequirement, 'id'>) }))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'projects')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'technicianReviews'),
        (snap) => setTechnicianReviews(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TechnicianReview, 'id'>) }))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'technicianReviews')
      )
    );

    return () => unsubs.forEach((u) => u());
  }, []);

  // Bootstrap initial Mumbai zones & config when Admin logs in
  useEffect(() => {
    if (!authReady || !user || !isAdmin) return;

    (async () => {
      try {
        const cfgRef = doc(db, 'platformConfig', 'default');
        const cfgSnap = await getDoc(cfgRef);
        if (!cfgSnap.exists()) {
          await setDoc(cfgRef, {
            ...DEFAULT_PLATFORM_CONFIG,
            updatedBy: user.uid,
            updatedAt: serverTimestamp(),
          });
        }

        const existingZonesSnap = await getDocs(collection(db, 'zones'));
        const existingIds = new Set(existingZonesSnap.docs.map((d) => d.id));
        const missingClusters = MUMBAI_INITIAL_CLUSTERS.filter((c) => !existingIds.has(c.id));
        if (missingClusters.length > 0) {
          const batch = writeBatch(db);
          for (const cluster of missingClusters) {
            batch.set(doc(db, 'zones', cluster.id), {
              name: cluster.name,
              city: 'Mumbai',
              state: 'Maharashtra',
              subZones: cluster.subZones,
              active: true,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          await batch.commit();
        }
      } catch (err) {
        console.error('Admin bootstrap note:', err);
      }
    })();
  }, [authReady, user, isAdmin]);

  // Authenticated user profile + PII + operational listeners
  useEffect(() => {
    if (!authReady || !user) {
      setCustomerBookings([]);
      setTechBookings([]);
      setCustomerOrders([]);
      setShopOrders([]);
      setContractorHires([]);
      setTechHires([]);
      setCustomerEnquiries([]);
      setShopEnquiries([]);
      setComplaints([]);
      setNotifications([]);
      setTransactions([]);
      setAiDecisions([]);
      setAllUsers([]);
      setTechnicianTests([]);
      setTechnicianCredentials([]);
      setSavedFavorites([]);
      setWallet(null);
      setRewards(null);
      return;
    }

    const uid = user.uid;
    const unsubs: Array<() => void> = [];

    unsubs.push(
      onSnapshot(
        doc(db, 'users', uid),
        (snap) => {
          if (snap.exists()) {
            const acc = snap.data() as UserAccount;
            setUserAccount(acc);
            setActiveRole(isAdmin ? 'admin' : acc.role);
          } else {
            setUserAccount(null);
            if (isAdmin) setActiveRole('admin');
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, `users/${uid}`)
      )
    );

    unsubs.push(
      onSnapshot(
        doc(db, 'users', uid, 'private', 'pii'),
        (snap) => {
          if (snap.exists()) {
            setUserPII(snap.data() as UserPrivatePII);
          } else {
            setUserPII(null);
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, `users/${uid}/private/pii`)
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'notifications'), where('recipientId', '==', uid)),
        (snap) =>
          setNotifications(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AppNotification, 'id'>) }))
          ),
        (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'users', uid, 'savedFavorites'),
        (snap) =>
          setSavedFavorites(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SavedFavorite, 'id'>) }))
          ),
        (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/savedFavorites`)
      )
    );

    unsubs.push(
      onSnapshot(
        doc(db, 'users', uid, 'wallet', 'main'),
        (snap) => {
          setWallet(snap.exists() ? (snap.data() as UserWallet) : null);
        },
        (err) => handleFirestoreError(err, OperationType.GET, `users/${uid}/wallet/main`)
      )
    );

    unsubs.push(
      onSnapshot(
        doc(db, 'users', uid, 'rewards', 'main'),
        (snap) => {
          setRewards(snap.exists() ? (snap.data() as UserRewards) : null);
        },
        (err) => handleFirestoreError(err, OperationType.GET, `users/${uid}/rewards/main`)
      )
    );

    if (isAdmin) {
      unsubs.push(
        onSnapshot(
          collection(db, 'bookings'),
          (snap) => setCustomerBookings(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ServiceBooking, 'id'>) }))),
          (err) => handleFirestoreError(err, OperationType.LIST, 'bookings')
        ),
        onSnapshot(
          collection(db, 'orders'),
          (snap) => setCustomerOrders(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ProductOrder, 'id'>) }))),
          (err) => handleFirestoreError(err, OperationType.LIST, 'orders')
        ),
        onSnapshot(
          collection(db, 'hires'),
          (snap) => setContractorHires(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WorkforceHire, 'id'>) }))),
          (err) => handleFirestoreError(err, OperationType.LIST, 'hires')
        ),
        onSnapshot(
          collection(db, 'enquiries'),
          (snap) => setCustomerEnquiries(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Enquiry, 'id'>) }))),
          (err) => handleFirestoreError(err, OperationType.LIST, 'enquiries')
        ),
        onSnapshot(
          collection(db, 'complaints'),
          (snap) => setComplaints(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Complaint, 'id'>) }))),
          (err) => handleFirestoreError(err, OperationType.LIST, 'complaints')
        ),
        onSnapshot(
          collection(db, 'transactions'),
          (snap) => setTransactions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RevenueTransaction, 'id'>) }))),
          (err) => handleFirestoreError(err, OperationType.LIST, 'transactions')
        ),
        onSnapshot(
          collection(db, 'aiDecisions'),
          (snap) => setAiDecisions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AIDecisionProposal, 'id'>) }))),
          (err) => handleFirestoreError(err, OperationType.LIST, 'aiDecisions')
        ),
        onSnapshot(
          collection(db, 'users'),
          (snap) => setAllUsers(snap.docs.map((d) => d.data() as UserAccount)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'users')
        ),
        onSnapshot(
          collection(db, 'technicianTests'),
          (snap) => setTechnicianTests(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TechnicianTestAttempt, 'id'>) }))),
          (err) => handleFirestoreError(err, OperationType.LIST, 'technicianTests')
        ),
        onSnapshot(
          collection(db, 'technicianCredentials'),
          (snap) => setTechnicianCredentials(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TechnicianCredential, 'id'>) }))),
          (err) => handleFirestoreError(err, OperationType.LIST, 'technicianCredentials')
        )
      );
      setTechBookings([]);
      setShopOrders([]);
      setTechHires([]);
      setShopEnquiries([]);
    } else {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'bookings'), where('customerId', '==', uid)),
          (snap) => setCustomerBookings(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ServiceBooking, 'id'>) }))),
          (err) => handleFirestoreError(err, OperationType.LIST, 'bookings/customer')
        ),
        onSnapshot(
          query(collection(db, 'bookings'), where('technicianId', '==', uid)),
          (snap) => setTechBookings(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ServiceBooking, 'id'>) }))),
          (err) => handleFirestoreError(err, OperationType.LIST, 'bookings/technician')
        ),
        onSnapshot(
          query(collection(db, 'orders'), where('customerId', '==', uid)),
          (snap) => setCustomerOrders(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ProductOrder, 'id'>) }))),
          (err) => handleFirestoreError(err, OperationType.LIST, 'orders/customer')
        ),
        onSnapshot(
          query(collection(db, 'orders'), where('shopOwnerId', '==', uid)),
          (snap) => setShopOrders(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ProductOrder, 'id'>) }))),
          (err) => handleFirestoreError(err, OperationType.LIST, 'orders/shopOwner')
        ),
        onSnapshot(
          query(collection(db, 'hires'), where('contractorId', '==', uid)),
          (snap) => setContractorHires(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WorkforceHire, 'id'>) }))),
          (err) => handleFirestoreError(err, OperationType.LIST, 'hires/contractor')
        ),
        onSnapshot(
          query(collection(db, 'hires'), where('technicianId', '==', uid)),
          (snap) => setTechHires(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WorkforceHire, 'id'>) }))),
          (err) => handleFirestoreError(err, OperationType.LIST, 'hires/technician')
        ),
        onSnapshot(
          query(collection(db, 'enquiries'), where('customerId', '==', uid)),
          (snap) => setCustomerEnquiries(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Enquiry, 'id'>) }))),
          (err) => handleFirestoreError(err, OperationType.LIST, 'enquiries/customer')
        ),
        onSnapshot(
          query(collection(db, 'enquiries'), where('shopOwnerId', '==', uid)),
          (snap) => setShopEnquiries(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Enquiry, 'id'>) }))),
          (err) => handleFirestoreError(err, OperationType.LIST, 'enquiries/shopOwner')
        ),
        onSnapshot(
          query(collection(db, 'complaints'), where('reporterId', '==', uid)),
          (snap) => setComplaints(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Complaint, 'id'>) }))),
          (err) => handleFirestoreError(err, OperationType.LIST, 'complaints')
        ),
        onSnapshot(
          query(collection(db, 'transactions'), where('userId', '==', uid)),
          (snap) => setTransactions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RevenueTransaction, 'id'>) }))),
          (err) => handleFirestoreError(err, OperationType.LIST, 'transactions')
        ),
        onSnapshot(
          query(collection(db, 'technicianTests'), where('technicianId', '==', uid)),
          (snap) => setTechnicianTests(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TechnicianTestAttempt, 'id'>) }))),
          (err) => handleFirestoreError(err, OperationType.LIST, 'technicianTests/owner')
        ),
        onSnapshot(
          query(collection(db, 'technicianCredentials'), where('technicianId', '==', uid)),
          (snap) => setTechnicianCredentials(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TechnicianCredential, 'id'>) }))),
          (err) => handleFirestoreError(err, OperationType.LIST, 'technicianCredentials/owner')
        )
      );
    }

    return () => unsubs.forEach((u) => u());
  }, [authReady, user, isAdmin]);

  const bookings = useMemo(() => {
    const map = new Map<string, ServiceBooking>();
    [...customerBookings, ...techBookings].forEach((b) => map.set(b.id, b));
    return Array.from(map.values());
  }, [customerBookings, techBookings]);

  const orders = useMemo(() => {
    const map = new Map<string, ProductOrder>();
    [...customerOrders, ...shopOrders].forEach((o) => map.set(o.id, o));
    return Array.from(map.values());
  }, [customerOrders, shopOrders]);

  const hires = useMemo(() => {
    const map = new Map<string, WorkforceHire>();
    [...contractorHires, ...techHires].forEach((h) => map.set(h.id, h));
    return Array.from(map.values());
  }, [contractorHires, techHires]);

  const enquiries = useMemo(() => {
    const map = new Map<string, Enquiry>();
    [...customerEnquiries, ...shopEnquiries].forEach((e) => map.set(e.id, e));
    return Array.from(map.values());
  }, [customerEnquiries, shopEnquiries]);

  const ensureUserDocs = async (
    firebaseUser: User,
    role: UserRole,
    clusterZone: string,
    displayNameOverride?: string
  ) => {
    const safeRole: UserRole = role === 'admin' ? 'customer' : role;
    const ref = doc(db, 'users', firebaseUser.uid);
    const snap = await getDoc(ref);
    const name = (displayNameOverride || firebaseUser.displayName || 'Mumbai Member').slice(0, 120);

    if (!snap.exists()) {
      try {
        await setDoc(ref, {
          uid: firebaseUser.uid,
          displayName: name,
          role: safeRole,
          phoneVerified: Boolean(firebaseUser.phoneNumber),
          clusterZone: clusterZone || 'Andheri',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${firebaseUser.uid}`);
      }
    }

    const piiRef = doc(db, 'users', firebaseUser.uid, 'private', 'pii');
    const piiSnap = await getDoc(piiRef);
    if (!piiSnap.exists()) {
      try {
        await setDoc(piiRef, {
          uid: firebaseUser.uid,
          phone: firebaseUser.phoneNumber || '',
          email: firebaseUser.email || '',
          kycStatus: 'unsubmitted',
          whatsappOptIn: true,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${firebaseUser.uid}/private/pii`);
      }
    }
  };

  const signInWithGoogle = async (preferredRole: UserRole = 'customer', clusterZone = 'Andheri') => {
    const res = await signInWithPopup(auth, googleProvider);
    await ensureUserDocs(res.user, preferredRole, clusterZone);
  };

  const sendPhoneOtp = async (phoneE164: string, recaptchaContainerId: string) => {
    const verifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
      size: 'invisible',
    });
    return await signInWithPhoneNumber(auth, phoneE164, verifier);
  };

  const confirmPhoneOtp = async (
    confirmation: ConfirmationResult,
    otpCode: string,
    displayName: string,
    preferredRole: UserRole,
    clusterZone: string
  ) => {
    const cred = await confirmation.confirm(otpCode);
    await ensureUserDocs(cred.user, preferredRole, clusterZone, displayName);
  };

  const logout = async () => {
    await signOut(auth);
    setActiveRole('customer');
  };

  const updateUserRoleAndZone = async (role: UserRole, clusterZone: string, displayName?: string) => {
    if (!user) return;
    const safeRole: UserRole = role === 'admin' && !isAdmin ? 'customer' : role;
    const ref = doc(db, 'users', user.uid);
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await setDoc(
          ref,
          {
            displayName: (displayName || userAccount?.displayName || user.displayName || 'Mumbai Member').slice(0, 120),
            role: safeRole === 'admin' ? userAccount?.role || 'customer' : safeRole,
            phoneVerified: Boolean(user.phoneNumber) || Boolean(userAccount?.phoneVerified),
            clusterZone,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        await ensureUserDocs(user, safeRole, clusterZone, displayName);
      }
      setActiveRole(safeRole);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const savePrivatePII = async (pii: Partial<UserPrivatePII>) => {
    if (!user) return;
    const ref = doc(db, 'users', user.uid, 'private', 'pii');
    try {
      await setDoc(
        ref,
        {
          uid: user.uid,
          phone: pii.phone ?? userPII?.phone ?? user.phoneNumber ?? '',
          email: pii.email ?? userPII?.email ?? user.email ?? '',
          fullAddress: pii.fullAddress ?? userPII?.fullAddress ?? '',
          kycStatus: pii.kycStatus ?? userPII?.kycStatus ?? 'pending',
          aadhaarLast4: (pii.aadhaarLast4 ?? userPII?.aadhaarLast4 ?? '').slice(0, 4),
          upiOrBankRef: pii.upiOrBankRef ?? userPII?.upiOrBankRef ?? '',
          whatsappOptIn: pii.whatsappOptIn ?? userPII?.whatsappOptIn ?? true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/private/pii`);
    }
  };

  const toggleFavorite = async (item: {
    targetType: SavedFavoriteType;
    targetId: string;
    targetName: string;
    category?: string;
    clusterZone: string;
  }): Promise<boolean> => {
    if (!user) return false;
    const favId = `${item.targetType}_${item.targetId}`;
    const favRef = doc(db, 'users', user.uid, 'savedFavorites', favId);
    const alreadySaved = savedFavorites.some(
      (f) => f.id === favId || (f.targetType === item.targetType && f.targetId === item.targetId)
    );

    try {
      if (alreadySaved) {
        await deleteDoc(favRef);
      } else {
        await setDoc(favRef, {
          userId: user.uid,
          targetType: item.targetType,
          targetId: item.targetId,
          targetName: (item.targetName || 'Saved Provider').slice(0, 140),
          category: (item.category || '').slice(0, 80),
          clusterZone: (item.clusterZone || 'Andheri').slice(0, 64),
          createdAt: serverTimestamp(),
        });
      }
      return true;
    } catch (err) {
      handleFirestoreError(
        err,
        alreadySaved ? OperationType.DELETE : OperationType.CREATE,
        `users/${user.uid}/savedFavorites/${favId}`
      );
      return false;
    }
  };

  const createNotification = async (
    recipientId: string,
    title: string,
    body: string,
    category: AppNotification['category'],
    channel: AppNotification['channel'] = 'in_app'
  ) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        recipientId,
        title: title.slice(0, 140),
        body: body.slice(0, 500),
        channel,
        category,
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'notifications');
    }
  };

  const addToWallet = async (amount: number, method: 'UPI' | 'Card', referenceCode: string) => {
    if (!user) throw new Error('Sign in required');
    const cleanAmount = Math.max(0, Math.round(Number(amount) || 0));
    if (cleanAmount < 50) throw new Error('Minimum wallet top-up is ₹50.');
    const refStr = referenceCode.trim() || `WAL-${method}-${Date.now().toString().slice(-6)}`;
    const walletRef = doc(db, 'users', user.uid, 'wallet', 'main');
    const currentBalance = wallet?.balance ?? 0;
    const currentCredited = wallet?.totalCredited ?? 0;
    const currentSpent = wallet?.totalSpent ?? 0;

    await setDoc(walletRef, {
      uid: user.uid,
      balance: currentBalance + cleanAmount,
      totalCredited: currentCredited + cleanAmount,
      totalSpent: currentSpent,
      lastTransactionRef: refStr.slice(0, 120),
      updatedAt: serverTimestamp(),
    });

    await addDoc(collection(db, 'transactions'), {
      userId: user.uid,
      userName: userAccount?.displayName || user.displayName || 'Mumbai Member',
      txType: 'wallet_topup',
      amount: cleanAmount,
      commissionAmount: 0,
      referenceId: 'wallet_main',
      utrReference: refStr.slice(0, 100),
      paymentMethod: method,
      status: 'Pending Verification',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const payWithWallet = async (amount: number, referenceLabel: string): Promise<string> => {
    if (!user) throw new Error('Sign in required');
    const cleanAmount = Math.max(0, Math.round(Number(amount) || 0));
    const currentBalance = wallet?.balance ?? 0;
    if (currentBalance < cleanAmount) {
      throw new Error(`Insufficient wallet balance (${currentBalance} INR). Add funds in Customer Hub.`);
    }
    const txRef = `WAL-PAY-${Date.now().toString().slice(-8)}`;
    const walletRef = doc(db, 'users', user.uid, 'wallet', 'main');
    await setDoc(walletRef, {
      uid: user.uid,
      balance: currentBalance - cleanAmount,
      totalCredited: wallet?.totalCredited ?? currentBalance,
      totalSpent: (wallet?.totalSpent ?? 0) + cleanAmount,
      lastTransactionRef: `${referenceLabel.slice(0, 60)} (${txRef})`,
      updatedAt: serverTimestamp(),
    });

    await addDoc(collection(db, 'transactions'), {
      userId: user.uid,
      userName: userAccount?.displayName || user.displayName || 'Mumbai Member',
      txType: 'wallet_payment',
      amount: cleanAmount,
      commissionAmount: 0,
      referenceId: referenceLabel.slice(0, 128),
      utrReference: txRef,
      paymentMethod: 'Wallet',
      status: 'Pending Verification',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return txRef;
  };

  const awardLoyaltyPoints = async (points: number) => {
    if (!user) return;
    const pts = Math.max(0, Math.round(points));
    if (pts === 0) return;
    const nextLifetime = (rewards?.lifetimeEarned ?? 0) + pts;
    const nextBalance = (rewards?.pointsBalance ?? 0) + pts;
    const nextTier: UserRewards['tier'] =
      nextLifetime >= 1500 ? 'Platinum' : nextLifetime >= 500 ? 'Gold' : 'Silver';
    await setDoc(doc(db, 'users', user.uid, 'rewards', 'main'), {
      uid: user.uid,
      pointsBalance: nextBalance,
      lifetimeEarned: nextLifetime,
      lifetimeRedeemed: rewards?.lifetimeRedeemed ?? 0,
      tier: nextTier,
      updatedAt: serverTimestamp(),
    });
  };

  const redeemLoyaltyPoints = async (points: number): Promise<number> => {
    if (!user) return 0;
    const available = rewards?.pointsBalance ?? 0;
    const toRedeem = Math.max(0, Math.min(available, Math.round(points)));
    if (toRedeem === 0) return 0;
    await setDoc(doc(db, 'users', user.uid, 'rewards', 'main'), {
      uid: user.uid,
      pointsBalance: available - toRedeem,
      lifetimeEarned: rewards?.lifetimeEarned ?? available,
      lifetimeRedeemed: (rewards?.lifetimeRedeemed ?? 0) + toRedeem,
      tier: rewards?.tier ?? 'Silver',
      updatedAt: serverTimestamp(),
    });
    return toRedeem;
  };

  const addToCart = (product: Product, quantity = 1) => {
    const qty = Math.max(1, Math.min(product.stock || 99, quantity));
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.product.id === product.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          product,
          quantity: Math.min(product.stock || 99, next[idx].quantity + qty),
        };
        return next;
      }
      return [...prev, { product, quantity: qty }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((c) => c.product.id !== productId));
  };

  const updateCartQty = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((c) =>
        c.product.id === productId
          ? { ...c, quantity: Math.min(c.product.stock || 99, Math.max(1, quantity)) }
          : c
      )
    );
  };

  const clearCart = () => setCart([]);

  const checkoutCart = async ({
    paymentMethod,
    shippingAddress,
    utrReference,
    applyMemberDiscount = true,
  }: {
    paymentMethod: 'UPI' | 'Wallet' | 'Card';
    shippingAddress: string;
    utrReference?: string;
    applyMemberDiscount?: boolean;
  }): Promise<number> => {
    if (!user) throw new Error('Sign in required before checkout.');
    if (cart.length === 0) throw new Error('Your cart is empty.');

    let grandTotal = 0;
    const itemBreakdowns = cart.map((item) => {
      const subtotal = item.product.price * item.quantity;
      const discountPct = applyMemberDiscount ? item.product.memberDiscountPercent || 0 : 0;
      const discountAmt = Math.round((subtotal * discountPct) / 100);
      const shipping = item.product.shippingAvailable ? item.product.shippingFee || 0 : 0;
      const net = Math.max(0, subtotal - discountAmt + shipping);
      grandTotal += net;
      return { item, discountAmt, shipping, net };
    });

    let paymentRef = utrReference?.trim() || '';
    if (paymentMethod === 'Wallet') {
      paymentRef = await payWithWallet(grandTotal, `Cart Checkout (${cart.length} items)`);
    } else if (!paymentRef) {
      paymentRef = `${paymentMethod}-${Date.now().toString().slice(-8)}`;
    }

    for (const { item, discountAmt, shipping, net } of itemBreakdowns) {
      const orderRef = await addDoc(collection(db, 'orders'), {
        customerId: user.uid,
        customerName: userAccount?.displayName || user.displayName || 'Customer',
        shopId: item.product.shopId,
        shopOwnerId: item.product.ownerId,
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: item.product.price,
        totalAmount: net,
        memberDiscountApplied: discountAmt,
        shippingFee: shipping,
        paymentMethod,
        shippingAddress: shippingAddress.trim() || userPII?.fullAddress || userAccount?.clusterZone || 'Mumbai',
        courierName: item.product.courierPartner || 'Mumbai Local Courier',
        shippingStatus: 'Packed',
        clusterZone: item.product.clusterZone,
        status: 'Placed',
        paymentStatus: 'Pending Verification',
        paymentReference: paymentRef.slice(0, 100),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        userName: userAccount?.displayName || user.displayName || 'Customer',
        txType: 'order_payment',
        amount: net,
        commissionAmount: Math.round((net * platformConfig.bookingCommissionPercent) / 100),
        referenceId: orderRef.id,
        utrReference: paymentRef.slice(0, 100),
        paymentMethod,
        status: 'Pending Verification',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await createNotification(
        item.product.ownerId,
        'New Direct Purchase Order',
        `${item.quantity}x ${item.product.name} ordered via ${paymentMethod} (${net} INR).`,
        'booking'
      );
    }

    const earnedPts = Math.max(5, Math.floor(grandTotal / 100));
    await awardLoyaltyPoints(earnedPts);
    clearCart();
    return grandTotal;
  };

  return (
    <MarketplaceContext.Provider
      value={{
        user,
        authReady,
        userAccount,
        userPII,
        isAdmin,
        activeRole,
        setActiveRole,
        zones,
        platformConfig,
        technicians,
        shops,
        products,
        contractors,
        projects,
        bookings,
        orders,
        hires,
        enquiries,
        complaints,
        notifications,
        transactions,
        aiDecisions,
        allUsers,
        technicianTests,
        technicianCredentials,
        technicianReviews,
        savedFavorites,
        wallet,
        rewards,
        cart,
        signInWithGoogle,
        sendPhoneOtp,
        confirmPhoneOtp,
        logout,
        updateUserRoleAndZone,
        savePrivatePII,
        toggleFavorite,
        createNotification,
        addToWallet,
        payWithWallet,
        awardLoyaltyPoints,
        redeemLoyaltyPoints,
        addToCart,
        removeFromCart,
        updateCartQty,
        clearCart,
        checkoutCart,
      }}
    >
      {children}
    </MarketplaceContext.Provider>
  );
};

export function useMarketplace() {
  const ctx = useContext(MarketplaceContext);
  if (!ctx) throw new Error('useMarketplace must be used inside MarketplaceProvider');
  return ctx;
}
