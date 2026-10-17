'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, X, CheckCircle2, AlertTriangle, CalendarDays } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { api } from '../lib/api';
import { formatFact } from '../lib/money';
import { AiConsentDialog } from './AiConsentDialog';
import type { CopilotFact, SavingsGoal } from '../types/finance';

interface GoalPlan {
  answer: string;
  insights: { title: string; description: string }[];
  facts: CopilotFact[];
  limitations: string[];
  source: 'rules' | 'llm:groq' | 'llm:gemini';
  verdict: 'reached' | 'on_track' | 'stretch' | 'not_reachable' | 'no_data';
  steps: string[];
  milestones: { label: string; date: string }[];
}

const VERDICT: Record<GoalPlan['verdict'], { label: string; className: string }> = {
  reached: { label: 'Goal reached', className: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  on_track: { label: 'On track', className: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  stretch: { label: 'A stretch', className: 'bg-amber-50 text-amber-800 border-amber-300' },
  not_reachable: { label: 'Not reachable as planned', className: 'bg-rose-50 text-rose-700 border-rose-300' },
  no_data: { label: 'Not enough history', className: 'bg-slate-100 text-slate-700 border-slate-300' },
};

/** AI goal planner: can I reach this goal by this date on my real income and spending, and how? */
export function GoalPlanDialog({ goal, onClose }: { goal: SavingsGoal; onClose: () => void }) {
  const { preferences, updateGoal } = useFinance();
  const [targetDate, setTargetDate] = useState(goal.targetDate ?? '');
  const [plan, setPlan] = useState<GoalPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const isSignedIn = preferences.isAuthenticated === true;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const buildPlan = async () => {
    setLoading(true);
    setError(null);
    try {
      setPlan(await api.post<GoalPlan>(`/goals/${encodeURIComponent(goal.id)}/plan`, targetDate ? { targetDate } : {}));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build a plan right now.');
    } finally {
      setLoading(false);
    }
  };

  const suggestedDate = plan?.facts.find((f) => f.label === 'Realistic finish date')?.value as string | undefined;
  const keyFacts = plan?.facts.filter((f) => f.unit === 'cents' || f.label === 'Realistic finish date').slice(0, 8) ?? [];
  const verdict = plan ? VERDICT[plan.verdict] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="goal-plan-title"
        className="max-w-lg w-full max-h-[90vh] overflow-y-auto keel-card bg-white p-6 shadow-2xl animate-in zoom-in-95 border border-black/[0.08] text-xs"
      >
        <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] mb-4">
          <h3 id="goal-plan-title" className="flex items-center gap-2 text-base font-bold text-[#0F172A]">
            <Sparkles className="w-4 h-4 text-sky-600" />
            AI plan: {goal.name}
          </h3>
          <button onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-black cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!isSignedIn ? (
          <p className="text-slate-600 font-medium leading-relaxed">
            Sign in to get a plan based on your real income and spending. Demo data is not used for planning.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[160px]">
                <label htmlFor="plan-date" className="block text-slate-700 font-semibold mb-1">
                  Reach it by (leave empty for a suggested date)
                </label>
                <input
                  id="plan-date"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium"
                />
              </div>
              <button
                onClick={buildPlan}
                disabled={loading}
                className="px-5 py-2.5 rounded-full bg-[#0F172A] hover:bg-neutral-800 text-white font-semibold shadow-md disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Calculating…' : plan ? 'Recalculate' : 'Build my plan'}
              </button>
            </div>

            {!preferences.isAiEnabled && (
              <p className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-900">
                AI guidance is off, so you will get the calculated plan.{' '}
                <button onClick={() => setConsentOpen(true)} className="font-bold underline cursor-pointer">
                  Turn on AI guidance
                </button>
              </p>
            )}

            {error && (
              <p role="alert" className="text-rose-700 font-semibold">
                {error}
              </p>
            )}

            {plan && verdict && (
              <div className="space-y-4" aria-live="polite">
                <span className={`inline-block px-3 py-1 rounded-full border font-bold ${verdict.className}`}>
                  {plan.verdict === 'not_reachable' ? <AlertTriangle className="inline w-3.5 h-3.5 mr-1" /> : <CheckCircle2 className="inline w-3.5 h-3.5 mr-1" />}
                  {verdict.label}
                </span>

                <p className="text-sm text-[#0F172A] leading-relaxed">{plan.answer}</p>
                {plan.insights.length > 0 && (
                  <ul className="space-y-1 text-slate-700">
                    {plan.insights.map((i) => (
                      <li key={i.title}>
                        <span className="font-semibold">{i.title}:</span> {i.description}
                      </li>
                    ))}
                  </ul>
                )}

                {keyFacts.length > 0 && (
                  <ul aria-label="Calculated numbers" className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {keyFacts.map((f) => (
                      <li key={f.id} className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
                        <span className="text-slate-500">{f.label}</span>
                        <span className="block font-mono font-bold text-[#0F172A]">
                          {formatFact(f)}
                          {f.kind === 'estimate' && <span className="text-amber-700 font-sans font-medium"> (estimate)</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {plan.steps.length > 0 && (
                  <div>
                    <p className="font-bold text-[#0F172A] mb-1.5">Your plan</p>
                    <ol className="list-decimal pl-5 space-y-1 text-slate-700">
                      {plan.steps.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {plan.milestones.length > 0 && (
                  <div>
                    <p className="font-bold text-[#0F172A] mb-1.5">Milestones (estimated)</p>
                    <ul className="space-y-1">
                      {plan.milestones.map((m) => (
                        <li key={m.label} className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-slate-700">
                            <CalendarDays className="w-3.5 h-3.5 text-sky-600" />
                            {m.label}
                          </span>
                          <span className="font-mono font-semibold">{m.date}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {plan.limitations.length > 0 && (
                  <ul className="text-[11px] text-amber-800 space-y-0.5">
                    {plan.limitations.map((l) => (
                      <li key={l}>Note: {l}</li>
                    ))}
                  </ul>
                )}

                <div className="flex flex-wrap gap-2">
                  {suggestedDate && suggestedDate !== goal.targetDate && (
                    <button
                      onClick={async () => {
                        await updateGoal(goal.id, { targetDate: suggestedDate });
                        setTargetDate(suggestedDate);
                      }}
                      className="px-3.5 py-1.5 rounded-full bg-white hover:bg-sky-50 border border-sky-200 text-sky-800 font-semibold cursor-pointer"
                    >
                      Use {suggestedDate} as the deadline
                    </button>
                  )}
                </div>

                <p className="pt-2 border-t border-slate-200 text-[10px] text-slate-500 font-medium">
                  {plan.source === 'rules'
                    ? 'Calculated by WealthPilot · no AI involved'
                    : `Worded by AI (${plan.source === 'llm:gemini' ? 'Gemini' : 'Groq'}) · every number calculated by WealthPilot`}
                  . Estimates, not financial advice.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      <AiConsentDialog isOpen={consentOpen} onClose={() => setConsentOpen(false)} />
    </div>
  );
}
