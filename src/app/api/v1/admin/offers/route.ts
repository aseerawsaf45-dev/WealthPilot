/**
 * WealthPilot — Admin: partner offers. GET/POST /api/v1/admin/offers (ADMIN_EMAILS only)
 */

import { adminOnly, parseBody, ok } from '@/server/http';
import { OfferInput } from '@/server/schemas';
import { adminListOffers, createOffer } from '@/server/repos/offers';

export const GET = adminOnly(async () => ok(await adminListOffers()));

export const POST = adminOnly(async (request, { userId }) => ok(await createOffer(userId, await parseBody(request, OfferInput)), 201));
