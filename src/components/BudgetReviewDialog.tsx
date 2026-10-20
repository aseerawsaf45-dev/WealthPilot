'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  X,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Target,
  Scale,
  Scissors,
  Loader2,
  Check,
  MessageCircleQuestion,
  History,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { useInsights } from '../context/useInsights';
import { formatMoney, dollarsToCents, fromMinor, displaySymbol } from '../lib/money';
import { emitUi } from '../lib/uiBus';

interface BudgetReviewDialogProps {
  category: string;
  onClose: () => void;
}

/** Rounds a budget suggestion up to a clean figure (2 significant digits). */
function roundNice(cents: number): number {
  if (cents <= 0) return 0;
  const digits = String(cents).length;
  const step = 10 ** Math.max(0, digits - 2);
  return Math.ceil(cents / step) * step;
}

export function BudgetReviewDialog({ category, onClose }: BudgetReviewDialogProps) {
  const { budgets, transactions, updateBudget, addBudget } = useFinance();
  const report = useInsights();
  const dialogRef = useRef<HTMLDivElement>(null);

  const [applying, setApplying] = useState(false);
  const [appliedAmount, setAppliedAmount] = useState<number | null>(null);
  const [customValue, setCustomValue] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);

  // Keyboard navigation & accessibility trap
  useEffect(() => {
    const el = dialogRef.current;
    el?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Data analysis
  const analysis = useMemo(() => {
    const today = report.today;
    const nowMonth = today.slice(0, 7);
    const budget = budgets.find((b) => b.category.toLowerCase() === category.toLowerCase());

    const catTxs = transactions.filter(
      (t) => t.category.toLowerCase() === category.toLowerCase() && t.amountCents < 0 && !t.isTransfer
    );
    const monthTxs = catTxs
      .filter((t) => t.financialDate.startsWith(nowMonth))
      .sort((a, b) => b.financialDate.localeCompare(a.financialDate));

    const spentCents = budget?.spentCents ?? Math.abs(monthTxs.reduce((s, t) => s + t.amountCents, 0));
    const allocatedCents = budget?.allocatedCents ?? 0;

    const elapsedPct = report.month.elapsedPct; // e.g. 65%
    const factor = Math.max(1, elapsedPct * 10);
    const projectedCents = Math.round((spentCents * 1000) / factor);
    const remainingDaysPct = Math.max(0, 100 - Math.round(elapsedPct));
    const overageCents = Math.max(0, spentCents - allocatedCents);
    const percentUsed = allocatedCents > 0 ? Math.round((spentCents * 1000) / allocatedCents) / 10 : 0;

    // Historical average (up to 3 complete previous months)
    const pastMonths = new Map<string, number>();
    for (const t of catTxs) {
      const m = t.financialDate.slice(0, 7);
      if (m < nowMonth && !t.financialDate.startsWith(nowMonth)) {
        pastMonths.set(m, (pastMonths.get(m) ?? 0) + Math.abs(t.amountCents));
      }
    }
    const historicalAvgCents =
      pastMonths.size > 0 ? Math.round([...pastMonths.values()].reduce((a, b) => a + b, 0) / pastMonths.size) : null;

    // Surplus in other categories
    const surplusCategories = budgets
      .filter((b) => b.category.toLowerCase() !== category.toLowerCase() && b.spentCents < b.allocatedCents)
      .map((b) => ({ category: b.category, surplusCents: b.allocatedCents - b.spentCents }))
      .sort((a, b) => b.surplusCents - a.surplusCents);
    const totalSurplus = surplusCategories.reduce((s, c) => s + c.surplusCents, 0);

    // AI Suggestions
    const projectedTarget = roundNice(projectedCents);
    const lockedTarget = roundNice(spentCents);
    const historicalTarget = historicalAvgCents ? roundNice(historicalAvgCents) : null;

    return {
      budget,
      spentCents,
      allocatedCents,
      elapsedPct,
      remainingDaysPct,
      projectedCents,
      overageCents,
      percentUsed,
      historicalAvgCents,
      surplusCategories,
      totalSurplus,
      monthTxs: monthTxs.slice(0, 5),
      projectedTarget,
      lockedTarget,
      historicalTarget,
    };
  }, [category, budgets, transactions, report]);

  const handleApply = async (newAllocatedCents: number) => {
    if (newAllocatedCents <= 0) return;
    setApplying(true);
    setCustomError(null);
    try {
      const existing = analysis.budget;
      if (existing) {
        await updateBudget(existing.id, { allocatedCents: newAllocatedCents });
      } else {
        await addBudget({
          category,
          allocatedCents: newAllocatedCents,
          spentCents: analysis.spentCents,
          period: 'monthly',
          rolloverEnabled: false,
          rolloverCents: 0,
          alertThresholdPercent: 85,
        });
      }
      setAppliedAmount(newAllocatedCents);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch {
      setCustomError('Failed to apply budget update. Please try again.');
    } finally {
      setApplying(false);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customValue.trim()) return;
    try {
      const cents = dollarsToCents(customValue.trim());
      if (cents <= 0) {
        setCustomError('Please enter a positive budget amount.');
        return;
      }
      handleApply(cents);
    } catch {
      setCustomError('Invalid amount format.');
    }
  };

  const handleAskAssistant = () => {
    onClose();
    emitUi({
      type: 'ask-assistant',
      question: `How can I reduce spending on ${category} or adjust my budget this month?`,
      scope: 'budgets',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="budget-review-title"
        tabIndex={-1}
        className="relative max-w-2xl w-full max-h-[90vh] flex flex-col bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden focus:outline-none"
      >
        {/* Glow accent */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-20 h-56 w-56 rounded-full bg-gradient-to-br from-sky-400/25 via-indigo-400/20 to-fuchsia-400/15 blur-3xl"
        />

        {/* Header */}
        <div className="relative flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md shadow-indigo-500/25">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="budget-review-title" className="text-base font-extrabold tracking-tight text-[#0F172A]">
                  AI Budget Review: {category}
                </h2>
                <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                  AI Action
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Spending analysis & AI-recommended budget adjustments</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-full p-2 text-slate-400 hover:bg-white hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="relative flex-1 overflow-y-auto p-6 space-y-6">
          {/* Success Banner */}
          {appliedAmount !== null && (
            <div className="wp-pop flex items-center gap-3 rounded-2xl bg-emerald-50 border border-emerald-300 p-4 text-emerald-800">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-bold">Budget Successfully Updated!</p>
                <p className="text-[11px] text-emerald-700">
                  {category} budget set to <span className="font-money font-bold">{formatMoney(appliedAmount)}</span> for this month.
                </p>
              </div>
            </div>
          )}

          {/* Current Status Card */}
          <div className="keel-card rounded-2xl border border-slate-200 bg-slate-50/50 p-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center sm:text-left">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Budget</span>
                <p className="text-base font-extrabold font-money text-[#0F172A] mt-0.5">
                  {formatMoney(analysis.allocatedCents)}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Spent So Far</span>
                <p className="text-base font-extrabold font-money text-rose-700 mt-0.5">
                  {formatMoney(analysis.spentCents)}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Overage / Status</span>
                <p
                  className={`text-base font-extrabold font-money mt-0.5 ${
                    analysis.overageCents > 0 ? 'text-rose-700' : 'text-emerald-700'
                  }`}
                >
                  {analysis.overageCents > 0 ? `+${formatMoney(analysis.overageCents)} over` : 'On track'}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Projected Month-End</span>
                <p className="text-base font-extrabold font-money text-amber-700 mt-0.5">
                  {formatMoney(analysis.projectedCents)}
                </p>
              </div>
            </div>

            {/* Pacing Bar */}
            <div className="space-y-1.5 pt-2 border-t border-slate-200/60">
              <div className="flex justify-between text-[11px] font-medium text-slate-600">
                <span>
                  Budget Used: <strong className="font-bold text-[#0F172A]">{analysis.percentUsed}%</strong>
                </span>
                <span>
                  Month Elapsed: <strong className="font-bold text-[#0F172A]">{Math.round(analysis.elapsedPct)}%</strong> ({analysis.remainingDaysPct}% remaining)
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    analysis.percentUsed >= 100 ? 'bg-rose-500' : analysis.percentUsed >= 85 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, analysis.percentUsed)}%` }}
                />
              </div>
            </div>
          </div>

          {/* AI Recommended Actions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-sky-500" />
                AI-Suggested Adjustments
              </h3>
              <span className="text-[11px] text-slate-500">Pick an option to apply immediately</span>
            </div>

            <div className="space-y-3">
              {/* Option 1: Adjust to Projected Month-End */}
              <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4 transition-all hover:border-sky-300 hover:shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 border border-sky-300 px-2 py-0.5 text-[10px] font-bold text-sky-800">
                        <TrendingUp className="h-3 w-3" />
                        Recommended
                      </span>
                      <h4 className="text-xs font-bold text-[#0F172A]">
                        Align Budget with Projected Month-End ({formatMoney(analysis.projectedTarget)})
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      At your current velocity, you are projected to reach{' '}
                      <span className="font-money font-semibold text-slate-800">{formatMoney(analysis.projectedCents)}</span>.
                      Increasing to{' '}
                      <span className="font-money font-bold text-sky-900">{formatMoney(analysis.projectedTarget)}</span> covers your
                      projected spending and clears overage alerts for the remaining {analysis.remainingDaysPct}% of the month.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={applying}
                    onClick={() => handleApply(analysis.projectedTarget)}
                    className="btn-anim shrink-0 inline-flex items-center justify-center gap-1.5 rounded-full bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-60 cursor-pointer shadow-sm shadow-sky-600/20"
                  >
                    {applying && appliedAmount === analysis.projectedTarget ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Apply {formatMoney(analysis.projectedTarget)}
                  </button>
                </div>
              </div>

              {/* Option 2: Lock at Spent-to-Date */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-slate-300 hover:shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                        <Scissors className="h-3 w-3" />
                        Strict Discipline
                      </span>
                      <h4 className="text-xs font-bold text-[#0F172A]">
                        Lock Budget to Actual Cleared Spend ({formatMoney(analysis.lockedTarget)})
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Caps your budget at what has already cleared ({formatMoney(analysis.spentCents)}). No further spending will be
                      allowed in {category} this month without triggering an immediate warning.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={applying}
                    onClick={() => handleApply(analysis.lockedTarget)}
                    className="btn-anim shrink-0 inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-400 disabled:opacity-60 cursor-pointer"
                  >
                    {applying && appliedAmount === analysis.lockedTarget ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Apply {formatMoney(analysis.lockedTarget)}
                  </button>
                </div>
              </div>

              {/* Option 3: Historical Baseline (if available and different) */}
              {analysis.historicalTarget &&
                analysis.historicalTarget !== analysis.projectedTarget &&
                analysis.historicalTarget !== analysis.lockedTarget && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-slate-300 hover:shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-300 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                            <History className="h-3 w-3" />
                            Historical Baseline
                          </span>
                          <h4 className="text-xs font-bold text-[#0F172A]">
                            Reset to 3-Month Average ({formatMoney(analysis.historicalTarget)})
                          </h4>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          Your typical average spend across past months was{' '}
                          <span className="font-money font-semibold text-slate-800">
                            {formatMoney(analysis.historicalAvgCents ?? 0)}
                          </span>
                          /mo. Useful if this month had abnormal charges and you want to restore your regular baseline.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={applying}
                        onClick={() => handleApply(analysis.historicalTarget!)}
                        className="btn-anim shrink-0 inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-400 disabled:opacity-60 cursor-pointer"
                      >
                        {applying && appliedAmount === analysis.historicalTarget ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        Apply {formatMoney(analysis.historicalTarget)}
                      </button>
                    </div>
                  </div>
                )}
            </div>
          </div>

          {/* Rebalancing Opportunities (if surplus in other categories) */}
          {analysis.totalSurplus > 0 && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-emerald-600" />
                <h4 className="text-xs font-bold text-emerald-900">Rebalance Surplus from Other Budgets</h4>
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                You have <strong className="font-money">{formatMoney(analysis.totalSurplus)}</strong> unspent across under-budget
                categories:{' '}
                {analysis.surplusCategories.slice(0, 3).map((c, i) => (
                  <span key={c.category}>
                    {i > 0 && ', '}
                    <strong>{c.category}</strong> ({formatMoney(c.surplusCents)} remaining)
                  </span>
                ))}
                . You can comfortably increase your {category} budget without exceeding your overall monthly income.
              </p>
            </div>
          )}

          {/* Recent Charges in this Category */}
          {analysis.monthTxs.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                Recent {category} Charges This Month
              </h4>
              <div className="rounded-2xl border border-slate-200 divide-y divide-slate-100 bg-white overflow-hidden text-xs">
                {analysis.monthTxs.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-3 hover:bg-slate-50/50">
                    <div>
                      <p className="font-bold text-[#0F172A]">{t.merchant || t.notes || category}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{t.financialDate}</p>
                    </div>
                    <span className="font-money font-bold text-slate-900">{formatMoney(Math.abs(t.amountCents))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom Budget Amount Form */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
            <h4 className="text-xs font-bold text-[#0F172A]">Set a Custom Budget Amount</h4>
            <form onSubmit={handleCustomSubmit} className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                  {displaySymbol()}
                </span>
                <input
                  type="number"
                  step="any"
                  min="1"
                  placeholder="e.g. 500.00"
                  value={customValue}
                  onChange={(e) => {
                    setCustomValue(e.target.value);
                    setCustomError(null);
                  }}
                  className="w-full rounded-full border border-slate-300 bg-white pl-8 pr-4 py-2 text-xs font-money font-semibold text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>
              <button
                type="submit"
                disabled={applying || !customValue.trim()}
                className="btn-anim inline-flex items-center justify-center gap-1.5 rounded-full bg-[#0F172A] px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                {applying && customValue ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Set Custom Budget'}
              </button>
            </form>
            {customError && <p className="text-[11px] font-medium text-rose-600">{customError}</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="relative flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/70">
          <button
            type="button"
            onClick={handleAskAssistant}
            className="btn-anim inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 hover:text-sky-900 cursor-pointer"
          >
            <MessageCircleQuestion className="h-4 w-4" />
            Ask Copilot how to reduce {category} spending
          </button>

          <button
            type="button"
            onClick={onClose}
            className="btn-anim rounded-full px-4 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
