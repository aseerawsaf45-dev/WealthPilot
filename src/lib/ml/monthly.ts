/**
 * Month summaries, month-over-month deltas, budget pacing, goal ETA ranges (ML-05) and
 * debt-to-asset ratio. All integer minor units; percentages are one-decimal ratios.
 */

import { addMonths, daysBetween, expenseParts, pctChange, type MlTx } from './util';

export interface MonthSummary {
  month: string; // YYYY-MM
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  txCount: number;
  byCategory: Array<{ category: string; cents: number; count: number }>;
}

export function monthSummary(txs: MlTx[], month: string, upTo?: string): MonthSummary {
  let income = 0;
  let expense = 0;
  let n = 0;
  const cats = new Map<string, { cents: number; count: number }>();
  for (const t of txs) {
    if (t.isTransfer || !t.financialDate.startsWith(month) || (upTo && t.financialDate > upTo)) continue;
    n++;
    if (t.amountCents > 0) income += t.amountCents;
    for (const p of expenseParts(t)) {
      expense += p.cents;
      const c = cats.get(p.category) ?? { cents: 0, count: 0 };
      c.cents += p.cents;
      c.count++;
      cats.set(p.category, c);
    }
  }
  return {
    month,
    incomeCents: income,
    expenseCents: expense,
    netCents: income - expense,
    txCount: n,
    byCategory: [...cats].map(([category, v]) => ({ category, ...v })).sort((a, b) => b.cents - a.cents),
  };
}

export interface MonthComparison {
  current: MonthSummary;
  /** Same days of the previous month (1..today's day), so a half month is compared fairly. */
  previousToDate: MonthSummary;
  previous: MonthSummary;
  incomeChangePct: number | null;
  expenseChangePct: number | null;
  /** Fraction of the month elapsed, in % (one decimal). */
  elapsedPct: number;
  biggestRise: { category: string; fromCents: number; toCents: number } | null;
}

export function compareMonths(txs: MlTx[], today: string): MonthComparison {
  const month = today.slice(0, 7);
  const prevMonth = addMonths(`${month}-01`, -1).slice(0, 7);
  const day = Number(today.slice(8, 10));
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const prevDays = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
  const current = monthSummary(txs, month, today);
  const previousToDate = monthSummary(txs, prevMonth, `${prevMonth}-${String(Math.min(day, prevDays)).padStart(2, '0')}`);
  const previous = monthSummary(txs, prevMonth);

  let biggestRise: MonthComparison['biggestRise'] = null;
  for (const c of current.byCategory) {
    const before = previousToDate.byCategory.find((p) => p.category === c.category)?.cents ?? 0;
    const rise = c.cents - before;
    if (rise > 0 && (!biggestRise || rise > biggestRise.toCents - biggestRise.fromCents)) biggestRise = { category: c.category, fromCents: before, toCents: c.cents };
  }

  return {
    current,
    previousToDate,
    previous,
    incomeChangePct: pctChange(previousToDate.incomeCents, current.incomeCents),
    expenseChangePct: pctChange(previousToDate.expenseCents, current.expenseCents),
    elapsedPct: Math.round((day * 1000) / daysInMonth) / 10,
    biggestRise,
  };
}

/** Average monthly income/spending over the last `months` complete months that have data. */
export function averageMonths(txs: MlTx[], today: string, months = 3): { incomeCents: number; expenseCents: number; monthsUsed: number } {
  const month = today.slice(0, 7);
  let income = 0;
  let expense = 0;
  let used = 0;
  for (let i = 1; i <= 12 && used < months; i++) {
    const s = monthSummary(txs, addMonths(`${month}-01`, -i).slice(0, 7));
    if (!s.txCount) continue;
    income += s.incomeCents;
    expense += s.expenseCents;
    used++;
  }
  return used ? { incomeCents: Math.round(income / used), expenseCents: Math.round(expense / used), monthsUsed: used } : { incomeCents: 0, expenseCents: 0, monthsUsed: 0 };
}

export interface BudgetPace {
  allocatedCents: number;
  spentCents: number;
  usedPct: number;
  elapsedPct: number;
  /** Spend projected to month end at the current pace. */
  projectedCents: number;
  status: 'under' | 'on_track' | 'over';
  overBudget: Array<{ category: string; spentCents: number; allocatedCents: number }>;
  atRisk: Array<{ category: string; projectedCents: number; allocatedCents: number }>;
}

export function budgetPace(budgets: Array<{ category: string; allocatedCents: number }>, current: MonthSummary, elapsedPct: number): BudgetPace {
  const spentOf = (cat: string) => current.byCategory.find((c) => c.category.toLowerCase() === cat.toLowerCase())?.cents ?? 0;
  let allocated = 0;
  let spent = 0;
  const overBudget: BudgetPace['overBudget'] = [];
  const atRisk: BudgetPace['atRisk'] = [];
  const factor = Math.max(1, elapsedPct * 10); // elapsed in ‰
  for (const b of budgets) {
    const s = spentOf(b.category);
    allocated += b.allocatedCents;
    spent += s;
    const projected = Math.round((s * 1000) / factor);
    if (s > b.allocatedCents) overBudget.push({ category: b.category, spentCents: s, allocatedCents: b.allocatedCents });
    else if (projected > b.allocatedCents && b.allocatedCents > 0) atRisk.push({ category: b.category, projectedCents: projected, allocatedCents: b.allocatedCents });
  }
  const projectedCents = Math.round((spent * 1000) / factor);
  const usedPct = allocated ? Math.round((spent * 1000) / allocated) / 10 : 0;
  const status = !allocated ? 'on_track' : projectedCents > allocated * 1.05 ? 'over' : projectedCents < allocated * 0.85 ? 'under' : 'on_track';
  return { allocatedCents: allocated, spentCents: spent, usedPct, elapsedPct, projectedCents, status, overBudget, atRisk };
}

export interface GoalEta {
  /** Months to finish at the expected saving rate (null = never at this rate). */
  months: number | null;
  /** Range with ±20% sensitivity on the saving rate. */
  earliestMonths: number | null;
  latestMonths: number | null;
  date: string | null;
  earliestDate: string | null;
  latestDate: string | null;
  requiredMonthlyCents: number | null; // to hit the target date, if any
}

/** ML-05: when a goal is reached at `monthlyCents` per month, with a ±20% range. */
export function goalEta(remainingCents: number, monthlyCents: number, today: string, targetDate?: string | null): GoalEta {
  const months = (rate: number) => (remainingCents <= 0 ? 0 : rate > 0 ? Math.ceil(remainingCents / rate) : null);
  const m = months(monthlyCents);
  const early = months(Math.round(monthlyCents * 1.2));
  const late = months(Math.round(monthlyCents * 0.8));
  const at = (n: number | null) => (n === null ? null : addMonths(today, n));
  let required: number | null = null;
  if (targetDate && remainingCents > 0) {
    const left = Math.max(1, Math.round(daysBetween(today, targetDate) / 30.44));
    required = Math.ceil(remainingCents / left);
  }
  return { months: m, earliestMonths: early, latestMonths: late, date: at(m), earliestDate: at(early), latestDate: at(late), requiredMonthlyCents: required };
}

/** Liabilities ÷ assets in % (one decimal); null with no assets. */
export function debtToAsset(assetsCents: number, liabilitiesCents: number): number | null {
  return assetsCents > 0 ? Math.round((liabilitiesCents * 1000) / assetsCents) / 10 : null;
}
