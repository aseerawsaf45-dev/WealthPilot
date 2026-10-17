/**
 * WealthPilot — One bill. PATCH/DELETE /api/v1/bills/:id
 */

import { authed, parseBody, ok, type IdContext } from '@/server/http';
import { BillPatch } from '@/server/schemas';
import { patchBill, deleteBill } from '@/server/repos/planning';
import { userToday } from '@/server/repos/user';

export const PATCH = authed<IdContext>(async (request, { userId }, ctx) => {
  const { id } = await ctx.params;
  const patch = await parseBody(request, BillPatch);
  return ok(await patchBill(userId, id, patch, await userToday(userId)));
});

export const DELETE = authed<IdContext>(async (_request, { userId }, ctx) => {
  const { id } = await ctx.params;
  return ok(await deleteBill(userId, id));
});
