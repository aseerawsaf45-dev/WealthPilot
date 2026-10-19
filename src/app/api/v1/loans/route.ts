/**
 * WealthPilot — Loan offers being considered. GET/POST /api/v1/loans
 */

import { authed, parseBody, ok } from '@/server/http';
import { LoanOfferInput } from '@/server/schemas';
import { listOffers, createOffer } from '@/server/repos/wealth';

export const GET = authed(async (_request, { userId }) => ok(await listOffers(userId)));

export const POST = authed(async (request, { userId }) => ok(await createOffer(userId, await parseBody(request, LoanOfferInput)), 201));
