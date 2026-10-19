/**
 * WealthPilot — real market history for region/asset funds (Yahoo Finance chart API, public,
 * unofficial: cached 15 min, stale data served if it changes) and yearly country stock-market
 * returns (World Bank CM.MKT.INDX.ZG, 30 days).
 */

import { cached, cachedAt } from './externalCache';
import { isCountryCode } from '@/lib/countries';
import { UNIVERSE, computeStats, type InstrumentStats, type PricePoint } from '@/lib/planning/markets';

interface Series {
  history: PricePoint[];
  price: number | null;
  time: string | null;
  currency: string;
}

async function yahoo(symbol: string): Promise<Series | null> {
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=10y&interval=1mo`, {
    headers: { 'user-agent': 'Mozilla/5.0 (WealthPilot planner)' },
    signal: AbortSignal.timeout(10_000),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const body = (await res.json()) as {
    chart?: { result?: Array<{ meta: { regularMarketPrice?: number; regularMarketTime?: number; currency?: string }; timestamp?: number[]; indicators: { adjclose?: Array<{ adjclose: Array<number | null> }>; quote: Array<{ close: Array<number | null> }> } }> };
  };
  const r = body.chart?.result?.[0];
  if (!r?.timestamp?.length) return null;
  const closes = r.indicators.adjclose?.[0]?.adjclose ?? r.indicators.quote[0]?.close ?? [];
  const byMonth = new Map<string, number>();
  r.timestamp.forEach((t, i) => {
    const c = closes[i];
    if (typeof c === 'number' && c > 0) byMonth.set(new Date(t * 1000).toISOString().slice(0, 7), Math.round(c * 100) / 100);
  });
  return {
    history: [...byMonth].map(([date, close]) => ({ date, close })),
    price: r.meta.regularMarketPrice ?? null,
    time: r.meta.regularMarketTime ? new Date(r.meta.regularMarketTime * 1000).toISOString() : null,
    currency: r.meta.currency ?? 'USD',
  };
}

export async function getMarketStats(): Promise<{ stats: InstrumentStats[]; asOf: string | null }> {
  const series = await Promise.all(UNIVERSE.map((inst) => cached(`mkt:${inst.symbol}`, 15 * 60_000, () => yahoo(inst.symbol), 5 * 60_000)));
  const stats = UNIVERSE.flatMap((inst, i) => {
    const s = series[i];
    return s ? [computeStats(inst, s.history, { price: s.price, time: s.time, currency: s.currency })] : [];
  });
  return { stats, asOf: await cachedAt('mkt:ACWI') };
}

/** Yearly % change of the country's stock market (S&P Global Equity Indices), newest last. */
export async function getCountryMarketHistory(country: string): Promise<Array<{ year: string; pct: number }>> {
  if (!isCountryCode(country)) return [];
  const rows = await cached(`wb:equity:${country}`, 30 * 86_400_000, async () => {
    const res = await fetch(`https://api.worldbank.org/v2/country/${country}/indicator/CM.MKT.INDX.ZG?format=json&mrnev=10&per_page=20`, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
    if (!res.ok) return null;
    const body = (await res.json()) as [unknown, Array<{ value: number | null; date: string }> | null];
    const list = (Array.isArray(body) && body[1]) || [];
    return list.filter((r) => typeof r.value === 'number').map((r) => ({ year: r.date, pct: Math.round((r.value as number) * 10) / 10 })).reverse();
  });
  return rows ?? [];
}
