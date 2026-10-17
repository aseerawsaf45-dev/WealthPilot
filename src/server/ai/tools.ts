/**
 * WealthPilot — Copilot tools (plan §7.3). Pure functions over FinanceData.
 *
 * FinanceData is loaded for the SESSION user by src/server/ai/data.ts before any tool runs,
 * so no tool takes (or can be tricked into using) a user id. Tools return aggregates only:
 * totals, counts, percentages, category/bill/goal names. Never raw transaction rows.
 * Each tool also returns a trusted template that references its facts as {{#i}}.
 */

import { z } from 'zod';
import { ymd, monthYear } from '../schemas';
import { addDays, billState, spendByCategory } from '../mappers';
import type { FactDraft, SuggestedAction } from './schema';

// ---- Data the tools run on (already scoped to one user) ---------------------

export interface FinanceData {
  today: string; // YYYY-MM-DD in the user's timezone
  currency: string; // preferred currency; category/budget figures use this currency only
  transactions: {
    financialDate: string;
    amountCents: number;
    category: string;
    currency: string;
    isTransfer: boolean;
    merchant: string;
    splits?: { category: string; amountCents: number }[];
  }[];
  budgets: { category: string; allocatedCents: number; alertThresholdPercent: number; monthYear: string }[];
  goals: { id?: string; name: string; targetCents: number; currentCents: number; targetDate: string | null; isPaused: boolean }[]; // id: server-side only, never sent to a model
  bills: { name: string; amountCents: number; nextDueDate: string; status: string }[];
  debts: { name: string; balanceCents: number; aprPercent: number; minimumPaymentCents: number }[];
}

export interface Period {
  start: string;
  end: string;
}

export interface ToolOutput {
  period: Period | null;
  facts: FactDraft[];
  template: string; // trusted text; facts referenced as {{#0}}, {{#1}} ...
  limitations: string[];
  actions: { label: string; action: SuggestedAction }[];
}

// ---- Date helpers -----------------------------------------------------------

export function monthRange(yyyyMm: string): Period {
  const [y, m] = yyyyMm.split('-').map(Number);
  return { start: `${yyyyMm}-01`, end: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) };
}

export function shiftMonth(yyyyMm: string, n: number): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const inPeriod = (d: string, p: Period) => d >= p.start && d <= p.end;
// Integer division first so e.g. 9420/40000 rounds to 23.6, not 23.5 (float 0.2355 * 1000 = 235.4999…).
const pct = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part * 1000) / whole) / 10);

const money = (label: string, value: number, currency: string, kind: FactDraft['kind'] = 'recorded'): FactDraft => ({
  label,
  value,
  unit: 'cents',
  currency,
  kind,
});
const percent = (label: string, value: number, kind: FactDraft['kind'] = 'recorded'): FactDraft => ({ label, value, unit: 'pct', kind });
const count = (label: string, value: number): FactDraft => ({ label, value, unit: 'count', kind: 'recorded' });

/** Expense total (positive cents) in the preferred currency, split-aware, transfers excluded. */
function spendIn(data: FinanceData, p: Period, category?: string): number {
  const rows = data.transactions.filter((t) => t.currency === data.currency && inPeriod(t.financialDate, p));
  const byCat = spendByCategory(rows, '');
  if (category) return byCat.get(category) ?? 0;
  let total = 0;
  for (const v of byCat.values()) total += v;
  return total;
}

function otherCurrencyNote(data: FinanceData, p: Period): string[] {
  const other = data.transactions.some((t) => t.currency !== data.currency && inPeriod(t.financialDate, p));
  return other ? [`Amounts in currencies other than ${data.currency} are not included in category totals.`] : [];
}

// ---- Argument schemas (validated before any tool runs) -----------------------

const Range = z
  .object({ from: ymd, to: ymd })
  .refine((r) => r.to >= r.from, 'to must be on or after from')
  .refine((r) => daysBetween(r.from, r.to) <= 366, 'range must be 366 days or less');

