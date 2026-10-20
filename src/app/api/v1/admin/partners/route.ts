/**
 * WealthPilot — Admin: partner organisations. GET/POST /api/v1/admin/partners (ADMIN_EMAILS only)
 */

import { adminOnly, parseBody, ok } from '@/server/http';
import { PartnerInput } from '@/server/schemas';
import { listPartners, createPartner } from '@/server/repos/offers';

export const GET = adminOnly(async () => ok(await listPartners()));

export const POST = adminOnly(async (request, { userId }) => ok(await createPartner(userId, await parseBody(request, PartnerInput)), 201));
