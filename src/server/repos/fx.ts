/**
 * WealthPilot — daily exchange rates.
 * One snapshot per UTC day, fetched lazily from a free public feed and cached in the DB and in memory.
 * Never throws: with no network and no stored snapshot it returns null and totals stay per currency.
 */

import { prisma } from '../db';
import { isIsoCurrency } from '@/lib/currency';
import { scaleRate, type FxRates } from '@/lib/fx';

const FEED_URL = 'https://open.er-api.com/v6/latest/USD';
export const FX_SOURCE = 'ExchangeRate-API (open.er-api.com)';

let memo: FxRates | null = null;
let inflight: Promise<FxRates | null> | null = null;
let lastFailureAt = 0;

const utcDay = () => new Date().toISOString().slice(0, 10);

function fromRow(row: { day: string; base: string; rates: unknown; source: string }): FxRates {
  return { day: row.day, base: row.base, rates: (row.rates ?? {}) as Record<string, string>, source: row.source };
}

async function fetchFeed(): Promise<FxRates | null> {
  const res = await fetch(FEED_URL, { signal: AbortSignal.timeout(5000), cache: 'no-store' });
  if (!res.ok) return null;
  const body = (await res.json()) as { result?: string; base_code?: string; rates?: Record<string, number> };
  if (body.result !== 'success' || body.base_code !== 'USD' || !body.rates) return null;
  const rates: Record<string, string> = {};
  for (const [code, rate] of Object.entries(body.rates)) {
    if (!isIsoCurrency(code)) continue;
    const scaled = scaleRate(rate);
    if (scaled) rates[code] = scaled;
  }
  if (Object.keys(rates).length < 20) return null;
  return { day: utcDay(), base: 'USD', rates, source: FX_SOURCE };
}

async function load(): Promise<FxRates | null> {
  const day = utcDay();
  const today = await prisma.fxSnapshot.findUnique({ where: { day } });
  if (today) return fromRow(today);

  // Don't hammer the feed (or wait on it) more than once every 10 minutes when it is down.
  if (Date.now() - lastFailureAt > 10 * 60_000) {
    try {
      const fresh = await fetchFeed();
      if (fresh) {
        await prisma.fxSnapshot.upsert({
          where: { day: fresh.day },
          create: { day: fresh.day, base: fresh.base, rates: fresh.rates, source: fresh.source },
          update: {},
        });
        return fresh;
      }
    } catch {
      /* offline or feed down: fall back to the newest stored snapshot */
    }
    lastFailureAt = Date.now();
  }
  const latest = await prisma.fxSnapshot.findFirst({ orderBy: { day: 'desc' } });
  return latest ? fromRow(latest) : null;
}

/** Today's rates (or the newest stored ones), or null. Safe to call on every request. */
export async function getFxRates(): Promise<FxRates | null> {
  if (memo && memo.day === utcDay()) return memo;
  inflight ??= load()
    .then((r) => {
      if (r) memo = r;
      return r ?? memo;
    })
    .catch(() => memo)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
