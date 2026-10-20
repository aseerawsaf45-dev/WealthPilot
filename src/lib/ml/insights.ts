/**
 * WealthPilot — deterministic insights for every page (Overview, Transactions, Bills, …).
 * Same code runs in the browser (demo + instant UI) and on the server (/insights, AI tools).
 * Text here is template text over computed numbers; an LLM may only re-word it via placeholders.
 */

import { formatMoney } from '../money';
import { daysBetween, type MlBill, type MlTx } from './util';
import { detectRecurring, monthlyEquivalent, cadenceToFrequency, type RecurringSeries } from './recurring';
import { detectAnomalies, type Anomaly } from './anomalies';
import { forecastCashFlow, type Forecast } from './forecast';
import { compareMonths, averageMonths, budgetPace, goalEta, debtToAsset, type MonthComparison, type BudgetPace, type GoalEta } from './monthly';
import { suggestCategories, type CategorySuggestion } from './categorize';
import { affordability, emi } from '../planning/loans';

export type InsightSegment = 'overview' | 'transactions' | 'accounts' | 'budgets' | 'goals' | 'bills' | 'debts' | 'loans' | 'invest' | 'learn' | 'import' | 'settings';
export type Severity = 'good' | 'info' | 'warn' | 'alert';

/** A client action an insight can offer; the page asks before running it. */
export type InsightAction =
  | { type: 'add_bill'; name: string; amountCents: number; frequency: 'weekly' | 'monthly' | 'quarterly' | 'annual'; nextDueDate: string; category: string }
  | { type: 'set_budget'; category: string; allocatedCents: number }
  | { type: 'review_budget'; category: string }
  | { type: 'recategorize'; items: Array<{ id: string; category: string }> }
  | { type: 'open_tab'; tab: string }
  | { type: 'filter_transactions'; query: string };

export interface Insight {
  id: string;
  segments: InsightSegment[];
  severity: Severity;
  title: string;
  detail: string;
  /** Short label of the method, shown on hover ("Modified z-score"). */
  method: string;
  action?: { label: string; action: InsightAction };
}

export interface InsightInput {
  today: string;
  currency: string;
  transactions: MlTx[]; // already in `currency`
  bills: MlBill[];
  budgets: Array<{ category: string; allocatedCents: number }>;
  goals: Array<{ id?: string; name: string; targetCents: number; currentCents: number; targetDate?: string | null; isPaused: boolean }>;
  debts: Array<{ name: string; balanceCents: number; aprPercent: number; minimumPaymentCents: number }>;
  /** Liquid balance (checking + savings + cash) in `currency`. */
  liquidCents: number;
  assetsCents: number;
  liabilitiesCents: number;
  rules?: Array<{ keyword: string; category: string }>;
  /** Planner items (optional): loan offers being considered and investment plans. */
  loanOffers?: Array<{ name: string; lender: string; principalCents: number; aprBps: number; termMonths: number; status: string }>;
  investments?: Array<{ name: string; currency: string; monthlyCents: number }>;
}

export interface InsightReport {
  today: string;
  currency: string;
  month: MonthComparison;
  averages: ReturnType<typeof averageMonths>;
  pace: BudgetPace;
  recurring: RecurringSeries[];
  anomalies: Anomaly[];
  forecast: Forecast;
  goalEtas: Array<{ id?: string; name: string; eta: GoalEta; onPace: boolean | null; enoughHistory: boolean }>;
  categorySuggestions: Array<{ id?: string; merchant: string; financialDate: string; amountCents: number; current: string; suggestion: CategorySuggestion }>;
  debtToAssetPct: number | null;
  runwayMonths: number | null;
  insights: Insight[];
  assumptions: string[];
}

