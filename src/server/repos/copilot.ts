/**
 * WealthPilot — Saved assistant chats (history sidebar). Every query is scoped by the session userId.
 * Chats are saved only while the user's chatHistoryEnabled preference is on; turning it off deletes them
 * (src/server/repos/user.ts updatePreferences).
 */

import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db';
import { writeAudit } from '../audit';
import { HttpError } from '../http';

const MAX_CHATS = 100;

/** A chat as the client stores it. Message objects are kept as-is (they are the user's own chat), with a size cap. */
export const ConversationInput = z.object({
  title: z.string().trim().min(1).max(80),
  messages: z
    .array(z.object({ id: z.string().max(80), sender: z.enum(['user', 'assistant']), timestamp: z.string().max(40), content: z.string().max(4000) }).passthrough())
    .max(200)
    .refine((m) => JSON.stringify(m).length <= 300_000, 'This chat is too long to save; start a new chat.'),
});
export const ConversationPatch = ConversationInput.partial();

const notFound = () => new HttpError('NOT_FOUND', 'Chat not found.', 404);

async function assertHistoryOn(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { chatHistoryEnabled: true } });
  if (!user?.chatHistoryEnabled) throw new HttpError('FORBIDDEN', 'Turn on chat history to save chats.', 403);
}

export async function listConversations(userId: string) {
  return prisma.copilotConversation.findMany({
    where: { userId },
    select: { id: true, title: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: MAX_CHATS,
  });
}

export async function getConversation(userId: string, id: string) {
  const row = await prisma.copilotConversation.findFirst({ where: { id, userId }, select: { id: true, title: true, messages: true, updatedAt: true } });
  if (!row) throw notFound();
  return row;
}

export async function createConversation(userId: string, input: z.infer<typeof ConversationInput>) {
  await assertHistoryOn(userId);
  const row = await prisma.copilotConversation.create({
    data: { userId, title: input.title, messages: input.messages as Prisma.InputJsonValue },
    select: { id: true, title: true, updatedAt: true },
  });
  // Keep the newest MAX_CHATS; older chats roll off.
  const old = await prisma.copilotConversation.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, skip: MAX_CHATS, select: { id: true } });
  if (old.length) await prisma.copilotConversation.deleteMany({ where: { userId, id: { in: old.map((o) => o.id) } } });
  return row;
}

export async function updateConversation(userId: string, id: string, patch: z.infer<typeof ConversationPatch>) {
  await assertHistoryOn(userId);
  const { count } = await prisma.copilotConversation.updateMany({
    where: { id, userId },
    data: { title: patch.title, messages: patch.messages as Prisma.InputJsonValue | undefined },
  });
  if (!count) throw notFound();
  return { id };
}

export async function deleteConversation(userId: string, id: string) {
  const { count } = await prisma.copilotConversation.deleteMany({ where: { id, userId } });
  if (!count) throw notFound();
  return { id };
}

export async function deleteAllConversations(userId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.copilotConversation.deleteMany({ where: { userId } });
    await writeAudit(tx, userId, 'COPILOT_HISTORY_DELETED', 'all saved chats deleted by user');
  });
  return { deleted: true };
}
