/**
 * WealthPilot — Current user profile + preferences. GET /api/v1/auth/me
 */

import { authed, ok } from '@/server/http';
import { getProfile } from '@/server/repos/user';

export const GET = authed(async (_request, session) => ok(await getProfile(session.userId)));
