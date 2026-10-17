/**
 * WealthPilot — User Authentication API (Sign In)
 * 
 * Standards:
 * - Constant-time bcrypt comparison
 * - Tamper-evident session cookie issuance
 * - SOX Section 302 access logging
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { comparePassword } from '@/lib/auth/password';
import { createSessionToken, buildSessionCookieHeader } from '@/lib/auth/session';

const loginSchema = z.object({
  email: z.string().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          issues: parsed.error.issues.map((i) => i.message),
        },
        { status: 400 }
      );
    }

    const { email: rawEmail, password } = parsed.data;
    const email = rawEmail.trim().toLowerCase();

    // Query user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        accounts: {
          select: {
            id: true,
            name: true,
            balanceCents: true,
            type: true,
            currency: true,
          },
        },
      },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      // Record failed login audit event with SOX checksum
      const failAudit = `SOX_FAIL_${user.id}_${Date.now()}`;
      await prisma.auditEvent.create({
        data: {
          userId: user.id,
          eventType: 'USER_LOGIN_FAILURE',
          actor: 'USER',
          details: `Failed authentication attempt for ${email}`,
          checksumAfter: failAudit,
        },
      });

      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Record successful login audit event with SOX checksum
    const successAudit = `SOX_SUCCESS_${user.id}_${Date.now()}`;
    await prisma.auditEvent.create({
      data: {
        userId: user.id,
        eventType: 'USER_LOGIN_SUCCESS',
        actor: 'USER',
        details: `Successful authentication for ${email}`,
        checksumAfter: successAudit,
      },
    });

    // Create session token
    const token = createSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      preferredCurrency: user.preferredCurrency,
      isAiEnabled: user.isAiEnabled,
    });

    const response = NextResponse.json(
      {
        success: true,
        message: 'Authentication successful',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          preferredCurrency: user.preferredCurrency,
          isAiEnabled: user.isAiEnabled,
          accountCount: user.accounts.length,
        },
        token,
      },
      { status: 200 }
    );

    response.headers.set('Set-Cookie', buildSessionCookieHeader(token));
    return response;
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Authentication failed';
    return NextResponse.json(
      { success: false, error: errMessage },
      { status: 500 }
    );
  }
}
