/**
 * WealthPilot — Assistant commands: turn "pay Netflix" into a change the user confirms.
 *
 * Nothing here writes. A command resolves against the session user's own FinanceData into an
 * ActionProposal (a FinanceContext method + ready args); the client runs it only after Confirm,
 * through the normal authed API routes. The model (when allowed) only extracts command args from
 * the user's own message; names are matched and ids looked up here. Every amount must appear in
 * the message, so a model can't invent one.
 */

import { z } from 'zod';
import { formatMoney, dollarsToCents } from '@/lib/money';
import { ymd, Currency } from '../schemas';
import { isCountryCode } from '@/lib/countries';
import { SCENARIOS, SCENARIO_IDS, type ScenarioId } from '@/lib/planning/scenarios';
import { suggestMixes, MIX_IDS, type MixId } from '@/lib/planning/markets';
import { addMonthsYmd, type FinanceData } from './tools';
import type { ToolCall } from './router';
import type { ActionProposal } from '@/types/finance';
import { GOAL_INTENT, type SegmentId } from '@/lib/assistant';
export { looksLikeCommand } from '@/lib/assistant';

export const TABS = ['overview', 'transactions', 'accounts', 'budgets', 'goals', 'bills', 'planning', 'learn', 'copilot', 'import', 'settings'] as const;
const TAB_ALIASES: Record<string, (typeof TABS)[number]> = { home: 'overview', dashboard: 'overview', debts: 'planning', debt: 'planning', planner: 'planning', loans: 'planning', loan: 'planning', invest: 'planning', investments: 'planning', privacy: 'settings', assistant: 'copilot', chat: 'copilot' };

/** A command waiting for its amount: sent back by the client with the user's answer (re-validated like any call). */
export interface PendingCommand {
  name: string;
  args: Record<string, unknown>;
  field: string;
}
/** `then` = a step that runs right after `proposal` and uses what it created (args '$prev'). */
type Resolved = { proposal: ActionProposal; then?: ActionProposal } | { clarify: string; askAmount?: string; options?: string[]; pending?: PendingCommand };

/** Which argument holds the amount a command asks for when it's missing. */
const AMOUNT_FIELD: Record<string, string> = {
  add_transaction: 'amount',
  add_goal: 'target',
  update_goal: 'target',
  contribute_goal: 'amount',
  set_budget: 'amount',
  add_bill: 'amount',
  update_bill: 'amount',
  add_debt: 'balance',
};
type Ctx = { data: FinanceData; message: string };

const amount = z.union([z.string().trim().min(1).max(20), z.number()]).describe('Amount exactly as the user wrote it, e.g. "12.50"');
// Required amounts are still optional for the model: when the user hasn't said one, it leaves it out and we ask.
const needed = amount.optional().describe('Amount exactly as the user wrote it; leave out if the user has not said one');
const name = z.string().trim().min(1).max(80);

// ---- Helpers ----------------------------------------------------------------

/** Cents of an amount the user actually wrote; null when the number is not in their message. */
function centsFromMessage(value: string | number | undefined, message: string, currency: string): number | null {
  if (value === undefined) return null;
  const c = dollarsToCents(String(value).replace(/,/g, ''), currency);
  const written = (message.replace(/,/g, '').match(/\d+(?:\.\d+)?/g) ?? []).map((n) => dollarsToCents(n, currency));
  return c > 0 && written.includes(c) ? c : null;
}

const noAmount = (what: string): Resolved => ({ clarify: `Please tell me the ${what} as a number, e.g. "$25".`, askAmount: what });

/** Scenario id from everyday words ("war", "sanctions", "oil shock", …). */
function scenarioFrom(text: string): ScenarioId | null {
  const t = text.toLowerCase();
  if (/war|conflict/.test(t)) return 'conflict';
  if (/sanction|capital control/.test(t)) return 'sanctions';
  if (/oil|energy/.test(t)) return 'oil_shock';
  if (/rate|hike/.test(t)) return 'rate_hike';
  if (/currency|devaluation|taka|crash/.test(t)) return 'currency_crash';
  if (/election|politic|unrest|instab/.test(t)) return 'political_instability';
  if (/recession|downturn|crisis/.test(t)) return 'recession';
  return null;
}

/** A loan offer by name or lender (taken offers excluded unless allowTaken is false-y for listing). */
function findOffer(data: FinanceData, query: string, onlyConsidering = false) {
  const offers = (data.loanOffers ?? []).filter((o) => !onlyConsidering || o.status === 'considering');
  const q = query.trim().toLowerCase().replace(/\s+loan(\s+offer)?$/, '');
  const byLender = offers.filter((o) => o.lender.toLowerCase().includes(q) || q.includes(o.lender.toLowerCase()));
  if (byLender.length === 1) return byLender[0];
  return findOne(offers.map((o) => ({ ...o, name: o.name })), query, onlyConsidering ? 'loan offer you are considering' : 'loan offer');
}

function findOne<T extends { name: string; id?: string }>(items: T[], query: string, kind: string): T | string {
  const q = query.trim().toLowerCase();
  const withId = items.filter((i) => i.id);
  const exact = withId.filter((i) => i.name.toLowerCase() === q);
  const hits = exact.length ? exact : withId.filter((i) => i.name.toLowerCase().includes(q) || q.includes(i.name.toLowerCase()));
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) return `Which ${kind} do you mean: ${hits.slice(0, 5).map((h) => h.name).join(', ')}?`;
  const all = withId.slice(0, 6).map((i) => i.name);
  return `I couldn't find a ${kind} called "${query}".${all.length ? ` Your ${kind}s: ${all.join(', ')}.` : ''}`;
}

const propose = (summary: string, op: ActionProposal['op'], args: unknown[], destructive = false): Resolved => ({ proposal: { summary, op, args, destructive } });
const money = (c: number, d: FinanceData) => formatMoney(c, d.currency);

// ---- Commands -----------------------------------------------------------------

interface CommandDef {
  name: string;
  description: string;
  args: z.ZodType;
  resolve: (args: never, ctx: Ctx) => Resolved;
}

const goalBy = (d: FinanceData, n: string) => findOne(d.goals, n, 'goal');

