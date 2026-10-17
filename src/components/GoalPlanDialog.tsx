'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, X, CheckCircle2, AlertTriangle, CalendarDays, RefreshCw, Loader2, Info, Clock, PiggyBank } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { formatFact, formatMoney, dollarsToCents } from '../lib/money';
import { planStaleReason, daysAgo } from '../lib/goalPlan';
import { AiConsentDialog } from './AiConsentDialog';
import type { CopilotFact, GoalPlanSnapshot, SavingsGoal } from '../types/finance';

// Class names live here (not in src/lib): Tailwind only scans src/app and src/components.
export const VERDICT_STYLE: Record<GoalPlanSnapshot['verdict'], { label: string; pill: string; Icon: typeof CheckCircle2 }> = {
  reached: { label: 'Goal reached', pill: 'bg-emerald-50 text-emerald-800 border-emerald-300', Icon: CheckCircle2 },
  on_track: { label: 'On track', pill: 'bg-emerald-50 text-emerald-800 border-emerald-300', Icon: CheckCircle2 },
  stretch: { label: 'A stretch', pill: 'bg-amber-50 text-amber-800 border-amber-300', Icon: AlertTriangle },
  not_reachable: { label: 'Not reachable as planned', pill: 'bg-rose-50 text-rose-700 border-rose-300', Icon: AlertTriangle },
  no_data: { label: 'Needs more history', pill: 'bg-slate-100 text-slate-700 border-slate-300', Icon: Info },
};

const fact = (plan: GoalPlanSnapshot, label: string): CopilotFact | undefined => plan.facts.find((f) => f.label === label);
const factText = (plan: GoalPlanSnapshot, label: string) => {
  const f = fact(plan, label);
  return f ? formatFact(f) : null;
};

/** One-line summary used on the goal card and the dialog hero. */
export function planHeadline(plan: GoalPlanSnapshot): string {
  const monthly = factText(plan, 'Needed each month to hit your deadline') ?? factText(plan, 'Suggested monthly saving');
  const realistic = factText(plan, 'Realistic finish date');
  switch (plan.verdict) {
    case 'reached':
      return 'Goal reached';
    case 'no_data':
      return 'Needs at least a week of income and spending';
    case 'not_reachable': {
      const left = fact(plan, 'Average monthly amount left over');
      const leftCents = left ? Number(left.value) : 0;
      const room = !left ? 'more than you can spare' : leftCents < 0 ? `spending is ${formatMoney(-leftCents, left.currency)} over income` : `you have ${formatFact(left)} left`;
      return monthly ? `Needs ${monthly}/mo · ${room}` : 'Not reachable on the current budget';
    }
    default:
      return `Save ${monthly}/mo${plan.targetDate ? ` · by ${plan.targetDate}` : realistic ? ` · done ~${realistic}` : ''}`;
  }
}

const GROUPS: { title: string; labels: string[] }[] = [
  { title: 'Your cash flow', labels: ['Average monthly income', 'Average monthly spending', 'Average monthly amount left over', 'Needed each month by your other goals'] },
  { title: 'This goal', labels: ['Saved so far', 'Goal target', 'Still needed'] },
  { title: 'The plan', labels: ['Needed each month to hit your deadline', 'Suggested monthly saving', 'Your deadline', 'Realistic finish date'] },
];

function addMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

const PRESETS = [
  { label: '6 months', value: () => addMonths(6) },
  { label: '1 year', value: () => addMonths(12) },
  { label: '2 years', value: () => addMonths(24) },
  { label: 'Suggest a date', value: () => '' },
];