export function buildInsights(input: InsightInput): InsightReport {
  const { today, currency, transactions, bills, budgets, goals, debts } = input;
  const money = (c: number) => formatMoney(c, currency);
  const month = compareMonths(transactions, today);
  const averages = averageMonths(transactions, today, 3);
  const pace = budgetPace(budgets, month.current, month.elapsedPct);
  const recurring = detectRecurring(transactions, today, bills);
  const anomalies = detectAnomalies(transactions, today, 30);
  const forecast = forecastCashFlow({ txs: transactions, bills, recurring, startBalanceCents: input.liquidCents, today });
  const categorySuggestions = suggestCategories(transactions, input.rules);
  // Saving capacity: average of complete months; a newer user's month-so-far (≥ 7 days) scaled to a full month.
  const day = Number(today.slice(8, 10));
  const scaled = day >= 7 && month.current.txCount ? Math.round((month.current.netCents * 100) / Math.max(1, month.elapsedPct)) : null;
  const surplus = averages.monthsUsed ? averages.incomeCents - averages.expenseCents : (scaled ?? 0);
  const enoughHistory = averages.monthsUsed > 0 || scaled !== null;
  const runwayMonths = averages.expenseCents > 0 ? Math.round((input.liquidCents * 10) / averages.expenseCents) / 10 : null;

  const active = goals.filter((g) => !g.isPaused && g.currentCents < g.targetCents);
  const perGoal = active.length && surplus > 0 ? Math.floor(surplus / 2 / active.length) : 0; // half the surplus, shared
  const goalEtas = active.map((g) => {
    const eta = goalEta(g.targetCents - g.currentCents, perGoal, today, g.targetDate);
    const onPace = enoughHistory && g.targetDate && eta.requiredMonthlyCents !== null ? eta.requiredMonthlyCents <= perGoal : null;
    return { id: g.id, name: g.name, eta, onPace, enoughHistory };
  });

  const insights: Insight[] = [];
  const push = (i: Insight) => insights.push(i);

  // ---- Month at a glance ------------------------------------------------------
  if (month.current.txCount) {
    const e = month.expenseChangePct;
    if (e !== null && Math.abs(e) >= 10) {
      push({
        id: 'month-spend-change',
        segments: ['overview', 'transactions'],
        severity: e > 0 ? (e >= 25 ? 'warn' : 'info') : 'good',
        title: e > 0 ? `Spending is up ${e}% on last month so far` : `Spending is down ${Math.abs(e)}% on last month so far`,
        detail: `${money(month.current.expenseCents)} spent by ${today}, against ${money(month.previousToDate.expenseCents)} by the same day last month.${month.biggestRise && e > 0 ? ` The biggest rise is ${month.biggestRise.category} (${money(month.biggestRise.fromCents)} → ${money(month.biggestRise.toCents)}).` : ''}`,
        method: 'Same days of this month vs last month',
        action: month.biggestRise && e > 0 ? { label: `See ${month.biggestRise.category}`, action: { type: 'filter_transactions', query: month.biggestRise.category } } : undefined,
      });
    }
  }

  // ---- Anomalies ----------------------------------------------------------------
  for (const a of anomalies.slice(0, 3)) {
    push({
      id: `anomaly-${a.id ?? a.merchant}-${a.financialDate}`,
      segments: ['overview', 'transactions'],
      severity: a.multiple >= 4 ? 'alert' : 'warn',
      title: `Unusual ${a.category} charge: ${a.merchant}`,
      detail: `${money(a.amountCents)} on ${a.financialDate} is ${a.multiple}× your usual ${a.category} amount (${money(a.typicalCents)}). Check it's expected.`,
      method: a.zScore === null ? '≥ 2× the median (amounts are usually identical)' : `Modified z-score ${a.zScore > 50 ? 'over 50' : a.zScore} (> 3.5 is unusual)`,
      action: { label: 'Find it', action: { type: 'filter_transactions', query: a.merchant } },
    });
  }

  // ---- Recurring → bills; price jumps ---------------------------------------------
  for (const r of recurring.filter((s) => s.direction === 'expense' && !s.matchesBill).slice(0, 3)) {
    const freq = cadenceToFrequency(r.cadence);
    push({
      id: `recurring-${r.key}`,
      segments: ['bills', 'overview'],
      severity: 'info',
      title: `${r.merchant} looks like a ${r.cadence} payment`,
      detail: `${r.occurrences} payments of about ${money(r.typicalCents)} (≈ ${money(monthlyEquivalent(r))}/month). Next expected around ${r.nextExpected}.`,
      method: 'Recurring detection: ≥ 3 payments, regular gaps (±20%), stable amounts',
      action: freq ? { label: 'Track as a bill', action: { type: 'add_bill', name: r.merchant, amountCents: r.lastCents, frequency: freq, nextDueDate: r.nextExpected, category: r.category || 'Subscriptions' } } : undefined,
    });
  }
  for (const r of recurring.filter((s) => s.direction === 'expense' && s.priceChangePct !== null && s.priceChangePct >= 10).slice(0, 2)) {
    push({
      id: `price-${r.key}`,
      segments: ['bills', 'transactions'],
      severity: 'warn',
      title: `${r.merchant} price went up ${r.priceChangePct}%`,
      detail: `The last charge was ${money(r.lastCents)}, up from a usual ${money(r.typicalCents)}.`,
      method: 'Last amount vs median of the previous 5',
    });
  }

  // ---- Forecast ----------------------------------------------------------------------
  if (forecast.minDataMet) {
    const p30 = forecast.points[0];
    push({
      id: 'forecast-30',
      segments: ['overview', 'accounts'],
      severity: forecast.shortfallDate ? 'alert' : p30.lowCents < 0 ? 'warn' : 'good',
      title: forecast.shortfallDate ? `Cash may run short around ${forecast.shortfallDate}` : `In 30 days you'll likely have about ${money(p30.expectedCents)}`,
      detail: `Expected ${money(p30.expectedCents)} on ${p30.date} (range ${money(p30.lowCents)} to ${money(p30.highCents)}): ${money(p30.incomeCents)} expected in, ${money(p30.billsCents)} in bills and recurring payments, ${money(p30.everydayCents)} everyday spending.`,
      method: forecast.method,
    });
  }

  // ---- Budgets -------------------------------------------------------------------------
  for (const b of pace.overBudget.slice(0, 2)) {
    push({
      id: `budget-over-${b.category}`,
      segments: ['budgets', 'overview'],
      severity: 'alert',
      title: `${b.category} is over budget`,
      detail: `${money(b.spentCents)} spent of ${money(b.allocatedCents)} with ${100 - Math.round(month.elapsedPct)}% of the month left.`,
      method: 'Spent vs budget this month',
      action: { label: 'Review budget', action: { type: 'review_budget', category: b.category } },
    });
  }
  for (const b of pace.atRisk.slice(0, 2)) {
    push({
      id: `budget-risk-${b.category}`,
      segments: ['budgets'],
      severity: 'warn',
      title: `${b.category} is on pace to go over`,
      detail: `At this pace you'll spend about ${money(b.projectedCents)} against a ${money(b.allocatedCents)} budget.`,
      method: 'Spend so far ÷ share of month elapsed',
      action: { label: 'Review budget', action: { type: 'review_budget', category: b.category } },
    });
  }
  // Suggest budgets for big categories that have none (3-month median-based average).
  if (averages.monthsUsed >= 2) {
    const have = new Set(budgets.map((b) => b.category.toLowerCase()));
    // Spending per category over the last ~3 complete months (current month excluded).
    const cats = new Map<string, number>();
    for (const t of transactions) {
      const d = daysBetween(t.financialDate, today);
      if (t.isTransfer || t.amountCents >= 0 || d < 0 || d > 92 || t.financialDate.startsWith(today.slice(0, 7))) continue;
      cats.set(t.category, (cats.get(t.category) ?? 0) - t.amountCents);
    }
    const suggestions = [...cats]
      .filter(([c]) => !have.has(c.toLowerCase()) && !/^(income|transfers?)$/i.test(c))
      .map(([c, total]) => [c, Math.round(total / averages.monthsUsed)] as const)
      .filter(([, avg]) => avg > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);
    for (const [category, avg] of suggestions) {
      const rounded = roundNice(avg);
      push({ id: `budget-suggest-${category}`, segments: ['budgets'], severity: 'info', title: `Set a ${category} budget?`, detail: `You've averaged ${money(avg)} a month on ${category}. A ${money(rounded)} budget keeps it in view.`, method: `Average of the last ${averages.monthsUsed} complete months`, action: { label: `Budget ${money(rounded)}`, action: { type: 'set_budget', category, allocatedCents: rounded } } });
    }
  }

  // ---- Goals ------------------------------------------------------------------------------
  for (const g of goalEtas.slice(0, 3)) {
    if (!g.enoughHistory) continue;
    if (g.eta.months === null) {
      push({ id: `goal-${g.id ?? g.name}`, segments: ['goals'], severity: 'warn', title: `${g.name}: no savings room right now`, detail: `Your recent income doesn't leave a surplus to put toward this goal. Open the AI plan for ways to make it reachable.`, method: 'Average surplus of the last 3 months' });
    } else if (g.onPace === false) {
      push({ id: `goal-${g.id ?? g.name}`, segments: ['goals', 'overview'], severity: 'warn', title: `${g.name} is behind its deadline`, detail: `It needs ${money(g.eta.requiredMonthlyCents ?? 0)}/month, but about ${money(perGoal)}/month is free for it. At that rate it finishes between ${g.eta.earliestDate} and ${g.eta.latestDate}.`, method: 'Goal ETA with ±20% saving-rate range' });
    } else if (g.eta.months > 0) {
      push({ id: `goal-${g.id ?? g.name}`, segments: ['goals'], severity: 'good', title: `${g.name}: likely done ${g.eta.earliestDate?.slice(0, 7)} – ${g.eta.latestDate?.slice(0, 7)}`, detail: `Saving about ${money(perGoal)}/month (half your average surplus, shared across ${active.length} goal${active.length === 1 ? '' : 's'}).`, method: 'Goal ETA with ±20% saving-rate range' });
    }
  }

  // ---- Debts ---------------------------------------------------------------------------------
  const costly = [...debts].filter((d) => d.balanceCents > 0).sort((a, b) => b.aprPercent - a.aprPercent)[0];
  if (costly && costly.aprPercent >= 15) {
    const monthlyInterest = Math.round((costly.balanceCents * costly.aprPercent) / 1200);
    push({ id: 'debt-costly', segments: ['debts', 'overview'], severity: 'warn', title: `${costly.name} costs about ${money(monthlyInterest)} a month in interest`, detail: `At ${costly.aprPercent}% APR it's your most expensive debt. Paying it first (avalanche) saves the most interest.`, method: 'Balance × APR ÷ 12', action: { label: 'Open Planner', action: { type: 'open_tab', tab: 'planning' } } });
  }

  // ---- Planner: loans and investments ---------------------------------------------------------
  const minimums = debts.reduce((s, d) => s + d.minimumPaymentCents, 0);
  for (const [i, o] of (input.loanOffers ?? []).filter((x) => x.status === 'considering').slice(0, 3).entries()) {
    const a = affordability(emi(o.principalCents, o.aprBps, o.termMonths), minimums, averages.incomeCents);
    if (a.band === 'stretched' || a.band === 'risky') {
      push({ id: `loan-dti-${i}`, segments: ['loans'], severity: a.band === 'risky' ? 'alert' : 'warn', title: `${o.name} (${o.lender}) would put ${a.dtiPct}% of income into debt payments`, detail: `${a.band === 'risky' ? 'Above the 43% most lenders accept.' : 'Above the 36% usually considered healthy.'} A smaller amount or a longer term lowers the monthly payment.`, method: '(new monthly payment + existing minimums) ÷ average income' });
    }
  }
  const plans = input.investments ?? [];
  if (plans.length) {
    const free = surplus - minimums;
    const planned = plans.filter((p) => p.currency === currency).reduce((s, p) => s + p.monthlyCents, 0);
    if (averages.monthsUsed && planned > Math.max(0, free)) {
      push({ id: 'invest-unfunded', segments: ['invest'], severity: 'warn', title: 'Your plans need more than you have spare', detail: `Plans add ${money(planned)} a month, but about ${money(Math.max(0, free))} is left after spending and debt minimums.`, method: 'Average surplus − debt minimums' });
    }
    const dear = debts.filter((d) => d.balanceCents > 0 && d.aprPercent >= 10).sort((a, b) => b.aprPercent - a.aprPercent)[0];
    if (dear) {
      push({ id: 'invest-pay-debt', segments: ['invest', 'debts'], severity: 'info', title: `Consider paying off ${dear.name} before investing more`, detail: `At ${dear.aprPercent}% APR it likely costs more than most investments earn after tax. See "Pay or invest?" in the Planner.`, method: 'Debt APR vs typical investment returns', action: { label: 'Open Planner', action: { type: 'open_tab', tab: 'planning' } } });
    }
  }

  // ---- Categorization ----------------------------------------------------------------------
  const fixable = categorySuggestions.filter((s) => s.id);
  if (fixable.length) {
    push({
      id: 'categorize',
      segments: ['transactions', 'import'],
      severity: 'info',
      title: `${fixable.length} transaction${fixable.length === 1 ? '' : 's'} can be categorized`,
      detail: `Suggestions come from your own past choices first, then common merchant names. ${fixable.slice(0, 3).map((s) => `${s.merchant} → ${s.suggestion.category}`).join(', ')}${fixable.length > 3 ? '…' : ''}`,
      method: 'Your history, then keyword rules',
      action: { label: 'Apply suggestions', action: { type: 'recategorize', items: fixable.slice(0, 50).map((s) => ({ id: s.id!, category: s.suggestion.category })) } },
    });
  }

  // ---- Runway / savings rate ---------------------------------------------------------------
  if (runwayMonths !== null) {
    push({
      id: 'runway',
      segments: ['overview', 'accounts'],
      severity: runwayMonths < 1 ? 'alert' : runwayMonths < 3 ? 'warn' : 'good',
      title: `Your cash covers ${runwayMonths} month${runwayMonths === 1 ? '' : 's'} of spending`,
      detail: `${money(input.liquidCents)} in checking, savings and cash vs ${money(averages.expenseCents)} average monthly spending. ${runwayMonths < 3 ? 'Three to six months is a common safety target.' : 'That is a healthy safety cushion.'}`,
      method: `Liquid balance ÷ average spending (last ${averages.monthsUsed} months)`,
    });
  }

  const order: Record<Severity, number> = { alert: 0, warn: 1, info: 2, good: 3 };
  insights.sort((a, b) => order[a.severity] - order[b.severity]);

  return {
    today,
    currency,
    month,
    averages,
    pace,
    recurring,
    anomalies,
    forecast,
    goalEtas,
    categorySuggestions,
    debtToAssetPct: debtToAsset(input.assetsCents, input.liabilitiesCents),
    runwayMonths,
    insights,
    assumptions: [...forecast.assumptions, 'Amounts in other currencies are converted at the daily market rate when one is available.'],
  };
}

/** Rounds a budget suggestion up to a tidy figure (2 significant digits). */
function roundNice(cents: number): number {
  if (cents <= 0) return 0;
  const digits = String(cents).length;
  const step = 10 ** Math.max(0, digits - 2);
  return Math.ceil(cents / step) * step;
}

/** Insights for one page, most important first. */
export function insightsFor(report: InsightReport, segment: InsightSegment, limit = 4): Insight[] {
  return report.insights.filter((i) => i.segments.includes(segment)).slice(0, limit);
}

