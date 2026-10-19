/**
 * WealthPilot — One investment plan. PATCH/DELETE /api/v1/investments/:id
 */

import { authed, parseBody, ok, type IdContext } from '@/server/http';
import { InvestmentPlanPatch } from '@/server/schemas';
import { patchPlan, deletePlan } from '@/server/repos/wealth';

export const PATCH = authed<IdContext>(async (request, { userId }, ctx) => {
  const { id } = await ctx.params;
  return ok(await patchPlan(userId, id, await parseBody(request, InvestmentPlanPatch)));
});

export const DELETE = authed<IdContext>(async (_request, { userId }, ctx) => {
  const { id } = await ctx.params;
  return ok(await deletePlan(userId, id));
});
