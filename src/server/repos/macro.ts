/**
 * WealthPilot — country economic data from the World Bank (public, no key), cached 30 days per
 * country in `country_macros` and in memory. Same shape as repos/fx.ts: never throws; on failure it
 * serves the stored row, else null (the UI then uses labelled fallbacks).
 */

import { prisma } from '../db';
import { isCountryCode } from '@/lib/countries';
import type { CountryMacroData, MacroPoint } from '@/lib/planning/invest';

const SOURCE = 'World Bank Open Data (WDI, WGI)';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const memo = new Map<string, CountryMacroData>();
const inflight = new Map<string, Promise<CountryMacroData | null>>();
const lastFailure = new Map<string, number>();

async function indicator(country: string, id: string, extra = '', mrnev = 1): Promise<Array<{ value: number; year: string }>> {
  const url = `https://api.worldbank.org/v2/country/${country}/indicator/${id}?format=json&mrnev=${mrnev}&per_page=20${extra}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(6000), cache: 'no-store' });
  if (!res.ok) return [];
  const body = (await res.json()) as [unknown, Array<{ value: number | null; date: string }> | null] | unknown;
  const rows = Array.isArray(body) && Array.isArray(body[1]) ? (body[1] as Array<{ value: number | null; date: string }>) : [];
  return rows.filter((r) => typeof r.value === 'number' && Number.isFinite(r.value)).map((r) => ({ value: r.value as number, year: r.date }));
}

const latest = (rows: Array<{ value: number; year: string }>): MacroPoint | null => (rows[0] ? { value: Math.round(rows[0].value * 100) / 100, year: rows[0].year } : null);

async function fetchCountry(country: string): Promise<CountryMacroData | null> {
  const [inf, lend, dep, real, gdp, pv, fx] = await Promise.all([
    indicator(country, 'FP.CPI.TOTL.ZG'),
    indicator(country, 'FR.INR.LEND'),
    indicator(country, 'FR.INR.DPST'),
    indicator(country, 'FR.INR.RINR'),
    indicator(country, 'NY.GDP.MKTP.KD.ZG'),
    indicator(country, 'GOV_WGI_PV.EST', '&source=3'),
    indicator(country, 'PA.NUS.FCRF', '', 6),
  ]);
  // Average yearly depreciation vs USD over the available span (newest first).
  let depreciation: MacroPoint | null = null;
  if (fx.length >= 2) {
    const [newest, oldest] = [fx[0], fx[fx.length - 1]];
    const years = Number(newest.year) - Number(oldest.year);
    if (years > 0 && oldest.value > 0) {
      const perYear = (1 - (oldest.value / newest.value) ** (1 / years)) * 100; // share of USD value lost per year
      depreciation = { value: Math.round(perYear * 100) / 100, year: `${oldest.year}–${newest.year}` };
    }
  }
  const data: CountryMacroData = {
    country,
    inflationPct: latest(inf),
    lendingRatePct: latest(lend),
    depositRatePct: latest(dep),
    realRatePct: latest(real),
    gdpGrowthPct: latest(gdp),
    politicalStability: latest(pv),
    depreciationPctPerYear: depreciation,
    source: SOURCE,
    fetchedAt: new Date().toISOString(),
  };
  const anything = [data.inflationPct, data.lendingRatePct, data.depositRatePct, data.gdpGrowthPct, data.politicalStability].some(Boolean);
  return anything ? data : null;
}

async function load(country: string): Promise<CountryMacroData | null> {
  const row = await prisma.countryMacro.findUnique({ where: { country } });
  if (row && Date.now() - row.fetchedAt.getTime() < MAX_AGE_MS) return row.data as unknown as CountryMacroData;
  if (Date.now() - (lastFailure.get(country) ?? 0) > 10 * 60_000) {
    try {
      const fresh = await fetchCountry(country);
      if (fresh) {
        const json = fresh as unknown as object;
        await prisma.countryMacro.upsert({ where: { country }, create: { country, data: json, source: SOURCE }, update: { data: json, source: SOURCE, fetchedAt: new Date() } });
        return fresh;
      }
    } catch {
      /* offline or API down: fall back to the stored row */
    }
    lastFailure.set(country, Date.now());
  }
  return row ? (row.data as unknown as CountryMacroData) : null;
}

/** Country data for an ISO-2 code, or null. Safe to call per request. */
export async function getCountryMacro(country: string): Promise<CountryMacroData | null> {
  if (!isCountryCode(country)) return null;
  const hit = memo.get(country);
  if (hit && Date.now() - Date.parse(hit.fetchedAt) < MAX_AGE_MS) return hit;
  let p = inflight.get(country);
  if (!p) {
    p = load(country)
      .then((r) => {
        if (r) memo.set(country, r);
        return r;
      })
      .catch(() => memo.get(country) ?? null)
      .finally(() => inflight.delete(country));
    inflight.set(country, p);
  }
  return p;
}
