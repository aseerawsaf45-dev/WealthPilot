/**
 * WealthPilot — Investment plans. GET/POST /api/v1/investments (projections are computed client-side, pure)
 */

import { authed, parseBody, ok } from '@/server/http';
import { InvestmentPlanInput } from '@/server/schemas';
import { listPlans, createPlan } from '@/server/repos/wealth';

export const GET = authed(async (_request, { userId }) => ok(await listPlans(userId)));

export const POST = authed(async (request, { userId }) => ok(await createPlan(userId, await parseBody(request, InvestmentPlanInput)), 201));
