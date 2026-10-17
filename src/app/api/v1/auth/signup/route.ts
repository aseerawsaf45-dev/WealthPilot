/**
 * WealthPilot — User Registration API (Sign Up)
 * 
 * Standards:
 * - NIST SP 800-63B password validation and bcrypt hashing
 * - Default financial enclave provisioning (Checking, Savings, Cash accounts)
 * - SOX Section 302 immutable audit event creation
 * - HTTP-only session cookie issuance
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';
import { createSessionToken, buildSessionCookieHeader } from '@/lib/auth/session';
import { createSoxAuditEntry } from '@/lib/compliance/soxCompliance';

const signupSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  name: z.string().min(1, 'Name is required').max(100).optional(),
  preferredCurrency: z.enum(['USD', 'BDT']).default('USD'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);

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

    const { email: rawEmail, password, name: rawName, preferredCurrency } = parsed.data;
    const email = rawEmail.trim().toLowerCase();
    const name = (rawName || email.split('@')[0] || 'Pilot').trim();

    // Verify password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { success: false, error: passwordValidation.message },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    // Salt and hash password
    const passwordHash = await hashPassword(password);

    // Create user and initialize starter financial accounts in transaction
    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name,
          passwordHash,
          preferredCurrency,
          isAiEnabled: true,
        },
      });

      // Provision starter accounts
      await tx.financialAccount.createMany({
        data: [
          {
            userId: user.id,
            name: 'Primary Checking',
            institution: 'WealthPilot Reserve',
            type: 'CHECKING',
            currency: preferredCurrency,
            balanceCents: BigInt(250000), // $2,500.00
            accountNumberMask: '•••• 1001',
            isManual: true,
            isIncludedInNetWorth: true,
          },
          {
            userId: user.id,
            name: 'High-Yield Savings',
            institution: 'WealthPilot Treasury',
            type: 'SAVINGS',
            currency: preferredCurrency,
            balanceCents: BigInt(1000000), // $10,000.00
            accountNumberMask: '•••• 2002',
            isManual: true,
            isIncludedInNetWorth: true,
          },
          {
            userId: user.id,
            name: 'Cash Reserve',
            institution: 'Cash Wallet',
            type: 'CASH',
            currency: preferredCurrency,
            balanceCents: BigInt(30000), // $300.00
            accountNumberMask: '•••• 3003',
            isManual: true,
            isIncludedInNetWorth: true,
          },
        ],
      });

      // Log SOX audit record
      const soxAudit = createSoxAuditEntry(user.id, 'ACCOUNT', user.id, 'CREATE', {
        email: user.email,
        name: user.name,
        currency: preferredCurrency,
      });

      await tx.auditEvent.create({
        data: {
          userId: user.id,
          eventType: 'USER_REGISTERED',
          actor: 'USER',
          details: `Account created for ${email}`,
          checksumAfter: soxAudit.checksumAfter,
        },
      });

      return user;
    });

    // Create session token
    const token = createSessionToken({
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      preferredCurrency: newUser.preferredCurrency,
      isAiEnabled: newUser.isAiEnabled,
    });

    const response = NextResponse.json(
      {
        success: true,
        message: 'Account successfully registered and ledger initialized',
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          preferredCurrency: newUser.preferredCurrency,
          isAiEnabled: newUser.isAiEnabled,
        },
        token,
      },
      { status: 201 }
    );

    response.headers.set('Set-Cookie', buildSessionCookieHeader(token));
    return response;
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Registration failed';
    return NextResponse.json(
      { success: false, error: errMessage },
      { status: 500 }
    );
  }
}
