/**
 * WealthPilot — One goal. PATCH /api/v1/goals/:id
 */

import { authed, parseBody, ok, type IdContext } from '@/server/http';
import { GoalPatch } from '@/server/schemas';
import { patchGoal } from '@/server/repos/planning';

export const PATCH = authed<IdContext>(async (request, { userId }, ctx) => {
  const { id } = await ctx.params;
  return ok(await patchGoal(userId, id, await parseBody(request, GoalPatch)));
});
