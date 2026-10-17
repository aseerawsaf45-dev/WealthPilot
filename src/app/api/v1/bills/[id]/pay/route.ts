/**
 * WealthPilot — Mark a bill paid. POST /api/v1/bills/:id/pay  { dueDate, recordTransaction? }
 * Advances nextDueDate and records the expense in one transaction; idempotent per dueDate (409 on repeat).
 */

import { authed, parseBody, ok, type IdContext } from '@/server/http';
import { rateLimit } from '@/server/rateLimit';
import { BillPayInput } from '@/server/schemas';
import { payBill } from '@/server/repos/planning';
import { userToday } from '@/server/repos/user';

export const POST = authed<IdContext>(async (request, { userId }, ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(request, BillPayInput);
  await rateLimit('bill:pay', [userId], 30, 60);
  return ok(await payBill(userId, id, input, await userToday(userId)));
});
