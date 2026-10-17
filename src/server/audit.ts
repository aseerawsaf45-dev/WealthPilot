/**
 * WealthPilot — Tamper-evident audit log (SEC-05).
 *
 * Per-user hash chain: checksumAfter = sha256(previous checksumAfter | fields | createdAt).
 * An advisory lock per user serialises writers so concurrent requests can't fork the chain.
 * `details` must never contain email, account numbers, notes or amounts.
 */

import crypto from 'crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from './db';

type Db = Prisma.TransactionClient;

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** Keyed hash for identifiers we must not store in clear (rate-limit keys, erasure receipts). */
export function pepperHash(value: string): string {
  const pepper = process.env.AUDIT_PEPPER;
  if (!pepper || pepper.length < 16) throw new Error('AUDIT_PEPPER must be set (see BACKEND_AND_AI_PLAN.md M3).');
  return crypto.createHmac('sha256', pepper).update(value).digest('hex');
}

export function chainHash(
  prev: string | null,
  entry: { userId: string; eventType: string; actor: string; details: string; createdAt: Date }
): string {
  return sha256([prev ?? 'GENESIS', entry.userId, entry.eventType, entry.actor, entry.details, entry.createdAt.toISOString()].join('|'));
}

/** Write one audit row inside an existing transaction. */
export async function writeAudit(db: Db, userId: string, eventType: string, details: string, actor = 'USER'): Promise<void> {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
  const prev = await db.auditEvent.findFirst({
    where: { userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { checksumAfter: true },
  });
  const createdAt = new Date();
  const checksumBefore = prev?.checksumAfter ?? null;
  const checksumAfter = chainHash(checksumBefore, { userId, eventType, actor, details, createdAt });
  await db.auditEvent.create({ data: { userId, eventType, actor, details, checksumBefore, checksumAfter, createdAt } });
}

/** Standalone audit write (its own transaction). */
export function audit(userId: string, eventType: string, details: string, actor = 'USER'): Promise<void> {
  return prisma.$transaction((tx) => writeAudit(tx, userId, eventType, details, actor));
}
