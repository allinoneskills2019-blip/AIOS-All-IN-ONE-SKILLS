import React, { useEffect, useMemo, useRef, useState } from 'react';
import { addDoc, collection, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { Building2, CheckCircle2, Star, UserPlus } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useMarketplace } from '../context/MarketplaceContext';
import { db } from '../lib/firebase';
import { formatINR, getExperienceCategory, SKILL_CATEGORIES } from '../lib/constants';
import { translateAvailability, translateSkillCategory } from '../lib/i18n';
import { handleFirestoreError, OperationType } from '../lib/firestoreError';
import type { ProjectRequirement, TechnicianProfile, TechnicianReview } from '../types';
import { BillingMembershipsSection } from './BillingMembershipsSection';

interface ContractorDashboardProps {
  onRequireAuth: () => void;
}

export const ContractorDashboard: React.FC<ContractorDashboardProps> = ({ onRequireAuth }) => {
  const {
    user,
    userAccount,
    zones,
    contractors,
    projects,
    technicians,
    technicianReviews,
    hires,
    platformConfig,
    createNotification,
  } = useMarketplace();
  const { language, t } = useLanguage();

  const reviewsByTech = useMemo(() => {
    const map = new Map<string, TechnicianReview[]>();
    for (const r of technicianReviews) {
      const list = map.get(r.technicianId) || [];
      list.push(r);
      map.set(r.technicianId, list);
    }
    return map;
  }, [technicianReviews]);

  const myProfile = useMemo(() => contractors.find((c) => c.ownerId === user?.uid) || null, [contractors, user]);
  const myProjects = useMemo(() => projects.filter((p) => p.contractorId === user?.uid), [projects, user]);
  const myHires = useMemo(() => hires.filter((h) => h.contractorId === user?.uid), [hires, user]);

  const [companyName, setCompanyName] = useState(myProfile?.companyName || '');
  const [contactName, setContactName] = useState(myProfile?.contactName || userAccount?.displayName || '');
  const [clusterZone, setClusterZone] = useState(myProfile?.clusterZone || userAccount?.clusterZone || 'Bandra');
  const [specialization, setSpecialization] = useState(myProfile?.specialization || 'Residential & Commercial Fit-outs');
  const [licenseNumber, setLicenseNumber] = useState(myProfile?.licenseNumber || '');
  const [pastWorkHistory, setPastWorkHistory] = useState(myProfile?.pastWorkHistory || '');
  const hydratedProfileId = useRef<string | null>(null);

  useEffect(() => {
    if (myProfile && hydratedProfileId.current !== myProfile.id) {
      hydratedProfileId.current = myProfile.id;
      setCompanyName(myProfile.companyName || '');
      setContactName(myProfile.contactName || '');
      setClusterZone(myProfile.clusterZone || 'Bandra');
      setSpecialization(myProfile.specialization || '');
      setLicenseNumber(myProfile.licenseNumber || '');
      setPastWorkHistory(myProfile.pastWorkHistory || '');
    }
  }, [myProfile]);

  const [projTitle, setProjTitle] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [projZone, setProjZone] = useState('Andheri');
  const [projSkill, setProjSkill] = useState<string>(SKILL_CATEGORIES[0]);
  const [workersNeeded, setWorkersNeeded] = useState('4');
  const [engagementType, setEngagementType] = useState<'daily' | 'monthly' | 'contract'>('monthly');
  const [budgetPerWorker, setBudgetPerWorker] = useState('22000');

  const [workerSkillFilter, setWorkerSkillFilter] = useState('All');
  const [workerZoneFilter, setWorkerZoneFilter] = useState('All');
  const [workerCategoryFilter, setWorkerCategoryFilter] = useState<'All' | 'A' | 'B' | 'C'>('All');
  const [minExpFilter, setMinExpFilter] = useState('0');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900">{t.contractor.authTitle}</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          {t.contractor.authDesc}
        </p>
        <button
          type="button"
          onClick={onRequireAuth}
          className="min-h-[44px] rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          {t.contractor.authCta}
        </button>
      </div>
    );
  }

  const activePackageCfg = platformConfig.contractorPackages.find(
    (pkg) => pkg.tier === (myProfile?.packageTier || 'None')
  );
  const profileLimit = myProfile?.leadQuotaLimit ?? activePackageCfg?.profileLimit ?? 5;
  const profilesUsed = myProfile?.leadQuotaUsed ?? myProfile?.profilesAccessed ?? 0;

  const filteredWorkers = useMemo(() => {
    const minExp = Number(minExpFilter) || 0;
    return technicians.filter((t) => {
      const skillOk = workerSkillFilter === 'All' || t.skillCategory === workerSkillFilter;
      const zoneOk =
        workerZoneFilter === 'All' ||
        t.clusterZone === workerZoneFilter ||
        (t.preferredLocations || []).includes(workerZoneFilter);
      const expOk = t.experienceYears >= minExp;
      const tier =
        t.adminGrade && t.adminGrade !== 'Pending'
          ? t.adminGrade
          : t.experienceCategory || getExperienceCategory(t.experienceYears);
      const catOk = workerCategoryFilter === 'All' || tier === workerCategoryFilter;
      return skillOk && zoneOk && expOk && catOk;
    });
  }, [technicians, workerSkillFilter, workerZoneFilter, workerCategoryFilter, minExpFilter]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    const ref = doc(db, 'contractors', user.uid);
    try {
      if (myProfile) {
        await updateDoc(ref, {
          companyName: companyName.trim(),
          contactName: contactName.trim(),
          clusterZone,
          specialization: specialization.trim(),
          licenseNumber: licenseNumber.trim().slice(0, 80),
          pastWorkHistory: pastWorkHistory.trim().slice(0, 1000),
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(ref, {
          ownerId: user.uid,
          companyName: companyName.trim(),
          contactName: contactName.trim(),
          clusterZone,
          specialization: specialization.trim(),
          licenseNumber: licenseNumber.trim().slice(0, 80),
          pastWorkHistory: pastWorkHistory.trim().slice(0, 1000),
          packageTier: 'None',
          profilesAccessed: 0,
          leadQuotaLimit: 5,
          leadQuotaUsed: 0,
          verified: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      setStatusMsg('Contractor company profile saved.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `contractors/${user.uid}`);
    }
  };

  const handlePostProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myProfile) {
      setStatusMsg('Save your contractor profile first.');
      return;
    }
    try {
      await addDoc(collection(db, 'projects'), {
        contractorId: user.uid,
        companyName: myProfile.companyName,
        title: projTitle.trim(),
        description: projDesc.trim(),
        clusterZone: projZone,
        requiredSkill: projSkill,
        workersNeeded: Math.max(1, Number(workersNeeded) || 1),
        hiredCount: 0,
        engagementType,
        budgetPerWorker: Math.max(0, Number(budgetPerWorker) || 0),
        status: 'Open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setProjTitle('');
      setProjDesc('');
      setStatusMsg('Construction project requirement published.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'projects');
    }
  };

  const handleHireWorker = async (tech: TechnicianProfile) => {
    const project = myProjects.find((p) => p.id === selectedProjectId) || myProjects[0];
    if (!project) {
      setStatusMsg('Create a construction project first so you can assign workers to it.');
      return;
    }
    if (profilesUsed >= profileLimit) {
      setStatusMsg(`Lead quota reached (${profilesUsed}/${profileLimit}). Upgrade your Membership quota (10 / 50 / 300 leads) below to continue hiring.`);
      return;
    }
    try {
      await addDoc(collection(db, 'hires'), {
        projectId: project.id,
        projectTitle: project.title,
        contractorId: user.uid,
        technicianId: tech.ownerId,
        technicianName: tech.fullName,
        engagementType: project.engagementType,
        agreedRate: project.budgetPerWorker || tech.expectedCharge,
        status: 'Requested',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (myProfile) {
        await updateDoc(doc(db, 'contractors', user.uid), {
          profilesAccessed: (myProfile.profilesAccessed ?? 0) + 1,
          leadQuotaUsed: profilesUsed + 1,
          updatedAt: serverTimestamp(),
        });
      }
      await createNotification(
        tech.ownerId,
        'New Contractor Job Offer',
        `${myProfile?.companyName || 'A contractor'} invited you to "${project.title}" in ${project.clusterZone}.`,
        'job'
      );
      setStatusMsg(`Workforce request sent to ${tech.fullName} for "${project.title}".`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'hires');
    }
  };

  const handleUpdateProjectStatus = async (project: ProjectRequirement, nextStatus: ProjectRequirement['status']) => {
    try {
      await updateDoc(doc(db, 'projects', project.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      setStatusMsg(`Project marked ${nextStatus}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `projects/${project.id}`);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t.contractor.dashboardTitle}</h2>
          <p className="text-sm text-slate-600">
            {myProfile
              ? `${myProfile.companyName} · ${myProfile.packageTier} · ${profilesUsed}/${profileLimit}`
              : t.contractor.profileTitle}
          </p>
        </div>
        {myProfile?.verified && (
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="w-4 h-4" /> {t.contractor.verifiedContractor}
          </div>
        )}
      </div>

      {statusMsg && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900">
          {statusMsg}
        </div>
      )}

      {/* Billing & Memberships (Quota 5 / 10 / 50 / 300 Leads + UPI/Card Checkout) */}
      <BillingMembershipsSection
        role="contractor"
        currentTier={myProfile?.packageTier}
        membershipStatus={myProfile?.packageTier !== 'None' ? 'active' : 'none'}
        quotaUsed={profilesUsed}
        quotaLimit={profileLimit}
        expiresAt={myProfile?.membershipExpiresAt}
        onStatusMessage={setStatusMsg}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Company Profile */}
        <form onSubmit={handleSaveProfile} className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6 space-y-4 h-fit">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-700" />
            <h3 className="text-base font-semibold text-slate-900">{t.contractor.profileTitle}</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Company / Contractor Name</label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Sahyadri Infra & Fitouts"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Primary Contact Name</label>
              <input
                type="text"
                required
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Base Mumbai Cluster</label>
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
              <label className="block text-xs font-medium text-slate-700 mb-1">Specialization</label>
              <input
                type="text"
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Contractor License / GST / PWD Reg. No.
              </label>
              <input
                type="text"
                maxLength={80}
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="e.g. PWD-MH-2024-88412"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Past Work History &amp; Major Projects
              </label>
              <textarea
                rows={3}
                maxLength={1000}
                value={pastWorkHistory}
                onChange={(e) => setPastWorkHistory(e.target.value)}
                placeholder="Completed housing societies, commercial fit-outs, or MEP contracts across Mumbai..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            className="min-h-[44px] w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            {myProfile ? 'Update Company Profile' : 'Save Contractor Profile'}
          </button>
        </form>

        {/* Post Project Requirement */}
        <form onSubmit={handlePostProject} className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h3 className="text-base font-semibold text-slate-900">{t.contractor.postProjectTitle}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Project Title</label>
              <input
                type="text"
                required
                value={projTitle}
                onChange={(e) => setProjTitle(e.target.value)}
                placeholder="e.g. Bandra Commercial MEP Wiring"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Site Location (Mumbai)</label>
              <select
                value={projZone}
                onChange={(e) => setProjZone(e.target.value)}
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
              <label className="block text-xs font-medium text-slate-700 mb-1">Required Skill</label>
              <select
                value={projSkill}
                onChange={(e) => setProjSkill(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                {SKILL_CATEGORIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Workers Needed</label>
              <input
                type="number"
                min={1}
                max={500}
                required
                value={workersNeeded}
                onChange={(e) => setWorkersNeeded(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Engagement Model</label>
              <select
                value={engagementType}
                onChange={(e) => setEngagementType(e.target.value as 'daily' | 'monthly' | 'contract')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="daily">Daily Wages</option>
                <option value="monthly">Monthly Salary</option>
                <option value="contract">Project Contract</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Budget per Worker (INR)</label>
              <input
                type="number"
                min={0}
                required
                value={budgetPerWorker}
                onChange={(e) => setBudgetPerWorker(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Work Scope & Site Requirements</label>
            <textarea
              rows={2}
              value={projDesc}
              onChange={(e) => setProjDesc(e.target.value)}
              placeholder="Shift timings, safety gear, and tools required"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="min-h-[44px] rounded-lg bg-amber-600 px-5 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            {t.contractor.publishProjectBtn}
          </button>
        </form>
      </div>

      {/* Find & Hire Workers */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{t.contractor.findHireTitle}</h3>
            <p className="text-xs text-slate-500">{t.contractor.findHireSub}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {myProjects.length > 0 && (
              <select
                value={selectedProjectId || myProjects[0]?.id || ''}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
              >
                {myProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            )}
            <select
              value={workerSkillFilter}
              onChange={(e) => setWorkerSkillFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
            >
              <option value="All">{t.marketplace.allSkillCategories}</option>
              {SKILL_CATEGORIES.map((s) => (
                <option key={s} value={s}>
                  {translateSkillCategory(s, language)}
                </option>
              ))}
            </select>
            <select
              value={workerZoneFilter}
              onChange={(e) => setWorkerZoneFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
            >
              <option value="All">{t.common.allMumbaiZones}</option>
              {zones.map((z) => (
                <option key={z.id} value={z.name}>
                  {z.name}
                </option>
              ))}
            </select>
            <select
              value={workerCategoryFilter}
              onChange={(e) => setWorkerCategoryFilter(e.target.value as 'All' | 'A' | 'B' | 'C')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
            >
              <option value="All">All Grades (A / B / C)</option>
              <option value="A">Category A</option>
              <option value="B">Category B</option>
              <option value="C">Category C</option>
            </select>
            <input
              type="number"
              min={0}
              value={minExpFilter}
              onChange={(e) => setMinExpFilter(e.target.value)}
              placeholder="Min yrs"
              className="w-24 rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-mono"
            />
          </div>
        </div>

        {filteredWorkers.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">No technicians match your filters right now.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWorkers.map((tech) => {
              const expCat = tech.experienceCategory || getExperienceCategory(tech.experienceYears);
              const gradeText =
                tech.adminGrade && tech.adminGrade !== 'Pending'
                  ? `Grade ${tech.adminGrade}`
                  : `Cat ${expCat} (Exp)`;
              const techRevs = reviewsByTech.get(tech.id) || reviewsByTech.get(tech.ownerId) || [];
              const reviewCount = Math.max(techRevs.length, tech.ratingCount ?? 0);
              const avgRating =
                techRevs.length > 0
                  ? techRevs.reduce((sum, r) => sum + r.rating, 0) / techRevs.length
                  : tech.ratingAvg ?? 0;
              const latestRev = techRevs[0];
              return (
              <div key={tech.id} className="rounded-xl border border-slate-200 p-4 space-y-3 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>
                      {translateSkillCategory(tech.skillCategory, language)} · {tech.clusterZone}
                    </span>
                    <span className={tech.availabilityStatus === 'Available' ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
                      {translateAvailability(tech.availabilityStatus, language)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {tech.photoUrl && (
                      <img
                        src={tech.photoUrl}
                        alt={tech.fullName}
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 rounded-md object-cover border border-slate-200 shrink-0"
                      />
                    )}
                    <div className="font-semibold text-slate-900 truncate">{tech.fullName}</div>
                  </div>
                  <div className="text-xs text-slate-600 font-mono tabular-nums flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold text-amber-700">{gradeText}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Star className={`w-3 h-3 ${reviewCount > 0 ? 'fill-amber-400 text-amber-500' : 'text-slate-400'}`} />
                      {avgRating.toFixed(1)} ({reviewCount})
                    </span>
                    <span>·</span>
                    <span>{tech.experienceYears} {t.common.yrsExp}</span>
                    <span>·</span>
                    <span>{formatINR(tech.expectedCharge)}</span>
                  </div>
                  {latestRev?.reviewText && (
                    <p className="text-xs text-slate-600 italic line-clamp-2 pt-0.5">
                      &ldquo;{latestRev.reviewText}&rdquo; — {latestRev.customerName}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleHireWorker(tech)}
                  className="min-h-[40px] w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
                >
                  <UserPlus className="w-3.5 h-3.5" /> {t.contractor.sendHireRequest}
                </button>
              </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Active Projects & Hired Workforce */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
          <h3 className="text-base font-semibold text-slate-900">{t.contractor.yourProjects}</h3>
          {myProjects.length === 0 ? (
            <p className="text-sm text-slate-500">No projects posted yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {myProjects.map((proj) => (
                <div key={proj.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{proj.title}</div>
                    <div className="text-xs text-slate-500 font-mono tabular-nums">
                      {proj.clusterZone} · {translateSkillCategory(proj.requiredSkill, language)} · {proj.hiredCount}/{proj.workersNeeded} · {proj.status}
                    </div>
                  </div>
                  {proj.status !== 'Completed' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateProjectStatus(proj, 'Completed')}
                      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-50"
                    >
                      Complete
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
          <h3 className="text-base font-semibold text-slate-900">{t.contractor.hiredWorkers}</h3>
          {myHires.length === 0 ? (
            <p className="text-sm text-slate-500">No workforce invitations sent yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {myHires.map((hire) => (
                <div key={hire.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{hire.technicianName}</div>
                    <div className="text-xs text-slate-500">
                      {hire.projectTitle} · {hire.engagementType} · {formatINR(hire.agreedRate)}
                    </div>
                  </div>
                  <span className="text-xs font-medium text-slate-700">{hire.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
