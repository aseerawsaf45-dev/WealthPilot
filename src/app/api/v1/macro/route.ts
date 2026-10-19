/**
 * WealthPilot — Country economic data (World Bank, cached 30 days). GET /api/v1/macro?country=BD
 * Public data, but signed-in only so the route can't be used as a free proxy.
 */

import { authed, ok, HttpError } from '@/server/http';
import { rateLimit } from '@/server/rateLimit';
import { isCountryCode } from '@/lib/countries';
import { getCountryMacro } from '@/server/repos/macro';

export const maxDuration = 30;

export const GET = authed(async (request, { userId }) => {
  const country = (request.nextUrl.searchParams.get('country') ?? '').toUpperCase();
  if (!isCountryCode(country)) throw new HttpError('VALIDATION_ERROR', 'Use country=<ISO-2 code>, e.g. BD.', 400);
  await rateLimit('macro', [userId], 30, 60);
  return ok({ macro: await getCountryMacro(country) });
});
