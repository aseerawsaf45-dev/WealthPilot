'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle2,
  RefreshCw,
  MessageCircleQuestion,
  ChevronDown,
  X,
  Check,
  Loader2,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { useInsights } from '../context/useInsights';
import { insightsFor, type Insight, type InsightAction, type InsightSegment, type Severity } from '../lib/ml';
import { api, ApiError } from '../lib/api';
import { emitUi } from '../lib/uiBus';
import { formatFact } from '../lib/money';
import type { CopilotFact } from '../types/finance';

interface PageAnswer {
  answer: string;
  insights: { title: string; description: string }[];
  facts: CopilotFact[];
  limitations: string[];
  source: 'rules' | 'llm:groq' | 'llm:gemini';
  cached: boolean;
  generatedAt: string;
}

const SEVERITY: Record<Severity, { icon: React.ElementType; ring: string; dot: string; text: string }> = {
  alert: { icon: AlertOctagon, ring: 'border-rose-200 bg-rose-50/70', dot: 'bg-rose-500', text: 'text-rose-700' },
  warn: { icon: AlertTriangle, ring: 'border-amber-200 bg-amber-50/70', dot: 'bg-amber-500', text: 'text-amber-700' },
  info: { icon: Info, ring: 'border-sky-200 bg-sky-50/60', dot: 'bg-sky-500', text: 'text-sky-700' },
  good: { icon: CheckCircle2, ring: 'border-emerald-200 bg-emerald-50/60', dot: 'bg-emerald-500', text: 'text-emerald-700' },
};

interface Props {
  segment: InsightSegment;
  /** Assistant segment id for "Ask about this page" (defaults to `segment`). */
  scope?: string;
  limit?: number;
  className?: string;
}

/**
 * "AI activity" panel shown at the top of every page:
 *  1. Instant, deterministic insights from the shared ML engine (works signed out too).
 *  2. Signed in: a short summary from /ai/page-insight — worded by AI when the user opted in,
 *     otherwise calculated text. Every number is computed on the server.
 * Actions never run on click alone; each one asks for confirmation inline.
 */