export const COMMANDS: CommandDef[] = [
  {
    name: 'navigate',
    description: `Open a page of the app: ${TABS.join(', ')}.`,
    args: z.object({ tab: z.string().trim().min(1).max(30) }),
    resolve: ({ tab }: { tab: string }) => {
      const t = tab.toLowerCase().replace(/\s*(tab|page)$/, '');
      const target = (TABS as readonly string[]).includes(t) ? t : TAB_ALIASES[t];
      return target ? propose(`Open ${target[0].toUpperCase()}${target.slice(1)}`, 'navigate', [target]) : { clarify: `I can open: ${TABS.join(', ')}.` };
    },
  },
  {
    name: 'open_quick_add',
    description: 'Open the form to record a transaction by hand.',
    args: z.object({}),
    resolve: () => propose('Open the Record Transaction form', 'openQuickAdd', []),
  },
  {
    name: 'add_transaction',
    description: 'Record an expense or income the user describes.',
    args: z.object({ amount: needed, merchant: name, type: z.enum(['expense', 'income']).default('expense'), category: name.optional(), date: ymd.optional(), account: name.optional() }),
    resolve: (a: { amount: string; merchant: string; type: 'expense' | 'income'; category?: string; date?: string; account?: string }, { data, message }) => {
      const c = centsFromMessage(a.amount, message, data.currency);
      if (!c) return noAmount('amount');
      const accounts = data.accounts ?? [];
      const acc = a.account ? findOne(accounts, a.account, 'account') : accounts[0];
      if (!acc) return { clarify: 'Add an account first (Accounts tab), then I can record transactions in it.' };
      if (typeof acc === 'string') return { clarify: acc };
      const date = a.date ?? data.today;
      const amountCents = a.type === 'income' ? c : -c;
      return propose(`Record ${a.type} of ${money(c, data)} at ${a.merchant}${a.category ? ` (${a.category})` : ''} on ${date} in ${acc.name}`, 'addTransaction', [
        { accountId: acc.id, financialDate: date, merchant: a.merchant, normalizedMerchant: a.merchant, category: a.category ?? 'General', amountCents, currency: data.currency, status: 'cleared', tags: [], isTransfer: false, source: 'manual' },
      ]);
    },
  },
  {
    name: 'recategorize_transaction',
    description: "Change the category of the user's most recent transaction at a merchant.",
    args: z.object({ merchant: name, category: name }),
    resolve: (a: { merchant: string; category: string }, { data }) => {
      const t = latestAt(data, a.merchant);
      if (typeof t === 'string') return { clarify: t };
      return propose(`Change the ${t.financialDate} ${t.merchant} transaction (${money(Math.abs(t.amountCents), data)}) to ${a.category}`, 'updateTransaction', [t.id, { category: a.category }]);
    },
  },
  {
    name: 'delete_transaction',
    description: "Delete the user's most recent transaction at a merchant (optionally on a date).",
    args: z.object({ merchant: name, date: ymd.optional() }),
    resolve: (a: { merchant: string; date?: string }, { data }) => {
      const t = latestAt(data, a.merchant, a.date);
      if (typeof t === 'string') return { clarify: t };
      return propose(`Delete the ${t.financialDate} ${t.merchant} transaction (${money(Math.abs(t.amountCents), data)})`, 'deleteTransaction', [t.id], true);
    },
  },
  {
    name: 'add_goal',
    description: 'Create a savings goal with a target amount and optional deadline; withPlan=true when the user also wants a plan for it.',
    args: z.object({ name, target: needed, targetDate: ymd.optional(), withPlan: z.boolean().optional() }),
    resolve: (a: { name: string; target: string; targetDate?: string; withPlan?: boolean }, { data, message }) => {
      const c = centsFromMessage(a.target, message, data.currency);
      if (!c) return noAmount('target amount');
      if (a.targetDate && a.targetDate <= data.today) return { clarify: `The deadline ${a.targetDate} has already passed. When do you want to reach "${a.name}"?` };
      const created = propose(`Create goal "${a.name}": save ${money(c, data)}${a.targetDate ? ` by ${a.targetDate}` : ''}`, 'addGoal', [
        { name: a.name, targetCents: c, currentCents: 0, targetDate: a.targetDate, priority: 'medium', category: 'General', isPaused: false },
      ]) as { proposal: ActionProposal };
      if (!a.withPlan) return created;
      return {
        ...created,
        then: { summary: `Make a plan for "${a.name}" from your income and spending, and open Goals`, op: 'planGoal', args: ['$prev'], destructive: false },
      };
    },
  },
  {
    name: 'update_goal',
    description: 'Change a savings goal: new target amount, new deadline or new name.',
    args: z.object({ name, target: amount.optional(), targetDate: ymd.optional(), newName: name.optional() }),
    resolve: (a: { name: string; target?: string; targetDate?: string; newName?: string }, { data, message }) => {
      const g = goalBy(data, a.name);
      if (typeof g === 'string') return { clarify: g };
      const updates: Record<string, unknown> = {};
      const parts: string[] = [];
      if (a.target !== undefined) {
        const c = centsFromMessage(a.target, message, data.currency);
        if (!c) return noAmount('new target');
        updates.targetCents = c;
        parts.push(`target ${money(c, data)}`);
      }
      if (a.targetDate) {
        updates.targetDate = a.targetDate;
        parts.push(`deadline ${a.targetDate}`);
      }
      if (a.newName) {
        updates.name = a.newName;
        parts.push(`name "${a.newName}"`);
      }
      if (!parts.length) return { clarify: `What should change on "${g.name}": the target, the deadline or the name?` };
      return propose(`Update goal "${g.name}": ${parts.join(', ')}`, 'updateGoal', [g.id, updates]);
    },
  },
  {
    name: 'contribute_goal',
    description: 'Add money to a savings goal.',
    args: z.object({ name, amount: needed }),
    resolve: (a: { name: string; amount: string }, { data, message }) => {
      const c = centsFromMessage(a.amount, message, data.currency);
      if (!c) return noAmount('amount');
      const g = goalBy(data, a.name);
      if (typeof g === 'string') return { clarify: g };
      return propose(`Add ${money(c, data)} to goal "${g.name}"`, 'contributeToGoal', [g.id, c]);
    },
  },
  ...(['pause', 'resume'] as const).map((verb) => ({
    name: `${verb}_goal`,
    description: `${verb === 'pause' ? 'Pause' : 'Resume'} a savings goal.`,
    args: z.object({ name }),
    resolve: (a: { name: string }, { data }: Ctx): Resolved => {
      const g = goalBy(data, a.name);
      if (typeof g === 'string') return { clarify: g };
      return propose(`${verb === 'pause' ? 'Pause' : 'Resume'} goal "${g.name}"`, 'updateGoal', [g.id, { isPaused: verb === 'pause' }]);
    },
  })),
  {
    name: 'delete_goal',
    description: 'Delete a savings goal.',
    args: z.object({ name }),
    resolve: (a: { name: string }, { data }) => {
      const g = goalBy(data, a.name);
      if (typeof g === 'string') return { clarify: g };
      return propose(`Delete goal "${g.name}" (${money(g.currentCents, data)} saved so far)`, 'deleteGoal', [g.id], true);
    },
  },
  {
    name: 'plan_goal',
    description: 'Run the AI goal planner for a savings goal and save the plan.',
    args: z.object({ name }),
    resolve: (a: { name: string }, { data }) => {
      const g = goalBy(data, a.name);
      if (typeof g === 'string') return { clarify: g };
      return propose(`Calculate a plan for goal "${g.name}" and open Goals`, 'planGoal', [g.id]);
    },
  },
  {
    name: 'set_budget',
    description: "Set this month's budget for a spending category.",
    args: z.object({ category: name, amount: needed }),
    resolve: (a: { category: string; amount: string }, { data, message }) => {
      const c = centsFromMessage(a.amount, message, data.currency);
      if (!c) return noAmount('budget amount');
      const existing = data.budgets.find((b) => b.category.toLowerCase() === a.category.toLowerCase());
      const category = existing?.category ?? a.category;
      return propose(`Set the ${category} budget to ${money(c, data)} for ${data.today.slice(0, 7)}`, 'addBudget', [
        { category, allocatedCents: c, spentCents: 0, period: 'monthly', rolloverEnabled: false, rolloverCents: 0, alertThresholdPercent: existing?.alertThresholdPercent ?? 85 },
      ]);
    },
  },
  {
    name: 'delete_budget',
    description: "Delete this month's budget for a category.",
    args: z.object({ category: name }),
    resolve: (a: { category: string }, { data }) => {
      const b = findOne(data.budgets.map((x) => ({ ...x, name: x.category })), a.category, 'budget');
      if (typeof b === 'string') return { clarify: b };
      return propose(`Delete the ${b.category} budget (${money(b.allocatedCents, data)})`, 'deleteBudget', [b.id], true);
    },
  },
  {
    name: 'add_bill',
    description: 'Add a recurring bill or subscription.',
    args: z.object({ name, amount: needed, frequency: z.enum(['weekly', 'monthly', 'quarterly', 'annual']).default('monthly'), nextDueDate: ymd.optional() }),
    resolve: (a: { name: string; amount: string; frequency: 'weekly' | 'monthly' | 'quarterly' | 'annual'; nextDueDate?: string }, { data, message }) => {
      const c = centsFromMessage(a.amount, message, data.currency);
      if (!c) return noAmount('bill amount');
      const due = a.nextDueDate ?? data.today;
      return propose(`Add bill "${a.name}": ${money(c, data)} ${a.frequency}, next due ${due}`, 'addBill', [
        { name: a.name, amountCents: c, frequency: a.frequency, nextDueDate: due, category: 'Bills', accountId: data.accounts?.[0]?.id ?? '', isAutoPay: false, status: 'active', confidence: 'confirmed' },
      ]);
    },
  },
  {
    name: 'update_bill',
    description: 'Change a bill: new amount, next due date, or pause/resume it.',
    args: z.object({ name, amount: amount.optional(), nextDueDate: ymd.optional(), paused: z.boolean().optional() }),
    resolve: (a: { name: string; amount?: string; nextDueDate?: string; paused?: boolean }, { data, message }) => {
      const b = findOne(data.bills, a.name, 'bill');
      if (typeof b === 'string') return { clarify: b };
      const updates: Record<string, unknown> = {};
      const parts: string[] = [];
      if (a.amount !== undefined) {
        const c = centsFromMessage(a.amount, message, data.currency);
        if (!c) return noAmount('new amount');
        updates.amountCents = c;
        parts.push(`amount ${money(c, data)}`);
      }
      if (a.nextDueDate) {
        updates.nextDueDate = a.nextDueDate;
        parts.push(`next due ${a.nextDueDate}`);
      }
      if (a.paused !== undefined) {
        updates.status = a.paused ? 'paused' : 'active';
        parts.push(a.paused ? 'paused' : 'active');
      }
      if (!parts.length) return { clarify: `What should change on "${b.name}": the amount, the due date, or pause it?` };
      return propose(`Update bill "${b.name}": ${parts.join(', ')}`, 'updateBill', [b.id, updates]);
    },
  },
  {
    name: 'pay_bill',
    description: 'Mark a bill as paid for its current due date.',
    args: z.object({ name }),
    resolve: (a: { name: string }, { data }) => {
      const b = findOne(data.bills, a.name, 'bill');
      if (typeof b === 'string') return { clarify: b };
      return propose(`Mark "${b.name}" (${money(b.amountCents, data)}, due ${b.nextDueDate}) as paid and record the expense`, 'payBill', [b.id]);
    },
  },
  {
    name: 'delete_bill',
    description: 'Delete a bill or subscription.',
    args: z.object({ name }),
    resolve: (a: { name: string }, { data }) => {
      const b = findOne(data.bills, a.name, 'bill');
      if (typeof b === 'string') return { clarify: b };
      return propose(`Delete bill "${b.name}" (${money(b.amountCents, data)})`, 'deleteBill', [b.id], true);
    },
  },
  {
    name: 'add_debt',
    description: 'Add a debt (loan or credit card) with balance, interest rate (APR %) and minimum payment.',
    args: z.object({
      name,
      balance: needed,
      aprPercent: z.union([z.string(), z.number()]).optional(),
      minimumPayment: amount.optional(),
      kind: z.enum(['credit_card', 'student_loan', 'car_loan', 'mortgage', 'personal_loan']).default('personal_loan'),
    }),
    resolve: (a: { name: string; balance: string; aprPercent?: string; minimumPayment?: string; kind: string }, { data, message }) => {
      const bal = centsFromMessage(a.balance, message, data.currency);
      if (!bal) return noAmount('balance');
      const min = a.minimumPayment !== undefined ? centsFromMessage(a.minimumPayment, message, data.currency) : 0;
      if (min === null) return noAmount('minimum payment');
      const apr = a.aprPercent !== undefined ? Number(String(a.aprPercent).replace('%', '')) : 0;
      if (!(apr >= 0 && apr <= 100) || (apr && !message.includes(String(apr)))) return { clarify: 'Please tell me the interest rate (APR) as a percentage, e.g. "19.9%".' };
      return propose(`Add debt "${a.name}": balance ${money(bal, data)}, APR ${apr}%, minimum ${money(min, data)}`, 'addDebt', [
        { name: a.name, balanceCents: bal, aprPercent: apr, minimumPaymentCents: min, dueDateDay: 1, category: a.kind },
      ]);
    },
  },
  {
    name: 'update_debt',
    description: "Change a debt's balance or minimum payment.",
    args: z.object({ name, balance: amount.optional(), minimumPayment: amount.optional() }),
    resolve: (a: { name: string; balance?: string; minimumPayment?: string }, { data, message }) => {
      const d = findOne(data.debts, a.name, 'debt');
      if (typeof d === 'string') return { clarify: d };
      const updates: Record<string, number> = {};
      const parts: string[] = [];
      for (const [key, field, label] of [['balance', 'balanceCents', 'balance'], ['minimumPayment', 'minimumPaymentCents', 'minimum']] as const) {
        if (a[key] === undefined) continue;
        const c = centsFromMessage(a[key]!, message, data.currency);
        if (!c) return noAmount(label);
        updates[field] = c;
        parts.push(`${label} ${money(c, data)}`);
      }
      if (!parts.length) return { clarify: `What should change on "${d.name}": the balance or the minimum payment?` };
      return propose(`Update debt "${d.name}": ${parts.join(', ')}`, 'updateDebt', [d.id, updates]);
    },
  },
  {
    name: 'delete_debt',
    description: 'Delete a debt.',
    args: z.object({ name }),
    resolve: (a: { name: string }, { data }) => {
      const d = findOne(data.debts, a.name, 'debt');
      if (typeof d === 'string') return { clarify: d };
      return propose(`Delete debt "${d.name}" (${money(d.balanceCents, data)} balance)`, 'deleteDebt', [d.id], true);
    },
  },
  {
    name: 'add_account',
    description: 'Add a manual account (checking, savings, credit, investment, cash or loan) with an optional current balance.',
    args: z.object({ name, type: z.enum(['checking', 'savings', 'credit', 'investment', 'cash', 'loan']).default('checking'), balance: amount.optional() }),
    resolve: (a: { name: string; type: string; balance?: string }, { data, message }) => {
      const bal = a.balance !== undefined ? centsFromMessage(a.balance, message, data.currency) : 0;
      if (bal === null) return noAmount('balance');
      return propose(`Add ${a.type} account "${a.name}" with balance ${money(bal, data)}`, 'addAccount', [
        { name: a.name, institution: 'Manual', type: a.type, currency: data.currency, balanceCents: bal, accountNumberMask: '•••• 0000', isManual: true, isIncludedInNetWorth: true },
      ]);
    },
  },
  {
    name: 'rename_account',
    description: 'Rename an account.',
    args: z.object({ name, newName: name }),
    resolve: (a: { name: string; newName: string }, { data }) => {
      const acc = findOne(data.accounts ?? [], a.name, 'account');
      if (typeof acc === 'string') return { clarify: acc };
      return propose(`Rename account "${acc.name}" to "${a.newName}"`, 'updateAccount', [acc.id, { name: a.newName }]);
    },
  },
  {
    name: 'delete_account',
    description: 'Delete an account (only if it has no transactions).',
    args: z.object({ name }),
    resolve: (a: { name: string }, { data }) => {
      const acc = findOne(data.accounts ?? [], a.name, 'account');
      if (typeof acc === 'string') return { clarify: acc };
      return propose(`Delete account "${acc.name}"`, 'removeAccount', [acc.id], true);
    },
  },
  // ---- Planner: investment plans, mixes, stress tests, loan offers ----------------------------
  {
    name: 'add_investment_plan',
    description: 'Create an investment plan: name, monthly amount, optional starting amount, years, risk (conservative/balanced/growth) and country (ISO-2).',
    args: z.object({ name, monthly: needed, initial: amount.optional(), years: z.union([z.number(), z.string()]).optional(), risk: z.enum(['conservative', 'balanced', 'growth']).default('balanced'), country: z.string().length(2).optional() }),
    resolve: (a: { name: string; monthly: string; initial?: string; years?: string | number; risk: 'conservative' | 'balanced' | 'growth'; country?: string }, { data, message }) => {
      const monthly = centsFromMessage(a.monthly, message, data.currency);
      if (!monthly) return noAmount('monthly amount');
      const initial = a.initial !== undefined ? centsFromMessage(a.initial, message, data.currency) : 0;
      if (initial === null) return noAmount('starting amount');
      const years = Math.min(50, Math.max(1, Math.round(Number(a.years) || 10)));
      const country = (a.country ?? data.region ?? 'US').toUpperCase();
      return propose(`Create investment plan "${a.name}": ${money(initial, data)} now + ${money(monthly, data)}/month for ${years} years, ${a.risk}, in ${country}`, 'saveInvestmentPlan', [
        { name: a.name, country: isCountryCode(country) ? country : 'US', currency: data.currency, initialCents: initial, monthlyCents: monthly, horizonMonths: years * 12, riskProfile: a.risk, expectedReturnBps: null, taxBps: 0, scenarios: [], allocation: null, mixName: null },
      ]);
    },
  },
  {
    name: 'update_investment_plan',
    description: 'Change an investment plan: monthly amount, starting amount, years, risk, country or expected yearly return (%).',
    args: z.object({ name, monthly: amount.optional(), initial: amount.optional(), years: z.union([z.number(), z.string()]).optional(), risk: z.enum(['conservative', 'balanced', 'growth']).optional(), country: z.string().length(2).optional(), expectedReturnPercent: z.union([z.number(), z.string()]).optional() }),
    resolve: (a: { name: string; monthly?: string; initial?: string; years?: string | number; risk?: 'conservative' | 'balanced' | 'growth'; country?: string; expectedReturnPercent?: string | number }, { data, message }) => {
      const plan = findOne(data.investments ?? [], a.name, 'investment plan');
      if (typeof plan === 'string') return { clarify: plan };
      const next = { ...plan };
      const changes: string[] = [];
      if (a.monthly !== undefined) {
        const c = centsFromMessage(a.monthly, message, data.currency);
        if (!c) return noAmount('monthly amount');
        next.monthlyCents = c;
        changes.push(`${money(c, data)}/month`);
      }
      if (a.initial !== undefined) {
        const c = centsFromMessage(a.initial, message, data.currency);
        if (c === null) return noAmount('starting amount');
        next.initialCents = c;
        changes.push(`start with ${money(c, data)}`);
      }
      if (a.years !== undefined && Number(a.years) > 0) {
        next.horizonMonths = Math.min(600, Math.round(Number(a.years) * 12));
        changes.push(`${Math.round(next.horizonMonths / 12)} years`);
      }
      if (a.risk) {
        next.riskProfile = a.risk;
        changes.push(a.risk);
      }
      if (a.country && isCountryCode(a.country.toUpperCase())) {
        next.country = a.country.toUpperCase();
        changes.push(`invest in ${next.country}`);
      }
      if (a.expectedReturnPercent !== undefined) {
        const r = Number(String(a.expectedReturnPercent).replace('%', ''));
        if (!Number.isFinite(r) || !message.includes(String(a.expectedReturnPercent).replace('%', ''))) return { clarify: 'Please tell me the expected yearly return as a percentage, e.g. "7%".' };
        next.expectedReturnBps = Math.round(r * 100);
        changes.push(`expected return ${r}%`);
      }
      if (!changes.length) return { clarify: 'What should I change: the monthly amount, years, risk, country or expected return?' };
      const { id, updatedAt: _u, ...body } = next;
      return propose(`Update plan "${plan.name}": ${changes.join(', ')}`, 'saveInvestmentPlan', [body, id]);
    },
  },
  {
    name: 'delete_investment_plan',
    description: 'Delete an investment plan.',
    args: z.object({ name }),
    resolve: (a: { name: string }, { data }) => {
      const plan = findOne(data.investments ?? [], a.name, 'investment plan');
      if (typeof plan === 'string') return { clarify: plan };
      return propose(`Delete investment plan "${plan.name}"`, 'deleteInvestmentPlan', [plan.id], true);
    },
  },
  {
    name: 'set_investment_scenario',
    description: 'Turn a stress-test scenario on or off for an investment plan: conflict (war), sanctions, oil_shock, rate_hike, currency_crash, political_instability, recession.',
    args: z.object({ name, scenario: z.enum(SCENARIO_IDS), on: z.boolean().default(true) }),
    resolve: (a: { name: string; scenario: ScenarioId; on: boolean }, { data }) => {
      const plan = findOne(data.investments ?? [], a.name, 'investment plan');
      if (typeof plan === 'string') return { clarify: plan };
      const label = SCENARIOS.find((s) => s.id === a.scenario)!.label;
      const scenarios = a.on ? [...new Set([...plan.scenarios, a.scenario])] : plan.scenarios.filter((s) => s !== a.scenario);
      const { id, updatedAt: _u, ...body } = plan;
      return propose(`${a.on ? 'Turn on' : 'Turn off'} the "${label}" stress test for "${plan.name}"`, 'saveInvestmentPlan', [{ ...body, scenarios }, id]);
    },
  },
  {
    name: 'apply_investment_mix',
    description: 'Apply one of the history-based fund mixes to an investment plan: core, global, lower_swings, growth or resilient.',
    args: z.object({ name, mix: z.enum(MIX_IDS) }),
    resolve: (a: { name: string; mix: MixId }, { data }) => {
      const plan = findOne(data.investments ?? [], a.name, 'investment plan');
      if (typeof plan === 'string') return { clarify: plan };
      if (!data.markets?.length) return { clarify: 'Market data is unavailable right now, so I cannot build the mix. Try again in a few minutes.' };
      const mixes = suggestMixes(data.markets, plan.riskProfile, Math.max(1, Math.round(plan.horizonMonths / 12)));
      const mix = mixes.find((m) => m.id === a.mix);
      if (!mix) return { clarify: `The available mixes are: ${mixes.map((m) => m.name).join(', ')}.` };
      const allocation = mix.picks.map((p) => ({ symbol: p.symbol, label: p.label, weightPct: p.weightPct }));
      const { id, updatedAt: _u, ...body } = plan;
      return propose(
        `Apply the "${mix.name}" mix to "${plan.name}": ${allocation.map((x) => `${x.label} ${x.weightPct}%`).join(', ')} (history-based return ${((mix.expectedReturnBps ?? 0) / 100).toFixed(1)}%/yr)`,
        'saveInvestmentPlan',
        [{ ...body, allocation, mixName: mix.name, expectedReturnBps: mix.expectedReturnBps }, id]
      );
    },
  },
  {
    name: 'add_loan_offer',
    description: 'Save a loan offer to compare: name, lender, amount, APR %, term in months or years, optional upfront fee and purpose (personal/car/home/education/business).',
    args: z.object({ name: name.optional(), lender: name, amount: needed, aprPercent: z.union([z.string(), z.number()]).optional(), months: z.union([z.number(), z.string()]).optional(), years: z.union([z.number(), z.string()]).optional(), fee: amount.optional(), purpose: z.enum(['personal', 'car', 'home', 'education', 'business']).default('personal') }),
    resolve: (a: { name?: string; lender: string; amount: string; aprPercent?: string | number; months?: string | number; years?: string | number; fee?: string; purpose: 'personal' | 'car' | 'home' | 'education' | 'business' }, { data, message }) => {
      const principal = centsFromMessage(a.amount, message, data.currency);
      if (!principal) return noAmount('loan amount');
      const apr = a.aprPercent !== undefined ? Number(String(a.aprPercent).replace('%', '')) : NaN;
      if (!(apr >= 0 && apr <= 100) || !message.includes(String(a.aprPercent).replace('%', ''))) return { clarify: 'What is the interest rate (APR)? For example "11.5%".' };
      const months = Math.round(Number(a.months) || Number(a.years) * 12 || 0);
      if (!(months >= 1 && months <= 480)) return { clarify: 'For how long is the loan? For example "5 years" or "60 months".' };
      const fee = a.fee !== undefined ? centsFromMessage(a.fee, message, data.currency) : 0;
      if (fee === null) return noAmount('fee');
      const label = a.name ?? `${a.purpose[0].toUpperCase()}${a.purpose.slice(1)} loan`;
      return propose(`Save loan offer "${label}" from ${a.lender}: ${money(principal, data)} at ${apr}% for ${months} months${fee ? `, ${money(fee, data)} fees` : ''}`, 'saveLoanOffer', [
        { name: label, lender: a.lender, principalCents: principal, aprBps: Math.round(apr * 100), termMonths: months, feeCents: fee, purpose: a.purpose, country: data.region && data.region !== 'EU' ? data.region : null },
      ]);
    },
  },
  {
    name: 'update_loan_offer',
    description: 'Change a loan offer that has not been taken yet: amount, APR %, term (months) or fee.',
    args: z.object({ name, amount: amount.optional(), aprPercent: z.union([z.string(), z.number()]).optional(), months: z.union([z.number(), z.string()]).optional(), fee: amount.optional() }),
    resolve: (a: { name: string; amount?: string; aprPercent?: string | number; months?: string | number; fee?: string }, { data, message }) => {
      const offer = findOffer(data, a.name);
      if (typeof offer === 'string') return { clarify: offer };
      if (offer.status === 'taken') return { clarify: `"${offer.name}" was already taken; change it in your debts instead.` };
      const next = { ...offer };
      const changes: string[] = [];
      if (a.amount !== undefined) {
        const c = centsFromMessage(a.amount, message, data.currency);
        if (!c) return noAmount('loan amount');
        next.principalCents = c;
        changes.push(money(c, data));
      }
      if (a.aprPercent !== undefined) {
        const apr = Number(String(a.aprPercent).replace('%', ''));
        if (!(apr >= 0 && apr <= 100) || !message.includes(String(a.aprPercent).replace('%', ''))) return { clarify: 'What is the new interest rate (APR)?' };
        next.aprBps = Math.round(apr * 100);
        changes.push(`${apr}% APR`);
      }
      if (a.months !== undefined && Number(a.months) >= 1) {
        next.termMonths = Math.min(480, Math.round(Number(a.months)));
        changes.push(`${next.termMonths} months`);
      }
      if (a.fee !== undefined) {
        const c = centsFromMessage(a.fee, message, data.currency);
        if (c === null) return noAmount('fee');
        next.feeCents = c;
        changes.push(`${money(c, data)} fees`);
      }
      if (!changes.length) return { clarify: 'What should I change: the amount, rate, term or fee?' };
      const { id, updatedAt: _u, status: _s, debtId: _d, ...body } = next;
      return propose(`Update loan offer "${offer.name}" (${offer.lender}): ${changes.join(', ')}`, 'saveLoanOffer', [body, id]);
    },
  },
  {
    name: 'delete_loan_offer',
    description: 'Delete a saved loan offer.',
    args: z.object({ name }),
    resolve: (a: { name: string }, { data }) => {
      const offer = findOffer(data, a.name);
      if (typeof offer === 'string') return { clarify: offer };
      return propose(`Delete loan offer "${offer.name}" from ${offer.lender}`, 'deleteLoanOffer', [offer.id], true);
    },
  },
  {
    name: 'take_loan',
    description: 'The user took one of their saved loan offers (by offer name or lender): add it to their debts.',
    args: z.object({ name, dueDay: z.union([z.number(), z.string()]).optional() }),
    resolve: (a: { name: string; dueDay?: string | number }, { data }) => {
      const offer = findOffer(data, a.name, true);
      if (typeof offer === 'string') return { clarify: offer };
      const day = Math.min(28, Math.max(1, Math.round(Number(a.dueDay) || Number(data.today.slice(8, 10)) || 1)));
      return propose(`Add "${offer.name}" from ${offer.lender} to your debts (${money(offer.principalCents, data)} at ${offer.aprBps / 100}%, payment due on day ${day})`, 'takeLoan', [offer.id, day]);
    },
  },
  {
    name: 'update_preferences',
    description: 'Change app settings: display currency or reduced motion. (AI consent, sign-out and account deletion are not available here.)',
    args: z.object({ currency: Currency.optional(), reducedMotion: z.boolean().optional() }),
    resolve: (a: { currency?: string; reducedMotion?: boolean }) => {
      const prefs: Record<string, unknown> = {};
      const parts: string[] = [];
      if (a.currency) {
        prefs.baseCurrency = a.currency;
        parts.push(`currency ${a.currency}`);
      }
      if (a.reducedMotion !== undefined) {
        prefs.reducedMotion = a.reducedMotion;
        parts.push(`reduced motion ${a.reducedMotion ? 'on' : 'off'}`);
      }
      if (!parts.length) return { clarify: 'I can change your currency or reduced motion. Other settings are in the Settings tab.' };
      return propose(`Change settings: ${parts.join(', ')}`, 'setPreferences', [prefs]);
    },
  },
];

