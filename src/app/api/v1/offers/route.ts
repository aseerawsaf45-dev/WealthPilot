/**
 * WealthPilot — Partner offers in a country. GET /api/v1/offers?country=XX
 * Returns offers with their branch coordinates; the browser computes distance, so the user's
 * location is never sent here.
 */

import { authed, ok, HttpError } from '@/server/http';
import { rateLimit } from '@/server/rateLimit';
import { isCountryCode } from '@/lib/countries';
import { listLiveOffers } from '@/server/repos/offers';

export const GET = authed(async (request, { userId }) => {
  const country = (request.nextUrl.searchParams.get('country') ?? '').toUpperCase();
  if (!isCountryCode(country)) throw new HttpError('VALIDATION_ERROR', 'Use country=<ISO-2 code>, e.g. BD.', 400);
  await rateLimit('offers', [userId], 30, 60);
  return ok(await listLiveOffers(country));
});