export function PageInsights({ segment, scope, limit = 4, className = '' }: Props) {
  const { preferences, accounts, budgets, addBill, addBudget, recategorizeTransactions } = useFinance();
  const report = useInsights();
  const items = useMemo(() => insightsFor(report, segment, 8), [report, segment]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [answer, setAnswer] = useState<PageAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signedIn = !!preferences.isAuthenticated;
  const aiSegment = scope ?? (segment === 'debts' ? 'planning' : segment);

  const load = useCallback(
    async (refresh = false) => {
      if (!signedIn) return;
      setLoading(true);
      setError(null);
      try {
        setAnswer(await api.post<PageAnswer>('/ai/page-insight', { segment: aiSegment, refresh }));
      } catch (e) {
        setError(e instanceof ApiError && e.status === 429 ? 'Too many requests. Try again in a minute.' : 'The summary is unavailable right now.');
      } finally {
        setLoading(false);
      }
    },
    [signedIn, aiSegment]
  );

  // Deferred one tick so the effect itself doesn't set state synchronously.
  useEffect(() => {
    const t = setTimeout(() => load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const visible = items.filter((i) => !dismissed.has(i.id));
  const shown = expanded ? visible : visible.slice(0, limit);

  const run = async (insight: Insight, action: InsightAction) => {
    setBusy(insight.id);
    try {
      switch (action.type) {
        case 'add_bill':
          await addBill({
            name: action.name,
            amountCents: action.amountCents,
            frequency: action.frequency,
            nextDueDate: action.nextDueDate,
            category: action.category,
            accountId: accounts[0]?.id ?? '',
            isAutoPay: false,
            status: 'active',
            confidence: 'detected',
          });
          break;
        case 'set_budget': {
          const existing = budgets.find((b) => b.category.toLowerCase() === action.category.toLowerCase());
          await addBudget({
            category: action.category,
            allocatedCents: action.allocatedCents,
            spentCents: existing?.spentCents ?? 0,
            period: 'monthly',
            rolloverEnabled: existing?.rolloverEnabled ?? false,
            rolloverCents: existing?.rolloverCents ?? 0,
            alertThresholdPercent: existing?.alertThresholdPercent ?? 85,
          });
          break;
        }
        case 'recategorize':
          await recategorizeTransactions(action.items);
          break;
        case 'open_tab':
          emitUi({ type: 'navigate', tab: action.tab });
          break;
        case 'filter_transactions':
          emitUi({ type: 'filter-transactions', query: action.query });
          break;
        case 'review_budget':
          emitUi({ type: 'review-budget', category: action.category });
          break;
      }
      if (action.type !== 'open_tab' && action.type !== 'filter_transactions' && action.type !== 'review_budget') setDone((d) => new Set(d).add(insight.id));
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  };

  const needsConfirm = (a: InsightAction) => a.type === 'add_bill' || a.type === 'set_budget' || a.type === 'recategorize';
  const sourceLabel = answer?.source === 'rules' ? 'Calculated by WealthPilot' : answer ? `Worded by AI (${answer.source === 'llm:gemini' ? 'Gemini' : 'Groq'}) · numbers by WealthPilot` : '';

  return (
    <section aria-label="Insights for this page" className={`wp-ai-panel keel-card relative overflow-hidden p-5 sm:p-6 ${className}`}>
      <div aria-hidden className="wp-ai-glow pointer-events-none absolute -top-24 -right-20 h-56 w-56 rounded-full bg-gradient-to-br from-sky-400/25 via-indigo-400/20 to-fuchsia-400/10 blur-3xl" />

      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="wp-ai-orb relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md shadow-indigo-500/25">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-extrabold tracking-tight text-[#0F172A]">AI insights</h2>
            <p className="text-[11px] font-medium text-slate-500">From your own data · nothing changes until you confirm</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {signedIn && (
            <button
              type="button"
              onClick={() => load(true)}
              disabled={loading}
              className="btn-anim inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 cursor-pointer"
              title="Recalculate this summary"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}
          <button
            type="button"
            onClick={() => emitUi({ type: 'ask-assistant', question: '', scope: aiSegment })}
            className="btn-anim inline-flex items-center gap-1.5 rounded-full bg-[#0F172A] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800 cursor-pointer"
          >
            <MessageCircleQuestion className="h-3.5 w-3.5 text-sky-300" />
            Ask about this page
          </button>
        </div>
      </div>

      {/* Summary (signed in) */}
      {signedIn && (
        <div className="relative mt-4" aria-live="polite">
          {loading && !answer ? (
            <div className="space-y-2" aria-label="Loading summary">
              <div className="wp-skeleton h-3.5 w-11/12 rounded-full" />
              <div className="wp-skeleton h-3.5 w-8/12 rounded-full" />
            </div>
          ) : error && !answer ? (
            <p className="text-xs font-medium text-slate-500">{error}</p>
          ) : answer ? (
            <div className={`wp-fade-swap ${loading ? 'opacity-60' : ''}`}>
              <p className="text-sm font-medium leading-relaxed text-slate-800">{answer.answer}</p>
              {answer.insights.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {answer.insights.slice(0, 3).map((i) => (
                    <li key={i.title} className="text-xs text-slate-600">
                      <strong className="font-bold text-slate-800">{i.title}:</strong> {i.description}
                    </li>
                  ))}
                </ul>
              )}
              {answer.facts.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {answer.facts.slice(0, 6).map((f) => (
                    <span key={f.id} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-[10px] font-semibold text-slate-600" title={f.kind === 'estimate' ? 'Estimate' : 'From your records'}>
                      {f.label}: <span className="font-money font-bold text-slate-900">{formatFact(f)}</span>
                      {f.kind === 'estimate' && <span className="text-slate-400">est.</span>}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-2 text-[10px] font-semibold text-slate-400">
                {sourceLabel}
                {answer.cached ? ' · saved summary' : ''}
                {answer.limitations[0] ? ` · ${answer.limitations[0]}` : ''}
              </p>
            </div>
          ) : null}
        </div>
      )}

      {/* Deterministic insight cards */}
      {visible.length > 0 ? (
        <ul className="wp-stagger relative mt-4 grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {shown.map((i) => {
            const sev = SEVERITY[i.severity];
            const Icon = sev.icon;
            const isDone = done.has(i.id);
            return (
              <li key={i.id} className={`wp-insight group relative rounded-2xl border p-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${sev.ring}`}>
                <div className="flex items-start gap-2.5">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${sev.text}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[#0F172A]">{i.title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">{i.detail}</p>
                    <p className="mt-1 text-[10px] font-medium text-slate-400" title={i.method}>
                      How: {i.method}
                    </p>
                    {i.action && !isDone && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {confirming === i.id ? (
                          <>
                            <button
                              type="button"
                              disabled={busy === i.id}
                              onClick={() => run(i, i.action!.action)}
                              className="btn-anim inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-60 cursor-pointer"
                            >
                              {busy === i.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                              Confirm: {i.action.label}
                            </button>
                            <button type="button" onClick={() => setConfirming(null)} className="btn-anim rounded-full px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer">
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => (needsConfirm(i.action!.action) ? setConfirming(i.id) : run(i, i.action!.action))}
                            className="btn-anim inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-bold text-slate-700 hover:border-slate-400 hover:text-slate-950 cursor-pointer"
                          >
                            {i.action.label}
                          </button>
                        )}
                      </div>
                    )}
                    {isDone && (
                      <p className="wp-pop mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                        <Check className="h-3 w-3" /> Done
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label={`Hide "${i.title}"`}
                    onClick={() => setDismissed((d) => new Set(d).add(i.id))}
                    className="rounded-full p-1 text-slate-400 opacity-0 transition-opacity hover:bg-white hover:text-slate-700 group-hover:opacity-100 focus-visible:opacity-100 cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        !loading && <p className="relative mt-3 text-xs font-medium text-slate-500">Nothing needs your attention here right now.</p>
      )}

      {visible.length > limit && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="btn-anim relative mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 hover:text-sky-900 cursor-pointer"
        >
          {expanded ? 'Show less' : `Show ${visible.length - limit} more`}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}

      {!signedIn && (
        <p className="relative mt-3 text-[10px] font-semibold text-slate-400">Calculated in your browser from demo data. Sign in to get AI-worded summaries of your own data.</p>
      )}
    </section>
  );
}
