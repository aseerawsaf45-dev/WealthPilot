/**
 * WealthPilot — Admin: one partner offer. PUT/DELETE /api/v1/admin/offers/:id (ADMIN_EMAILS only)
 */

import { adminOnly, parseBody, ok, type IdContext } from '@/server/http';
import { OfferInput } from '@/server/schemas';
import { updateOffer, deleteOffer } from '@/server/repos/offers';

export const PUT = adminOnly<IdContext>(async (request, { userId }, ctx) => {
  const { id } = await ctx.params;
  return ok(await updateOffer(userId, id, await parseBody(request, OfferInput)));
});

export const DELETE = adminOnly<IdContext>(async (_request, { userId }, ctx) => {
  const { id } = await ctx.params;
  return ok(await deleteOffer(userId, id));
});
