/**
 * WealthPilot — Real market history + a history-based mix. GET /api/v1/markets?country=BD&risk=balanced&years=10
 * Yahoo Finance (region/asset funds, 15-min cache) and World Bank yearly country market returns.
 */

import { authed, ok } from '@/server/http';
import { rateLimit } from '@/server/rateLimit';
import { suggestMix, type Risk } from '@/lib/planning/markets';
import { getMarketStats, getCountryMarketHistory } from '@/server/repos/markets';

export const maxDuration = 30;

const RISKS: Risk[] = ['conservative', 'balanced', 'growth'];

export const GET = authed(async (request, { userId }) => {
  const sp = request.nextUrl.searchParams;
  const risk = RISKS.find((r) => r === sp.get('risk')) ?? 'balanced';
  const years = Math.min(50, Math.max(1, Number(sp.get('years')) || 10));
  await rateLimit('markets', [userId], 30, 60);
  const [{ stats, asOf }, countryHistory] = await Promise.all([getMarketStats(), getCountryMarketHistory((sp.get('country') ?? '').toUpperCase())]);
  // Yearly points are enough for charts and keep the payload small.
  const slim = stats.map((s) => ({ ...s, history: s.history.filter((_, i, a) => (a.length - 1 - i) % 12 === 0) }));
  return ok({ stats: slim, mix: suggestMix(stats, risk, years), countryHistory, asOf, sources: ['Yahoo Finance (fund prices)', 'World Bank (country market returns)'] });
});
