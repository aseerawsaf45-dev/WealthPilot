/**
 * WealthPilot — Anonymous view/click count for a partner offer. POST /api/v1/offers/:id/event
 * Stored as a daily counter per offer (no user id, no location). Unknown offers are ignored.
 */

import { authed, parseBody, type IdContext } from '@/server/http';
import { rateLimit } from '@/server/rateLimit';
import { OfferEvent } from '@/server/schemas';
import { countEvent } from '@/server/repos/offers';

export const POST = authed<IdContext>(async (request, { userId }, ctx) => {
  const { id } = await ctx.params;
  const { type } = await parseBody(request, OfferEvent);
  await rateLimit('offers:event', [userId], 60, 60);
  await countEvent(id.slice(0, 40), type);
  return new Response(null, { status: 204 });
});