/** AI goal planner. Shows the saved plan instantly; "Recalculate" calls the server and saves the new plan. */
export function GoalPlanDialog({ goalId, onClose }: { goalId: string; onClose: () => void }) {
  const { goals, preferences, updateGoal, planGoal, contributeToGoal } = useFinance();
  const goal = goals.find((g) => g.id === goalId) as SavingsGoal | undefined;
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const returnFocus = useRef<Element | null>(null);
  const isSignedIn = preferences.isAuthenticated === true;

  useEffect(() => {
    returnFocus.current = document.activeElement; // give focus back to the card button on close
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      (returnFocus.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  if (!goal) return null;
  const plan = goal.plan;
  const stale = plan && !justSaved ? planStaleReason(goal) : null;
  const percent = goal.targetCents > 0 ? Math.min(100, Math.round((goal.currentCents / goal.targetCents) * 100)) : 0;
  const realisticDate = plan ? factText(plan, 'Realistic finish date') : null;

  const calculate = async () => {
    setLoading(true);
    setError(null);
    const res = await planGoal(goal.id, targetDate || undefined);
    setLoading(false);
    if (res.error) setError(res.error);
    else setJustSaved(true);
  };

  const verdict = plan ? VERDICT_STYLE[plan.verdict] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/45 backdrop-blur-sm animate-in fade-in duration-200" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="goal-plan-title"
        className="w-full sm:max-w-2xl max-h-[92dvh] flex flex-col bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200/80 animate-in slide-in-from-bottom-2 duration-300 text-xs"
      >
        {/* Sticky header */}
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-slate-100">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-sky-700">
              <Sparkles className="w-3.5 h-3.5" /> AI goal plan
            </p>
            <h3 id="goal-plan-title" className="mt-0.5 text-lg font-bold text-[#0F172A] truncate">
              {goal.name}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {verdict && (
              <span className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full border font-bold ${verdict.pill}`}>
                <verdict.Icon className="w-3.5 h-3.5" />
                {verdict.label}
              </span>
            )}
            <button onClick={onClose} aria-label="Close" className="p-2 rounded-full text-slate-500 hover:text-black hover:bg-slate-100 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-5">
          {!isSignedIn ? (
            <p className="text-slate-600 font-medium leading-relaxed">
              Sign in to get a plan based on your real income and spending. Demo data is not used for planning.
            </p>
          ) : (
            <>
              {/* Deadline + presets */}
              <section aria-label="Deadline" className="space-y-2.5">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[170px]">
                    <label htmlFor="plan-date" className="block text-slate-700 font-semibold mb-1">
                      Reach it by
                    </label>
                    <input
                      id="plan-date"
                      type="date"
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                    />
                  </div>
                  <button
                    onClick={calculate}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0F172A] hover:bg-slate-800 text-white font-bold shadow-md disabled:opacity-60 cursor-pointer"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : plan ? <RefreshCw className="w-4 h-4" /> : <Sparkles className="w-4 h-4 text-sky-300" />}
                    {loading ? 'Calculating…' : plan ? 'Recalculate' : 'Build my plan'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick deadlines">
                  {PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => setTargetDate(p.value())}
                      className="px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-sky-50 hover:border-sky-200 text-slate-700 font-semibold cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </section>

              {!preferences.isAiEnabled && (
                <p className="flex items-start gap-2 p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-900">
                  <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    AI guidance is off, so you get the calculated plan.{' '}
                    <button onClick={() => setConsentOpen(true)} className="font-bold underline cursor-pointer">
                      Turn on AI guidance
                    </button>
                  </span>
                </p>
              )}

              {error && (
                <p role="alert" className="flex items-center justify-between gap-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-semibold">
                  {error}
                  <button onClick={calculate} className="underline cursor-pointer">
                    Try again
                  </button>
                </p>
              )}

              {loading && !plan && (
                <div aria-busy="true" aria-label="Calculating your plan" className="space-y-3">
                  <div className="wp-skeleton h-28" />
                  <div className="wp-skeleton h-16" />
                  <div className="wp-skeleton h-40" />
                </div>
              )}

              {!plan && !loading && !error && (
                <div className="text-center py-8 px-4 rounded-2xl border border-dashed border-slate-300 text-slate-600">
                  <Sparkles className="w-6 h-6 mx-auto text-sky-500 mb-2" />
                  <p className="font-semibold text-slate-800">No plan yet</p>
                  <p className="mt-1">Pick a deadline (or let us suggest one) and build a plan from your real income and spending.</p>
                </div>
              )}

              {plan && verdict && (
                <div className={`space-y-5 transition-opacity ${loading ? 'opacity-50' : ''}`} aria-live="polite">
                  {stale && (
                    <p className="flex items-center justify-between gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-semibold">
                      <span className="flex items-center gap-2">
                        <Clock className="w-4 h-4" /> Out of date: {stale}.
                      </span>
                      <button onClick={calculate} className="underline cursor-pointer">
                        Recalculate
                      </button>
                    </p>
                  )}
                  {justSaved && (
                    <p role="status" className="wp-pop flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
                      <CheckCircle2 className="w-4 h-4" /> Plan saved to this goal.
                    </p>
                  )}

                  {/* Hero */}
                  <section className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white">
                    <span className={`sm:hidden inline-flex items-center gap-1 mb-2 px-2.5 py-1 rounded-full border font-bold ${verdict.pill}`}>
                      <verdict.Icon className="w-3.5 h-3.5" />
                      {verdict.label}
                    </span>
                    <p className="text-xl sm:text-2xl font-bold tracking-tight">{planHeadline(plan)}</p>
                    <div className="mt-4">
                      <div className="flex justify-between text-[11px] text-slate-300 font-semibold mb-1.5">
                        <span>
                          {formatMoney(goal.currentCents)} of {formatMoney(goal.targetCents)}
                        </span>
                        <span>{percent}% saved</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/15 overflow-hidden" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                        <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-slate-300">
                      {plan.targetDate && (
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3.5 h-3.5" /> Deadline {plan.targetDate}
                        </span>
                      )}
                      {realisticDate && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> Realistic finish {realisticDate}
                        </span>
                      )}
                    </div>
                  </section>

                  {/* AI guidance */}
                  <section className="space-y-2">
                    <p className="text-sm text-[#0F172A] leading-relaxed">{plan.answer}</p>
                    {plan.insights.length > 0 && (
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {plan.insights.map((i) => (
                          <li key={i.title} className="p-3 rounded-xl bg-sky-50/70 border border-sky-100">
                            <p className="font-bold text-slate-900">{i.title}</p>
                            <p className="text-slate-600 mt-0.5">{i.description}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  {/* Numbers, grouped */}
                  <section className="grid gap-3 sm:grid-cols-3">
                    {GROUPS.map((g) => {
                      const items = g.labels.map((l) => fact(plan, l)).filter((f): f is CopilotFact => !!f);
                      if (!items.length) return null;
                      return (
                        <div key={g.title} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">{g.title}</p>
                          <dl className="space-y-1.5">
                            {items.map((f) => (
                              <div key={f.id}>
                                <dt className="text-slate-500">{f.label}</dt>
                                <dd className="font-mono font-bold text-[#0F172A]">
                                  {formatFact(f)}
                                  {f.kind === 'estimate' && <span className="font-sans font-medium text-amber-700"> est.</span>}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      );
                    })}
                  </section>

                  {/* Steps */}
                  {plan.steps.length > 0 && (
                    <section>
                      <p className="font-bold text-sm text-[#0F172A] mb-2">Your plan</p>
                      <ol className="space-y-2">
                        {plan.steps.map((s, i) => (
                          <li key={s} className="flex gap-3 items-start">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-sky-100 text-sky-800 font-bold flex items-center justify-center">{i + 1}</span>
                            <span className="pt-1 text-slate-700 leading-relaxed">{s}</span>
                          </li>
                        ))}
                      </ol>
                    </section>
                  )}

                  {/* Milestones timeline */}
                  {plan.milestones.length > 0 && (
                    <section>
                      <p className="font-bold text-sm text-[#0F172A] mb-2">Milestones (estimated)</p>
                      <ol className="relative border-l-2 border-sky-100 ml-2 space-y-3">
                        {plan.milestones.map((m) => (
                          <li key={m.label} className="pl-4 relative">
                            <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-sky-500 ring-4 ring-sky-100" />
                            <span className="font-semibold text-slate-800">{m.label}</span>
                            <span className="ml-2 font-mono text-slate-500">{m.date}</span>
                          </li>
                        ))}
                      </ol>
                    </section>
                  )}

                  {plan.limitations.length > 0 && (
                    <ul className="text-[11px] text-amber-800 space-y-0.5">
                      {plan.limitations.map((l) => (
                        <li key={l}>Note: {l}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        {isSignedIn && plan && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-3.5 border-t border-slate-100 bg-slate-50/70 rounded-b-3xl">
            <p className="text-[10px] text-slate-500 font-medium">
              {plan.source === 'rules' ? 'Calculated by WealthPilot' : `Worded by AI (${plan.source === 'llm:gemini' ? 'Gemini' : 'Groq'}) · numbers by WealthPilot`}
              {goal.planUpdatedAt && ` · saved ${daysAgo(goal.planUpdatedAt)}`} · estimates, not financial advice
            </p>
            <div className="flex gap-2">
              {realisticDate && plan.verdict !== 'on_track' && realisticDate !== goal.targetDate && (
                <button
                  onClick={async () => {
                    await updateGoal(goal.id, { targetDate: realisticDate });
                    setTargetDate(realisticDate);
                  }}
                  className="px-3.5 py-2 rounded-full bg-white hover:bg-sky-50 border border-sky-200 text-sky-800 font-bold cursor-pointer"
                >
                  Use {realisticDate} as deadline
                </button>
              )}
              <button
                onClick={async () => {
                  const input = window.prompt(`Amount to add to "${goal.name}":`, '');
                  const cents = input?.trim() ? dollarsToCents(input) : 0;
                  if (cents) await contributeToGoal(goal.id, cents);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
              >
                <PiggyBank className="w-3.5 h-3.5" /> Add money
              </button>
            </div>
          </div>
        )}
      </div>
      <AiConsentDialog isOpen={consentOpen} onClose={() => setConsentOpen(false)} />
    </div>
  );
}
