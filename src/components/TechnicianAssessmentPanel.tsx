import React, { useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { Award, ClipboardCheck, Upload } from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { db } from '../lib/firebase';
import { getCategoryTierDescription, getExperienceCategory } from '../lib/constants';
import { handleFirestoreError, OperationType } from '../lib/firestoreError';
import { getSkillTestPack } from '../lib/skillTests';
import type { TechnicianProfile } from '../types';

interface TechnicianAssessmentPanelProps {
  myTech: TechnicianProfile | null;
  skillCategory: string;
  experienceYears: number;
  fullName: string;
}

export const TechnicianAssessmentPanel: React.FC<TechnicianAssessmentPanelProps> = ({
  myTech,
  skillCategory,
  experienceYears,
  fullName,
}) => {
  const { user, technicianTests, technicianCredentials } = useMarketplace();

  // Mock Test State
  const testPack = useMemo(() => getSkillTestPack(skillCategory), [skillCategory]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [checkedPractical, setCheckedPractical] = useState<string[]>([]);
  const [fieldNotes, setFieldNotes] = useState('');
  const [submittingTest, setSubmittingTest] = useState(false);
  const [panelMsg, setPanelMsg] = useState<string | null>(null);

  const expCategory = getExperienceCategory(experienceYears);

  const myTests = useMemo(
    () => technicianTests.filter((t) => t.technicianId === user?.uid),
    [technicianTests, user]
  );

  const myCreds = useMemo(
    () => technicianCredentials.filter((c) => c.technicianId === user?.uid),
    [technicianCredentials, user]
  );

  if (!user) return null;



  const toggleChecklistItem = (item: string) => {
    setCheckedPractical((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item].slice(0, 10)
    );
  };

  const handleSubmitMockTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myTech) {
      setPanelMsg('Please save your Technician Profile above before submitting your skill mock test.');
      return;
    }

    const total = testPack.questions.length;
    const unanswered = testPack.questions.filter((q) => typeof answers[q.id] !== 'number');
    if (unanswered.length > 0) {
      setPanelMsg(`Please answer all ${total} questions in the ${testPack.skillCategory} mock test.`);
      return;
    }

    setSubmittingTest(true);
    setPanelMsg(null);
    let correct = 0;
    testPack.questions.forEach((q) => {
      if (answers[q.id] === q.correctIndex) correct += 1;
    });
    const mockScore = Math.round((correct / total) * 100);

    try {
      await addDoc(collection(db, 'technicianTests'), {
        technicianId: user.uid,
        technicianName: fullName.trim() || myTech.fullName,
        skillCategory: testPack.skillCategory,
        experienceYears: Math.max(0, Number(experienceYears) || 0),
        experienceCategory: expCategory,
        mockScore,
        correctAnswers: correct,
        totalQuestions: total,
        practicalSelfChecklist: checkedPractical,
        fieldReadinessNotes: fieldNotes.trim().slice(0, 600),
        fieldTestStatus: 'Pending',
        assignedGrade: 'Pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'technicians', user.uid), {
        experienceCategory: expCategory,
        mockTestScore: mockScore,
        mockTestStatus: 'Submitted',
        updatedAt: serverTimestamp(),
      });

      setAnswers({});
      setFieldNotes('');
      setPanelMsg(
        `${testPack.skillCategory} Mock Test submitted (${correct}/${total} correct · ${mockScore}%). Admin will conduct/review your Field Test and assign your Category Grade.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'technicianTests');
    } finally {
      setSubmittingTest(false);
    }
  };

  const latestTest = myTests[myTests.length - 1];

  return (
    <div className="space-y-8">
      {/* Category & Grading Summary Bar */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-2.5">
            <Award className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Experience Category, Mock &amp; Field Test Grading
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Technicians are categorized A / B / C by experience; final Grade (A / B / C) is assigned by the backend Admin after Mock Test, Field Test, and Document Verification.
              </p>
            </div>
          </div>
        </div>

        {panelMsg && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900">
            {panelMsg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-0 lg:divide-x divide-slate-100">
          <div className="lg:pr-5">
            <div className="text-xs font-medium text-slate-500">Experience Category</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              Category {expCategory}
            </div>
            <p className="text-xs text-slate-500 mt-1">{getCategoryTierDescription(expCategory)}</p>
          </div>
          <div className="lg:px-5">
            <div className="text-xs font-medium text-slate-500">Admin Assigned Grade</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-amber-700 mt-1">
              {myTech?.adminGrade && myTech.adminGrade !== 'Pending'
                ? `Grade ${myTech.adminGrade}`
                : 'Pending'}
            </div>
            <p className="text-xs text-slate-500 mt-1 truncate">
              {myTech?.adminGradeNotes || 'Awaiting backend Admin grading'}
            </p>
          </div>
          <div className="lg:px-5">
            <div className="text-xs font-medium text-slate-500">Skill Mock Test Score</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {typeof myTech?.mockTestScore === 'number' ? `${myTech.mockTestScore}%` : 'Not Taken'}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {myTech?.mockTestStatus === 'Submitted'
                ? `${myTests.length} attempt${myTests.length === 1 ? '' : 's'} submitted`
                : `Field test for ${skillCategory}`}
            </p>
          </div>
          <div className="lg:pl-5">
            <div className="text-xs font-medium text-slate-500">Field Test &amp; Docs</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {myTech?.fieldTestStatus || 'Pending'}
              {typeof myTech?.fieldTestScore === 'number' && myTech.fieldTestScore > 0
                ? ` (${myTech.fieldTestScore}%)`
                : ''}
            </div>
            <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
              {myCreds.length} credential file{myCreds.length === 1 ? '' : 's'} uploaded
            </p>
          </div>
        </div>
      </section>

      {/* Field-Specific Mock Test */}
      <form
        onSubmit={handleSubmitMockTest}
        className="rounded-xl border border-slate-200 bg-white p-6 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-amber-600" />
            <h3 className="text-base font-semibold text-slate-900">
              {testPack.skillCategory} Field Mock Test
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {testPack.questions.length} MCQs · Field Readiness
            </span>
            <a
              href="#credentials-upload-section"
              className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-800"
            >
              <Upload className="w-3.5 h-3.5" /> Manage Docs ({myCreds.length})
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {testPack.questions.map((q, idx) => (
            <div key={q.id} className="space-y-2 pb-4 border-b border-slate-100">
              <p className="text-sm font-medium text-slate-900">
                <span className="font-mono text-slate-500 mr-1.5">Q{idx + 1}.</span>
                {q.question}
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {q.options.map((opt, optIdx) => {
                  const selected = answers[q.id] === optIdx;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: optIdx }))}
                      className={`min-h-[42px] text-left rounded-lg border px-3 py-2 text-xs transition-colors ${
                        selected
                          ? 'border-slate-900 bg-slate-900 text-white font-medium'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Practical Field Checklist */}
        <div className="border-t border-slate-200 pt-4 space-y-2.5">
          <div className="text-xs font-semibold text-slate-800">
            Practical Field Test Self-Checklist ({testPack.skillCategory})
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
            {testPack.practicalChecklist.map((item) => {
              const checked = checkedPractical.includes(item);
              return (
                <label
                  key={item}
                  className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer py-1"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleChecklistItem(item)}
                    className="mt-0.5 rounded border-slate-300"
                  />
                  <span>{item}</span>
                </label>
              );
            })}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Field Experience / Tools Note for Admin Assessor (Optional)
            </label>
            <textarea
              rows={2}
              value={fieldNotes}
              onChange={(e) => setFieldNotes(e.target.value)}
              placeholder="Mention practical projects, multimeter/testing equipment, or preferred field test center"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submittingTest}
          className="min-h-[44px] w-full sm:w-auto rounded-lg bg-amber-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
        >
          {submittingTest ? 'Submitting Test...' : 'Submit Mock Test for Grading'}
        </button>

        {latestTest && (
          <div className="border-t border-slate-100 pt-3 text-xs text-slate-600 font-mono tabular-nums">
            Latest submission: {latestTest.skillCategory} · Mock {latestTest.mockScore}% ({latestTest.correctAnswers}/{latestTest.totalQuestions}) · Field Test: {latestTest.fieldTestStatus} · Grade: {latestTest.assignedGrade}
          </div>
        )}
      </form>
    </div>
  );
};
