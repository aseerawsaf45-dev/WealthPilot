'use client';

import React, { useState } from 'react';
import { formatMoney, formatCompactMoney } from '../lib/money';
import { useToday } from '../lib/dates';
import { TrendingUp, ArrowUpRight, ShieldCheck, Sparkles, HelpCircle } from 'lucide-react';

// ============================================================================
// 5. Asset Allocation & Liquidity Stacked Breakdown Chart
// ============================================================================
import type {
  FinancialAccount,
  DebtAccount,
  Transaction,
  SavingsGoal,
  BudgetCategory,
  BillSubscription,
} from '../types/finance';

interface AssetAllocationChartProps {
  accounts: FinancialAccount[];
  selectedType: string;
  onSelectType: (t: string) => void;
}

export function AssetAllocationChart({
  accounts,
  selectedType,
  onSelectType,
}: AssetAllocationChartProps) {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const categories = [
    { type: 'checking', label: 'Cash & Checking', color: '#0EA5E9' },
    { type: 'savings', label: 'High-Yield Savings', color: '#38BDF8' },
    { type: 'investment', label: 'Brokerage & Stocks', color: '#0284C7' },
    { type: 'credit', label: 'Credit Cards', color: '#F43F5E' },
    { type: 'loan', label: 'Loans & Mortgages', color: '#FB7185' },
  ];

  const categoryTotals = categories.map((cat) => {
    const accs = accounts.filter((a) => a.type === cat.type);
    const total = accs.reduce((sum, a) => sum + Math.abs(a.balanceCents), 0);
    return { ...cat, total, count: accs.length };
  });

  const grossAssetsCents = accounts
    .filter((a) => a.balanceCents > 0)
    .reduce((s, a) => s + a.balanceCents, 0);

  const grossLiabilitiesCents = accounts
    .filter((a) => a.balanceCents < 0)
    .reduce((s, a) => s + Math.abs(a.balanceCents), 0);

  const totalVolume = grossAssetsCents + grossLiabilitiesCents || 1;

  return (
    <div className="keel-card p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider block mb-0.5">
            Asset Distribution & Leverage
          </span>
          <h3 className="text-xl font-bold tracking-tight text-[#0F172A]">
            Capital Allocation Framework
          </h3>
          <p className="text-xs text-neutral-600 mt-0.5 font-medium">
            Real-time balance breakdown across deposit, investment, and debt accounts.
          </p>
        </div>

        {/* Quick Summary Badges: Assets (Green/Profit) & Liabilities (Red/Loss) */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-left">
            <span className="text-[10px] uppercase font-bold text-emerald-700 block tracking-wider">Gross Assets</span>
            <span className="text-sm font-bold text-emerald-900 font-money">+{formatMoney(grossAssetsCents)}</span>
          </div>
          <div className="px-3.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-left">
            <span className="text-[10px] uppercase font-bold text-rose-700 block tracking-wider">Liabilities</span>
            <span className="text-sm font-bold text-rose-900 font-money">-{formatMoney(grossLiabilitiesCents)}</span>
          </div>
        </div>
      </div>

      {/* Segmented Stacked Progress Bar */}
      <div className="space-y-2">
        <div className="h-6 w-full rounded-xl bg-neutral-100 p-1 flex gap-1 overflow-hidden">
          {categoryTotals.map((cat) => {
            if (cat.total === 0) return null;
            const pct = (cat.total / totalVolume) * 100;
            const isSelected = selectedType === cat.type.toUpperCase() || selectedType === 'ALL';
            const isHovered = hoveredCategory === cat.type;

            return (
              <button
                key={cat.type}
                type="button"
                onClick={() => onSelectType(selectedType === cat.type.toUpperCase() ? 'ALL' : cat.type.toUpperCase())}
                onMouseEnter={() => setHoveredCategory(cat.type)}
                onMouseLeave={() => setHoveredCategory(null)}
                style={{
                  width: `${Math.max(4, pct)}%`,
                  backgroundColor: cat.color,
                }}
                className={`h-full rounded-lg transition-all cursor-pointer relative group ${
                  isSelected ? 'opacity-100' : 'opacity-40'
                } ${isHovered ? 'scale-y-110 shadow-md ring-2 ring-sky-300' : ''}`}
                title={`${cat.label}: ${formatMoney(cat.total)} (${pct.toFixed(1)}%)`}
              />
            );
          })}
        </div>

        {/* Category Pill Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => onSelectType('ALL')}
            className={`btn-anim px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${
              selectedType === 'ALL'
                ? 'bg-[#0F172A] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All Accounts ({accounts.length})
          </button>
          {categoryTotals.map((cat) => {
            const isSelected = selectedType === cat.type.toUpperCase();
            return (
              <button
                key={cat.type}
                type="button"
                onClick={() => onSelectType(isSelected ? 'ALL' : cat.type.toUpperCase())}
                className={`btn-anim px-3.5 py-1.5 rounded-full text-xs font-medium cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-sky-500 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                <span>{cat.label}</span>
                <span className="text-[10px] opacity-80 font-mono">({cat.count})</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 6. Debt Payoff Trajectory Chart (Avalanche vs Snowball curves)
// ============================================================================
interface DebtPayoffTrajectoryChartProps {
  /** Total remaining balance per month from calculateDebtPayoffSchedule (index 0 = today). */
  snowballBalances: number[];
  avalancheBalances: number[];
  snowballMonths: number;
  avalancheMonths: number;
  extraPaymentCents: number;
  interestSavedCents: number;
}

/** Real payoff curves: the simulated month-by-month balance for each strategy. */
export function DebtPayoffTrajectoryChart({ snowballBalances, avalancheBalances, snowballMonths, avalancheMonths, extraPaymentCents, interestSavedCents }: DebtPayoffTrajectoryChartProps) {
  const maxMonths = Math.max(snowballBalances.length - 1, avalancheBalances.length - 1, 1);
  const top = Math.max(1, ...snowballBalances, ...avalancheBalances);
  const width = 640;
  const height = 180;
  const padding = 30;
  const toPts = (balances: number[]) =>
    balances.map((b, m) => ({ x: padding + (m / maxMonths) * (width - padding * 2), y: height - padding - (b / top) * (height - padding * 2) }));
  const avalanchePts = toPts(avalancheBalances);
  const snowballPts = toPts(snowballBalances);
  const ptsToPath = (pts: { x: number; y: number }[]) => pts.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, '');
  const monthsFaster = Math.abs(snowballMonths - avalancheMonths);

  if (avalancheBalances.length < 2) {
    return <p className="text-xs text-slate-500 font-medium">Add a debt to see its payoff curve.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider block mb-0.5">Payoff simulator</span>
          <h4 className="text-lg font-bold tracking-tight text-[#0F172A]">Total debt over time</h4>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-300">+{formatMoney(interestSavedCents)} interest saved</span>
          {monthsFaster > 0 && <span className="text-xs font-mono font-medium text-neutral-600">{monthsFaster} month{monthsFaster === 1 ? '' : 's'} sooner</span>}
        </div>
      </div>

      <div className="relative w-full h-44 bg-neutral-50/50 rounded-2xl border border-black/[0.05] p-3 overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" role="img" aria-label={`Avalanche pays off in ${avalancheMonths} months, snowball in ${snowballMonths} months`}>
          {[0.25, 0.5, 0.75].map((pct) => (
            <line key={pct} x1={padding} y1={padding + pct * (height - padding * 2)} x2={width - padding} y2={padding + pct * (height - padding * 2)} stroke="rgba(0,0,0,0.06)" strokeDasharray="4 4" />
          ))}
          <text x={padding} y={padding - 8} fontSize="9" fill="#94A3B8">{formatCompactMoney(top)}</text>
          <path d={ptsToPath(snowballPts)} fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeDasharray="4 4" pathLength={1} className="wp-draw" />
          <path d={ptsToPath(avalanchePts)} fill="none" stroke="#0EA5E9" strokeWidth="3" strokeLinecap="round" pathLength={1} className="wp-draw" />
          <g transform={`translate(${avalanchePts[avalanchePts.length - 1].x}, ${avalanchePts[avalanchePts.length - 1].y})`}>
            <circle r="5" fill="#0EA5E9" />
            <text x="0" y="-10" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#0EA5E9">{avalancheMonths} mo (Avalanche)</text>
          </g>
          <g transform={`translate(${snowballPts[snowballPts.length - 1].x}, ${snowballPts[snowballPts.length - 1].y})`}>
            <circle r="4" fill="#94A3B8" />
            <text x="0" y="18" textAnchor="middle" fontSize="9" fill="#64748B">{snowballMonths} mo (Snowball)</text>
          </g>
        </svg>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500 pt-1">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1 rounded-full bg-sky-500" />
            <strong className="text-neutral-700">Avalanche</strong> (highest APR first)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1 rounded-full bg-neutral-400" />
            <span>Snowball (smallest balance first)</span>
          </span>
        </div>
        <span className="text-[11px] font-mono text-neutral-400">With {formatMoney(extraPaymentCents)}/mo extra</span>
      </div>
    </div>
  );
}

// ============================================================================
// 7. Cash Flow Rhythm Histogram Chart
// ============================================================================
export function CashFlowRhythmChart({
  transactions,
  selectedDate,
  onSelectDate,
  currency,
}: {
  transactions: Transaction[];
  selectedDate?: string | null;
  onSelectDate?: (date: string) => void;
  currency?: string;
}) {
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  // Group last 14 days of activity (calendar days in the user's timezone)
  const today = useToday();
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - (13 - i));
    const dateStr = d.toISOString().split('T')[0];
    const dayTxs = transactions.filter((t) => t.financialDate === dateStr);
    const income = dayTxs.filter((t) => t.amountCents > 0).reduce((s, t) => s + t.amountCents, 0);
    const expense = dayTxs.filter((t) => t.amountCents < 0).reduce((s, t) => s + Math.abs(t.amountCents), 0);
    return {
      date: dateStr,
      label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }),
      income,
      expense,
      count: dayTxs.length,
    };
  });

  const maxVal = Math.max(...days.map((d) => Math.max(d.income, d.expense)), 50000);

  return (
    <div className="keel-card p-6 sm:p-7 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
            Liquidity Velocity
          </span>
          <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#0F172A]">
            14-Day Cash Flow Rhythm
          </h3>
          <p className="text-xs text-slate-600 mt-0.5 font-medium">
            Dual-vector ledger visualization of inbound receipts vs. operational disbursements.
          </p>
        </div>

        {/* Legend: Profit (Green) vs Loss/Disbursements (Red) */}
        <div className="flex items-center gap-4 text-xs font-semibold">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shadow-xs" />
            <span className="text-emerald-800 font-bold">Inbound Deposits (Profit)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 shadow-xs" />
            <span className="text-rose-800 font-bold">Disbursements (Outflow)</span>
          </span>
        </div>
      </div>

      {/* Histogram Bar Arena */}
      <div className="h-44 sm:h-48 flex items-end justify-between gap-1.5 sm:gap-2.5 pt-6 pb-2 px-1 border-b border-slate-200/80 relative">
        {days.map((d) => {
          const isSelected = selectedDate === d.date;
          const isHovered = hoveredDay === d.date;
          const incomeHeight = (d.income / maxVal) * 100;
          const expenseHeight = (d.expense / maxVal) * 100;

          return (
            <div
              key={d.date}
              onClick={() => onSelectDate && onSelectDate(isSelected ? '' : d.date)}
              onMouseEnter={() => setHoveredDay(d.date)}
              onMouseLeave={() => setHoveredDay(null)}
              className="flex-1 flex flex-col items-center justify-end h-full group cursor-pointer relative"
            >
              {/* Tooltip on hover */}
              {isHovered && (
                <div className="absolute -top-14 left-1/2 -translate-x-1/2 z-30 pointer-events-none bg-[#0F172A] text-white px-3 py-1.5 rounded-xl text-[11px] font-mono shadow-2xl whitespace-nowrap border border-slate-700/80">
                  <div className="font-semibold text-slate-300">{d.label}</div>
                  <div className="text-emerald-400 font-bold font-money">+{formatMoney(d.income, currency)}</div>
                  <div className="text-rose-400 font-bold font-money">-{formatMoney(d.expense, currency)}</div>
                </div>
              )}

              {/* Inbound & Outbound Bars Side-by-Side: Green for Inflow/Profit, Red for Outflow */}
              <div className="w-full flex items-end justify-center gap-1 h-full">
                <div
                  style={{ height: `${Math.max(4, incomeHeight)}%` }}
                  className={`w-1/2 rounded-t-sm transition-all duration-200 ${
                    isSelected
                      ? 'bg-emerald-600 ring-2 ring-emerald-300 shadow-sm'
                      : 'bg-emerald-500 hover:bg-emerald-400'
                  }`}
                />
                <div
                  style={{ height: `${Math.max(4, expenseHeight)}%` }}
                  className={`w-1/2 rounded-t-sm transition-all duration-200 ${
                    isSelected
                      ? 'bg-rose-600 ring-2 ring-rose-300 shadow-sm'
                      : 'bg-rose-500/85 hover:bg-rose-500'
                  }`}
                />
              </div>

              {/* Day label */}
              <span className="text-[10px] font-mono font-medium text-neutral-500 mt-2 block">
                {d.date.slice(8)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// 8. Goal Trajectory & Horizon Acceleration Chart
// ============================================================================
export function GoalTrajectoryChart({ goals }: { goals: SavingsGoal[] }) {
  const totalTargetCents = goals.reduce((s, g) => s + g.targetCents, 0);
  const totalSavedCents = goals.reduce((s, g) => s + g.currentCents, 0);
  const overallPercent = totalTargetCents > 0 ? Math.round((totalSavedCents / totalTargetCents) * 100) : 0;

  return (
    <div className="keel-card p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">
            Capital Accumulation Horizon
          </span>
          <h3 className="text-xl font-bold tracking-tight text-[#0F172A]">
            Wealth Milestones & Target Velocity
          </h3>
          <p className="text-xs text-slate-600 font-medium mt-0.5">
            Aggregated target progress across all earmarked wealth reservoirs.
          </p>
        </div>

        {/* Global Progress Pill */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-2xl bg-sky-50 border border-sky-100 flex items-center gap-3">
            <span className="text-2xl font-bold font-money text-sky-700">{overallPercent}%</span>
            <div className="text-left text-xs">
              <span className="text-sky-900 font-bold block">{formatMoney(totalSavedCents)}</span>
              <span className="text-neutral-400 text-[11px]">of {formatMoney(totalTargetCents)} Target</span>
            </div>
          </div>
        </div>
      </div>

      {/* Segmented Goal Stacked Pill Progress */}
      <div className="space-y-4">
        <div className="h-4 w-full bg-neutral-100 rounded-full overflow-hidden p-0.5 flex gap-1">
          {goals.map((g, i) => {
            const weight = (g.currentCents / (totalSavedCents || 1)) * 100;
            const colors = ['#0EA5E9', '#38BDF8', '#0284C7', '#7DD3FC', '#BAE6FD'];
            return (
              <div
                key={g.id}
                style={{ width: `${Math.max(5, weight)}%`, backgroundColor: colors[i % colors.length] }}
                className="h-full rounded-full transition-all duration-300"
                title={`${g.name}: ${formatMoney(g.currentCents)}`}
              />
            );
          })}
        </div>

        {/* Goal Quick Ticker */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {goals.slice(0, 4).map((g) => {
            const pct = Math.min(100, Math.round((g.currentCents / (g.targetCents || 1)) * 100));
            return (
              <div key={g.id} className="p-3 rounded-xl bg-neutral-50 border border-black/[0.04] space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-800 truncate">{g.name}</span>
                  <span className="font-mono text-sky-600 font-bold">{pct}%</span>
                </div>
                <div className="text-[11px] text-neutral-500 font-money">
                  {formatMoney(g.currentCents)} / {formatMoney(g.targetCents)}
                </div>
                <div className="w-full h-1.5 bg-neutral-200 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-sky-500 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 9. Budget Pacing Gauge Chart
// ============================================================================
export function BudgetPacingGaugeChart({ budgets }: { budgets: BudgetCategory[] }) {
  const totalAllocatedCents = budgets.reduce((s, b) => s + b.allocatedCents, 0);
  const totalSpentCents = budgets.reduce((s, b) => s + b.spentCents, 0);
  const overallPercent = totalAllocatedCents > 0 ? Math.round((totalSpentCents / totalAllocatedCents) * 100) : 0;

  // Day of month elapsed fraction (e.g. 16th / 31)
  const today = useToday();
  const [ty, tm, td] = today.split('-').map(Number);
  const dayOfMonth = td;
  const daysInMonth = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  const monthElapsedPercent = Math.round((dayOfMonth / daysInMonth) * 100);

  const isUnderPace = overallPercent <= monthElapsedPercent;

  return (
    <div className="keel-card p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider block mb-0.5">
            Burn Rate & Cadence
          </span>
          <h3 className="text-xl font-bold tracking-tight text-[#0F172A]">
            Monthly Budget Pacing Index
          </h3>
          <p className="text-xs text-neutral-600 mt-0.5 font-medium">
            Active burn rate normalized against month-to-date calendar progression.
          </p>
        </div>

        {/* Pacing Badge: Green for Under-Pace (Savings/Profit) vs Red for Over-Pace (Deficit/Loss) */}
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full border ${
              isUnderPace
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-rose-50 text-rose-800 border-rose-300'
            }`}
          >
            {isUnderPace ? 'Pacing Optimal: Under Target (Surplus)' : 'Pacing Alert: Accelerated Burn (Deficit)'}
          </span>
        </div>
      </div>

      {/* Dual Progress Comparison Bar */}
      <div className="space-y-3 bg-neutral-50 p-4 rounded-2xl border border-black/[0.04]">
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="font-semibold text-neutral-800">Budget Consumed ({overallPercent}%)</span>
            <span className="font-mono text-neutral-600 font-money">
              {formatMoney(totalSpentCents)} of {formatMoney(totalAllocatedCents)}
            </span>
          </div>
          <div className="w-full h-3 bg-neutral-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isUnderPace ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
              style={{ width: `${Math.min(100, overallPercent)}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1.5 text-neutral-600 font-medium">
            <span>Calendar Month Elapsed ({monthElapsedPercent}%)</span>
            <span className="font-mono text-[11px] font-semibold text-neutral-700">
              Day {dayOfMonth} of {daysInMonth}
            </span>
          </div>
          <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-neutral-500 rounded-full transition-all duration-500"
              style={{ width: `${monthElapsedPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 10. Bills Liquidity Drain Timeline Chart
// ============================================================================
export function BillsDrainTimelineChart({
  bills,
  checkingBalanceCents,
}: {
  bills: BillSubscription[];
  checkingBalanceCents: number;
}) {

  // Next 30 days from today: every due date of every active bill, following its frequency.
  const today = useToday();
  const dueOn = new Map<string, number[]>();
  const end = new Date(`${today}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 29);
  const endYmd = end.toISOString().slice(0, 10);
  for (const b of bills) {
    if (b.status === 'paused' || !b.nextDueDate) continue;
    const d = new Date(`${b.nextDueDate}T00:00:00Z`);
    for (let i = 0; i < 40 && d.toISOString().slice(0, 10) <= endYmd; i++) {
      const ymd = d.toISOString().slice(0, 10);
      if (ymd >= today) dueOn.set(ymd, [...(dueOn.get(ymd) ?? []), b.amountCents]);
      if (b.frequency === 'weekly') d.setUTCDate(d.getUTCDate() + 7);
      else d.setUTCMonth(d.getUTCMonth() + (b.frequency === 'monthly' ? 1 : b.frequency === 'quarterly' ? 3 : 12));
    }
  }
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const amounts = dueOn.get(d.toISOString().slice(0, 10)) ?? [];
    return { day: d.getUTCDate(), drain: amounts.reduce((s, a) => s + a, 0), billCount: amounts.length };
  });
  const totalBillsCents = days.reduce((s, d) => s + d.drain, 0);

  return (
    <div className="keel-card p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider block mb-0.5">
            Cash Outflow Projection
          </span>
          <h3 className="text-xl font-bold tracking-tight text-[#0F172A]">
            30-Day Liquidity Drain Timeline
          </h3>
          <p className="text-xs text-neutral-600 mt-0.5 font-medium">
            Forward schedule of scheduled recurring debits mapped against primary cash account.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-left">
            <span className="text-[10px] uppercase font-bold text-rose-700 block tracking-wider">Scheduled Debits (Loss)</span>
            <span className="text-sm font-bold text-rose-900 font-money">-{formatMoney(totalBillsCents)}</span>
          </div>
        </div>
      </div>

      {/* 30-day mini calendar matrix */}
      <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-15 gap-1.5 pt-2">
        {days.map((d) => {
          const hasBills = d.drain > 0;
          return (
            <div
              key={d.day}
              className={`p-2 rounded-xl border text-center transition-all ${
                hasBills
                  ? 'bg-rose-50/80 border-rose-200 text-rose-900 shadow-xs'
                  : 'bg-neutral-50/60 border-black/[0.04] text-neutral-400'
              }`}
            >
              <div className="text-[10px] font-mono font-medium">Day {d.day}</div>
              {hasBills ? (
                <div className="text-[11px] font-bold font-money text-rose-700 mt-0.5 truncate">
                  -{formatCompactMoney(d.drain)}
                </div>
              ) : (
                <div className="text-[10px] text-neutral-400 mt-0.5">-</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
