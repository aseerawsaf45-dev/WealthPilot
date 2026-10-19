/**
 * WealthPilot — Apply one option from a saved goal plan. POST /api/v1/goals/:id/plan/apply { optionId }
 * One DB transaction + one audit entry; returns the user's goals and this month's budgets.
 */

import { z } from 'zod';
import { authed, parseBody, ok, type IdContext } from '@/server/http';
import { rateLimit } from '@/server/rateLimit';
import { applyGoalPlanOption } from '@/server/repos/planning';
import { userToday } from '@/server/repos/user';

const Body = z.object({ optionId: z.enum(['extend', 'cut', 'balanced', 'pause_others', 'lower_target', 'income']) });

export const POST = authed<IdContext>(async (request, { userId }, ctx) => {
  const { id } = await ctx.params;
  const { optionId } = await parseBody(request, Body);
  await rateLimit('plan:apply', [userId], 10, 60);
  const today = await userToday(userId);
  return ok(await applyGoalPlanOption(userId, id, optionId, today.slice(0, 7), today));
});