export const commandByName = (n: string) => COMMANDS.find((c) => c.name === n);

function latestAt(data: FinanceData, merchant: string, date?: string) {
  const q = merchant.toLowerCase();
  const t = data.transactions.find((x) => x.id && x.merchant.toLowerCase().includes(q) && (!date || x.financialDate === date));
  return t ? (t as typeof t & { id: string }) : `I couldn't find a recent transaction at "${merchant}"${date ? ` on ${date}` : ''}.`;
}

/** Validates args with the command's schema and resolves it. Bad args → a clarifying question. */
export function resolveCommand(call: ToolCall, data: FinanceData, message: string): Resolved {
  const cmd = commandByName(call.name);
  if (!cmd) return { clarify: "I can't do that." };
  const args = cmd.args.safeParse(call.args ?? {});
  if (!args.success) return { clarify: "I couldn't work out the details of that change. Could you say it another way?" };
  const r = cmd.resolve(args.data as never, { data, message });
  if (!('askAmount' in r) || !r.askAmount) return r;
  // The amount is missing or unclear: remember the command so a reply like "$30" completes it, and offer
  // the numbers the user just wrote (e.g. "20 to 30 usd") as one-tap answers.
  const field = AMOUNT_FIELD[call.name];
  const rest = Object.fromEntries(Object.entries(args.data as Record<string, unknown>).filter(([k, v]) => k !== field && v !== undefined));
  const pending = field ? { name: call.name, args: rest, field } : undefined;
  const latest = message.split('\n').pop() ?? '';
  const written = [...new Set(latest.replace(/,/g, '').match(/\d+(?:\.\d{1,3})?/g) ?? [])].slice(0, 4);
  if (!written.length) return { ...r, pending };
  const options = written.map((n) => formatMoney(dollarsToCents(n, data.currency), data.currency));
  return { clarify: `Which ${r.askAmount} should I use: ${options.join(' or ')}? Or type another amount.`, options, pending };
}

