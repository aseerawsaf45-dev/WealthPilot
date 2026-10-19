/**
 * WealthPilot — Take a loan offer: creates the debt (EMI as minimum payment). POST /api/v1/loans/:id/take { dueDateDay }
 */

import { authed, parseBody, ok, type IdContext } from '@/server/http';
import { rateLimit } from '@/server/rateLimit';
import { TakeLoanInput } from '@/server/schemas';
import { takeOffer } from '@/server/repos/wealth';

export const POST = authed<IdContext>(async (request, { userId }, ctx) => {
  const { id } = await ctx.params;
  const { dueDateDay } = await parseBody(request, TakeLoanInput);
  await rateLimit('loan:take', [userId], 10, 60);
  return ok(await takeOffer(userId, id, dueDateDay), 201);
});
