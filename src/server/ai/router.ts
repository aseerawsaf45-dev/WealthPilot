/**
 * WealthPilot — Deterministic intent router (plan §7.1 step 4).
 *
 * Common questions map straight to tool calls by keyword, so they work with AI switched off
 * and cost no LLM quota. Returns null when nothing matches confidently.
 */

import { addDays } from '../mappers';
import { dollarsToCents } from '@/lib/money';
import { monthRange, shiftMonth, type Period } from './tools';

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

const has = (q: string, words: string[]) => words.some((w) => q.includes(w));

/** Period named in the question; defaults to this month so far. */
export function detectPeriod(q: string, today: string): { period: Period; previous: Period; label: string } {
  const month = today.slice(0, 7);
  const lastDays = q.match(/last (\d{1,3}) days/);
  if (lastDays) {
    const n = Math.min(Math.max(Number(lastDays[1]), 1), 366);
    const start = addDays(today, -(n - 1));
    return { period: { start, end: today }, previous: { start: addDays(start, -n), end: addDays(start, -1) }, label: `the last ${n} days` };
  }
  // "this month vs last month" is about this month; only a bare "last month" moves the period.
  if (has(q, ['last month', 'previous month']) && !q.includes('this month')) {
    const prev = shiftMonth(month, -1);
    return { period: monthRange(prev), previous: monthRange(shiftMonth(month, -2)), label: prev };
  }
  if (has(q, ['this year', 'year to date', 'ytd'])) {
    const year = Number(today.slice(0, 4));
    // Same days of last year, so the comparison is like for like (Feb 29 clamps to Feb 28).
    const sameDayLastYear = `${year - 1}${today.slice(4)}`;
    const lastYearEnd = sameDayLastYear.endsWith('-02-29') ? `${year - 1}-02-28` : sameDayLastYear;
    return { period: { start: `${year}-01-01`, end: today }, previous: { start: `${year - 1}-01-01`, end: lastYearEnd }, label: `${year} so far` };
  }
  // This month to date vs the same days of last month (not the whole of last month).
  const prevMonth = monthRange(shiftMonth(month, -1));
  const day = today.slice(8, 10);
  const prevEnd = `${prevMonth.start.slice(0, 8)}${day}` > prevMonth.end ? prevMonth.end : `${prevMonth.start.slice(0, 8)}${day}`;
  return { period: { start: `${month}-01`, end: today }, previous: { start: prevMonth.start, end: prevEnd }, label: 'this month so far' };
}

/** A category the user actually has, named in the question (full name or its first word). */
export function detectCategory(q: string, categories: string[]): string | undefined {
  const sorted = [...new Set(categories)].sort((a, b) => b.length - a.length);
  return sorted.find((c) => {
    const lower = c.toLowerCase();
    const first = lower.split(/[\s&/,-]+/)[0];
    return q.includes(lower) || (first.length >= 4 && new RegExp(`\\b${first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(q));
  });
}

/** "600 dollars a month", "$600/month", "250.50 per month" → integer cents; undefined when absent. */
export function detectMonthlyAmount(q: string, currency = 'USD'): number | undefined {
  const m = q.match(/\$?\s?(\d[\d,]*(?:\.\d{1,3})?)\s*(?:dollars?|usd|taka|bdt|[a-z]{3})?\s*(?:a|per|each|every|\/)\s*month/);
  if (!m) return undefined;
  const cents = dollarsToCents(m[1].replace(/,/g, ''), currency);
  return cents > 0 ? cents : undefined;
}

export function routeIntent(message: string, today: string, categories: string[], currency = 'USD'): ToolCall[] | null {
  const q = message.toLowerCase();
  const { period, previous } = detectPeriod(q, today);
  const range = { from: period.start, to: period.end };

  if (has(q, ['duplicate', 'double charge', 'charged twice'])) return [{ name: 'find_possible_duplicates', args: {} }];
  if (has(q, ['unusual', 'anomal', 'stand out', 'stands out', 'forecast', 'predict', 'run out of', 'runway', 'recurring', 'anything wrong', 'insight'])) return [{ name: 'get_insights', args: {} }];
  if (has(q, ['budget', 'overspen', 'over spen'])) return [{ name: 'get_budget_status', args: { month: period.start.slice(0, 7) } }];
  if (has(q, ['bill', 'due', 'subscription', 'upcoming payment'])) return [{ name: 'get_upcoming_bills', args: { days: 30 } }];
  if (has(q, ['invest', 'stock', 'shares', 'portfolio', 'inflation', 'politic', 'geopolit', 'sanction', 'war ', 'recession'])) {
    return has(q, ['debt', 'pay off', 'payoff', 'loan']) ? [{ name: 'get_investment_outlook', args: {} }, { name: 'get_debt_summary', args: {} }] : [{ name: 'get_investment_outlook', args: {} }];
  }
  if (has(q, ['loan offer', 'compare loan', 'afford a loan', 'afford the loan', 'take a loan', 'borrow', 'emi'])) return [{ name: 'compare_loans', args: {} }];
  if (has(q, ['debt', 'snowball', 'avalanche', 'payoff', 'pay off', 'loan', 'credit card'])) return [{ name: 'get_debt_summary', args: {} }];
  if (has(q, ['goal', 'saving for', 'save for', 'emergency fund', 'savings plan', 'my savings', 'on track to save'])) {
    const monthlyCents = detectMonthlyAmount(q, currency);
    return [{ name: 'calculate_savings_plan', args: monthlyCents ? { monthlyCents } : {} }];
  }

  const summary: ToolCall[] = [{ name: 'get_financial_summary', args: range }, { name: 'get_category_breakdown', args: { ...range, limit: 3 } }];
  // Before category matching: "income" would otherwise match an "Income" category and report spending on it.
  if (has(q, ['income', 'earn', 'cash flow', 'cashflow', 'net cash'])) return summary;

  const category = detectCategory(q, categories);
  const compare = { name: 'compare_periods', args: { a: range, b: { from: previous.start, to: previous.end }, ...(category && { category }) } };
  if (has(q, ['compare', ' vs', 'versus', 'than last', 'change', 'increase', 'decrease', 'why', 'more than', 'less than'])) {
    return [compare, { name: 'get_category_breakdown', args: { ...range, limit: 5 } }];
  }
  if (category) return [compare];
  if (has(q, ['spend', 'spent', 'expense', 'summar', 'overview'])) return summary;
  return null;
}
