/**
 * WealthPilot — Profile & preferences. GET/PATCH /api/v1/user/preferences
 * isAiEnabled is NOT writable here; only /user/ai-consent changes it (SEC-11).
 */

import { authed, parseBody, ok } from '@/server/http';
import { PreferencesPatch } from '@/server/schemas';
import { getProfile, updatePreferences } from '@/server/repos/user';

export const GET = authed(async (_request, { userId }) => ok(await getProfile(userId)));

export const PATCH = authed(async (request, { userId }) => ok(await updatePreferences(userId, await parseBody(request, PreferencesPatch))));
