/**
 * WealthPilot ML — shared helpers. Everything here is deterministic: (rows, today) → result.
 * Money stays in integer minor units; statistics (medians, z-scores) use plain numbers only
 * as ratios, never as stored or displayed amounts.
 */

/** The fields every ML function reads. Amounts are already in one currency (the base). */
export interface MlTx {
  id?: string;
  financialDate: string; // YYYY-MM-DD
  amountCents: number; // < 0 expense, > 0 income
  category: string;
  merchant: string;
  isTransfer: boolean;
  currency?: string;
  splits?: { category: string; amountCents: number }[];
}

export interface MlBill {
  id?: string;
  name: string;
  amountCents: number;
  nextDueDate: string;
  frequency?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual';
  status: string;
}

export const DAY_MS = 86_400_000;

export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

export function addMonths(ymd: string, months: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const last = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + months, Math.min(d, last))).toISOString().slice(0, 10);
}

/** Integer-safe median (rounded to an integer for money). */
export function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/** Exact median (may be fractional), for statistics only. */
export function medianExact(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Nearest-rank percentile (p in 0..100) of integers; returns an element of the input. */
export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const rank = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[rank];
}

/** "NETFLIX.COM 8844*" / "Netflix" → "netflix": groups the same payee across spellings. */
export function normalizeMerchant(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(pos|ach|debit|credit|purchase|payment|card|txn|ref|inv)\b/g, ' ')
    .replace(/\.(com|net|org|io|co)\b/g, '')
    .replace(/[#*][\w-]*/g, ' ')
    .replace(/\d{3,}/g, ' ')
    .replace(/[^a-zÀ-￿ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Expense parts of a transaction (splits by their own category), positive minor units. */
export function expenseParts(t: MlTx): { category: string; cents: number }[] {
  if (t.isTransfer) return [];
  const parts = t.splits?.length ? t.splits : [{ category: t.category, amountCents: t.amountCents }];
  return parts.filter((p) => p.amountCents < 0).map((p) => ({ category: p.category, cents: -p.amountCents }));
}

/** Integer percentage change a → b, one decimal (null when a is 0). */
export function pctChange(a: number, b: number): number | null {
  if (a === 0) return null;
  return Math.round(((b - a) * 1000) / Math.abs(a)) / 10;
}
