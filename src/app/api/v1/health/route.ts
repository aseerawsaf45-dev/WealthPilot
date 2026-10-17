/**
 * WealthPilot — Uptime check. GET /api/v1/health → { db, latencyMs } (no versions, no env)
 */

import { checkDatabaseHealth } from '@/server/db';
import { handle, ok, fail } from '@/server/http';

export const GET = handle(async () => {
  const health = await checkDatabaseHealth(); // the DB query keeps this handler dynamic under cacheComponents
  return health.isHealthy ? ok({ db: 'ok', latencyMs: health.latencyMs }) : fail('INTERNAL_ERROR', 'Database unavailable.', 503);
});
