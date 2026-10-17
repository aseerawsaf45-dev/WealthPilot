/**
 * WealthPilot — One account. PATCH /api/v1/accounts/:id · DELETE ?cascade=true (409 while it has transactions)
 */

import { authed, parseBody, ok, type IdContext } from '@/server/http';
import { AccountPatch } from '@/server/schemas';
import { patchAccount, deleteAccount } from '@/server/repos/ledger';

export const PATCH = authed<IdContext>(async (request, { userId }, ctx) => {
  const { id } = await ctx.params;
  return ok(await patchAccount(userId, id, await parseBody(request, AccountPatch)));
});

export const DELETE = authed<IdContext>(async (request, { userId }, ctx) => {
  const { id } = await ctx.params;
  return ok(await deleteAccount(userId, id, request.nextUrl.searchParams.get('cascade') === 'true'));
});
