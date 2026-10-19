/**
 * Date parsing for bank exports and receipts. Ambiguous numeric dates (03/04/2026) are resolved per
 * column: if any value has a first part > 12 the column is day-first, if any second part > 12 it is
 * month-first, otherwise the user's locale decides.
 */

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

export type DayOrder = 'dmy' | 'mdy';

const pad = (n: number) => String(n).padStart(2, '0');

function valid(y: number, m: number, d: number): string | null {
  if (y < 100) y += y > 69 ? 1900 : 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1970 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** The user's locale's usual order for numeric dates (en-US → mdy, most others → dmy). */
export function localeDayOrder(locale?: string): DayOrder {
  try {
    const parts = new Intl.DateTimeFormat(locale || undefined).formatToParts(new Date(Date.UTC(2026, 10, 22)));
    const order = parts.filter((p) => p.type === 'day' || p.type === 'month').map((p) => p.type);
    return order[0] === 'month' ? 'mdy' : 'dmy';
  } catch {
    return 'mdy';
  }
}

/** Decides day/month order for a whole column of raw values. */
export function detectDayOrder(values: string[], fallback: DayOrder): DayOrder {
  for (const v of values) {
    const m = v.trim().match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
    if (!m) continue;
    if (Number(m[1]) > 12) return 'dmy';
    if (Number(m[2]) > 12) return 'mdy';
  }
  return fallback;
}

/** One value → YYYY-MM-DD, or null. Handles ISO, numeric (with order), "5 Oct 2026", "Oct 5, 2026", Excel serials. */
export function parseDate(raw: string | number | Date | null | undefined, order: DayOrder = 'mdy'): string | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : valid(raw.getFullYear(), raw.getMonth() + 1, raw.getDate());
  if (typeof raw === 'number') {
    // Excel serial date (days since 1899-12-30)
    if (raw > 20000 && raw < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + Math.round(raw) * 86_400_000);
      return valid(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }
    return null;
  }
  const s = raw.trim().replace(/\s+/g, ' ');
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (m) {
    const dmy = valid(+m[3], +m[2], +m[1]);
    const mdy = valid(+m[3], +m[1], +m[2]);
    // The preferred order, unless only the other one is a real date (14/10 can only be day-first).
    return order === 'dmy' ? dmy ?? mdy : mdy ?? dmy;
  }
  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s\-.]+([A-Za-z]{3,9})\.?[\s\-.,]+(\d{2,4})\b/);
  if (m && MONTHS[m[2].toLowerCase()]) return valid(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);
  m = s.match(/^([A-Za-z]{3,9})\.?[\s\-.]+(\d{1,2})(?:st|nd|rd|th)?,?[\s\-.]+(\d{2,4})\b/);
  if (m && MONTHS[m[1].toLowerCase()]) return valid(+m[3], MONTHS[m[1].toLowerCase()], +m[2]);
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  return null;
}

/**
 * Day order for a set of numeric dates that may all be ambiguous (01/10 … 12/10): first the values
 * themselves (a part > 12), then the order whose dates lie closest before `today` (statements and
 * receipts are about the past), then the locale.
 */
export function chooseDayOrder(values: string[], fallback: DayOrder, today?: string): DayOrder {
  const nums = values.map((v) => v.trim().match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/)).filter(Boolean) as RegExpMatchArray[];
  if (!nums.length) return fallback;
  for (const m of nums) {
    if (Number(m[1]) > 12) return 'dmy';
    if (Number(m[2]) > 12) return 'mdy';
  }
  if (!today) return fallback;
  const t = Date.parse(`${today}T00:00:00Z`);
  const score = (order: DayOrder) =>
    nums.reduce((sum, m) => {
      const d = parseDate(m[0], order);
      if (!d) return sum + 1e12;
      const diff = t - Date.parse(`${d}T00:00:00Z`);
      return sum + (diff < -2 * 86_400_000 ? 1e11 : Math.abs(diff)); // future dates are unlikely
    }, 0);
  const [a, b] = [score('dmy'), score('mdy')];
  return a === b ? fallback : a < b ? 'dmy' : 'mdy';
}

/** Finds the first date anywhere in free text (receipts). */
export function findDateInText(text: string, order: DayOrder): string | null {
  const patterns = [
    /\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/,
    /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/,
    /\b\d{1,2}(?:st|nd|rd|th)?[\s\-.]+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?[\s\-.,]+\d{2,4}\b/i,
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{2,4}\b/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    const d = m && parseDate(m[0], order);
    if (d) return d;
  }
  return null;
}
