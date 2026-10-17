/**
 * WealthPilot — GDPR Art. 17 erasure. DELETE /api/v1/auth/account  { password }
 *
 * Password re-entry, 3/hour, cascade delete of every user relation (sessions included),
 * one pseudonymous erasure receipt. Profile edits moved to PATCH /api/v1/user/preferences
 * (the old PUT here could flip isAiEnabled and bypass consent: SEC-11).
 */

import { authed, parseBody, ok } from '@/server/http';
import { rateLimit } from '@/server/rateLimit';
import { PasswordConfirm } from '@/server/schemas';
import { assertPassword, eraseUser } from '@/server/repos/user';
import { buildClearSessionCookieHeader } from '@/lib/auth/session';

export const DELETE = authed(async (request, session) => {
  const { password } = await parseBody(request, PasswordConfirm);
  await rateLimit('account:delete', [session.userId], 3, 60 * 60);
  await assertPassword(session.userId, password);
  await eraseUser(session.userId);

  const response = ok({ erased: true, message: 'Your account and all its financial records were permanently deleted.' });
  response.headers.set('Set-Cookie', buildClearSessionCookieHeader());
  return response;
});
