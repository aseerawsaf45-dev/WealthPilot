/**
 * WealthPilot — Daily exchange rates for converted totals. GET /api/v1/fx
 * Rates are public market data (not user data); signed-in only so the route can't be used as a free proxy.
 */

import { authed, ok } from '@/server/http';
import { rateLimit } from '@/server/rateLimit';
import { getFxRates } from '@/server/repos/fx';

export const GET = authed(async (_request, { userId }) => {
  await rateLimit('fx', [userId], 30, 60);
  return ok({ fx: await getFxRates() });
});