// ---- Rules parser (works without AI) ------------------------------------------

// Any common currency symbol or a 3-letter code before the number; 0–3 decimals (JPY … KWD).
const SYMBOLS = '$৳€£¥₹₩₦₱₺₫₪₴₽฿₨₵₸₮₭៛';
const AMT = String.raw`(?:[${SYMBOLS}]|\b[A-Za-z]{3}\s)?\s?(\d[\d,]*(?:\.\d{1,3})?)`;

/** "$30", "make it 30 usd", "about 2,500" → "30" / "2500": a reply that is just one amount. */
export function singleAmount(message: string): string | null {
  const m = message.trim().match(new RegExp(String.raw`^(?:(?:maybe|may be|make it|use|about|around|say|it's|its)\s+)?[${SYMBOLS}]?\s?(\d[\d,]*(?:\.\d{1,3})?)\s*(?:usd|dollars?|bdt|taka|eur|euros?|gbp|pounds?|inr|rupees?|jpy|yen|cny|yuan|[a-z]{3})?[.!]?$`, 'i'));
  return m ? m[1].replace(/,/g, '') : null;
}

/** Common commands in plain words. null = not a recognised command. */
export function rulesCommand(message: string): ToolCall | null {
  const m = message.trim().replace(/[.!]+$/, '');
  let r: RegExpMatchArray | null;
  if (/^(?:open\s+)?(?:quick add|record a transaction)$/i.test(m)) return { name: 'open_quick_add', args: {} };
  if ((r = m.match(/^(?:open|go to|take me to|switch to)\s+(?:the\s+|my\s+)?([a-z ]+?)(?:\s+(?:tab|page))?$/i))) return { name: 'navigate', args: { tab: r[1] } };
  if ((r = m.match(new RegExp(String.raw`^(?:add|put|save|contribute)\s+${AMT}\s+(?:to|into|towards?)\s+(?:my\s+|the\s+)?(.+?)(?:\s+goal)?$`, 'i'))))
    return { name: 'contribute_goal', args: { amount: r[1], name: r[2] } };
  if ((r = m.match(new RegExp(String.raw`^(?:add|record|log)\s+(?:an?\s+)?(income|expense)?\s*(?:of\s+)?${AMT}\s+(?:(income|expense)\s+)?(?:for|at|on|from)?\s*(.+)$`, 'i'))))
    return { name: 'add_transaction', args: { amount: r[2], merchant: r[4], type: (r[1] ?? r[3] ?? 'expense').toLowerCase() } };
  if ((r = m.match(new RegExp(String.raw`^(?:i\s+)?(?:spent|paid)\s+${AMT}\s+(?:on|at|for)\s+(.+)$`, 'i')))) return { name: 'add_transaction', args: { amount: r[1], merchant: r[2], type: 'expense' } };
  if ((r = m.match(new RegExp(String.raw`^set\s+(?:my\s+|the\s+)?(.+?)\s+budget\s+to\s+${AMT}$`, 'i')))) return { name: 'set_budget', args: { category: r[1], amount: r[2] } };
  if ((r = m.match(/^pay\s+(?:the\s+|my\s+)?(.+?)(?:\s+bill)?$/i))) return { name: 'pay_bill', args: { name: r[1] } };
  if ((r = m.match(/^plan\s+(?:for\s+)?(?:my\s+|the\s+)?(.+?)(?:\s+goal)?$/i))) return { name: 'plan_goal', args: { name: r[1] } };
  if ((r = m.match(/^(pause|resume)\s+(?:the\s+|my\s+)?(.+?)(?:\s+goal)?$/i))) return { name: `${r[1].toLowerCase()}_goal`, args: { name: r[2] } };
  // Planner (debt & wealth): loans, investment mixes and stress tests.
  if ((r = m.match(/^(?:i\s+)?(?:take|took|accept(?:ed)?|go with|went with)\s+(?:the\s+|my\s+)?(.+?)\s+loan(?:\s+offer)?(?:\s+due\s+(?:on\s+)?(?:day\s+)?(\d{1,2}))?$/i))) return { name: 'take_loan', args: { name: r[1], ...(r[2] && { dueDay: r[2] }) } };
  if ((r = m.match(/^(?:apply|use|switch to)\s+(?:the\s+)?(core|simple global|global|lower[- ]swings?|growth(?:[- ]tilt)?|crisis[- ]resilient|resilient)\s+mix\s+(?:to|for|on|in)\s+(?:my\s+|the\s+)?(.+?)(?:\s+(?:investment\s+)?plan)?$/i))) {
    const mix = /lower/i.test(r[1]) ? 'lower_swings' : /growth/i.test(r[1]) ? 'growth' : /resilient/i.test(r[1]) ? 'resilient' : /global/i.test(r[1]) ? 'global' : 'core';
    return { name: 'apply_investment_mix', args: { name: r[2], mix } };
  }
  if ((r = m.match(/^turn\s+(on|off)\s+(?:the\s+)?(.+?)\s+(?:scenario|stress[- ]test)\s+(?:for|on|in)\s+(?:my\s+|the\s+)?(.+?)(?:\s+(?:investment\s+)?plan)?$/i))) {
    const scenario = scenarioFrom(r[2]);
    if (scenario) return { name: 'set_investment_scenario', args: { name: r[3], scenario, on: r[1].toLowerCase() === 'on' } };
  }
  if ((r = m.match(/^(?:delete|remove)\s+(?:the\s+|my\s+)?(.+?)\s+(?:investment\s+)?plan$/i))) return { name: 'delete_investment_plan', args: { name: r[1] } };
  if ((r = m.match(/^(?:delete|remove)\s+(?:the\s+|my\s+)?(.+?)\s+loan\s+offer$/i))) return { name: 'delete_loan_offer', args: { name: r[1] } };
  // Natural phrasings ("I bought…", "set a budget of $300 for dining", "add my Netflix subscription $15 monthly").
  const P = String.raw`^(?:please\s+|(?:i(?:\s+(?:want|need|would like)|'d like)|can you|could you|help me)\s+(?:to\s+)?)?`;
  if ((r = m.match(new RegExp(String.raw`^(?:i\s+)?(?:bought|purchased|got)\s+(?:an?\s+|some\s+|the\s+)?(.+?)\s+(?:for|at)\s+${AMT}(?:\s*(?:usd|dollars?|bdt|taka|tk))?$`, 'i'))))
    return { name: 'add_transaction', args: { amount: r[2], merchant: r[1], type: 'expense' } };
  if ((r = m.match(new RegExp(String.raw`^(?:i\s+)?(?:received|got paid|earned|got)\s+${AMT}(?:\s*(?:usd|dollars?|bdt|taka|tk))?\s*(?:from|as|for)?\s*(?:my\s+)?(.*)$`, 'i'))))
    return { name: 'add_transaction', args: { amount: r[1], merchant: r[2]?.trim() || 'Income', type: 'income' } };
  if ((r = m.match(new RegExp(String.raw`${P}(?:set|make|create|add)\s+(?:a\s+|my\s+|the\s+)?(?:monthly\s+)?budget\s+(?:of\s+)?${AMT}(?:\s*(?:usd|dollars?|bdt|taka|tk))?\s+(?:for|on)\s+(?:my\s+|the\s+)?(.+?)$`, 'i'))))
    return { name: 'set_budget', args: { category: r[2], amount: r[1] } };
  if ((r = m.match(new RegExp(String.raw`${P}(?:set|make|create|add)\s+(?:a\s+|my\s+|the\s+)?(?:monthly\s+)?budget\s+(?:for|on)\s+(?:my\s+|the\s+)?(.+?)\s+(?:of|to|at)\s+${AMT}(?:\s*(?:usd|dollars?|bdt|taka|tk))?$`, 'i'))))
    return { name: 'set_budget', args: { category: r[1], amount: r[2] } };
  if ((r = m.match(new RegExp(String.raw`^limit\s+(?:my\s+)?(.+?)\s+(?:spending\s+)?to\s+${AMT}(?:\s*(?:a|per)\s+month)?$`, 'i')))) return { name: 'set_budget', args: { category: r[1], amount: r[2] } };
  if ((r = m.match(new RegExp(String.raw`${P}add\s+(?:a\s+|my\s+|the\s+)?(?:new\s+)?(?:bill|subscription)\s+(?:for\s+|called\s+)?(.+?)\s+(?:of\s+|for\s+|at\s+)?${AMT}(?:\s*(?:usd|dollars?|bdt|taka|tk))?(?:\s+(?:a|per|every)?\s*(week|month|quarter|year)(?:ly)?)?$`, 'i'))) ||
      (r = m.match(new RegExp(String.raw`${P}add\s+(?:a\s+|my\s+|the\s+)?(.+?)\s+(?:bill|subscription)\s+(?:of\s+|for\s+|at\s+)?${AMT}(?:\s*(?:usd|dollars?|bdt|taka|tk))?(?:\s+(?:a|per|every)?\s*(week|month|quarter|year)(?:ly)?)?$`, 'i')))) {
    const freq = { week: 'weekly', month: 'monthly', quarter: 'quarterly', year: 'annual' }[(r[3] ?? 'month').toLowerCase()] ?? 'monthly';
    return { name: 'add_bill', args: { name: r[1], amount: r[2], frequency: freq } };
  }
  if ((r = m.match(/^mark\s+(?:the\s+|my\s+)?(.+?)(?:\s+bill)?\s+(?:as\s+)?paid$/i))) return { name: 'pay_bill', args: { name: r[1] } };
  if ((r = m.match(/^(?:delete|remove)\s+(?:the\s+|my\s+)?(bill|goal|budget|debt|account)\s+(.+)$/i)) || (r = m.match(/^(?:delete|remove)\s+(?:the\s+|my\s+)?(.+?)\s+(bill|goal|budget|debt|account)$/i))) {
    const [kind, target] = /^(bill|goal|budget|debt|account)$/i.test(r[1]) ? [r[1], r[2]] : [r[2], r[1]];
    const k = kind.toLowerCase();
    return { name: `delete_${k}`, args: k === 'budget' ? { category: target } : { name: target } };
  }
  return null;
}

