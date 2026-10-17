/**
 * WealthPilot — One transaction. PATCH/DELETE /api/v1/transactions/:id (DELETE = VOID)
 */

import { authed, parseBody, ok, type IdContext } from '@/server/http';
import { rateLimit } from '@/server/rateLimit';
import { TransactionPatch } from '@/server/schemas';
import { updateTransaction, voidTransaction } from '@/server/repos/ledger';

export const PATCH = authed<IdContext>(async (request, { userId }, ctx) => {
  await rateLimit('tx:write', [userId], 60, 60);
  const { id } = await ctx.params;
  return ok(await updateTransaction(userId, id, await parseBody(request, TransactionPatch)));
});

export const DELETE = authed<IdContext>(async (_request, { userId }, ctx) => {
  await rateLimit('tx:write', [userId], 60, 60);
  const { id } = await ctx.params;
  return ok(await voidTransaction(userId, id));
});
