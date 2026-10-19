/**
 * WealthPilot — One loan offer. PATCH/DELETE /api/v1/loans/:id
 */

import { authed, parseBody, ok, type IdContext } from '@/server/http';
import { LoanOfferPatch } from '@/server/schemas';
import { patchOffer, deleteOffer } from '@/server/repos/wealth';

export const PATCH = authed<IdContext>(async (request, { userId }, ctx) => {
  const { id } = await ctx.params;
  return ok(await patchOffer(userId, id, await parseBody(request, LoanOfferPatch)));
});

export const DELETE = authed<IdContext>(async (_request, { userId }, ctx) => {
  const { id } = await ctx.params;
  return ok(await deleteOffer(userId, id));
});