const toPeriod = (r: { from: string; to: string }): Period => ({ start: r.from, end: r.to });

// ---- Tools ------------------------------------------------------------------

function financialSummary(args: { from: string; to: string }, data: FinanceData): ToolOutput {
  const p = toPeriod(args);
  const rows = data.transactions.filter((t) => !t.isTransfer && inPeriod(t.financialDate, p));
  if (!rows.length) {
    return { period: p, facts: [], template: `No transactions are recorded between ${p.start} and ${p.end}.`, limitations: [], actions: [{ label: 'Add a transaction', action: 'open_transactions' }] };
  }
  const byCurrency = new Map<string, { income: number; expense: number; n: number }>();
  for (const t of rows) {
    const c = byCurrency.get(t.currency) ?? { income: 0, expense: 0, n: 0 };
    if (t.amountCents > 0) c.income += t.amountCents;
    else c.expense -= t.amountCents;
    c.n += 1;
    byCurrency.set(t.currency, c);
  }
  const facts: FactDraft[] = [];
  const parts: string[] = [];
  for (const [cur, c] of byCurrency) {
    const i = facts.length;
    facts.push(money(`Spending (${cur})`, c.expense, cur), money(`Income (${cur})`, c.income, cur), money(`Net cash flow (${cur})`, c.income - c.expense, cur), count(`Number of transactions paid in ${cur}`, c.n));
    parts.push(`you spent {{#${i}}} and received {{#${i + 1}}}, a net of {{#${i + 2}}} across {{#${i + 3}}} transactions`);
  }
  return {
    period: p,
    facts,
    template: `Between ${p.start} and ${p.end}, ${parts.join('; in another currency, ')}. Transfers between your own accounts are excluded.`,
    limitations: byCurrency.size > 1 ? ['Totals are shown per currency and never added across currencies.'] : [],
    actions: [{ label: 'Review transactions', action: 'open_transactions' }],
  };
}

function categoryBreakdown(args: { from: string; to: string; limit: number }, data: FinanceData): ToolOutput {
  const p = toPeriod(args);
  const rows = data.transactions.filter((t) => t.currency === data.currency && inPeriod(t.financialDate, p));
  const byCat = [...spendByCategory(rows, '').entries()].sort((a, b) => b[1] - a[1]);
  const total = byCat.reduce((s, [, v]) => s + v, 0);
  if (!total) return { period: p, facts: [], template: `There is no spending recorded between ${p.start} and ${p.end}.`, limitations: [], actions: [] };
  const top = byCat.slice(0, args.limit);
  const facts: FactDraft[] = [];
  const parts = top.map(([cat, cents]) => {
    const i = facts.length;
    facts.push(money(`${cat} spending`, cents, data.currency), percent(`${cat} share of spending`, pct(cents, total)));
    return `${cat} {{#${i}}} ({{#${i + 1}}})`;
  });
  return {
    period: p,
    facts,
    template: `Your largest spending categories were ${parts.join(', ')}.`,
    limitations: otherCurrencyNote(data, p),
    actions: [{ label: 'Open category report', action: 'open_category_report' }],
  };
}

