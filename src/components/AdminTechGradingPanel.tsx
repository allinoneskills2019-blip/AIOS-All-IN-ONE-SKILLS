import React, { useMemo, useState } from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Award, Check, ExternalLink, Eye, FileText, User, X } from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { db } from '../lib/firebase';
import { getExperienceCategory, SKILL_CATEGORIES } from '../lib/constants';
import { handleFirestoreError, OperationType } from '../lib/firestoreError';
import type {
  TechnicianCategoryGrade,
  TechnicianCredential,
  TechnicianProfile,
  TechnicianTestAttempt,
} from '../types';

export const AdminTechGradingPanel: React.FC = () => {
  const {
    user,
    technicians,
    technicianTests,
    technicianCredentials,
    createNotification,
  } = useMarketplace();

  const [expFilter, setExpFilter] = useState<'All' | 'A' | 'B' | 'C'>('All');
  const [gradeFilter, setGradeFilter] = useState<'All' | 'Pending' | 'A' | 'B' | 'C'>('All');
  const [skillFilter, setSkillFilter] = useState<string>('All');
  const [selectedTechId, setSelectedTechId] = useState<string | null>(null);
  const [previewCred, setPreviewCred] = useState<TechnicianCredential | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Grading Form State for selected technician
  const [assignedGrade, setAssignedGrade] = useState<TechnicianCategoryGrade>('B');
  const [fieldStatus, setFieldStatus] = useState<'Pending' | 'Scheduled' | 'Passed' | 'Needs Retest'>('Passed');
  const [fieldScore, setFieldScore] = useState<string>('80');
  const [adminRemarks, setAdminRemarks] = useState<string>('');
  const [alsoVerifyProfile, setAlsoVerifyProfile] = useState<boolean>(true);
  const [savingGrade, setSavingGrade] = useState(false);

  const testsByTech = useMemo(() => {
    const map = new Map<string, TechnicianTestAttempt[]>();
    technicianTests.forEach((t) => {
      const list = map.get(t.technicianId) || [];
      list.push(t);
      map.set(t.technicianId, list);
    });
    return map;
  }, [technicianTests]);

  const credsByTech = useMemo(() => {
    const map = new Map<string, TechnicianCredential[]>();
    technicianCredentials.forEach((c) => {
      const list = map.get(c.technicianId) || [];
      list.push(c);
      map.set(c.technicianId, list);
    });
    return map;
  }, [technicianCredentials]);

  const filteredTechnicians = useMemo(() => {
    return technicians.filter((t) => {
      const expCat = t.experienceCategory || getExperienceCategory(t.experienceYears);
      const currentGrade = t.adminGrade || 'Pending';
      const expOk = expFilter === 'All' || expCat === expFilter;
      const gradeOk = gradeFilter === 'All' || currentGrade === gradeFilter;
      const skillOk = skillFilter === 'All' || t.skillCategory === skillFilter;
      return expOk && gradeOk && skillOk;
    });
  }, [technicians, expFilter, gradeFilter, skillFilter]);

  const selectedTech: TechnicianProfile | null = useMemo(() => {
    if (!filteredTechnicians.length) return null;
    return (
      filteredTechnicians.find((t) => t.id === selectedTechId) ||
      filteredTechnicians[0]
    );
  }, [filteredTechnicians, selectedTechId]);

  const selectTechnician = (tech: TechnicianProfile) => {
    setSelectedTechId(tech.id);
    const expCat = tech.experienceCategory || getExperienceCategory(tech.experienceYears);
    setAssignedGrade(
      tech.adminGrade && tech.adminGrade !== 'Pending' ? tech.adminGrade : expCat
    );
    setFieldStatus(tech.fieldTestStatus || 'Pending');
    setFieldScore(String(tech.fieldTestScore ?? tech.mockTestScore ?? 0));
    setAdminRemarks(tech.adminGradeNotes || '');
    setAlsoVerifyProfile(true);
    setStatusMsg(null);
  };

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedTech) return;

    const numericScore = Math.max(0, Math.min(100, Number(fieldScore) || 0));
    setSavingGrade(true);
    setStatusMsg(null);

    try {
      await updateDoc(doc(db, 'technicians', selectedTech.id), {
        adminGrade: assignedGrade,
        adminGradeNotes: adminRemarks.trim().slice(0, 400),
        fieldTestScore: numericScore,
        fieldTestStatus: fieldStatus,
        verified: alsoVerifyProfile ? true : selectedTech.verified,
        updatedAt: serverTimestamp(),
      });

      const techAttempts = testsByTech.get(selectedTech.ownerId) || [];
      const latestAttempt = techAttempts[techAttempts.length - 1];
      if (latestAttempt) {
        await updateDoc(doc(db, 'technicianTests', latestAttempt.id), {
          assignedGrade,
          fieldTestStatus: fieldStatus,
          fieldTestScore: numericScore,
          adminRemarks: adminRemarks.trim().slice(0, 500),
          gradedBy: user.uid,
          updatedAt: serverTimestamp(),
        });
      }

      await createNotification(
        selectedTech.ownerId,
        `Category Grade ${assignedGrade} Published`,
        `Admin assigned Official Grade ${assignedGrade} (Field Test: ${fieldStatus}, Score: ${numericScore}%) to your ${selectedTech.skillCategory} profile.`,
        'system'
      );

      setStatusMsg(
        `Saved Official Grade ${assignedGrade} and Field Test (${fieldStatus} · ${numericScore}%) for ${selectedTech.fullName}.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `technicians/${selectedTech.id}`);
    } finally {
      setSavingGrade(false);
    }
  };

  const handleCredentialReview = async (
    cred: TechnicianCredential,
    nextStatus: 'Verified' | 'Rejected'
  ) => {
    try {
      await updateDoc(doc(db, 'technicianCredentials', cred.id), {
        verificationStatus: nextStatus,
        adminNote:
          nextStatus === 'Verified'
            ? 'Verified by Administrator'
            : 'Document unclear or mismatched — please re-upload.',
        updatedAt: serverTimestamp(),
      });
      await createNotification(
        cred.technicianId,
        `${cred.docType} ${nextStatus}`,
        `Your uploaded document "${cred.title}" was marked ${nextStatus} by Admin.`,
        'system'
      );
      setStatusMsg(`${cred.docType} "${cred.title}" marked ${nextStatus}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `technicianCredentials/${cred.id}`);
    }
  };

  const selectedTests = selectedTech ? testsByTech.get(selectedTech.ownerId) || [] : [];
  const selectedCreds = selectedTech ? credsByTech.get(selectedTech.ownerId) || [] : [];

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-2.5">
            <Award className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Technician Categorization (A / B / C), Field Tests &amp; Document Grading
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Inspect technician experience category, skill mock tests, and uploaded certificates/licenses/degrees to assign official Category A, B, or C grades.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={expFilter}
              onChange={(e) => setExpFilter(e.target.value as 'All' | 'A' | 'B' | 'C')}
              className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
            >
              <option value="All">All Experience Categories</option>
              <option value="A">Category A (5+ yrs)</option>
              <option value="B">Category B (2–4 yrs)</option>
              <option value="C">Category C (0–1 yr)</option>
            </select>
            <select
              value={gradeFilter}
              onChange={(e) =>
                setGradeFilter(e.target.value as 'All' | 'Pending' | 'A' | 'B' | 'C')
              }
              className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
            >
              <option value="All">All Admin Grades</option>
              <option value="Pending">Pending Grading</option>
              <option value="A">Grade A</option>
              <option value="B">Grade B</option>
              <option value="C">Grade C</option>
            </select>
            <select
              value={skillFilter}
              onChange={(e) => setSkillFilter(e.target.value)}
              className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
            >
              <option value="All">All Skills</option>
              {SKILL_CATEGORIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {statusMsg && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900">
            {statusMsg}
          </div>
        )}
      </div>

      {filteredTechnicians.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          No technicians match the selected Category or Skill filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Technician Roster List */}
          <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Technicians ({filteredTechnicians.length})
              </span>
              <span className="text-[11px] font-mono text-slate-500">Select to grade</span>
            </div>
            <div className="max-h-[620px] overflow-y-auto divide-y divide-slate-100">
              {filteredTechnicians.map((tech) => {
                const expCat = tech.experienceCategory || getExperienceCategory(tech.experienceYears);
                const credCount = (credsByTech.get(tech.ownerId) || []).length;
                const active = selectedTech?.id === tech.id;
                return (
                  <button
                    key={tech.id}
                    type="button"
                    onClick={() => selectTechnician(tech)}
                    className={`w-full text-left px-5 py-3.5 flex items-center gap-3.5 transition-colors ${
                      active ? 'bg-amber-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-lg border border-slate-200 bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                      {tech.photoUrl ? (
                        <img
                          src={tech.photoUrl}
                          alt={tech.fullName}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900 truncate">
                          {tech.fullName}
                        </span>
                        <span className="text-xs font-mono tabular-nums font-semibold text-amber-700 shrink-0">
                          {tech.adminGrade && tech.adminGrade !== 'Pending'
                            ? `Grade ${tech.adminGrade}`
                            : `Exp Cat ${expCat}`}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 truncate mt-0.5 font-mono tabular-nums">
                        {tech.skillCategory} · {tech.experienceYears} yrs · Mock:{' '}
                        {typeof tech.mockTestScore === 'number' ? `${tech.mockTestScore}%` : 'N/A'} ·{' '}
                        {credCount} doc{credCount === 1 ? '' : 's'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Inspection & Grading Desk */}
          {selectedTech && (
            <div className="lg:col-span-7 space-y-6">
              {/* Profile & Mock Test Summary */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
                <div className="flex items-start gap-4 border-b border-slate-100 pb-4">
                  <div className="w-16 h-16 rounded-xl border border-slate-200 bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                    {selectedTech.photoUrl ? (
                      <img
                        src={selectedTech.photoUrl}
                        alt={selectedTech.fullName}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-7 h-7 text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-slate-500">
                      {selectedTech.skillCategory} · {selectedTech.clusterZone} ({selectedTech.workingRadiusKm} km) · {selectedTech.verified ? 'Verified' : 'Unverified'}
                    </div>
                    <h4 className="text-lg font-bold text-slate-900 mt-0.5">
                      {selectedTech.fullName}
                    </h4>
                    <div className="text-xs text-slate-600 font-mono tabular-nums mt-1">
                      Experience: {selectedTech.experienceYears} yrs (Category{' '}
                      {selectedTech.experienceCategory || getExperienceCategory(selectedTech.experienceYears)}) · Mock Test:{' '}
                      {typeof selectedTech.mockTestScore === 'number'
                        ? `${selectedTech.mockTestScore}%`
                        : 'Not Taken'}{' '}
                      · Official Grade: {selectedTech.adminGrade || 'Pending'}
                    </div>
                  </div>
                </div>

                {/* Mock Test Attempts */}
                <div className="space-y-2.5">
                  <h5 className="text-xs font-semibold text-slate-800">
                    Field Mock Test Submissions ({selectedTests.length})
                  </h5>
                  {selectedTests.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      Technician has not submitted a skill mock test yet. Admin can still assign a grade after practical field assessment.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                      {selectedTests.map((attempt) => (
                        <div key={attempt.id} className="p-3.5 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between font-mono tabular-nums">
                            <span className="font-semibold text-slate-900">
                              {attempt.skillCategory} · Mock Score: {attempt.mockScore}% ({attempt.correctAnswers}/{attempt.totalQuestions})
                            </span>
                            <span className="text-slate-600">
                              Field: {attempt.fieldTestStatus}
                            </span>
                          </div>
                          {attempt.practicalSelfChecklist.length > 0 && (
                            <div className="text-slate-600">
                              Self-checked skills: {attempt.practicalSelfChecklist.join(' · ')}
                            </div>
                          )}
                          {attempt.fieldReadinessNotes && (
                            <div className="text-slate-500 italic">
                              Note: {attempt.fieldReadinessNotes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Uploaded Certificates, Licenses & Degrees */}
                <div className="space-y-2.5">
                  <h5 className="text-xs font-semibold text-slate-800">
                    Uploaded Certificates, Licenses &amp; Degrees ({selectedCreds.length})
                  </h5>
                  {selectedCreds.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No certificates, licenses, or degrees uploaded by this technician yet.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                      {selectedCreds.map((cred) => (
                        <div
                          key={cred.id}
                          className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
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
                            <div className="text-sm font-medium text-slate-900 truncate">
                              {cred.title}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => setPreviewCred(cred)}
                              className="min-h-[34px] inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              <Eye className="w-3.5 h-3.5" /> View
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCredentialReview(cred, 'Verified')}
                              className="min-h-[34px] inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                            >
                              <Check className="w-3.5 h-3.5" /> Verify
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCredentialReview(cred, 'Rejected')}
                              className="min-h-[34px] inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                            >
                              <X className="w-3.5 h-3.5" /> Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Admin Field Test & Grade Assignment Form */}
              <form
                onSubmit={handleSaveGrade}
                className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
              >
                <h4 className="text-base font-semibold text-slate-900">
                  Assign Field Test Score &amp; Official Grade (Backend Admin)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Official Grade (A / B / C)
                    </label>
                    <select
                      value={assignedGrade}
                      onChange={(e) => setAssignedGrade(e.target.value as TechnicianCategoryGrade)}
                      className="w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium"
                    >
                      <option value="A">Category A (Master / Top Grade)</option>
                      <option value="B">Category B (Skilled / Standard)</option>
                      <option value="C">Category C (Junior / Supervised)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Field Test Status
                    </label>
                    <select
                      value={fieldStatus}
                      onChange={(e) =>
                        setFieldStatus(
                          e.target.value as 'Pending' | 'Scheduled' | 'Passed' | 'Needs Retest'
                        )
                      }
                      className="w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Scheduled">Scheduled</option>
                      <option value="Passed">Passed</option>
                      <option value="Needs Retest">Needs Retest</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Field Test Score (0–100)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={fieldScore}
                      onChange={(e) => setFieldScore(e.target.value)}
                      className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Admin Assessment &amp; Grading Remarks
                  </label>
                  <textarea
                    rows={2}
                    value={adminRemarks}
                    onChange={(e) => setAdminRemarks(e.target.value)}
                    placeholder="Practical workmanship evaluation, tool readiness, and certificate verification summary"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alsoVerifyProfile}
                    onChange={(e) => setAlsoVerifyProfile(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span>Mark technician profile as Verified alongside Grade assignment</span>
                </label>

                <button
                  type="submit"
                  disabled={savingGrade}
                  className="min-h-[44px] rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {savingGrade ? 'Publishing Grade...' : `Publish Grade ${assignedGrade} & Field Result`}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Credential Document Preview Modal */}
      {previewCred && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="text-xs text-slate-500">
                  {previewCred.technicianName} · {previewCred.docType} · {previewCred.verificationStatus}
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
