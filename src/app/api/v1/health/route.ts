/**
 * WealthPilot — Uptime check. GET /api/v1/health → { db, latencyMs } (no versions, no env)
 */

import { connection } from 'next/server';
import { checkDatabaseHealth } from '@/server/db';
import { handle, ok, fail } from '@/server/http';

export const GET = handle(async () => {
  await connection();
  const health = await checkDatabaseHealth();
  return health.isHealthy ? ok({ db: 'ok', latencyMs: health.latencyMs }) : fail('INTERNAL_ERROR', 'Database unavailable.', 503);
});