function comparePeriods(args: { a: { from: string; to: string }; b: { from: string; to: string }; category?: string }, data: FinanceData): ToolOutput {
  const pa = toPeriod(args.a);
  const pb = toPeriod(args.b);
  const what = args.category ? `on ${args.category}` : 'in total';
  const a = spendIn(data, pa, args.category);
  const b = spendIn(data, pb, args.category);
  const diff = a - b;
  const facts: FactDraft[] = [
    money(`Spending ${what} ${pa.start} to ${pa.end}`, a, data.currency),
    money(`Spending ${what} ${pb.start} to ${pb.end}`, b, data.currency),
    money(`Difference ${what}`, Math.abs(diff), data.currency),
  ];
  let template = `You spent {{#0}} ${what} from ${pa.start} to ${pa.end}, compared with {{#1}} from ${pb.start} to ${pb.end}`;
  if (diff === 0) template += ', the same amount.';
  else {
    template += `: {{#2}} ${diff > 0 ? 'more' : 'less'}`;
    if (b > 0) {
      facts.push(percent(`Change ${what}`, Math.abs(pct(diff, b))));
      template += ` ({{#3}} ${diff > 0 ? 'higher' : 'lower'})`;
    }
    template += '.';
  }
  facts.push({ label: `Direction of change ${what}`, value: diff > 0 ? 'higher' : diff < 0 ? 'lower' : 'unchanged', unit: 'text', kind: 'recorded' });
  const limitations = otherCurrencyNote(data, { start: pb.start < pa.start ? pb.start : pa.start, end: pa.end > pb.end ? pa.end : pb.end });
  if (b === 0 && a > 0) limitations.push('There is no spending in the earlier period, so a percentage change cannot be calculated.');
  if (pa.end >= data.today && pa.start <= data.today) limitations.push(`The current period is still in progress (data through ${data.today}).`);
  return { period: pa, facts, template, limitations, actions: [{ label: 'Open category report', action: 'open_category_report' }] };
}

function budgetStatus(args: { month: string }, data: FinanceData): ToolOutput {
  const p = monthRange(args.month);
  const budgets = data.budgets.filter((b) => b.monthYear === args.month);
  if (!budgets.length) {
    return { period: p, facts: [], template: `You have no budgets set for ${args.month}.`, limitations: [], actions: [{ label: 'Create a budget', action: 'open_budgets' }] };
  }
  const rows = data.transactions.filter((t) => t.currency === data.currency && inPeriod(t.financialDate, p));
  const spent = spendByCategory(rows, '');
  const status = budgets
    .map((b) => {
      const s = spent.get(b.category) ?? 0;
      const util = pct(s, b.allocatedCents);
      return { ...b, spent: s, util, state: s > b.allocatedCents ? 'over budget' : util >= b.alertThresholdPercent ? 'close to its limit' : 'on track' };
    })
    .sort((x, y) => y.util - x.util)
    .slice(0, 6);
  const facts: FactDraft[] = [];
  const parts = status.map((b) => {
    const i = facts.length;
    facts.push(
      money(`${b.category} spent`, b.spent, data.currency),
      money(`${b.category} budget`, b.allocatedCents, data.currency),
      percent(`${b.category} budget used`, b.util),
      { label: `${b.category} budget status`, value: b.state, unit: 'text', kind: 'recorded' } // words only: shown to the model
    );
    return `${b.category} is {{#${i + 3}}}: {{#${i}}} of {{#${i + 1}}} ({{#${i + 2}}})`;
  });
  const over = status.filter((b) => b.state === 'over budget').length;
  facts.push(count('Budgets over limit', over));
  return {
    period: p,
    facts,
    template: `For ${args.month}: ${parts.join('; ')}. {{#${facts.length - 1}}} of your budgets are over their limit.`,
    limitations: budgets.length > 6 ? ['Only the six most-used budgets are listed.'] : [],
    actions: [{ label: 'Open budgets', action: 'open_budgets' }],
  };
}

function upcomingBills(args: { days: number }, data: FinanceData): ToolOutput {
  const until = addDays(data.today, args.days);
  const due = data.bills
    .filter((b) => b.status !== 'paused' && b.nextDueDate <= until)
    .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate))
    .slice(0, 10);
  const p = { start: data.today, end: until };
  if (!due.length) return { period: p, facts: [], template: `No bills are due in the next ${args.days} days.`, limitations: [], actions: [{ label: 'Open bills', action: 'open_bills' }] };
  const facts: FactDraft[] = [money('Total due', due.reduce((s, b) => s + b.amountCents, 0), data.currency), count('Bills due', due.length)];
  const parts = due.map((b) => {
    const i = facts.length;
    facts.push(money(`${b.name} amount`, b.amountCents, data.currency), { label: `${b.name} due date`, value: b.nextDueDate, unit: 'date', kind: 'recorded' });
    const state = billState(b.nextDueDate, b.status, data.today);
    return `${b.name} {{#${i}}} on {{#${i + 1}}}${state === 'overdue' ? ' (overdue)' : ''}`;
  });
  return {
    period: p,
    facts,
    template: `{{#1}} bills totalling {{#0}} are due by ${until}: ${parts.join(', ')}.`,
    limitations: [],
    actions: [{ label: 'Open bills', action: 'open_bills' }],
  };
}

