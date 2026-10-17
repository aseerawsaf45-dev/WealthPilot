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

/**
 * Write one audit row inside an existing transaction: 2 round trips (lock, then one INSERT…SELECT
 * that reads the previous hash and computes the new one in SQL, identical to chainHash()).
 * createdAt is strictly increasing per user, so ordering by createdAt is unambiguous.
 */
export async function writeAudit(db: Db, userId: string, eventType: string, details: string, actor = 'USER'): Promise<void> {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
  const now = new Date().toISOString();
  await db.$executeRaw`
    WITH prev AS (
      SELECT "checksumAfter", "createdAt" FROM "audit_events"
      WHERE "userId" = ${userId} ORDER BY "createdAt" DESC, "id" DESC LIMIT 1
    ), ts AS (
      SELECT GREATEST(${now}::timestamp(3), COALESCE((SELECT "createdAt" FROM prev) + interval '1 millisecond', ${now}::timestamp(3))) AS at
    )
    INSERT INTO "audit_events" ("id", "userId", "eventType", "actor", "details", "checksumBefore", "checksumAfter", "createdAt")
    SELECT ${crypto.randomUUID()}, ${userId}, ${eventType}, ${actor}, ${details}, (SELECT "checksumAfter" FROM prev),
      encode(sha256(convert_to(concat_ws('|',
        COALESCE((SELECT "checksumAfter" FROM prev), 'GENESIS'), ${userId}, ${eventType}, ${actor}, ${details},
        to_char(ts.at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')), 'UTF8')), 'hex'),
      ts.at
    FROM ts`;
}

/** Standalone audit write (its own transaction). */
export function audit(userId: string, eventType: string, details: string, actor = 'USER'): Promise<void> {
  return prisma.$transaction((tx) => writeAudit(tx, userId, eventType, details, actor));
}
