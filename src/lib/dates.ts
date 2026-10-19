import { useSyncExternalStore } from 'react';

/** Local calendar helpers for the browser (the server uses todayIn(timezone) in src/server/mappers.ts). */

/** Today's date in the browser's timezone as YYYY-MM-DD. */
export function todayYmd(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** "October 2026" for a YYYY-MM or YYYY-MM-DD string, in the user's locale. */
export function monthLabel(ymd: string, locale?: string): string {
  const [y, m] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, 1)).toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** YYYY-MM of the month `offset` months from the given YYYY-MM. */
export function shiftMonth(ym: string, offset: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  return d.toISOString().slice(0, 7);
}

const noop = () => () => {};
const SERVER_TODAY = '1970-01-01';

/**
 * Today (browser timezone) for rendering. Prerendering sees a fixed placeholder and the browser
 * swaps in the real date on hydration, so no `new Date()` runs during the server render.
 */
export function useToday(): string {
  return useSyncExternalStore(noop, todayYmd, () => SERVER_TODAY);
}