/** Monthly contributions that fit before `target` (one per month on today's day-of-month). Minimum 1. */
function monthsUntil(today: string, target: string): number {
  const [ty, tm, td] = today.split('-').map(Number);
  const [gy, gm, gd] = target.split('-').map(Number);
  // Oct 17 → next Oct 1 is 11 contributions, not 12: the 12th would land after the deadline.
  return Math.max(1, (gy - ty) * 12 + (gm - tm) - (gd < td ? 1 : 0));
}

function savingsPlan(args: { goalName?: string; monthlyCents?: number }, data: FinanceData): ToolOutput {
  const needle = args.goalName?.toLowerCase();
  const goals = data.goals.filter((g) => !g.isPaused && (!needle || g.name.toLowerCase().includes(needle))).slice(0, 5);
  if (!goals.length) {
    return { period: null, facts: [], template: needle ? 'I could not find an active goal with that name.' : 'You have no active savings goals.', limitations: [], actions: [{ label: 'Open goals', action: 'open_goals' }] };
  }
  const facts: FactDraft[] = [];
  // The user's own amount becomes a fact too, so the narration can mention it via a placeholder.
  if (args.monthlyCents) facts.push(money('Monthly amount you asked about', args.monthlyCents, data.currency, 'estimate'));
  const parts = goals.map((g) => {
    const remaining = Math.max(0, g.targetCents - g.currentCents);
    const i = facts.length;
    facts.push(money(`${g.name} saved`, g.currentCents, data.currency), money(`${g.name} target`, g.targetCents, data.currency), percent(`${g.name} funded`, pct(g.currentCents, g.targetCents)));
    let text = `${g.name}: {{#${i}}} of {{#${i + 1}}} ({{#${i + 2}}} funded)`;
    if (remaining === 0) return `${text}, already reached`;
    if (args.monthlyCents) {
      const j = facts.length;
      facts.push({ label: `${g.name} months to target`, value: Math.ceil(remaining / args.monthlyCents), unit: 'months', kind: 'estimate' });
      text += `; at {{#0}} a month it would take about {{#${j}}}`;
    } else if (g.targetDate && g.targetDate > data.today) {
      const j = facts.length;
      facts.push(money(`${g.name} needed per month`, Math.ceil(remaining / monthsUntil(data.today, g.targetDate)), data.currency, 'estimate'));
      text += `; to reach it by ${g.targetDate} you would need about {{#${j}}} per month`;
    }
    return text;
  });
  return {
    period: null,
    facts,
    template: `${parts.join('. ')}.`,
    limitations: ['Monthly amounts are estimates that assume equal contributions and no interest.'],
    actions: [{ label: 'Open goals', action: 'open_goals' }],
  };
}

// ---- Goal planner -------------------------------------------------------------

export type PlanVerdict = 'reached' | 'on_track' | 'stretch' | 'not_reachable' | 'no_data';

export interface GoalPlan extends ToolOutput {
  verdict: PlanVerdict;
  steps: string[]; // trusted text; facts referenced as {{#i}}
  milestones: { label: string; factIndex: number }[];
}

// Spending that is usually fixed in the short term; never suggested as a cut.
const FIXED_SPEND = /(housing|rent|mortgage|utilit|insurance|income|transfer|debt|loan|tax|medical|health)/i;

/** YYYY-MM-DD `months` after `ymd`, clamped to the month's last day. */
function addMonthsYmd(ymd: string, months: number): string {
  const target = monthRange(shiftMonth(ymd.slice(0, 7), months));
  const day = `${target.start.slice(0, 8)}${ymd.slice(8, 10)}`;
  return day > target.end ? target.end : day;
}

