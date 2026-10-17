/**
 * WealthPilot — One budget. PATCH /api/v1/budgets/:id
 */

import { authed, parseBody, ok, type IdContext } from '@/server/http';
import { BudgetPatch } from '@/server/schemas';
import { patchBudget } from '@/server/repos/planning';

export const PATCH = authed<IdContext>(async (request, { userId }, ctx) => {
  const { id } = await ctx.params;
  return ok(await patchBudget(userId, id, await parseBody(request, BudgetPatch)));
});
