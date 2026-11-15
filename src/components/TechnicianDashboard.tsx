import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  LocateFixed,
  Lock,
  Navigation,
  Shield,
  Star,
  Trash2,
  Upload,
  Wrench,
  X,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useMarketplace } from '../context/MarketplaceContext';
import { type DeviceLocationState, useDeviceLocation } from '../hooks/useDeviceLocation';
import { db } from '../lib/firebase';
import {
  AUTOMOTIVE_SUBCATEGORIES,
  BOOKING_PROGRESS_STEPS,
  formatINR,
  getExperienceCategory,
  SKILL_CATEGORIES,
  WORKING_RADII,
} from '../lib/constants';
import { formatDistanceKm, getDistanceToZoneKm } from '../lib/geo';
import { translateAvailability, translateSkillCategory } from '../lib/i18n';
import { handleFirestoreError, OperationType } from '../lib/firestoreError';
import {
  compressImageToDataUrl,
  deleteTechnicianCredentialFromStorage,
  formatFileSize,
  uploadTechnicianCredentialToStorage,
} from '../lib/mediaUpload';
import type { AvailabilityStatus, ProjectRequirement, ServiceBooking, TechnicianCredential, WorkforceHire } from '../types';
import {
  getBookedSlotSet,
  makeSlotKey,
  prunePastBusySlots,
  SERVICE_TIME_SLOTS,
} from '../lib/availability';
import { TechnicianAssessmentPanel } from './TechnicianAssessmentPanel';
import { WeeklyAvailabilityCalendar } from './WeeklyAvailabilityCalendar';
import { BillingMembershipsSection } from './BillingMembershipsSection';

interface TechnicianDashboardProps {
  onRequireAuth: () => void;
  deviceLocation?: DeviceLocationState;
}

const URGENT_NEARBY_RADIUS_KM = 5;