/**
 * Can the user reach a goal by a date, given their real income and spending? Averages the last
 * 3 complete months (months with no transactions are skipped), subtracts what other dated goals
 * need, then judges the monthly amount against the free surplus: ≤ 50% on track, ≤ 100% stretch.
 */
export function planGoal(args: { goalName: string; targetDate?: string }, data: FinanceData): GoalPlan {
  const goal = data.goals.find((g) => g.name === args.goalName);
  if (!goal) {
    return { period: null, facts: [], template: 'I could not find that goal.', limitations: [], actions: [], verdict: 'no_data', steps: [], milestones: [] };
  }
  const facts: FactDraft[] = [];
  const add = (f: FactDraft) => facts.push(f) - 1;
  const remaining = Math.max(0, goal.targetCents - goal.currentCents);
  const fSaved = add(money('Saved so far', goal.currentCents, data.currency));
  const fTarget = add(money('Goal target', goal.targetCents, data.currency));
  const fRemaining = add(money('Still needed', remaining, data.currency));
  const limitations: string[] = ['Plans are estimates based on your recent averages; real months will vary.'];
  const actions: ToolOutput['actions'] = [{ label: 'Open goals', action: 'open_goals' }];
  const base = { period: null, limitations, actions };

  if (remaining === 0) {
    return { ...base, facts, template: `You have already reached ${goal.name}: {{#${fSaved}}} of {{#${fTarget}}}.`, verdict: 'reached', steps: [], milestones: [] };
  }

  // Ability to save: last 3 complete months that have any data.
  const thisMonth = data.today.slice(0, 7);
  const months = [1, 2, 3].map((n) => monthRange(shiftMonth(thisMonth, -n)));
  let income = 0;
  let spending = 0;
  let monthsWithData = 0; // may be a fraction when falling back to this month so far
  const catTotals = new Map<string, number>();
  const tally = (p: Period) => {
    const rows = data.transactions.filter((t) => t.currency === data.currency && !t.isTransfer && inPeriod(t.financialDate, p));
    for (const t of rows) if (t.amountCents > 0) income += t.amountCents;
    for (const [cat, v] of spendByCategory(rows, '')) {
      spending += v;
      catTotals.set(cat, (catTotals.get(cat) ?? 0) + v);
    }
    return rows.length > 0;
  };
  for (const p of months) if (tally(p)) monthsWithData += 1;

  if (!monthsWithData) {
    // New users have no complete month yet: scale this month so far (≥ 7 days) to a full month.
    const day = Number(data.today.slice(8, 10));
    const monthDays = Number(monthRange(thisMonth).end.slice(8, 10));
    if (day >= 7 && tally({ start: `${thisMonth}-01`, end: data.today })) {
      monthsWithData = day / monthDays;
      limitations.push(`Rough estimate: based on the first ${day} days of this month, scaled to a full month.`);
    } else {
      return {
        ...base,
        facts,
        template: `${goal.name}: {{#${fSaved}}} of {{#${fTarget}}} saved. I need at least a week of income and spending in WealthPilot to judge what you can afford; record your transactions and try again soon.`,
        verdict: 'no_data',
        steps: [],
        milestones: [],
      };
    }
  } else if (monthsWithData < 3) {
    limitations.push(`Based on only ${monthsWithData} complete month(s) of history.`);
  }
  const avgIncome = Math.round(income / monthsWithData);
  const avgSpending = Math.round(spending / monthsWithData);
  const surplus = avgIncome - avgSpending;

  // Other dated goals compete for the same surplus.
  const otherNeeds = data.goals
    .filter((g) => g !== goal && !g.isPaused && g.targetDate && g.targetDate > data.today && g.targetCents > g.currentCents)
    .reduce((s, g) => s + Math.ceil((g.targetCents - g.currentCents) / monthsUntil(data.today, g.targetDate!)), 0);
  const free = surplus - otherNeeds;

  const fIncome = add(money('Average monthly income', avgIncome, data.currency));
  const fSpending = add(money('Average monthly spending', avgSpending, data.currency));
  const fSurplus = add(money('Average monthly amount left over', surplus, data.currency));
  const fOther = otherNeeds ? add(money('Needed each month by your other goals', otherNeeds, data.currency, 'estimate')) : -1;

  let deadline = args.targetDate ?? goal.targetDate ?? undefined;
  if (deadline && deadline <= data.today) {
    limitations.push('The deadline is not in the future, so this plan suggests a realistic date instead.');
    deadline = undefined;
  }

  const comfortable = Math.floor(Math.max(0, free) / 2); // half the free surplus: room for surprises
  const realisticMonths = comfortable > 0 ? Math.ceil(remaining / comfortable) : null;
  const fRealisticDate = realisticMonths !== null ? add({ label: 'Realistic finish date', value: addMonthsYmd(data.today, realisticMonths), unit: 'date', kind: 'estimate' }) : -1;

  let verdict: PlanVerdict;
  let monthly: number;
  let fMonthly: number;
  let headline: string;
  if (deadline) {
    const monthsLeft = monthsUntil(data.today, deadline);
    const required = Math.ceil(remaining / monthsLeft);
    verdict = free <= 0 || required > free ? 'not_reachable' : required <= comfortable ? 'on_track' : 'stretch';
    const fDeadline = add({ label: 'Your deadline', value: deadline, unit: 'date', kind: 'recorded' });
    fMonthly = add(money('Needed each month to hit your deadline', required, data.currency, 'estimate'));
    monthly = verdict === 'not_reachable' ? comfortable : required;
    headline =
      verdict === 'on_track'
        ? `${goal.name} is on track: saving {{#${fMonthly}}} a month gets you there by {{#${fDeadline}}}, well within the {{#${fSurplus}}} you have left over each month.`
        : verdict === 'stretch'
          ? `${goal.name} by {{#${fDeadline}}} is a stretch: it needs {{#${fMonthly}}} a month, more than half of what you can spare.`
          : `${goal.name} by {{#${fDeadline}}} is not reachable on your current budget: it needs {{#${fMonthly}}} a month, but you have about {{#${fSurplus}}} left over.`;
  } else {
    verdict = comfortable > 0 ? 'on_track' : 'not_reachable';
    monthly = comfortable;
    fMonthly = add(money('Suggested monthly saving', comfortable, data.currency, 'estimate'));
    headline =
      comfortable > 0
        ? `${goal.name} has no deadline. Saving {{#${fMonthly}}} a month (half of what you have left over) would finish it by about {{#${fRealisticDate}}}.`
        : `${goal.name}: your spending currently matches or exceeds your income, so there is nothing left over to save yet.`;
  }
  facts.push({ label: 'Plan verdict', value: verdict.replace('_', ' '), unit: 'text', kind: 'estimate' });

  // Ways to close the gap: the 3 largest flexible categories, trimmed by 20%.
  const steps: string[] = [];
  if (monthly > 0) steps.push(`Move {{#${fMonthly}}} into ${goal.name} every month, ideally on payday so it happens before spending.`);
  if (verdict === 'stretch' || verdict === 'not_reachable') {
    const cuts = [...catTotals.entries()]
      .filter(([cat]) => !FIXED_SPEND.test(cat))
      .sort((x, y) => y[1] - x[1])
      .slice(0, 3)
      .map(([cat, total]) => ({ cat, avg: Math.round(total / monthsWithData) }));
    for (const c of cuts) {
      const fSave = add(money(`Saving from trimming ${c.cat} by a fifth`, Math.round(c.avg / 5), data.currency, 'estimate'));
      steps.push(`Trim ${c.cat} by a fifth to free about {{#${fSave}}} a month.`);
    }
    if (realisticMonths !== null && deadline) steps.push(`Or keep your current budget and move the deadline to {{#${fRealisticDate}}}.`);
  }
  if (fOther >= 0) steps.push(`Your other dated goals already need {{#${fOther}}} a month; pause or re-date one if this goal matters more.`);
  steps.push('Review progress at each milestone below and adjust if your income or spending changes.');

  // Milestones at 25/50/75/100% of the target, at the planned monthly amount.
  const milestones: GoalPlan['milestones'] = [];
  if (monthly > 0) {
    // Fact labels go to the model, so no digits and no user-typed names (e.g. "Reserve (6 Mo)") in them:
    // the model copies them and the grounding check rejects the wording.
    // Ordinals only: number words ("three quarters", "half") are rejected by the grounding check too.
    const steps4 = [
      [25, 'first milestone'],
      [50, 'second milestone'],
      [75, 'third milestone'],
      [100, 'final milestone (target reached)'],
    ] as const;
    for (const [share, words] of steps4) {
      const amount = Math.round((goal.targetCents * share) / 100);
      if (amount <= goal.currentCents) continue;
      const date = addMonthsYmd(data.today, Math.ceil((amount - goal.currentCents) / monthly));
      milestones.push({ label: `${share}% saved`, factIndex: add({ label: `${words[0].toUpperCase()}${words.slice(1)} date`, value: date, unit: 'date', kind: 'estimate' }) });
    }
  }

  return {
    ...base,
    facts,
    template:
      `${headline} You have saved {{#${fSaved}}} of {{#${fTarget}}} ({{#${fRemaining}}} to go). ` +
      `On average you earn {{#${fIncome}}} and spend {{#${fSpending}}} a month.`,
    verdict,
    steps,
    milestones,
  };
}

