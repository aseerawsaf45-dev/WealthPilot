/**
 * WealthPilot — Sign out. POST /api/v1/auth/logout
 * Revokes the server-side Session row so a copied cookie stops working, then clears the cookie.
 */

import { prisma } from '@/server/db';
import { handle, ok } from '@/server/http';
import { audit } from '@/server/audit';
import { getSessionFromRequest, buildClearSessionCookieHeader } from '@/lib/auth/session';

export const POST = handle(async (request) => {
  const session = getSessionFromRequest(request);
  if (session) {
    const { count } = await prisma.session.updateMany({
      where: { id: session.sid, userId: session.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count) await audit(session.userId, 'USER_LOGOUT', 'session revoked');
  }

  const response = ok({ signedOut: true });
  response.headers.set('Set-Cookie', buildClearSessionCookieHeader());
  return response;
});
