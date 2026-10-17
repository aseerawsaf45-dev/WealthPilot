/**
 * WealthPilot — User Logout API
 * 
 * Clears the session cookie and logs user sign-out audit event.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { getSessionFromRequest, buildClearSessionCookieHeader } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);

    if (session) {
      const logoutChecksum = `SOX_LOGOUT_${session.userId}_${Date.now()}`;
      await prisma.auditEvent.create({
        data: {
          userId: session.userId,
          eventType: 'USER_LOGOUT',
          actor: 'USER',
          details: `User signed out from active session`,
          checksumAfter: logoutChecksum,
        },
      }).catch(() => null);
    }

    const response = NextResponse.json(
      {
        success: true,
        message: 'Successfully signed out',
      },
      { status: 200 }
    );

    response.headers.set('Set-Cookie', buildClearSessionCookieHeader());
    return response;
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Logout failed';
    const response = NextResponse.json({ success: false, error: errMessage }, { status: 500 });
    response.headers.set('Set-Cookie', buildClearSessionCookieHeader());
    return response;
  }
}
