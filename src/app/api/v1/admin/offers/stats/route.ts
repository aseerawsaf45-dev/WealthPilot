/**
 * WealthPilot — Admin: anonymous views/clicks per offer, last 30 days. GET /api/v1/admin/offers/stats
 */

import { adminOnly, ok } from '@/server/http';
import { offerStats } from '@/server/repos/offers';

export const GET = adminOnly(async () => ok(await offerStats(30)));
