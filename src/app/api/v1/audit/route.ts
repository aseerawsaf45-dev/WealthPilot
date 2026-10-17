/**
 * WealthPilot — The user's own audit events. GET /api/v1/audit?limit=30 (no IPs)
 */

import { authed, ok } from '@/server/http';
import { listAudit } from '@/server/repos/user';

export const GET = authed(async (request, { userId }) => {
  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit')) || 30, 1), 100);
  return ok(await listAudit(userId, limit));
});