function debtSummary(_args: Record<string, never>, data: FinanceData): ToolOutput {
  if (!data.debts.length) return { period: null, facts: [], template: 'You have no debts recorded.', limitations: [], actions: [] };
  const highest = [...data.debts].sort((a, b) => b.aprPercent - a.aprPercent)[0];
  const facts: FactDraft[] = [
    count('Debts', data.debts.length),
    money('Total debt balance', data.debts.reduce((s, d) => s + d.balanceCents, 0), data.currency),
    money('Total minimum payments per month', data.debts.reduce((s, d) => s + d.minimumPaymentCents, 0), data.currency),
    { label: 'Highest-interest debt', value: highest.name, unit: 'text', kind: 'recorded' },
    percent('Highest interest rate (APR)', highest.aprPercent),
  ];
  return {
    period: null,
    facts,
    template:
      'You have {{#0}} debts totalling {{#1}}, with minimum payments of {{#2}} per month. ' +
      'The highest rate is {{#3}} at {{#4}} APR. The avalanche method pays that one first to save the most interest; ' +
      'the snowball method pays the smallest balance first for quicker wins. Compare both in the Debt Planner.',
    limitations: [],
    actions: [],
  };
}

/** Rules-only: names merchants and dates, so it is never offered to an external model. */
function possibleDuplicates(_args: Record<string, never>, data: FinanceData): ToolOutput {
  const p = { start: addDays(data.today, -90), end: data.today };
  const groups = new Map<string, { merchant: string; date: string; amount: number; currency: string; n: number }>();
  for (const t of data.transactions) {
    if (t.isTransfer || !inPeriod(t.financialDate, p)) continue;
    const key = `${t.financialDate}|${t.merchant.trim().toLowerCase()}|${t.amountCents}|${t.currency}`;
    const g = groups.get(key) ?? { merchant: t.merchant, date: t.financialDate, amount: t.amountCents, currency: t.currency, n: 0 };
    g.n += 1;
    groups.set(key, g);
  }
  const dups = [...groups.values()].filter((g) => g.n > 1).slice(0, 5);
  const facts: FactDraft[] = [count('Possible duplicate groups (last 90 days)', dups.length)];
  if (!dups.length) {
    return { period: p, facts, template: 'I found {{#0}} possible duplicate charges in the last 90 days (same date, merchant and amount).', limitations: [], actions: [] };
  }
  const parts = dups.map((g) => {
    const i = facts.length;
    facts.push({ label: `${g.merchant} date`, value: g.date, unit: 'date', kind: 'recorded' }, count(`${g.merchant} charges`, g.n), money(`${g.merchant} amount`, Math.abs(g.amount), g.currency));
    return `${g.merchant} on {{#${i}}} ({{#${i + 1}}} charges of {{#${i + 2}}})`;
  });
  return {
    period: p,
    facts,
    template: `I found {{#0}} possible duplicate groups in the last 90 days: ${parts.join('; ')}. Check whether any are accidental double postings.`,
    limitations: ['Two identical charges on the same day can be legitimate.'],
    actions: [{ label: 'Review transactions', action: 'open_transactions' }],
  };
}

