/**
 * ML-04 — 30/60/90-day cash-flow forecast (baseline method, explainable):
 *   balance + expected recurring income − bills due − typical everyday spending.
 * Everyday spending = expenses not explained by recurring series or bills. The P10–P90 band comes from
 * the spread of real 30-day everyday-spending totals over the last 180 days, scaled to each horizon.
 * Needs ≥ 60 days of history; otherwise minDataMet is false and no forecast is made.
 */

import { addDays, daysBetween, expenseParts, median, normalizeMerchant, percentile, type MlBill, type MlTx } from './util';
import { nextDate, type RecurringSeries } from './recurring';

export interface ForecastPoint {
  days: 30 | 60 | 90;
  date: string;
  expectedCents: number;
  lowCents: number; // P10 (more spending than usual)
  highCents: number; // P90 (less spending than usual)
  incomeCents: number;
  billsCents: number;
  everydayCents: number;
}

export interface Forecast {
  minDataMet: boolean;
  historyDays: number;
  startBalanceCents: number;
  points: ForecastPoint[];
  /** First day the expected balance drops below zero within 90 days, if any. */
  shortfallDate: string | null;
  method: string;
  assumptions: string[];
}

function billDates(bill: MlBill, from: string, to: string): string[] {
  if (bill.status === 'paused' || !bill.nextDueDate) return [];
  const out: string[] = [];
  let d = bill.nextDueDate;
  const freq = bill.frequency ?? 'monthly';
  for (let i = 0; d <= to && i < 60; i++) {
    if (d > from) out.push(d);
    const n = new Date(`${d}T00:00:00Z`);
    if (freq === 'weekly' || freq === 'biweekly') n.setUTCDate(n.getUTCDate() + (freq === 'weekly' ? 7 : 14));
    else n.setUTCMonth(n.getUTCMonth() + (freq === 'monthly' ? 1 : freq === 'quarterly' ? 3 : 12));
    d = n.toISOString().slice(0, 10);
  }
  return out;
}

function seriesDates(s: RecurringSeries, from: string, to: string): string[] {
  const out: string[] = [];
  let d = s.nextExpected;
  for (let i = 0; d <= to && i < 60; i++) {
    if (d > from) out.push(d);
    d = nextDate(d, s.cadence);
  }
  return out;
}

export function forecastCashFlow(input: {
  txs: MlTx[];
  bills: MlBill[];
  recurring: RecurringSeries[];
  startBalanceCents: number;
  today: string;
}): Forecast {
  const { txs, bills, recurring, startBalanceCents, today } = input;
  const past = txs.filter((t) => t.financialDate <= today);
  const earliest = past.reduce<string | null>((m, t) => (!m || t.financialDate < m ? t.financialDate : m), null);
  const historyDays = earliest ? daysBetween(earliest, today) + 1 : 0;
  const method = 'Baseline: balance + recurring income − bills − typical everyday spending; the range is how much your 30-day spending has varied (P10–P90, last 180 days).';
  if (historyDays < 60) {
    return { minDataMet: false, historyDays, startBalanceCents, points: [], shortfallDate: null, method, assumptions: ['At least 60 days of transactions are needed for a forecast.'] };
  }

  // Everyday spending: expenses whose payee is not a recurring series and not a bill.
  const recurringKeys = new Set(recurring.filter((r) => r.direction === 'expense').map((r) => r.key));
  const billNames = bills.map((b) => b.name.toLowerCase());
  const isScheduled = (m: string) => {
    const lower = m.toLowerCase();
    return billNames.some((b) => b && (lower.includes(b) || b.includes(lower)));
  };
  const daily = new Map<string, number>();
  const window = Math.min(180, historyDays);
  const since = addDays(today, -window);
  for (const t of past) {
    if (t.financialDate <= since) continue;
    if (recurringKeys.has(normalizeMerchant(t.merchant)) || isScheduled(t.merchant)) continue;
    const cents = expenseParts(t).reduce((s, p) => s + p.cents, 0);
    if (cents) daily.set(t.financialDate, (daily.get(t.financialDate) ?? 0) + cents);
  }
  // Rolling 30-day totals → typical (median) and spread (P10/P90).
  const totals: number[] = [];
  for (let end = 29; end < window; end += 1) {
    let sum = 0;
    for (let d = end - 29; d <= end; d++) sum += daily.get(addDays(since, d + 1)) ?? 0;
    totals.push(sum);
  }
  const typical30 = median(totals);
  // The band reflects how much ALL spending has varied month to month (recurring amounts drift too),
  // not just everyday spending, so it never collapses to a single number.
  const allDaily = new Map<string, number>();
  for (const t of past) {
    if (t.financialDate <= since) continue;
    const cents = expenseParts(t).reduce((s, p) => s + p.cents, 0);
    if (cents) allDaily.set(t.financialDate, (allDaily.get(t.financialDate) ?? 0) + cents);
  }
  const allTotals: number[] = [];
  for (let end = 29; end < window; end += 1) {
    let sum = 0;
    for (let d = end - 29; d <= end; d++) sum += allDaily.get(addDays(since, d + 1)) ?? 0;
    allTotals.push(sum);
  }
  const allMedian = median(allTotals);
  const upSpread = Math.max(0, percentile(allTotals, 90) - allMedian, percentile(totals, 90) - typical30);
  const downSpread = Math.max(0, allMedian - percentile(allTotals, 10), typical30 - percentile(totals, 10));

  const assumptions = [
    `Everyday spending of about the median 30-day total over the last ${window} days.`,
    'Recurring income and payments continue on their detected schedule; bills are paid on their due dates.',
    'Balances of checking, savings and cash accounts only; transfers are ignored.',
  ];

  const points: ForecastPoint[] = ([30, 60, 90] as const).map((days) => {
    const to = addDays(today, days);
    let income = 0;
    let recurringOut = 0;
    for (const s of recurring) {
      const n = seriesDates(s, today, to).length;
      if (s.direction === 'income') income += n * s.typicalCents;
      else if (!s.matchesBill) recurringOut += n * s.typicalCents;
    }
    let billsCents = recurringOut;
    for (const b of bills) billsCents += billDates(b, today, to).length * b.amountCents;
    const everyday = Math.round((typical30 * days) / 30);
    const expected = startBalanceCents + income - billsCents - everyday;
    return {
      days,
      date: to,
      expectedCents: expected,
      lowCents: expected - Math.round((upSpread * days) / 30),
      highCents: expected + Math.round((downSpread * days) / 30),
      incomeCents: income,
      billsCents,
      everydayCents: everyday,
    };
  });

  // Shortfall: walk day by day with the same rules.
  let shortfallDate: string | null = null;
  let bal = startBalanceCents;
  const perDay = typical30 / 30;
  const events = new Map<string, number>();
  const end = addDays(today, 90);
  for (const s of recurring) {
    if (s.direction === 'expense' && s.matchesBill) continue;
    for (const d of seriesDates(s, today, end)) events.set(d, (events.get(d) ?? 0) + (s.direction === 'income' ? s.typicalCents : -s.typicalCents));
  }
  for (const b of bills) for (const d of billDates(b, today, end)) events.set(d, (events.get(d) ?? 0) - b.amountCents);
  for (let i = 1; i <= 90 && !shortfallDate; i++) {
    const d = addDays(today, i);
    bal += (events.get(d) ?? 0) - perDay;
    if (bal < 0) shortfallDate = d;
  }

  return { minDataMet: true, historyDays, startBalanceCents, points, shortfallDate, method, assumptions };
}
