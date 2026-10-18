/**
 * WealthPilot — Saved assistant chats. GET (list) · POST (save a new chat) · DELETE (delete all)
 * Saving needs the user's chat-history preference on (403 otherwise).
 */

import { authed, parseBody, ok } from '@/server/http';
import { rateLimit } from '@/server/rateLimit';
import { ConversationInput, listConversations, createConversation, deleteAllConversations } from '@/server/repos/copilot';

export const GET = authed(async (_request, { userId }) => ok(await listConversations(userId)));

export const POST = authed(async (request, { userId }) => {
  await rateLimit('chat:write', [userId], 60, 60);
  return ok(await createConversation(userId, await parseBody(request, ConversationInput)), 201);
});

export const DELETE = authed(async (_request, { userId }) => ok(await deleteAllConversations(userId)));