export const TechnicianDashboard: React.FC<TechnicianDashboardProps> = ({
  onRequireAuth,
  deviceLocation: externalLocation,
}) => {
  const {
    user,
    userAccount,
    userPII,
    zones,
    technicians,
    technicianReviews,
    projects,
    bookings,
    hires,
    platformConfig,
    technicianCredentials,
    savePrivatePII,
    createNotification,
  } = useMarketplace();
  const { language, t } = useLanguage();

  const zoneNames = useMemo(() => zones.map((z) => z.name), [zones]);
  const fallbackLocation = useDeviceLocation(zoneNames);
  const location = externalLocation || fallbackLocation;

  const myTech = useMemo(() => technicians.find((t) => t.ownerId === user?.uid) || null, [technicians, user]);
  const myBookings = useMemo(() => bookings.filter((b) => b.technicianId === user?.uid), [bookings, user]);
  const myHires = useMemo(() => hires.filter((h) => h.technicianId === user?.uid), [hires, user]);
  const myCreds = useMemo(
    () => technicianCredentials.filter((c) => c.technicianId === user?.uid),
    [technicianCredentials, user]
  );
  const myReviews = useMemo(
    () => technicianReviews.filter((r) => r.technicianId === user?.uid),
    [technicianReviews, user]
  );

  const [fullName, setFullName] = useState(myTech?.fullName || userAccount?.displayName || '');
  const [photoUrl, setPhotoUrl] = useState(myTech?.photoUrl || '');
  const [skillCategory, setSkillCategory] = useState<string>(myTech?.skillCategory || SKILL_CATEGORIES[0]);
  const [subcategory, setSubcategory] = useState(myTech?.subcategory || '');
  const [experienceYears, setExperienceYears] = useState(String(myTech?.experienceYears ?? 3));
  const [workDescription, setWorkDescription] = useState(myTech?.workDescription || '');
  const [prevPhotosRaw, setPrevPhotosRaw] = useState((myTech?.previousWorkPhotos || []).join(', '));
  const [clusterZone, setClusterZone] = useState(myTech?.clusterZone || userAccount?.clusterZone || 'Andheri');
  const [preferredLocations, setPreferredLocations] = useState<string[]>(
    myTech?.preferredLocations || ['Andheri', 'Jogeshwari']
  );
  const [workingRadiusKm, setWorkingRadiusKm] = useState<3 | 5 | 10>(myTech?.workingRadiusKm || 5);
  const [workPreference, setWorkPreference] = useState<'daily' | 'monthly' | 'both'>(myTech?.workPreference || 'both');
  const [expectedCharge, setExpectedCharge] = useState(String(myTech?.expectedCharge ?? 800));
  const [hourlyRate, setHourlyRate] = useState(String(myTech?.hourlyRate ?? 350));
  const [calloutFee, setCalloutFee] = useState(String(myTech?.calloutFee ?? myTech?.expectedCharge ?? 500));
  const [serviceUpiId, setServiceUpiId] = useState(myTech?.upiId || '');
  const [progressDrafts, setProgressDrafts] = useState<Record<string, { label: ServiceBooking['progressLabel']; note: string }>>({});
  const [availabilityStatus, setAvailabilityStatus] = useState<AvailabilityStatus>(
    myTech?.availabilityStatus || 'Available'
  );
  const [busySlots, setBusySlots] = useState<string[]>(() =>
    prunePastBusySlots(myTech?.busySlots || [])
  );
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleDirty, setScheduleDirty] = useState(false);

  // Private PII fields (never placed on public technician document)
  const [privatePhone, setPrivatePhone] = useState(userPII?.phone || user?.phoneNumber || '');
  const [aadhaarLast4, setAadhaarLast4] = useState(userPII?.aadhaarLast4 || '');
  const [upiOrBankRef, setUpiOrBankRef] = useState(userPII?.upiOrBankRef || '');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Certificates, Licenses & Degrees (Firebase Storage + Firestore linkage)
  const [docType, setDocType] = useState<'Certificate' | 'License' | 'Degree'>('Certificate');
  const [docTitle, setDocTitle] = useState('');
  const [docIssuer, setDocIssuer] = useState('');
  const [selectedCredFile, setSelectedCredFile] = useState<File | null>(null);
  const [uploadingCred, setUploadingCred] = useState(false);
  const [credProgress, setCredProgress] = useState<number>(0);
  const [credMsg, setCredMsg] = useState<string | null>(null);
  const [previewCred, setPreviewCred] = useState<TechnicianCredential | null>(null);
  const [signaledProjectIds, setSignaledProjectIds] = useState<Record<string, boolean>>({});
  const [signalingProjectId, setSignalingProjectId] = useState<string | null>(null);
  const credInputRef = useRef<HTMLInputElement | null>(null);

  const hydratedTechId = useRef<string | null>(null);
  const hydratedPiiUid = useRef<string | null>(null);

  const { urgentNearbyBookings, urgentNearbyProjects, totalImmediatePendingCount } = useMemo(() => {
    const now = new Date();
    const todayIso = now.toISOString().slice(0, 10);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowIso = tomorrow.toISOString().slice(0, 10);

    const isUrgentBooking = (b: ServiceBooking) => {
      if (b.priority === 'Urgent') return true;
      if (b.scheduledDate && b.scheduledDate <= tomorrowIso) return true;
      return /urgent|immediate|emergency|asap|today|leak|short circuit|no power|spark/i.test(
        b.serviceNotes || ''
      );
    };

    const immediateBookings = myBookings.filter(
      (b) => (b.status === 'Requested' || b.status === 'Accepted') && isUrgentBooking(b)
    );

    const origin = location.activeOriginCoords;
    if (!origin) {
      return {
        urgentNearbyBookings: [] as Array<{ booking: ServiceBooking; distanceKm: number; isPriorityFlagged: boolean }>,
        urgentNearbyProjects: [] as Array<{ project: ProjectRequirement; distanceKm: number; skillMatch: boolean }>,
        totalImmediatePendingCount: immediateBookings.filter((b) => b.status === 'Requested').length,
      };
    }

    const nearbyBookings = immediateBookings
      .map((booking) => ({
        booking,
        distanceKm: getDistanceToZoneKm(origin, booking.clusterZone),
        isPriorityFlagged:
          booking.priority === 'Urgent' ||
          booking.scheduledDate <= todayIso ||
          /urgent|emergency|asap/i.test(booking.serviceNotes || ''),
      }))
      .filter(
        (entry): entry is { booking: ServiceBooking; distanceKm: number; isPriorityFlagged: boolean } =>
          entry.distanceKm !== null && entry.distanceKm <= URGENT_NEARBY_RADIUS_KM
      )
      .sort((a, b) => {
        if (a.isPriorityFlagged !== b.isPriorityFlagged) return a.isPriorityFlagged ? -1 : 1;
        if (a.booking.status !== b.booking.status) {
          return a.booking.status === 'Requested' ? -1 : 1;
        }
        return a.distanceKm - b.distanceKm;
      });

    const nearbyProjects = projects
      .filter(
        (pr) =>
          pr.status === 'Open' &&
          pr.hiredCount < pr.workersNeeded &&
          (pr.engagementType === 'daily' ||
            (myTech && pr.requiredSkill === myTech.skillCategory) ||
            /urgent|immediate|today|asap/i.test(`${pr.title} ${pr.description || ''}`))
      )
      .map((project) => ({
        project,
        distanceKm: getDistanceToZoneKm(origin, project.clusterZone),
        skillMatch: Boolean(myTech && project.requiredSkill === myTech.skillCategory),
      }))
      .filter(
        (entry): entry is { project: ProjectRequirement; distanceKm: number; skillMatch: boolean } =>
          entry.distanceKm !== null && entry.distanceKm <= URGENT_NEARBY_RADIUS_KM
      )
      .sort((a, b) => {
        if (a.skillMatch !== b.skillMatch) return a.skillMatch ? -1 : 1;
        return a.distanceKm - b.distanceKm;
      });

    return {
      urgentNearbyBookings: nearbyBookings,
      urgentNearbyProjects: nearbyProjects,
      totalImmediatePendingCount: immediateBookings.filter((b) => b.status === 'Requested').length,
    };
  }, [myBookings, projects, myTech, location.activeOriginCoords]);

  useEffect(() => {
    if (myTech && hydratedTechId.current !== myTech.id) {
      hydratedTechId.current = myTech.id;
      setFullName(myTech.fullName || '');
      setPhotoUrl(myTech.photoUrl || '');
      setSkillCategory(myTech.skillCategory || SKILL_CATEGORIES[0]);
      setSubcategory(myTech.subcategory || '');
      setExperienceYears(String(myTech.experienceYears ?? 0));
      setWorkDescription(myTech.workDescription || '');
      setPrevPhotosRaw((myTech.previousWorkPhotos || []).join(', '));
      setClusterZone(myTech.clusterZone || 'Andheri');
      setPreferredLocations(myTech.preferredLocations || ['Andheri']);
      setWorkingRadiusKm(myTech.workingRadiusKm || 5);
      setWorkPreference(myTech.workPreference || 'both');
      setExpectedCharge(String(myTech.expectedCharge ?? 0));
      setHourlyRate(String(myTech.hourlyRate ?? Math.round((myTech.expectedCharge ?? 800) * 0.4)));
      setCalloutFee(String(myTech.calloutFee ?? myTech.expectedCharge ?? 0));
      setServiceUpiId(myTech.upiId || '');
      setAvailabilityStatus(myTech.availabilityStatus || 'Available');
      setBusySlots(prunePastBusySlots(myTech.busySlots || []));
      setScheduleDirty(false);
    }
  }, [myTech]);

  useEffect(() => {
    if (userPII && hydratedPiiUid.current !== userPII.uid) {
      hydratedPiiUid.current = userPII.uid;
      setPrivatePhone(userPII.phone || user?.phoneNumber || '');
      setAadhaarLast4(userPII.aadhaarLast4 || '');
      setUpiOrBankRef(userPII.upiOrBankRef || '');
    }
  }, [userPII, user]);

  if (!user) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900">{t.technician.authTitle}</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          {t.technician.authDesc}
        </p>
        <button
          type="button"
          onClick={onRequireAuth}
          className="min-h-[44px] rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          {t.technician.authCta}
        </button>
      </div>
    );
  }

  const togglePreferredZone = (zoneName: string) => {
    setPreferredLocations((prev) =>
      prev.includes(zoneName) ? prev.filter((z) => z !== zoneName) : [...prev, zoneName].slice(0, 12)
    );
  };

  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    setStatusMsg(null);
    try {
      const compressed = await compressImageToDataUrl(file, 360, 70000);
      setPhotoUrl(compressed);
      if (myTech) {
        await updateDoc(doc(db, 'technicians', user.uid), {
          photoUrl: compressed,
          updatedAt: serverTimestamp(),
        });
        setStatusMsg('Profile photo uploaded and saved.');
      } else {
        setStatusMsg('Profile photo ready. Save your Technician Profile below to publish.');
      }
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Unable to upload photo.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    const prevPhotos = prevPhotosRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6);

    const parsedExp = Math.max(0, Number(experienceYears) || 0);
    const expCat = getExperienceCategory(parsedExp);

    const ref = doc(db, 'technicians', user.uid);
    try {
      if (myTech) {
        await updateDoc(ref, {
          fullName: fullName.trim(),
          photoUrl: photoUrl.trim(),
          skillCategory,
          subcategory: subcategory.trim(),
          experienceYears: parsedExp,
          experienceCategory: expCat,
          workDescription: workDescription.trim(),
          previousWorkPhotos: prevPhotos,
          preferredLocations,
          clusterZone,
          workingRadiusKm,
          workPreference,
          expectedCharge: Math.max(0, Number(expectedCharge) || 0),
          hourlyRate: Math.max(0, Number(hourlyRate) || 0),
          calloutFee: Math.max(0, Number(calloutFee) || 0),
          upiId: serviceUpiId.trim().slice(0, 120),
          availabilityStatus,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(ref, {
          ownerId: user.uid,
          fullName: fullName.trim(),
          photoUrl: photoUrl.trim(),
          skillCategory,
          subcategory: subcategory.trim(),
          experienceYears: parsedExp,
          experienceCategory: expCat,
          adminGrade: 'Pending',
          adminGradeNotes: '',
          mockTestStatus: 'Not Taken',
          fieldTestStatus: 'Pending',
          fieldTestScore: 0,
          credentialsCount: myCreds.length,
          credentialDocIds: myCreds.map((c) => c.id).slice(0, 10),
          workDescription: workDescription.trim(),
          previousWorkPhotos: prevPhotos,
          preferredLocations,
          clusterZone,
          workingRadiusKm,
          workPreference,
          expectedCharge: Math.max(0, Number(expectedCharge) || 0),
          hourlyRate: Math.max(0, Number(hourlyRate) || 0),
          calloutFee: Math.max(0, Number(calloutFee) || 0),
          upiId: serviceUpiId.trim().slice(0, 120),
          availabilityStatus,
          busySlots: prunePastBusySlots(busySlots),
          ratingAvg: 0,
          ratingCount: 0,
          completedJobsCount: 0,
          verified: false,
          membershipStatus: 'none',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      await savePrivatePII({
        phone: privatePhone.trim(),
        aadhaarLast4: aadhaarLast4.replace(/\D/g, '').slice(0, 4),
        upiOrBankRef: upiOrBankRef.trim(),
        kycStatus: aadhaarLast4.length === 4 ? 'pending' : userPII?.kycStatus || 'unsubmitted',
      });

      setStatusMsg('Public skill profile and isolated private KYC details saved.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `technicians/${user.uid}`);
    }
  };

  const handleQuickAvailability = async (next: AvailabilityStatus) => {
    setAvailabilityStatus(next);
    if (!myTech) return;
    try {
      await updateDoc(doc(db, 'technicians', user.uid), {
        availabilityStatus: next,
        updatedAt: serverTimestamp(),
      });
      setStatusMsg(`Availability updated to ${next}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `technicians/${user.uid}`);
    }
  };

  const myBookedSlots = useMemo(
    () => getBookedSlotSet(myBookings, user.uid),
    [myBookings, user.uid]
  );

  const handleToggleSlot = (slotKey: string) => {
    setBusySlots((prev) => {
      const next = prev.includes(slotKey)
        ? prev.filter((k) => k !== slotKey)
        : [...prev, slotKey];
      return prunePastBusySlots(next);
    });
    setScheduleDirty(true);
  };

  const handleToggleDay = (isoDate: string, markBusy: boolean) => {
    setBusySlots((prev) => {
      const dayKeys = SERVICE_TIME_SLOTS.map((s) => makeSlotKey(isoDate, s.id));
      const withoutDay = prev.filter((k) => !dayKeys.includes(k));
      const next = markBusy ? [...withoutDay, ...dayKeys] : withoutDay;
      return prunePastBusySlots(next);
    });
    setScheduleDirty(true);
  };

  const handleMarkWeekendsBusy = (weekendIsos: string[]) => {
    setBusySlots((prev) => {
      const weekendKeys = weekendIsos.flatMap((iso) =>
        SERVICE_TIME_SLOTS.map((s) => makeSlotKey(iso, s.id))
      );
      return prunePastBusySlots([...prev, ...weekendKeys]);
    });
    setScheduleDirty(true);
  };

  const handleClearWeek = (weekDayIsos: string[]) => {
    const daySet = new Set(weekDayIsos);
    setBusySlots((prev) =>
      prev.filter((k) => {
        const [iso] = k.split('|');
        return !daySet.has(iso);
      })
    );
    setScheduleDirty(true);
  };

  const handleSaveSchedule = async () => {
    if (!myTech) {
      setStatusMsg('Please save your Technician Profile first to publish your weekly calendar.');
      return;
    }
    setSavingSchedule(true);
    setStatusMsg(null);
    const cleaned = prunePastBusySlots(busySlots);
    try {
      await updateDoc(doc(db, 'technicians', user.uid), {
        busySlots: cleaned,
        updatedAt: serverTimestamp(),
      });
      setBusySlots(cleaned);
      setScheduleDirty(false);
      setStatusMsg('Weekly availability calendar saved and visible to customers.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `technicians/${user.uid}`);
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleBookingAction = async (booking: ServiceBooking, nextStatus: ServiceBooking['status']) => {
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      await createNotification(
        booking.customerId,
        `Service Booking ${nextStatus}`,
        `${booking.technicianName} marked your ${booking.skillCategory} booking as ${nextStatus}.`,
        'booking'
      );
      setStatusMsg(`Booking marked ${nextStatus}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `bookings/${booking.id}`);
    }
  };

  const handleUpdateBookingProgress = async (booking: ServiceBooking) => {
    const draft = progressDrafts[booking.id] || {
      label: booking.progressLabel || BOOKING_PROGRESS_STEPS[0],
      note: booking.progressNote || '',
    };
    if (!draft.label) return;
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        progressLabel: draft.label,
        progressNote: draft.note.trim().slice(0, 300),
        updatedAt: serverTimestamp(),
      });
      await createNotification(
        booking.customerId,
        `Service Update: ${draft.label}`,
        `${booking.technicianName} updated your ${booking.skillCategory} request to "${draft.label}".${draft.note.trim() ? ` Note: ${draft.note.trim()}` : ''}`,
        'booking'
      );
      setStatusMsg(`Live service progress updated: ${draft.label}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `bookings/${booking.id}`);
    }
  };

  const handleHireAction = async (hire: WorkforceHire, nextStatus: 'Active' | 'Declined') => {
    try {
      await updateDoc(doc(db, 'hires', hire.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      await createNotification(
        hire.contractorId,
        `Workforce Invite ${nextStatus}`,
        `${hire.technicianName} ${nextStatus === 'Active' ? 'accepted' : 'declined'} "${hire.projectTitle}".`,
        'job'
      );
      setStatusMsg(`Workforce request ${nextStatus}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `hires/${hire.id}`);
    }
  };

  const handleSignalImmediateAvailability = async (project: ProjectRequirement, distanceKm: number) => {
    setSignalingProjectId(project.id);
    setStatusMsg(null);
    try {
      const techName = fullName.trim() || myTech?.fullName || userAccount?.displayName || 'Verified Technician';
      const techSkill = myTech?.skillCategory || skillCategory;
      await createNotification(
        project.contractorId,
        `[IMMEDIATE] Nearby ${techSkill} Available (${formatDistanceKm(distanceKm)})`,
        `${techName} (${techSkill}, Grade ${myTech?.adminGrade && myTech.adminGrade !== 'Pending' ? myTech.adminGrade : getExperienceCategory(myTech?.experienceYears ?? 0)}) is within ${formatDistanceKm(distanceKm)} of ${project.clusterZone} and ready for immediate dispatch on "${project.title}".`,
        'job'
      );
      setSignaledProjectIds((prev) => ({ ...prev, [project.id]: true }));
      setStatusMsg(`Immediate availability sent to ${project.companyName} for "${project.title}".`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'notifications');
    } finally {
      setSignalingProjectId(null);
    }
  };

  const handleUploadCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myTech) {
      setCredMsg('Please save your Technician Profile above before uploading documents.');
      return;
    }
    if (!selectedCredFile) {
      setCredMsg('Select an image (JPG/PNG/WebP) or PDF document up to 5 MB.');
      return;
    }
    if (myCreds.length >= 10) {
      setCredMsg('Maximum 10 credential documents allowed per technician profile.');
      return;
    }

    setUploadingCred(true);
    setCredProgress(0);
    setCredMsg(null);

    try {
      const uploaded = await uploadTechnicianCredentialToStorage(
        user.uid,
        docType,
        selectedCredFile,
        (pct) => setCredProgress(pct)
      );

      let credDocRef;
      try {
        credDocRef = await addDoc(collection(db, 'technicianCredentials'), {
          technicianId: user.uid,
          technicianName: fullName.trim() || myTech.fullName,
          docType,
          title: docTitle.trim().slice(0, 140),
          issuer: docIssuer.trim().slice(0, 120),
          fileName: uploaded.fileName,
          mimeType: uploaded.mimeType,
          fileSize: uploaded.fileSize,
          storagePath: uploaded.storagePath,
          downloadUrl: uploaded.downloadUrl,
          verificationStatus: 'Pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (fsErr) {
        // Roll back orphaned Storage object if Firestore record fails
        await deleteTechnicianCredentialFromStorage(uploaded.storagePath).catch(() => undefined);
        handleFirestoreError(fsErr, OperationType.CREATE, 'technicianCredentials');
        return;
      }

      try {
        await updateDoc(doc(db, 'technicians', user.uid), {
          credentialsCount: myCreds.length + 1,
          credentialDocIds: arrayUnion(credDocRef.id),
          updatedAt: serverTimestamp(),
        });
      } catch (linkErr) {
        handleFirestoreError(linkErr, OperationType.UPDATE, `technicians/${user.uid}`);
        return;
      }

      setDocTitle('');
      setDocIssuer('');
      setSelectedCredFile(null);
      if (credInputRef.current) credInputRef.current.value = '';
      setCredMsg(`${docType} "${docTitle.trim()}" uploaded to Firebase Storage and linked to your profile.`);
    } catch (err) {
      setCredMsg(err instanceof Error ? err.message : 'Unable to upload credential file.');
    } finally {
      setUploadingCred(false);
      setCredProgress(0);
    }
  };

  const handleDeleteCredential = async (cred: TechnicianCredential) => {
    setCredMsg(null);
    try {
      if (cred.storagePath) {
        await deleteTechnicianCredentialFromStorage(cred.storagePath);
      }
      await deleteDoc(doc(db, 'technicianCredentials', cred.id));
      if (myTech) {
        await updateDoc(doc(db, 'technicians', user.uid), {
          credentialsCount: Math.max(0, myCreds.length - 1),
          credentialDocIds: arrayRemove(cred.id),
          updatedAt: serverTimestamp(),
        });
      }
      if (previewCred?.id === cred.id) setPreviewCred(null);
      setCredMsg(`Removed "${cred.title}" from Firebase Storage and your profile.`);
    } catch (err) {
      if (err instanceof Error && !err.message.startsWith('{')) {
        setCredMsg(err.message);
      } else {
        handleFirestoreError(err, OperationType.DELETE, `technicianCredentials/${cred.id}`);
      }
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t.technician.workbenchTitle}</h2>
          <p className="text-sm text-slate-600">
            {myTech
              ? `${translateSkillCategory(myTech.skillCategory, language)} · ${myTech.adminGrade && myTech.adminGrade !== 'Pending' ? myTech.adminGrade : myTech.experienceCategory || getExperienceCategory(myTech.experienceYears)} · ${myTech.clusterZone} (${myTech.workingRadiusKm} km)`
              : t.technician.completeReg}
          </p>
        </div>

        {/* Availability Toggle */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 w-fit">
          {(['Available', 'Busy', 'Unavailable'] as AvailabilityStatus[]).map((state) => (
            <button
              key={state}
              type="button"
              onClick={() => handleQuickAvailability(state)}
              className={`min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                availabilityStatus === state
                  ? state === 'Available'
                    ? 'bg-emerald-600 text-white'
                    : state === 'Busy'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-800 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {translateAvailability(state, language)}
            </button>
          ))}
        </div>
      </div>

      {statusMsg && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900">
          {statusMsg}
        </div>
      )}

      {/* Urgent Nearby Jobs (<= 5 km via Device Geolocation API) */}
      <section
        aria-labelledby="urgent-nearby-jobs-heading"
        className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <h3 id="urgent-nearby-jobs-heading" className="text-base font-semibold text-slate-900">
                {t.technician.urgentHeading}
              </h3>
              {location.status === 'active' && (
                <span className="text-xs font-mono tabular-nums font-semibold text-red-700">
                  · {urgentNearbyBookings.length + urgentNearbyProjects.length} {t.technician.urgentActiveSuffix}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600">
              {t.technician.urgentSub}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => location.requestLocation()}
              disabled={location.status === 'locating'}
              className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                location.status === 'active'
                  ? 'border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              {location.status === 'locating' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <LocateFixed className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>
                {location.status === 'locating'
                  ? t.technician.scanningGps
                  : location.status === 'active'
                    ? t.technician.refreshGpsScan
                    : t.technician.enableLiveGps}
              </span>
            </button>
            {location.status === 'active' && (
              <button
                type="button"
                onClick={() => location.clearLocation()}
                aria-label={t.header.clear}
                className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {location.status === 'error' && location.errorMessage && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800 flex flex-wrap items-center justify-between gap-2">
            <span>{location.errorMessage}</span>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <select
                aria-label="Select fallback Mumbai zone"
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    location.selectFallbackZone(e.target.value);
                  }
                }}
                className="rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800"
              >
                <option value="">Set Mumbai zone manually...</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.name}>
                    {z.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => location.clearLocation()}
                className="font-medium underline text-red-900 shrink-0"
              >
                {t.common.dismiss}
              </button>
            </div>
          </div>
        )}

        {location.status !== 'active' ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-medium text-slate-900">
                {t.technician.readyScanTitle}
              </div>
              <p className="text-xs text-slate-600">
                {t.technician.readyScanDesc}
                {totalImmediatePendingCount > 0 ? ` (${totalImmediatePendingCount})` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => location.requestLocation()}
              disabled={location.status === 'locating'}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-medium text-white hover:bg-amber-700 whitespace-nowrap shrink-0"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>{t.technician.scan5kmBtn}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active GPS Telemetry & Anchor Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs">
              <div className="font-mono tabular-nums text-slate-700">
                {location.rawCoords && (
                  <>
                    GPS {location.rawCoords.lat.toFixed(4)}°N, {location.rawCoords.lng.toFixed(4)}°E
                    {location.nearestZone ? ` · Nearest hub: ${location.nearestZone.zoneName}` : ''}
                    {location.usingMumbaiAnchor ? ' (Measuring 5 km from Mumbai hub)' : ' · 5.0 km radius'}
                  </>
                )}
              </div>
              {location.isOutsideMumbai && location.nearestZone && (
                <button
                  type="button"
                  onClick={() => location.setUseMumbaiAnchor(!location.usingMumbaiAnchor)}
                  className="font-medium text-amber-700 hover:text-amber-800 underline underline-offset-2 whitespace-nowrap"
                >
                  {location.usingMumbaiAnchor
                    ? 'Switch back to raw GPS'
                    : `Scan 5 km around ${location.nearestZone.zoneName}`}
                </button>
              )}
            </div>

            {urgentNearbyBookings.length === 0 && urgentNearbyProjects.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-6 text-center space-y-1.5">
                <p className="text-sm font-medium text-slate-900">
                  {t.technician.noUrgentNearby}
                </p>
                <p className="text-xs text-slate-500">
                  {t.technician.noUrgentSub}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {urgentNearbyBookings.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="text-xs font-semibold text-slate-700">
                      {t.technician.immediateCustomerReqs} ({urgentNearbyBookings.length})
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {urgentNearbyBookings.map(({ booking: b, distanceKm, isPriorityFlagged }) => (
                        <div
                          key={b.id}
                          className={`rounded-xl border p-4 flex flex-col justify-between space-y-3 ${
                            isPriorityFlagged
                              ? 'border-red-300 bg-red-50/40'
                              : 'border-amber-300 bg-amber-50/40'
                          }`}
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span
                                className={`font-semibold inline-flex items-center gap-1 ${
                                  isPriorityFlagged ? 'text-red-700' : 'text-amber-800'
                                }`}
                              >
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                {b.priority === 'Urgent' ? t.technician.urgentPriority : t.technician.immediateService}
                              </span>
                              <span className="font-mono tabular-nums font-semibold text-slate-900">
                                {formatDistanceKm(distanceKm)} {t.common.kmAway}
                              </span>
                            </div>
                            <div className="text-sm font-semibold text-slate-900">
                              {b.customerName} · {b.clusterZone}
                            </div>
                            <div className="text-xs text-slate-600 font-mono tabular-nums">
                              {b.scheduledDate}
                              {b.scheduledSlot ? ` · ${b.scheduledSlot}` : ''} · {translateSkillCategory(b.skillCategory, language)}
                            </div>
                            {b.serviceNotes && (
                              <p className="text-xs text-slate-700 line-clamp-2">{b.serviceNotes}</p>
                            )}
                          </div>

                          <div className="pt-2.5 border-t border-slate-200/80 flex items-center justify-between gap-2">
                            <div>
                              <div className="text-[11px] text-slate-500">{t.technician.servicePayout}</div>
                              <div className="text-sm font-bold font-mono tabular-nums text-slate-900">
                                {formatINR(b.serviceCharge)}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {b.status === 'Requested' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleBookingAction(b, 'Accepted')}
                                    className="min-h-[38px] rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 whitespace-nowrap"
                                  >
                                    {t.technician.acceptUrgentJob}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleBookingAction(b, 'Rejected')}
                                    className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                                  >
                                    {t.technician.decline}
                                  </button>
                                </>
                              )}
                              {b.status === 'Accepted' && (
                                <button
                                  type="button"
                                  onClick={() => handleBookingAction(b, 'In Progress')}
                                  className="min-h-[38px] rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 whitespace-nowrap"
                                >
                                  {t.technician.startWorkNow}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {urgentNearbyProjects.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="text-xs font-semibold text-slate-700">
                      {t.technician.nearbySiteDispatch} ({urgentNearbyProjects.length})
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {urgentNearbyProjects.map(({ project: pr, distanceKm, skillMatch }) => {
                        const openSlots = Math.max(0, pr.workersNeeded - pr.hiredCount);
                        const sent = Boolean(signaledProjectIds[pr.id]);
                        return (
                          <div
                            key={pr.id}
                            className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 flex flex-col justify-between space-y-3"
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="text-slate-600 font-medium">
                                  {pr.companyName} · {pr.clusterZone}
                                  {skillMatch ? ' · Skill Match' : ''}
                                </span>
                                <span className="font-mono tabular-nums font-semibold text-slate-900">
                                  {formatDistanceKm(distanceKm)} {t.common.kmAway}
                                </span>
                              </div>
                              <div className="text-sm font-semibold text-slate-900">{pr.title}</div>
                              <div className="text-xs text-slate-600 font-mono tabular-nums">
                                {translateSkillCategory(pr.requiredSkill, language)} · {openSlots} opening{openSlots === 1 ? '' : 's'} · {pr.engagementType}
                              </div>
                              {pr.description && (
                                <p className="text-xs text-slate-600 line-clamp-2">{pr.description}</p>
                              )}
                            </div>

                            <div className="pt-2.5 border-t border-slate-200/80 flex items-center justify-between gap-2">
                              <div className="text-sm font-bold font-mono tabular-nums text-slate-900">
                                {formatINR(pr.budgetPerWorker)} / worker
                              </div>
                              <button
                                type="button"
                                disabled={sent || signalingProjectId === pr.id}
                                onClick={() => handleSignalImmediateAvailability(pr, distanceKm)}
                                className={`min-h-[38px] rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                                  sent
                                    ? 'border border-emerald-300 bg-emerald-50 text-emerald-800'
                                    : 'bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60'
                                }`}
                              >
                                {sent
                                  ? t.technician.availabilitySent
                                  : signalingProjectId === pr.id
                                    ? t.technician.sending
                                    : t.technician.signalAvailability}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Incoming Service Bookings & Contractor Hires */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">{t.technician.customerServiceReqs}</h3>
            <span className="text-xs font-mono text-slate-500">{myBookings.length} {t.common.total}</span>
          </div>
          {myBookings.length === 0 ? (
            <p className="text-sm text-slate-500">
              No service requests yet. Keep your status set to Available to receive cluster-matched bookings.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {myBookings.map((b) => (
                <div key={b.id} className="py-3.5 space-y-2">
                  <div className="flex justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        {b.customerName} · {b.clusterZone}
                        {b.priority === 'Urgent' && (
                          <span className="ml-1.5 text-xs font-semibold text-red-700">· {t.technician.urgentPriority}</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        {b.scheduledDate}
                        {b.scheduledSlot ? ` · ${b.scheduledSlot}` : ''} · {b.serviceNotes || translateSkillCategory(b.skillCategory, language)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold font-mono tabular-nums">{formatINR(b.serviceCharge)}</div>
                      <div className="text-xs text-slate-600">{b.status}</div>
                    </div>
                  </div>
                  {b.status === 'Requested' && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleBookingAction(b, 'Accepted')}
                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                      >
                        {t.technician.acceptJob}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBookingAction(b, 'Rejected')}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        {t.technician.decline}
                      </button>
                    </div>
                  )}
                  {b.status === 'Accepted' && (
                    <button
                      type="button"
                      onClick={() => handleBookingAction(b, 'In Progress')}
                      className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white"
                    >
                      {t.technician.startWork}
                    </button>
                  )}
                  {b.status === 'In Progress' && (
                    <button
                      type="button"
                      onClick={() => handleBookingAction(b, 'Completed')}
                      className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                    >
                      {t.technician.markCompleted}
                    </button>
                  )}
                  {(b.status === 'Accepted' || b.status === 'In Progress') && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                      <div className="text-[11px] font-medium text-slate-700">
                        Live Service Progress Tracker {b.progressLabel ? `· Current: ${b.progressLabel}` : ''}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <select
                          value={progressDrafts[b.id]?.label || b.progressLabel || BOOKING_PROGRESS_STEPS[0]}
                          onChange={(e) =>
                            setProgressDrafts((prev) => ({
                              ...prev,
                              [b.id]: {
                                label: e.target.value as ServiceBooking['progressLabel'],
                                note: prev[b.id]?.note ?? b.progressNote ?? '',
                              },
                            }))
                          }
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
                        >
                          {BOOKING_PROGRESS_STEPS.map((step) => (
                            <option key={step} value={step}>
                              {step}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={progressDrafts[b.id]?.note ?? b.progressNote ?? ''}
                          onChange={(e) =>
                            setProgressDrafts((prev) => ({
                              ...prev,
                              [b.id]: {
                                label: prev[b.id]?.label || b.progressLabel || BOOKING_PROGRESS_STEPS[0],
                                note: e.target.value,
                              },
                            }))
                          }
                          placeholder="Optional technician note (e.g. spare part ETA)"
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUpdateBookingProgress(b)}
                        className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100"
                      >
                        Update Customer Progress
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">{t.technician.contractorOffers}</h3>
            <span className="text-xs font-mono text-slate-500">{myHires.length} {t.common.total}</span>
          </div>
          {myHires.length === 0 ? (
            <p className="text-sm text-slate-500">No contractor project invitations yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {myHires.map((h) => (
                <div key={h.id} className="py-3.5 space-y-2">
                  <div className="flex justify-between">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{h.projectTitle}</div>
                      <div className="text-xs text-slate-500">
                        {h.engagementType} · {formatINR(h.agreedRate)}
                      </div>
                    </div>
                    <span className="text-xs font-medium text-slate-700">{h.status}</span>
                  </div>
                  {h.status === 'Requested' && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleHireAction(h, 'Active')}
                        className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                      >
                        {t.technician.acceptOffer}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleHireAction(h, 'Declined')}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
                      >
                        {t.technician.decline}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Weekly Availability Calendar */}
      <WeeklyAvailabilityCalendar
        mode="technician"
        busySlots={busySlots}
        bookedSlots={myBookedSlots}
        onToggleSlot={handleToggleSlot}
        onToggleDay={handleToggleDay}
        onMarkWeekendsBusy={handleMarkWeekendsBusy}
        onClearWeek={handleClearWeek}
        onSaveSchedule={handleSaveSchedule}
        saving={savingSchedule}
        hasUnsavedChanges={scheduleDirty}
        disabledReason={
          !myTech ? 'Save your Technician Profile below first to publish weekly availability slots.' : null
        }
      />

      {/* Customer Ratings & Verified Reviews */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{t.technician.ratingsReviewsTitle}</h3>
            <p className="text-xs text-slate-500">
              {t.technician.ratingsReviewsSub}
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 text-sm font-mono tabular-nums font-semibold text-slate-900">
            <Star
              className={`w-4 h-4 ${
                myReviews.length > 0 ? 'fill-amber-400 text-amber-500' : 'text-slate-400'
              }`}
            />
            <span>
              {(
                myReviews.length > 0
                  ? myReviews.reduce((sum, r) => sum + r.rating, 0) / myReviews.length
                  : myTech?.ratingAvg ?? 0
              ).toFixed(1)}{' '}
              ({Math.max(myReviews.length, myTech?.ratingCount ?? 0)} {t.common.reviews})
            </span>
          </div>
        </div>

        {myReviews.length === 0 ? (
          <p className="text-sm text-slate-500">
            No customer reviews yet. Completed service bookings allow customers to leave star ratings and feedback.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {myReviews.slice(0, 8).map((review) => (
              <div key={review.id} className="py-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium text-slate-900">
                    {review.customerName}{' '}
                    <span className="text-xs font-normal text-slate-500">
                      · {translateSkillCategory(review.skillCategory, language)} · {review.clusterZone}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-3.5 h-3.5 ${
                          s <= review.rating ? 'fill-amber-400 text-amber-500' : 'text-slate-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                {review.reviewText && (
                  <p className="text-xs text-slate-600 leading-relaxed">&ldquo;{review.reviewText}&rdquo;</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Registration & Membership */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <form onSubmit={handleSaveProfile} className="lg:col-span-8 rounded-xl border border-slate-200 bg-white p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-slate-700" />
              <h3 className="text-base font-semibold text-slate-900">{t.technician.profileSectionTitle}</h3>
            </div>
            {myTech?.verified && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" /> {t.common.verified}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Skill Category</label>
              <select
                value={skillCategory}
                onChange={(e) => setSkillCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                {SKILL_CATEGORIES.map((s) => (
                  <option key={s} value={s}>
                    {translateSkillCategory(s, language)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Subcategory / Specialization</label>
              {skillCategory === 'Automotive Services' ? (
                <select
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  className="w-full rounded-lg border border-amber-300 bg-amber-50/40 px-3 py-2 text-sm"
                >
                  <option value="">Select Automotive / EV specialty...</option>
                  {AUTOMOTIVE_SUBCATEGORIES.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  placeholder="e.g. Split AC PCB & Gas Refill"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Experience (Years)</label>
              <input
                type="number"
                min={0}
                max={60}
                required
                value={experienceYears}
                onChange={(e) => setExperienceYears(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Primary Mumbai Cluster</label>
              <select
                value={clusterZone}
                onChange={(e) => setClusterZone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.name}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Working Radius</label>
              <select
                value={workingRadiusKm}
                onChange={(e) => setWorkingRadiusKm(Number(e.target.value) as 3 | 5 | 10)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white font-mono"
              >
                {WORKING_RADII.map((r) => (
                  <option key={r} value={r}>
                    {r} km radius
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Work Preference</label>
              <select
                value={workPreference}
                onChange={(e) => setWorkPreference(e.target.value as 'daily' | 'monthly' | 'both')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="daily">Daily Service / Visit</option>
                <option value="monthly">Monthly Salary</option>
                <option value="both">Both Daily & Monthly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Base Expected Charge (INR)</label>
              <input
                type="number"
                min={0}
                required
                value={expectedCharge}
                onChange={(e) => setExpectedCharge(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Minimum Call-Out Fee (INR)</label>
              <input
                type="number"
                min={0}
                required
                value={calloutFee}
                onChange={(e) => setCalloutFee(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Hourly Labor Rate (INR/hr)</label>
              <input
                type="number"
                min={0}
                required
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {t.technician.serviceUpiLabel}
              </label>
              <input
                type="text"
                maxLength={120}
                value={serviceUpiId}
                onChange={(e) => setServiceUpiId(e.target.value)}
                placeholder="e.g. ramesh.electric@okaxis or 9820012345@ybl"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Preferred Mumbai Locations</label>
            <div className="flex flex-wrap gap-1.5">
              {zones.map((z) => {
                const active = preferredLocations.includes(z.name);
                return (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => togglePreferredZone(z.name)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      active
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {z.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Work Description</label>
            <textarea
              rows={2}
              value={workDescription}
              onChange={(e) => setWorkDescription(e.target.value)}
              placeholder="Describe tools owned, certifications, and typical jobs completed"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          {/* Profile Photo Upload + Previous Work Photos */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-16 h-16 rounded-xl border border-slate-200 bg-white overflow-hidden flex items-center justify-center shrink-0">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={fullName || 'Technician profile photo'}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Camera className="w-6 h-6 text-slate-400" />
                )}
              </div>
              <div className="flex-1 space-y-1.5">
                <label className="block text-xs font-medium text-slate-800">
                  Upload Profile Photo (Camera / Gallery)
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePhotoUpload}
                    disabled={photoUploading}
                    className="text-xs text-slate-600 file:mr-3 file:min-h-[38px] file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-800 hover:file:bg-slate-100"
                  />
                  {photoUploading && (
                    <span className="text-xs text-amber-700 font-medium">Compressing photo...</span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Or Paste Photo URL (Optional)
                </label>
                <input
                  type="url"
                  value={photoUrl.startsWith('data:') ? '' : photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Previous Work Photo URLs (comma-separated)
                </label>
                <input
                  type="text"
                  value={prevPhotosRaw}
                  onChange={(e) => setPrevPhotosRaw(e.target.value)}
                  placeholder="https://..., https://..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Isolated Private KYC Box */}
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <Shield className="w-4 h-4 text-amber-600" />
              <span>Private Verification & Payout Details (Hidden from Public Marketplace)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Verified Mobile</label>
                <input
                  type="tel"
                  value={privatePhone}
                  onChange={(e) => setPrivatePhone(e.target.value)}
                  placeholder="+91 98200..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Aadhaar Last 4 Digits (KYC only)</label>
                <input
                  type="text"
                  maxLength={4}
                  value={aadhaarLast4}
                  onChange={(e) => setAadhaarLast4(e.target.value.replace(/\D/g, ''))}
                  placeholder="1234"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">UPI ID / Bank Ref</label>
                <input
                  type="text"
                  value={upiOrBankRef}
                  onChange={(e) => setUpiOrBankRef(e.target.value)}
                  placeholder="name@upi"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="min-h-[44px] rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            {t.technician.saveProfileBtn}
          </button>
        </form>

        {/* Billing & Memberships Summary & Checkout */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-2">
            <div className="text-xs font-medium text-slate-500">Customer Price Preview Rate</div>
            <div className="text-lg font-bold font-mono tabular-nums text-slate-900">
              {formatINR(Number(calloutFee) || 0)} call-out + {formatINR(Number(hourlyRate) || 0)}/hr
            </div>
            <p className="text-xs text-slate-500">
              Customers see your call-out fee and hourly estimate transparently before confirming a booking.
            </p>
          </div>
          <BillingMembershipsSection
            role="technician"
            membershipStatus={myTech?.membershipStatus}
            quotaUsed={myBookings.length}
            quotaLimit={10}
            onStatusMessage={setStatusMsg}
          />
        </div>
      </div>

      {/* Certificates, Licenses & Degree Documents (Firebase Storage + Firestore Profile Link) */}
      <section
        id="credentials-upload-section"
        className="rounded-xl border border-slate-200 bg-white p-6 space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-2.5">
            <Upload className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                {t.technician.credentialsTitle}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {t.technician.credentialsSub}
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 text-xs font-mono tabular-nums text-slate-600">
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <span>{myCreds.length}/10 linked files</span>
          </div>
        </div>

        {credMsg && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900">
            {credMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form onSubmit={handleUploadCredential} className="lg:col-span-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Document Category</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as 'Certificate' | 'License' | 'Degree')}
                className="w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="Certificate">Skill / Trade Certificate</option>
                <option value="License">Trade / PWD / Govt License</option>
                <option value="Degree">ITI / Diploma / Degree</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Document Title</label>
              <input
                type="text"
                required
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="e.g. Maharashtra PWD Wireman License / ITI Electrician"
                className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Issuing Authority / Institute (Optional)
              </label>
              <input
                type="text"
                value={docIssuer}
                onChange={(e) => setDocIssuer(e.target.value)}
                placeholder="e.g. NCVT / NSDC / Mumbai ITI / Govt PWD"
                className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Select Certificate, License, or Degree File (JPG, PNG, WebP, or PDF · Max 5 MB)
              </label>
              <input
                ref={credInputRef}
                type="file"
                accept="image/*,.pdf,application/pdf"
                onChange={(e) => setSelectedCredFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-600 file:mr-3 file:min-h-[40px] file:rounded-lg file:border file:border-slate-300 file:bg-slate-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-800 hover:file:bg-slate-100"
              />
              {selectedCredFile && (
                <div className="mt-1.5 text-[11px] font-mono text-slate-500 truncate">
                  Selected: {selectedCredFile.name} ({formatFileSize(selectedCredFile.size)})
                </div>
              )}
            </div>

            {uploadingCred && (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono text-slate-600">
                  <span>Uploading to Firebase Storage...</span>
                  <span>{credProgress}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-amber-600 transition-all duration-150"
                    style={{ width: `${credProgress}%` }}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={uploadingCred || !myTech}
              className="min-h-[44px] w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {!myTech
                ? 'Save Technician Profile First'
                : uploadingCred
                  ? `Uploading (${credProgress}%)...`
                  : `Upload ${docType} to Profile`}
            </button>
          </form>

          <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-slate-50/50 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-900">
                {t.technician.linkedDocsTitle}
              </h4>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {myCreds.length} stored
              </span>
            </div>

            {myCreds.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">
                No certificates, trade licenses, or degrees uploaded yet. Upload your credentials on the left to unlock Admin verification and Category A / B / C grading.
              </p>
            ) : (
              <div className="divide-y divide-slate-200 bg-white rounded-lg border border-slate-200 px-4">
                {myCreds.map((cred) => {
                  const fileUrl = cred.downloadUrl || cred.fileDataUrl || '';
                  return (
                    <div key={cred.id} className="py-3.5 flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-0.5">
                        <div className="text-xs text-slate-500">
                          {cred.docType}
                          {cred.issuer ? ` · ${cred.issuer}` : ''}
                          {' · '}
                          <span
                            className={
                              cred.verificationStatus === 'Verified'
                                ? 'text-emerald-700 font-medium'
                                : cred.verificationStatus === 'Rejected'
                                  ? 'text-red-700 font-medium'
                                  : 'text-amber-700 font-medium'
                            }
                          >
                            {cred.verificationStatus}
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-slate-900 truncate">
                          {cred.title}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 truncate">
                          {cred.fileName}
                          {cred.fileSize ? ` · ${formatFileSize(cred.fileSize)}` : ''}
                          {cred.storagePath ? ' · Firebase Storage' : ''}
                        </div>
                        {cred.adminNote && (
                          <div className="text-xs text-slate-600 pt-0.5">
                            Admin note: {cred.adminNote}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {fileUrl && (
                          <button
                            type="button"
                            onClick={() => setPreviewCred(cred)}
                            aria-label={`View ${cred.title}`}
                            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteCredential(cred)}
                          aria-label={`Delete ${cred.title}`}
                          className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-md border border-slate-200 bg-white text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Category A/B/C & Field Mock Test */}
      <TechnicianAssessmentPanel
        myTech={myTech}
        skillCategory={skillCategory}
        experienceYears={Number(experienceYears) || 0}
        fullName={fullName}
      />

      {/* Document Preview Modal */}
      {previewCred && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="text-xs text-slate-500">
                  {previewCred.docType} · {previewCred.verificationStatus}
                  {previewCred.fileSize ? ` · ${formatFileSize(previewCred.fileSize)}` : ''}
                </div>
                <h4 className="text-base font-semibold text-slate-900">{previewCred.title}</h4>
              </div>
              <button
                type="button"
                onClick={() => setPreviewCred(null)}
                className="min-h-[36px] rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            {(() => {
              const fileUrl = previewCred.downloadUrl || previewCred.fileDataUrl || '';
              if (previewCred.mimeType.startsWith('image/')) {
                return (
                  <img
                    src={fileUrl}
                    alt={previewCred.title}
                    className="w-full max-h-[65vh] object-contain rounded-lg border border-slate-200 bg-slate-50"
                  />
                );
              }
              return (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center space-y-3">
                  <FileText className="w-8 h-8 text-slate-500 mx-auto" />
                  <p className="text-xs text-slate-600 font-mono">{previewCred.fileName}</p>
                  {fileUrl && (
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={previewCred.fileName}
                      className="inline-flex items-center gap-1.5 justify-center min-h-[40px] rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Open / Download PDF Document
                    </a>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
