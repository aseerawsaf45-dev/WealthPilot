/**
 * WealthPilot — Add money to (or withdraw from) a goal. POST /api/v1/goals/:id/contributions  { amountCents }
 */

import { authed, parseBody, ok, type IdContext } from '@/server/http';
import { rateLimit } from '@/server/rateLimit';
import { GoalContributionInput } from '@/server/schemas';
import { contributeToGoal } from '@/server/repos/planning';

export const POST = authed<IdContext>(async (request, { userId }, ctx) => {
  const { id } = await ctx.params;
  const { amountCents } = await parseBody(request, GoalContributionInput);
  await rateLimit('goal:contribute', [userId], 60, 60);
  return ok(await contributeToGoal(userId, id, amountCents));
});
