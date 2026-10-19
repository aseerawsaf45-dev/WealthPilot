/**
 * WealthPilot — Per-page AI insight cache (latest per user + page).
 * A cached answer is reused while the underlying numbers are unchanged (dataHash) and it is < 6 h old,
 * so switching tabs never spends AI quota.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '../db';

const MAX_AGE_MS = 6 * 60 * 60 * 1000;

export async function getPageInsight(userId: string, segment: string, dataHash: string) {
  const row = await prisma.pageInsight.findUnique({ where: { userId_segment: { userId, segment } } });
  if (!row || row.dataHash !== dataHash || Date.now() - row.createdAt.getTime() > MAX_AGE_MS) return null;
  return { payload: row.payload, createdAt: row.createdAt.toISOString() };
}

export async function savePageInsight(userId: string, segment: string, dataHash: string, payload: Prisma.InputJsonValue) {
  const now = new Date();
  await prisma.pageInsight.upsert({
    where: { userId_segment: { userId, segment } },
    create: { userId, segment, dataHash, payload, createdAt: now },
    update: { dataHash, payload, createdAt: now },
  });
  return now.toISOString();
}