// ---- Natural-language goals ("I want to buy a car for about 100 usd within next year, add this goal with a plan")

const NUM_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, nine: 9, ten: 10, twelve: 12, eighteen: 18 };
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** A deadline in plain words → YYYY-MM-DD (end of that month for "by June"), or undefined. */
export function parseWhen(text: string, today: string): string | undefined {
  const t = text.toLowerCase();
  let m: RegExpMatchArray | null;
  if ((m = t.match(/\b(\d{4}-\d{2}-\d{2})\b/))) return m[1];
  if ((m = t.match(/\b(?:within|in|over)\s+(?:the\s+)?(?:next\s+)?(\d+|a|an|one|two|three|four|five|six|nine|ten|twelve|eighteen)\s+(month|year)s?\b/))) {
    const n = /^\d+$/.test(m[1]) ? Number(m[1]) : NUM_WORDS[m[1]];
    return addMonthsYmd(today, m[2] === 'year' ? n * 12 : n);
  }
  if (/\b(?:within\s+(?:the\s+)?)?next\s+year\b|\bin\s+a\s+year\b/.test(t)) return addMonthsYmd(today, 12);
  if (/\b(?:within\s+(?:the\s+)?)?next\s+month\b/.test(t)) return addMonthsYmd(today, 1);
  if (/\b(?:by\s+)?(?:the\s+)?end\s+of\s+(?:this|the)\s+year\b|\bthis\s+year\b/.test(t)) return `${today.slice(0, 4)}-12-31`;
  if ((m = t.match(/\bby\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:\s+(\d{4}))?/))) {
    const month = MONTHS.indexOf(m[1]) + 1;
    let year = m[2] ? Number(m[2]) : Number(today.slice(0, 4));
    if (!m[2] && `${year}-${String(month).padStart(2, '0')}` <= today.slice(0, 7)) year += 1;
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${year}-${String(month).padStart(2, '0')}-${last}`;
  }
  return undefined;
}

const titleCase = (s: string) => s.replace(/\s+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase());
const STOP = String.raw`(?=\s+(?:which|that|for|by|within|in|next|price|priced|costing|costs?|worth|at|of|around|about|and|with|before|this|so)\b|\s*[,.!?${SYMBOLS}]|\s*\d|$)`;

/** A request for a NEW goal anywhere in the sentence → add_goal (amount/date/name parsed; missing amount is asked later). */
export function goalRequest(message: string, today: string): ToolCall | null {
  if (!GOAL_INTENT.test(message)) return null;
  const t = message.replace(/\s+/g, ' ').trim();
  let m: RegExpMatchArray | null;
  let goalName: string | undefined;
  if ((m = t.match(new RegExp(String.raw`\bgoal\s*[:\-–]\s*(?:an?\s+|the\s+|my\s+)?([a-z][\w '\-]{0,40}?)${STOP}`, 'i')))) goalName = m[1];
  else if ((m = t.match(new RegExp(String.raw`\bgoal\s+(?:called|named|for)\s+["“']?(?:an?\s+|the\s+|my\s+)?([a-z][\w '\-]{0,40}?)["”']?${STOP}`, 'i')))) goalName = m[1];
  else if ((m = t.match(new RegExp(String.raw`\b(?:buy|purchase|afford|get)\s+(?:an?\s+|the\s+|my\s+)?([a-z][\w '\-]{0,40}?)${STOP}`, 'i')))) goalName = m[1];
  else if ((m = t.match(new RegExp(String.raw`\bsav(?:e|ing)\s+(?:up\s+)?(?:for|towards?)\s+(?:an?\s+|the\s+|my\s+)?([a-z][\w '\-]{0,40}?)${STOP}`, 'i')))) goalName = m[1];
  const amount = t.match(new RegExp(String.raw`[${SYMBOLS}]\s?(\d[\d,]*(?:\.\d{1,3})?)|(\d[\d,]*(?:\.\d{1,3})?)\s*(?:usd|dollars?|bucks|bdt|taka|tk|eur|euros?|gbp|pounds?|inr|rupees?|rs|jpy|yen|cny|rmb|yuan|aed|dirhams?|sar|riyals?)\b`, 'i'));
  const targetDate = parseWhen(t, today);
  const args: Record<string, unknown> = { name: titleCase(goalName ?? 'New goal') };
  if (amount) args.target = (amount[1] ?? amount[2]).replace(/,/g, '');
  if (targetDate) args.targetDate = targetDate;
  if (/\bplan\b/i.test(t)) args.withPlan = true;
  return { name: 'add_goal', args };
}

/** Max changes in one plan ("add $12 coffee and pay Spotify", or several model command calls). */
export const MAX_STEPS = 6;

/**
 * "add $12 coffee and pay Spotify then open bills" → one call per part, but only when EVERY part is a
 * command (so "set Food and groceries budget to $50" stays one command).
 */
export function rulesCommands(message: string, today = new Date().toISOString().slice(0, 10)): ToolCall[] | null {
  const parts = message.split(/\s*;\s*|,?\s+(?:and\s+)?then\s+|\s+and\s+/i).filter((p) => p.trim());
  if (parts.length > 1) {
    const calls = parts.map(rulesCommand);
    if (calls.every(Boolean)) return (calls as ToolCall[]).slice(0, MAX_STEPS);
  }
  const one = rulesCommand(message) ?? goalRequest(message, today);
  return one ? [one] : null;
}

// ---- Segments ("/goals …" in the chat) ------------------------------------------

const monthToDate = (today: string): ToolCall => ({ name: 'get_financial_summary', args: { from: `${today.slice(0, 7)}-01`, to: today } });
const GOAL_CMDS = ['add_goal', 'update_goal', 'contribute_goal', 'pause_goal', 'resume_goal', 'delete_goal', 'plan_goal'];
const DEBT_CMDS = ['add_debt', 'update_debt', 'delete_debt'];

/** What each segment offers the model (navigate is always allowed) and the calculation its overview shows. */
export const SEGMENT_TOOLS: Record<SegmentId, { read: string[]; commands: string[]; overview?: (today: string) => ToolCall }> = {
  overview: { read: ['get_insights', 'get_financial_summary', 'get_category_breakdown', 'compare_periods'], commands: COMMANDS.map((c) => c.name), overview: monthToDate },
  transactions: { read: ['get_insights', 'get_financial_summary', 'get_category_breakdown', 'compare_periods', 'find_possible_duplicates'], commands: ['add_transaction', 'recategorize_transaction', 'delete_transaction', 'open_quick_add'], overview: monthToDate },
  accounts: { read: ['get_insights', 'get_financial_summary'], commands: ['add_account', 'rename_account', 'delete_account'], overview: () => ({ name: 'get_insights', args: {} }) },
  budgets: { read: ['get_budget_status', 'get_category_breakdown'], commands: ['set_budget', 'delete_budget'], overview: (t) => ({ name: 'get_budget_status', args: { month: t.slice(0, 7) } }) },
  goals: { read: ['calculate_savings_plan', 'plan_goal'], commands: GOAL_CMDS, overview: () => ({ name: 'calculate_savings_plan', args: {} }) },
  bills: { read: ['get_upcoming_bills', 'get_insights'], commands: ['add_bill', 'update_bill', 'pay_bill', 'delete_bill'], overview: () => ({ name: 'get_upcoming_bills', args: { days: 30 } }) },
  debts: { read: ['get_debt_summary'], commands: DEBT_CMDS, overview: () => ({ name: 'get_debt_summary', args: {} }) },
  planning: { read: ['get_debt_summary', 'compare_loans', 'get_investment_outlook', 'calculate_savings_plan'], commands: [...DEBT_CMDS, ...GOAL_CMDS, 'add_investment_plan', 'update_investment_plan', 'delete_investment_plan', 'set_investment_scenario', 'apply_investment_mix', 'add_loan_offer', 'update_loan_offer', 'delete_loan_offer', 'take_loan'], overview: () => ({ name: 'get_debt_summary', args: {} }) },
  loans: { read: ['compare_loans', 'get_debt_summary'], commands: [...DEBT_CMDS, 'add_loan_offer', 'update_loan_offer', 'delete_loan_offer', 'take_loan'], overview: () => ({ name: 'compare_loans', args: {} }) },
  invest: { read: ['get_investment_outlook', 'get_debt_summary'], commands: ['navigate', 'add_investment_plan', 'update_investment_plan', 'delete_investment_plan', 'set_investment_scenario', 'apply_investment_mix'], overview: () => ({ name: 'get_investment_outlook', args: {} }) },
  learn: { read: ['get_insights', 'get_debt_summary', 'calculate_savings_plan'], commands: ['navigate'], overview: () => ({ name: 'get_insights', args: {} }) },
  import: { read: ['get_financial_summary', 'find_possible_duplicates'], commands: ['open_quick_add'] },
  settings: { read: [], commands: ['update_preferences'] },
};
