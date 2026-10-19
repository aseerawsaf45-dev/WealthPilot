/**
 * ML-02 — Recurring payment / income detection.
 * A payee is recurring when it has ≥ 3 rows, the median gap is within ±20% of a known cadence,
 * and the amounts vary little (coefficient of variation < 0.15).
 */

import { addDays, addMonths, daysBetween, median, medianExact, normalizeMerchant, type MlTx, type MlBill } from './util';

export type Cadence = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual';

const CADENCES: Array<{ cadence: Cadence; days: number }> = [
  { cadence: 'weekly', days: 7 },
  { cadence: 'biweekly', days: 14 },
  { cadence: 'monthly', days: 30.4 },
  { cadence: 'quarterly', days: 91.3 },
  { cadence: 'annual', days: 365.25 },
];

export interface RecurringSeries {
  key: string; // normalized merchant
  merchant: string; // most recent spelling
  category: string;
  direction: 'expense' | 'income';
  cadence: Cadence;
  typicalCents: number; // positive median amount
  lastCents: number;
  occurrences: number;
  lastDate: string;
  nextExpected: string;
  /** Last amount vs the median of the previous (up to 5) amounts, in %. */
  priceChangePct: number | null;
  /** True when a bill with a similar name already exists. */
  matchesBill: boolean;
}

export function nextDate(from: string, cadence: Cadence): string {
  switch (cadence) {
    case 'weekly':
      return addDays(from, 7);
    case 'biweekly':
      return addDays(from, 14);
    case 'monthly':
      return addMonths(from, 1);
    case 'quarterly':
      return addMonths(from, 3);
    case 'annual':
      return addMonths(from, 12);
  }
}

/** Cadence as a frequency the bill form supports (biweekly isn't offered there, so it maps to null). */
export function cadenceToFrequency(c: Cadence): 'weekly' | 'monthly' | 'quarterly' | 'annual' | null {
  return c === 'biweekly' ? null : c;
}

function matchCadence(gapDays: number): Cadence | null {
  for (const c of CADENCES) if (Math.abs(gapDays - c.days) <= c.days * 0.2) return c.cadence;
  return null;
}

function similar(a: string, b: string): boolean {
  const x = normalizeMerchant(a);
  const y = normalizeMerchant(b);
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
}

export function detectRecurring(txs: MlTx[], today: string, bills: MlBill[] = []): RecurringSeries[] {
  const groups = new Map<string, MlTx[]>();
  for (const t of txs) {
    if (t.isTransfer || t.amountCents === 0 || t.financialDate > today) continue;
    const key = `${normalizeMerchant(t.merchant)}|${t.amountCents < 0 ? 'e' : 'i'}`;
    if (key.startsWith('|')) continue;
    const g = groups.get(key) ?? [];
    g.push(t);
    groups.set(key, g);
  }

  const out: RecurringSeries[] = [];
  for (const [key, rows] of groups) {
    if (rows.length < 3) continue;
    rows.sort((a, b) => a.financialDate.localeCompare(b.financialDate));
    // One row per day: several same-day rows are a split purchase, not a cadence.
    const daily: MlTx[] = [];
    for (const r of rows) if (daily[daily.length - 1]?.financialDate !== r.financialDate) daily.push(r);
    if (daily.length < 3) continue;

    const gaps = daily.slice(1).map((r, i) => daysBetween(daily[i].financialDate, r.financialDate));
    const cadence = matchCadence(medianExact(gaps));
    if (!cadence) continue;

    const amounts = daily.map((r) => Math.abs(r.amountCents));
    const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const sd = Math.sqrt(amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / amounts.length);
    // The last amount may be a price change; judge stability on the earlier ones when there are enough.
    const earlier = amounts.length >= 4 ? amounts.slice(0, -1) : amounts;
    const eMean = earlier.reduce((s, a) => s + a, 0) / earlier.length;
    const eSd = Math.sqrt(earlier.reduce((s, a) => s + (a - eMean) ** 2, 0) / earlier.length);
    if ((eMean ? eSd / eMean : 1) >= 0.15 && (mean ? sd / mean : 1) >= 0.15) continue;

    const last = daily[daily.length - 1];
    // A series that stopped (no row for 2 cadences) is no longer recurring.
    const next = nextDate(last.financialDate, cadence);
    if (daysBetween(next, today) > (CADENCES.find((c) => c.cadence === cadence)!.days | 0)) continue;

    const prev = amounts.slice(-6, -1);
    const prevMedian = median(prev);
    const lastCents = amounts[amounts.length - 1];
    out.push({
      key: key.split('|')[0],
      merchant: last.merchant,
      category: last.category,
      direction: last.amountCents < 0 ? 'expense' : 'income',
      cadence,
      typicalCents: median(amounts),
      lastCents,
      occurrences: daily.length,
      lastDate: last.financialDate,
      nextExpected: next,
      priceChangePct: prevMedian ? Math.round(((lastCents - prevMedian) * 1000) / prevMedian) / 10 : null,
      matchesBill: bills.some((b) => similar(b.name, last.merchant)),
    });
  }
  return out.sort((a, b) => b.typicalCents - a.typicalCents);
}

/** Monthly-equivalent amount of a series (integer minor units). */
export function monthlyEquivalent(s: Pick<RecurringSeries, 'cadence' | 'typicalCents'>): number {
  const perYear = { weekly: 52, biweekly: 26, monthly: 12, quarterly: 4, annual: 1 }[s.cadence];
  return Math.round((s.typicalCents * perYear) / 12);
}
