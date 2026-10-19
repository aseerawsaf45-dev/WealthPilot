/**
 * WealthPilot — Banks in a country, ranked from public data. GET /api/v1/banks?country=BD&purpose=loan|deposit
 * Wikidata (which banks exist) + GDELT news (last 30 days) + World Bank average rates as the benchmark.
 * No user data is sent anywhere; signed-in only so it can't be used as a free proxy.
 */

import { authed, ok, HttpError } from '@/server/http';
import { rateLimit } from '@/server/rateLimit';
import { isCountryCode } from '@/lib/countries';
import { rankBanks } from '@/lib/planning/banks';
import { getBankData } from '@/server/repos/banks';
import { getCountryMacro } from '@/server/repos/macro';

export const maxDuration = 60;

export const GET = authed(async (request, { userId }) => {
  const sp = request.nextUrl.searchParams;
  const country = (sp.get('country') ?? '').toUpperCase();
  const purpose = sp.get('purpose') === 'deposit' ? 'deposit' : 'loan';
  if (!isCountryCode(country)) throw new HttpError('VALIDATION_ERROR', 'Use country=<ISO-2 code>, e.g. BD.', 400);
  await rateLimit('banks', [userId], 20, 60);
  const [data, macro] = await Promise.all([getBankData(country), getCountryMacro(country)]);
  return ok({
    country,
    purpose,
    picks: rankBanks(data.banks, data.news, purpose),
    newsCount: data.news.length,
    benchmark: purpose === 'loan' ? macro?.lendingRatePct ?? null : macro?.depositRatePct ?? null,
    banksAsOf: data.banksAsOf,
    newsAsOf: data.newsAsOf,
    sources: ['Wikidata', 'GDELT Project (news, last 30 days)', 'World Bank (average rates)'],
  });
});
