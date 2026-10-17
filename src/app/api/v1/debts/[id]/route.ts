/**
 * WealthPilot — One debt. PATCH/DELETE /api/v1/debts/:id
 */

import { authed, parseBody, ok, type IdContext } from '@/server/http';
import { DebtPatch } from '@/server/schemas';
import { patchDebt, deleteDebt } from '@/server/repos/planning';

export const PATCH = authed<IdContext>(async (request, { userId }, ctx) => {
  const { id } = await ctx.params;
  return ok(await patchDebt(userId, id, await parseBody(request, DebtPatch)));
});

export const DELETE = authed<IdContext>(async (_request, { userId }, ctx) => {
  const { id } = await ctx.params;
  return ok(await deleteDebt(userId, id));
});