// ---- Registry ---------------------------------------------------------------

export interface ToolDef {
  name: string;
  description: string;
  args: z.ZodType;
  /** false = rules-only; never offered to (or narrated by) an external model. */
  llm: boolean;
  run: (args: never, data: FinanceData) => ToolOutput;
}

const empty = z.object({}).strict();

export const TOOLS: ToolDef[] = [
  { name: 'get_financial_summary', description: 'Income, spending and net cash flow per currency for a date range (transfers excluded).', args: Range, llm: true, run: financialSummary as ToolDef['run'] },
  {
    name: 'get_category_breakdown',
    description: 'Top spending categories with totals and share of spending for a date range.',
    args: z.object({ from: ymd, to: ymd, limit: z.number().int().min(1).max(12).default(5) }).refine((r) => r.to >= r.from && daysBetween(r.from, r.to) <= 366, 'invalid range'),
    llm: true,
    run: categoryBreakdown as ToolDef['run'],
  },
  {
    name: 'compare_periods',
    description: 'Compare total spending (optionally one category) between period a and an earlier period b.',
    args: z.object({ a: Range, b: Range, category: z.string().trim().min(1).max(60).optional() }),
    llm: true,
    run: comparePeriods as ToolDef['run'],
  },
  { name: 'get_budget_status', description: 'Budget allocation, spending and utilisation per category for a month (YYYY-MM).', args: z.object({ month: monthYear }), llm: true, run: budgetStatus as ToolDef['run'] },
  { name: 'get_upcoming_bills', description: 'Bills due within the next N days (max 60), with amounts and due dates.', args: z.object({ days: z.number().int().min(1).max(60).default(30) }), llm: true, run: upcomingBills as ToolDef['run'] },
  {
    name: 'calculate_savings_plan',
    description: 'Progress of active savings goals and the monthly amount needed; optionally for one goal name or a given monthly contribution in minor units.',
    args: z.object({ goalName: z.string().trim().min(1).max(80).optional(), monthlyCents: z.number().int().positive().safe().optional() }),
    llm: true,
    run: savingsPlan as ToolDef['run'],
  },
  {
    name: 'plan_goal',
    description: 'Judge whether a savings goal (by exact name) is reachable by a date given average income and spending, with a monthly plan, cuts and milestones.',
    args: z.object({ goalName: z.string().trim().min(1).max(80), targetDate: ymd.optional() }),
    llm: true,
    run: planGoal as ToolDef['run'],
  },
  { name: 'get_debt_summary', description: 'Number of debts, total balance, total minimum payments and the highest-interest debt.', args: empty, llm: true, run: debtSummary as ToolDef['run'] },
  { name: 'find_possible_duplicates', description: 'Possible duplicate charges in the last 90 days.', args: empty, llm: false, run: possibleDuplicates as ToolDef['run'] },
];

export const toolByName = (name: string) => TOOLS.find((t) => t.name === name);

/** Validates args with the tool's Zod schema, then runs it. Throws on unknown tool or bad args. */
export function runTool(name: string, rawArgs: unknown, data: FinanceData): ToolOutput {
  const tool = toolByName(name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  const args = tool.args.parse(rawArgs ?? {});
  return tool.run(args as never, data);
}
