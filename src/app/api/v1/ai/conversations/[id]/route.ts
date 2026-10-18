/**
 * WealthPilot — One saved assistant chat. GET · PATCH { title?, messages? } · DELETE
 */

import { authed, parseBody, ok, type IdContext } from '@/server/http';
import { rateLimit } from '@/server/rateLimit';
import { ConversationPatch, getConversation, updateConversation, deleteConversation } from '@/server/repos/copilot';

export const GET = authed<IdContext>(async (_request, { userId }, ctx) => {
  const { id } = await ctx.params;
  return ok(await getConversation(userId, id));
});

export const PATCH = authed<IdContext>(async (request, { userId }, ctx) => {
  const { id } = await ctx.params;
  await rateLimit('chat:write', [userId], 60, 60);
  return ok(await updateConversation(userId, id, await parseBody(request, ConversationPatch)));
});

export const DELETE = authed<IdContext>(async (_request, { userId }, ctx) => {
  const { id } = await ctx.params;
  return ok(await deleteConversation(userId, id));
});
