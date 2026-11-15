import React, { useEffect, useMemo, useRef, useState } from 'react';
import { addDoc, collection, doc, getDocs, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { Bot, Check, ChevronDown, Download, FileCode, FileSpreadsheet, MapPin, RefreshCw, Search, ShieldCheck, Sliders, Smartphone, X } from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { db } from '../lib/firebase';
import { AI_MANAGEMENT_ROLES, formatINR, MUMBAI_INITIAL_CLUSTERS, sanitizeId } from '../lib/constants';
import { buildAndroidBuildScript, buildTwaManifestObject, triggerTextDownload } from '../lib/androidBuild';
import { handleFirestoreError, OperationType } from '../lib/firestoreError';
import type { Complaint, PlatformConfig, RevenueTransaction } from '../types';
import { MumbaiClusterMap } from './MumbaiClusterMap';
import { ClusterChartsSection } from './ClusterChartsSection';
import { DashboardOverviewCard } from './DashboardOverviewCard';
import { AdminTechGradingPanel } from './AdminTechGradingPanel';
import { AdminZoneHeatmap } from './AdminZoneHeatmap';

export const AdminDashboard: React.FC = () => {
  const {
    user,
    isAdmin,
    zones,
    platformConfig,
    allUsers,
    shops,
    contractors,
    technicians,
    bookings,
    orders,
    complaints,
    transactions,
    aiDecisions,
    technicianTests,
    technicianCredentials,
    createNotification,
  } = useMarketplace();

  const [zoneFilter, setZoneFilter] = useState('All');
  const [adminTab, setAdminTab] = useState<'overview' | 'zones' | 'revenue' | 'approvals' | 'grading' | 'ai'>('overview');

  // Zone Creation & Filtering
  const [newZoneName, setNewZoneName] = useState('');
  const [newSubZones, setNewSubZones] = useState('');
  const [zoneSearch, setZoneSearch] = useState('');
  const [syncingZones, setSyncingZones] = useState(false);

  // Editable Revenue Config
  const [cfg, setCfg] = useState<PlatformConfig>(platformConfig);

  // AI Consultation
  const [aiRole, setAiRole] = useState<string>(AI_MANAGEMENT_ROLES[0].role);
  const [aiZone, setAiZone] = useState<string>('All Mumbai Clusters');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [androidModalOpen, setAndroidModalOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExportMenuOpen(false);
        setAndroidModalOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const metrics = useMemo(() => {
    const customersCount = allUsers.filter((u) => u.role === 'customer').length;
    const activeTechs = technicians.filter((t) => t.availabilityStatus !== 'Unavailable').length;
    const inactiveTechs = technicians.filter((t) => t.availabilityStatus === 'Unavailable').length;
    const availableTechs = technicians.filter((t) => t.availabilityStatus === 'Available').length;
    const busyTechs = technicians.filter((t) => t.availabilityStatus === 'Busy').length;

    const completedBookings = bookings.filter((b) => b.status === 'Completed').length;
    const cancelledBookings = bookings.filter((b) => b.status === 'Cancelled' || b.status === 'Rejected').length;

    const verifiedTxs = transactions.filter((t) => t.status === 'Verified');
    const totalRevenue = verifiedTxs.reduce((acc, t) => acc + t.amount, 0);
    const totalCommission = verifiedTxs.reduce((acc, t) => acc + t.commissionAmount, 0);
    const membershipPayments = verifiedTxs
      .filter((t) => t.txType === 'technician_membership')
      .reduce((acc, t) => acc + t.amount, 0);
    const contractorPackageRevenue = verifiedTxs
      .filter((t) => t.txType === 'contractor_package')
      .reduce((acc, t) => acc + t.amount, 0);

    const zoneStats = zones.map((z) => ({
      zone: z.name,
      technicians: technicians.filter((t) => t.clusterZone === z.name).length,
      shops: shops.filter((s) => s.clusterZone === z.name).length,
      contractors: contractors.filter((c) => c.clusterZone === z.name).length,
      bookings: bookings.filter((b) => b.clusterZone === z.name).length,
    }));

    return {
      customersCount,
      shopkeepersCount: shops.length,
      contractorsCount: contractors.length,
      techniciansCount: technicians.length,
      activeTechs,
      inactiveTechs,
      availableTechs,
      busyTechs,
      totalBookings: bookings.length,
      completedBookings,
      cancelledBookings,
      totalOrders: orders.length,
      openComplaints: complaints.filter((c) => c.status !== 'Resolved').length,
      totalRevenue,
      totalCommission,
      membershipPayments,
      contractorPackageRevenue,
      zoneStats,
    };
  }, [allUsers, technicians, shops, contractors, bookings, orders, complaints, transactions, zones]);

  if (!user || !isAdmin) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center space-y-3">
        <ShieldCheck className="w-8 h-8 text-amber-600 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">Administrator Access Required</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Sign in with an authorized Administrator account to access revenue configuration, Mumbai zone management, verification workflows, and AI Management Team approvals.
        </p>
      </div>
    );
  }

  const handleExportCSV = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Total Customers', String(metrics.customersCount)],
      ['Total Shopkeepers', String(metrics.shopkeepersCount)],
      ['Total Contractors', String(metrics.contractorsCount)],
      ['Total Technicians', String(metrics.techniciansCount)],
      ['Available Technicians', String(metrics.availableTechs)],
      ['Busy Technicians', String(metrics.busyTechs)],
      ['Inactive Technicians', String(metrics.inactiveTechs)],
      ['Total Bookings', String(metrics.totalBookings)],
      ['Completed Bookings', String(metrics.completedBookings)],
      ['Cancelled Bookings', String(metrics.cancelledBookings)],
      ['Seller Orders', String(metrics.totalOrders)],
      ['Verified Revenue (INR)', String(metrics.totalRevenue)],
      ['Commission Earned (INR)', String(metrics.totalCommission)],
      ['Membership Payments (INR)', String(metrics.membershipPayments)],
      ['Contractor Packages (INR)', String(metrics.contractorPackageRevenue)],
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    triggerTextDownload(`all-in-one-skill-report-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv;charset=utf-8;');
    setExportMenuOpen(false);
    setStatusMsg('Exported operational metrics CSV report.');
  };

  const handleExportJSON = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      zoneFilter,
      metrics,
    };
    triggerTextDownload(
      `all-in-one-skill-snapshot-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2),
      'application/json;charset=utf-8;'
    );
    setExportMenuOpen(false);
    setStatusMsg('Exported operational metrics JSON snapshot.');
  };

  const handleDownloadTwaManifest = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
    const manifestJson = JSON.stringify(buildTwaManifestObject(origin), null, 2);
    triggerTextDownload('twa-manifest.json', manifestJson, 'application/json;charset=utf-8;');
    setExportMenuOpen(false);
    setStatusMsg('Downloaded Android TWA manifest (twa-manifest.json) for APK/AAB builds.');
  };

  const handleDownloadApkBuildScript = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
    const scriptText = buildAndroidBuildScript(origin);
    triggerTextDownload('build-apk.sh', scriptText, 'text/x-shellscript;charset=utf-8;');
    setExportMenuOpen(false);
    setStatusMsg('Downloaded Bubblewrap Android APK/AAB build script (build-apk.sh).');
  };

  const handleAddZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZoneName.trim()) return;
    const zoneId = sanitizeId(newZoneName.trim().toLowerCase());
    const subZones = newSubZones
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      await setDoc(doc(db, 'zones', zoneId), {
        name: newZoneName.trim(),
        city: 'Mumbai',
        state: 'Maharashtra',
        subZones,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewZoneName('');
      setNewSubZones('');
      setStatusMsg(`Added Mumbai zone "${newZoneName.trim()}".`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `zones/${zoneId}`);
    }
  };

  const handleSyncDefaultZones = async () => {
    setSyncingZones(true);
    setStatusMsg(null);
    try {
      const snap = await getDocs(collection(db, 'zones'));
      const existingIds = new Set(snap.docs.map((d) => d.id));
      const missing = MUMBAI_INITIAL_CLUSTERS.filter((c) => !existingIds.has(c.id));

      if (missing.length === 0) {
        setStatusMsg(`All ${MUMBAI_INITIAL_CLUSTERS.length} South Mumbai & Suburban zones are already synced in Firestore.`);
        return;
      }

      const batch = writeBatch(db);
      missing.forEach((z) => {
        batch.set(doc(db, 'zones', z.id), {
          name: z.name,
          city: 'Mumbai',
          state: 'Maharashtra',
          subZones: z.subZones,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
      setStatusMsg(`Synced ${missing.length} South Mumbai & Suburban localities to Firestore (${MUMBAI_INITIAL_CLUSTERS.length} total).`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'zones');
    } finally {
      setSyncingZones(false);
    }
  };

  const handleSavePlatformConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'platformConfig', 'default'), {
        bookingCommissionPercent: Number(cfg.bookingCommissionPercent) || 0,
        customerBookingCharge: Number(cfg.customerBookingCharge) || 0,
        technicianMonthlyFee: Number(cfg.technicianMonthlyFee) || 0,
        technicianYearlyFee: Number(cfg.technicianYearlyFee) || 0,
        promotionDailyRate: Number(cfg.promotionDailyRate) || 0,
        contractorPackages: cfg.contractorPackages,
        shopkeeperPlans: cfg.shopkeeperPlans,
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      });
      setStatusMsg('Revenue model, commissions, and subscription packages saved to Firestore.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'platformConfig/default');
    }
  };

  const handleVerifyTransaction = async (tx: RevenueTransaction, approve: boolean) => {
    try {
      await updateDoc(doc(db, 'transactions', tx.id), {
        status: approve ? 'Verified' : 'Rejected',
        verifiedBy: user.uid,
        updatedAt: serverTimestamp(),
      });

      if (approve) {
        if (tx.txType === 'contractor_package' && tx.referenceId) {
          const parsedTier = tx.referenceId.split(' ')[0];
          const validTier = ['Basic', 'Professional', 'Premium'].includes(parsedTier) ? parsedTier : 'Basic';
          const quotaMatch = tx.referenceId.match(/\((\d+)\s+quota\)/i);
          const quotaLimit = quotaMatch ? Math.min(1000, Number(quotaMatch[1])) : validTier === 'Premium' ? 300 : validTier === 'Professional' ? 50 : 10;
          await updateDoc(doc(db, 'contractors', tx.userId), {
            packageTier: validTier,
            leadQuotaLimit: quotaLimit,
            updatedAt: serverTimestamp(),
          });
        }
        if (tx.txType === 'technician_membership') {
          await updateDoc(doc(db, 'technicians', tx.userId), {
            membershipStatus: 'active',
            updatedAt: serverTimestamp(),
          });
        }
        if (tx.txType === 'booking_payment' && tx.referenceId) {
          await updateDoc(doc(db, 'bookings', tx.referenceId), {
            paymentStatus: 'Verified',
            updatedAt: serverTimestamp(),
          });
        }
        if (tx.txType === 'order_payment' && tx.referenceId) {
          await updateDoc(doc(db, 'orders', tx.referenceId), {
            paymentStatus: 'Verified',
            updatedAt: serverTimestamp(),
          });
        }
      }

      await createNotification(
        tx.userId,
        approve ? 'Payment Verified' : 'Payment Rejected',
        `Your ${tx.txType.replace('_', ' ')} (UTR: ${tx.utrReference}) was ${approve ? 'verified' : 'rejected'} by Admin.`,
        'payment'
      );
      setStatusMsg(`Transaction ${approve ? 'verified' : 'rejected'}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `transactions/${tx.id}`);
    }
  };

  const handleVerifyPartner = async (collectionName: 'technicians' | 'shops' | 'contractors', id: string) => {
    try {
      await updateDoc(doc(db, collectionName, id), {
        verified: true,
        updatedAt: serverTimestamp(),
      });
      setStatusMsg(`Verified ${collectionName.slice(0, -1)} account.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${collectionName}/${id}`);
    }
  };

  const handleResolveComplaint = async (c: Complaint) => {
    try {
      await updateDoc(doc(db, 'complaints', c.id), {
        status: 'Resolved',
        resolutionNote: 'Reviewed and resolved by Administrator.',
        updatedAt: serverTimestamp(),
      });
      setStatusMsg('Complaint marked Resolved.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `complaints/${c.id}`);
    }
  };

  const handleConsultAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/ai/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentRole: aiRole,
          zone: aiZone,
          prompt: aiPrompt.trim(),
          metricsSummary: metrics,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI consultation failed');

      await addDoc(collection(db, 'aiDecisions'), {
        agentRole: aiRole,
        zone: aiZone,
        title: String(data.title || `${aiRole} Brief`).slice(0, 160),
        summary: String(data.summary || '').slice(0, 1500),
        recommendedAction: String(data.recommendedAction || '').slice(0, 400),
        requiresApproval: Boolean(data.requiresHumanApproval),
        approvalStatus: data.requiresHumanApproval ? 'Pending' : 'Informational',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setAiPrompt('');
      setStatusMsg(`${aiRole} report logged.`);
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'AI Management consultation error.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleDecisionApproval = async (id: string, approve: boolean) => {
    try {
      await updateDoc(doc(db, 'aiDecisions', id), {
        approvalStatus: approve ? 'Approved' : 'Rejected',
        approvedBy: user.uid,
        updatedAt: serverTimestamp(),
      });
      setStatusMsg(`AI recommendation ${approve ? 'Approved' : 'Rejected'}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `aiDecisions/${id}`);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Administrator Master Console</h2>
          <p className="text-sm text-slate-600">
            Central governance for Mumbai clusters, revenue streams, partner verification, disputes, and the AI Management Team.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
          >
            <option value="All">All Mumbai Zones</option>
            {zones.map((z) => (
              <option key={z.id} value={z.name}>
                {z.name}
              </option>
            ))}
          </select>
          <div ref={exportMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setExportMenuOpen((prev) => !prev)}
              aria-expanded={exportMenuOpen}
              aria-haspopup="menu"
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" /> Export
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {exportMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg z-40"
              >
                <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Data &amp; Reports
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleExportCSV}
                  className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-800 hover:bg-slate-100"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
                  <div>
                    <div>Export CSV Report</div>
                    <div className="text-[11px] font-normal text-slate-500">Operational metrics spreadsheet</div>
                  </div>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleExportJSON}
                  className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-800 hover:bg-slate-100"
                >
                  <FileCode className="w-4 h-4 text-slate-600 shrink-0" />
                  <div>
                    <div>Export JSON Snapshot</div>
                    <div className="text-[11px] font-normal text-slate-500">Metrics + Mumbai cluster counts</div>
                  </div>
                </button>

                <div className="my-1 border-t border-slate-200" />
                <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Android APK &amp; Play Store (.aab)
                </div>
                <a
                  href="/all-in-one-skill-android-kit.tar.gz"
                  download="all-in-one-skill-android-kit.tar.gz"
                  role="menuitem"
                  onClick={() => setExportMenuOpen(false)}
                  className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-900 bg-slate-100 hover:bg-slate-200 mb-1"
                >
                  <Download className="w-4 h-4 text-slate-900 shrink-0" />
                  <div>
                    <div>Download Android Build Kit (.tar.gz)</div>
                    <div className="text-[11px] font-normal text-slate-600">All TWA + Gradle signing + CI files</div>
                  </div>
                </a>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleDownloadTwaManifest}
                  className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-800 hover:bg-slate-100"
                >
                  <Smartphone className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <div>Download TWA Manifest (.json)</div>
                    <div className="text-[11px] font-normal text-slate-500">Bubblewrap APK / AAB config</div>
                  </div>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleDownloadApkBuildScript}
                  className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-800 hover:bg-slate-100"
                >
                  <Download className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <div>Download APK / AAB Build Script</div>
                    <div className="text-[11px] font-normal text-slate-500">Generates .apk &amp; .aab via Android SDK</div>
                  </div>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setExportMenuOpen(false);
                    setAndroidModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-900 bg-amber-50 hover:bg-amber-100 mt-1"
                >
                  <Smartphone className="w-4 h-4 text-amber-700 shrink-0" />
                  <div>
                    <div>Android APK &amp; AAB Build Guide</div>
                    <div className="text-[11px] font-normal text-amber-800">Project files &amp; Play Console setup</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {statusMsg && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900">
          {statusMsg}
        </div>
      )}

      {/* Admin Sub-Navigation */}
      <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-slate-100 w-fit">
        {(
          [
            ['overview', 'Metrics Overview'],
            ['zones', 'Mumbai Clusters'],
            ['revenue', 'Fees & Packages'],
            ['approvals', `Verifications & Disputes (${transactions.filter((t) => t.status === 'Pending Verification').length + metrics.openComplaints})`],
            ['grading', `Tech Grading & Docs (${technicianTests.filter((t) => t.assignedGrade === 'Pending').length + technicianCredentials.filter((c) => c.verificationStatus === 'Pending').length})`],
            ['ai', 'AI Management Team'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setAdminTab(key)}
            className={`min-h-[38px] px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              adminTab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {adminTab === 'overview' && (
        <div className="space-y-6">
          <DashboardOverviewCard
            selectedZone={zoneFilter}
            onResetZone={() => setZoneFilter('All')}
          />

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              ['Total Customers', metrics.customersCount],
              ['Available Techs', metrics.availableTechs],
              ['Busy Techs', metrics.busyTechs],
              ['Inactive Techs', metrics.inactiveTechs],
              ['Total Bookings', metrics.totalBookings],
              ['Completed Jobs', metrics.completedBookings],
              ['Cancelled Jobs', metrics.cancelledBookings],
              ['Seller Orders', metrics.totalOrders],
              ['Open Complaints', metrics.openComplaints],
              ['Verified Revenue', formatINR(metrics.totalRevenue)],
              ['Commissions', formatINR(metrics.totalCommission)],
              ['Memberships + Packages', formatINR(metrics.membershipPayments + metrics.contractorPackageRevenue)],
            ].map(([label, val]) => (
              <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-xs text-slate-500">{label}</div>
                <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">{val}</div>
              </div>
            ))}
          </div>

          <AdminZoneHeatmap
            zones={zones}
            technicians={technicians}
            shops={shops}
            contractors={contractors}
            bookings={bookings}
            selectedZone={zoneFilter}
            onSelectZone={setZoneFilter}
          />

          <MumbaiClusterMap
            zones={zones}
            technicians={technicians}
            shops={shops}
            contractors={contractors}
            bookings={bookings}
            selectedZone={zoneFilter}
            onSelectZone={setZoneFilter}
          />

          <ClusterChartsSection
            zones={zones}
            technicians={technicians}
            bookings={bookings}
            selectedZone={zoneFilter}
            onSelectZone={setZoneFilter}
          />

          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-900">
                Zone-Wise Registrations & Activity (Mumbai · {metrics.zoneStats.filter((z) => zoneFilter === 'All' || z.zone === zoneFilter).length} Localities)
              </h3>
            </div>
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto border border-slate-100 rounded-lg">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th className="py-2.5 pl-3 pr-4">Mumbai Cluster</th>
                    <th className="py-2.5 px-4 text-right">Technicians</th>
                    <th className="py-2.5 px-4 text-right">Shopkeepers</th>
                    <th className="py-2.5 px-4 text-right">Contractors</th>
                    <th className="py-2.5 pl-4 pr-3 text-right">Bookings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                  {metrics.zoneStats
                    .filter((z) => zoneFilter === 'All' || z.zone === zoneFilter)
                    .map((z) => (
                      <tr key={z.zone}>
                        <td className="py-2.5 pl-3 pr-4 font-sans font-medium text-slate-900">{z.zone}</td>
                        <td className="py-2.5 px-4 text-right">{z.technicians}</td>
                        <td className="py-2.5 px-4 text-right">{z.shops}</td>
                        <td className="py-2.5 px-4 text-right">{z.contractors}</td>
                        <td className="py-2.5 pl-4 pr-3 text-right">{z.bookings}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {adminTab === 'zones' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form onSubmit={handleAddZone} className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-6 space-y-4 h-fit">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-600" />
                <h3 className="text-base font-semibold text-slate-900">Add Mumbai Area / Sub-Zone</h3>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Cluster Name</label>
                <input
                  type="text"
                  required
                  value={newZoneName}
                  onChange={(e) => setNewZoneName(e.target.value)}
                  placeholder="e.g. Powai"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Sub-Zones (comma-separated)</label>
                <input
                  type="text"
                  value={newSubZones}
                  onChange={(e) => setNewSubZones(e.target.value)}
                  placeholder="Hiranandani, Chandivali, IIT Area"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="min-h-[44px] w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                Add Mumbai Cluster
              </button>
            </form>

            <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-white p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-slate-900">
                  Active Service Clusters ({zones.length})
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={zoneSearch}
                      onChange={(e) => setZoneSearch(e.target.value)}
                      placeholder="Filter locality or sub-zone..."
                      className="min-h-[38px] w-56 rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSyncDefaultZones}
                    disabled={syncingZones}
                    className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingZones ? 'animate-spin' : ''}`} />
                    {syncingZones ? 'Syncing...' : 'Sync All Mumbai Zones'}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-1">
                {zones
                  .filter((z) => {
                    const q = zoneSearch.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      z.name.toLowerCase().includes(q) ||
                      z.subZones.some((sz) => sz.toLowerCase().includes(q))
                    );
                  })
                  .map((z) => (
                    <div key={z.id} className="rounded-lg border border-slate-200 p-4">
                      <div className="font-semibold text-slate-900">{z.name}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {z.subZones.length > 0 ? z.subZones.join(' · ') : 'Primary cluster'}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <AdminZoneHeatmap
            zones={zones}
            technicians={technicians}
            shops={shops}
            contractors={contractors}
            bookings={bookings}
            selectedZone={zoneFilter}
            onSelectZone={setZoneFilter}
          />

          <MumbaiClusterMap
            zones={zones}
            technicians={technicians}
            shops={shops}
            contractors={contractors}
            bookings={bookings}
            selectedZone={zoneFilter}
            onSelectZone={setZoneFilter}
          />
        </div>
      )}

      {adminTab === 'revenue' && (
        <form onSubmit={handleSavePlatformConfig} className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-600" />
            <h3 className="text-base font-semibold text-slate-900">Revenue Model, Commissions & Package Pricing</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Service Commission (%)</label>
              <input
                type="number"
                min={0}
                max={50}
                value={cfg.bookingCommissionPercent}
                onChange={(e) => setCfg({ ...cfg, bookingCommissionPercent: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Customer Booking Fee (INR)</label>
              <input
                type="number"
                min={0}
                value={cfg.customerBookingCharge}
                onChange={(e) => setCfg({ ...cfg, customerBookingCharge: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tech Monthly Fee (INR)</label>
              <input
                type="number"
                min={0}
                value={cfg.technicianMonthlyFee}
                onChange={(e) => setCfg({ ...cfg, technicianMonthlyFee: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tech Yearly Fee (INR)</label>
              <input
                type="number"
                min={0}
                value={cfg.technicianYearlyFee}
                onChange={(e) => setCfg({ ...cfg, technicianYearlyFee: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Product Promo / Day (INR)</label>
              <input
                type="number"
                min={0}
                value={cfg.promotionDailyRate}
                onChange={(e) => setCfg({ ...cfg, promotionDailyRate: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-900">Contractor Subscription Packages</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {cfg.contractorPackages.map((pkg, idx) => (
                <div key={pkg.tier} className="rounded-lg border border-slate-200 p-4 space-y-2">
                  <div className="font-semibold text-sm text-slate-900">{pkg.tier} Package</div>
                  <label className="block text-xs text-slate-600">
                    Price (INR)
                    <input
                      type="number"
                      min={0}
                      value={pkg.price}
                      onChange={(e) => {
                        const next = [...cfg.contractorPackages];
                        next[idx] = { ...next[idx], price: Number(e.target.value) };
                        setCfg({ ...cfg, contractorPackages: next });
                      }}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-mono"
                    />
                  </label>
                  <label className="block text-xs text-slate-600">
                    Validity (Days)
                    <input
                      type="number"
                      min={1}
                      value={pkg.validityDays}
                      onChange={(e) => {
                        const next = [...cfg.contractorPackages];
                        next[idx] = { ...next[idx], validityDays: Number(e.target.value) };
                        setCfg({ ...cfg, contractorPackages: next });
                      }}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-mono"
                    />
                  </label>
                  <label className="block text-xs text-slate-600">
                    Worker Profile Limit
                    <input
                      type="number"
                      min={1}
                      value={pkg.profileLimit}
                      onChange={(e) => {
                        const next = [...cfg.contractorPackages];
                        next[idx] = { ...next[idx], profileLimit: Number(e.target.value) };
                        setCfg({ ...cfg, contractorPackages: next });
                      }}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-mono"
                    />
                  </label>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="min-h-[44px] rounded-lg bg-amber-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-amber-700"
          >
            Save Revenue & Package Settings
          </button>
        </form>
      )}

      {adminTab === 'approvals' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Payment & UTR Verification Queue</h3>
            {transactions.filter((t) => t.status === 'Pending Verification').length === 0 ? (
              <p className="text-sm text-slate-500">No pending payments.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {transactions
                  .filter((t) => t.status === 'Pending Verification')
                  .map((tx) => (
                    <div key={tx.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-slate-900">
                          {tx.userName} · {tx.txType.replace('_', ' ')}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">
                          Amount: {formatINR(tx.amount)} · UTR: {tx.utrReference}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleVerifyTransaction(tx, true)}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white"
                        >
                          <Check className="w-3.5 h-3.5" /> Verify
                        </button>
                        <button
                          type="button"
                          onClick={() => handleVerifyTransaction(tx, false)}
                          className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700"
                        >
                          <X className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
              <h3 className="text-base font-semibold text-slate-900">Partner Verification Queue</h3>
              {[
                ...technicians.filter((t) => !t.verified).map((t) => ({ col: 'technicians' as const, id: t.id, label: `${t.fullName} (Technician · ${t.skillCategory})` })),
                ...shops.filter((s) => !s.verified).map((s) => ({ col: 'shops' as const, id: s.id, label: `${s.shopName} (Shopkeeper)` })),
                ...contractors.filter((c) => !c.verified).map((c) => ({ col: 'contractors' as const, id: c.id, label: `${c.companyName} (Contractor)` })),
              ].map((item) => (
                <div key={`${item.col}_${item.id}`} className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-800">{item.label}</span>
                  <button
                    type="button"
                    onClick={() => handleVerifyPartner(item.col, item.id)}
                    className="rounded-md bg-slate-900 px-3 py-1 text-xs font-medium text-white"
                  >
                    Approve Badge
                  </button>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
              <h3 className="text-base font-semibold text-slate-900">Complaints & Disputes</h3>
              {complaints.length === 0 ? (
                <p className="text-sm text-slate-500">No complaints filed.</p>
              ) : (
                complaints.map((c) => (
                  <div key={c.id} className="py-2.5 border-b border-slate-100 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-slate-900">{c.subject}</span>
                      <span className="text-xs text-slate-500">{c.status}</span>
                    </div>
                    <p className="text-xs text-slate-600">{c.description}</p>
                    {c.status !== 'Resolved' && (
                      <button
                        type="button"
                        onClick={() => handleResolveComplaint(c)}
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium"
                      >
                        Mark Resolved
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {adminTab === 'grading' && <AdminTechGradingPanel />}

      {adminTab === 'ai' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleConsultAI} className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6 space-y-4 h-fit">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-amber-600" />
              <h3 className="text-base font-semibold text-slate-900">Consult AI Management Team</h3>
            </div>
            <p className="text-xs text-slate-500">
              All financial, refund, verification, and policy proposals require explicit human Administrator approval.
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">AI Executive / Manager Role</label>
              <select
                value={aiRole}
                onChange={(e) => setAiRole(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                {AI_MANAGEMENT_ROLES.map((r) => (
                  <option key={r.role} value={r.role}>
                    {r.role}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Mumbai Cluster Focus</label>
              <select
                value={aiZone}
                onChange={(e) => setAiZone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="All Mumbai Clusters">All Mumbai Clusters</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.name}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Operational Prompt</label>
              <textarea
                rows={3}
                required
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. Audit Andheri vs Bandra technician utilization and recommend campaign actions."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={aiLoading}
              className="min-h-[44px] w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              {aiLoading ? 'Generating Executive Brief...' : 'Run AI Management Brief'}
            </button>
          </form>

          <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">AI Briefs & Human Approval Queue</h3>
            {aiDecisions.length === 0 ? (
              <p className="text-sm text-slate-500">
                Consult any of the 9 AI Management Team roles on the left to generate real-time operational proposals.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {aiDecisions.map((d) => (
                  <div key={d.id} className="py-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>
                        {d.agentRole} · {d.zone || 'Mumbai'}
                      </span>
                      <span className="font-medium text-slate-700">{d.approvalStatus}</span>
                    </div>
                    <div className="text-sm font-semibold text-slate-900">{d.title}</div>
                    <p className="text-xs text-slate-600 leading-relaxed">{d.summary}</p>
                    {d.recommendedAction && (
                      <p className="text-xs text-slate-800 bg-slate-50 rounded-md px-3 py-2">
                        Recommended: {d.recommendedAction}
                      </p>
                    )}
                    {d.approvalStatus === 'Pending' && (
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleDecisionApproval(d.id, true)}
                          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white"
                        >
                          Authorize Action
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDecisionApproval(d.id, false)}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {androidModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="android-apk-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="android-apk-modal-title" className="text-lg font-bold text-slate-900">
                  Android APK &amp; Google Play (.aab) Build Kit
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Trusted Web Activity (TWA) packaging for <span className="font-mono">com.allinoneskill.mumbai</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAndroidModalOpen(false)}
                aria-label="Close modal"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950 leading-relaxed">
              Compiling a signed <span className="font-mono font-semibold">.apk</span> or Play Console{' '}
              <span className="font-mono font-semibold">.aab</span> binary requires Java JDK 17 and the Android SDK (not available directly inside a web browser or Node-only runtime). Ready-to-build Android project files are included directly in your repository under{' '}
              <span className="font-mono font-semibold">android/</span> and{' '}
              <span className="font-mono font-semibold">.github/workflows/build-android-apk.yml</span>.
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2 text-xs text-slate-700">
              <div className="font-semibold text-slate-900">Included Project Files:</div>
              <ul className="space-y-1 font-mono text-[11px] text-slate-700">
                <li>• android/twa-manifest.json (TWA config &amp; icons)</li>
                <li>• android/build-apk.sh (Local Bubblewrap build script)</li>
                <li>• .github/workflows/build-android-apk.yml (CI .apk + .aab build)</li>
              </ul>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleDownloadTwaManifest}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" /> Download twa-manifest.json
              </button>
              <button
                type="button"
                onClick={handleDownloadApkBuildScript}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
              >
                <FileCode className="w-3.5 h-3.5 text-amber-600" /> Download build-apk.sh
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
