/**
 * WealthPilot — Postgres fixed-window rate limiter (SEC-04). One atomic upsert per check.
 */

import { prisma } from './db';
import { HttpError } from './http';
import { pepperHash } from './audit';

/**
 * Counts one hit and reports whether it is still within `limit` for `windowSec`.
 * Pass raw identifiers (email, IP) in `parts`; they are stored only as a keyed hash.
 */
export async function rateLimitHit(scope: string, parts: string[], limit: number, windowSec: number): Promise<{ allowed: boolean; retryAfter: number }> {
  const key = `${scope}:${pepperHash(parts.join('|'))}`;
  const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "rate_limit_buckets" ("key", "count", "resetAt")
    VALUES (${key}, 1, (now() AT TIME ZONE 'UTC') + ${windowSec}::int * interval '1 second')
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "rate_limit_buckets"."resetAt" < (now() AT TIME ZONE 'UTC') THEN 1 ELSE "rate_limit_buckets"."count" + 1 END,
      "resetAt" = CASE WHEN "rate_limit_buckets"."resetAt" < (now() AT TIME ZONE 'UTC')
                       THEN (now() AT TIME ZONE 'UTC') + ${windowSec}::int * interval '1 second'
                       ELSE "rate_limit_buckets"."resetAt" END
    RETURNING "count", "resetAt"`;

  const { count, resetAt } = rows[0];
  // resetAt is a UTC wall-clock TIMESTAMP; Prisma reads it back as a UTC Date.
  return { allowed: count <= limit, retryAfter: Math.max(1, Math.ceil((new Date(resetAt).getTime() - Date.now()) / 1000)) };
}

/** Same as rateLimitHit, but throws a 429 HttpError once the limit is exceeded. */
export async function rateLimit(scope: string, parts: string[], limit: number, windowSec: number): Promise<void> {
  const { allowed, retryAfter } = await rateLimitHit(scope, parts, limit, windowSec);
  if (!allowed) {
    throw new HttpError('RATE_LIMITED', 'Too many attempts. Please wait and try again.', 429, { 'Retry-After': String(retryAfter) });
  }
}
