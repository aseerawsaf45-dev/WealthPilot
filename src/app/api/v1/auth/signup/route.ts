/**
 * WealthPilot — Sign up. POST /api/v1/auth/signup
 *
 * bcrypt (cost 12), starter accounts, AI off by default (opt-in, SEC-11),
 * 3 sign-ups per hour per IP, cookie-only session.
 */

import { z } from 'zod';
import { prisma } from '@/server/db';
import { handle, parseBody, ok, fail, clientIp, startSession } from '@/server/http';
import { rateLimit } from '@/server/rateLimit';
import { writeAudit } from '@/server/audit';
import { Currency } from '@/server/schemas';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';

const SignupBody = z.object({
  email: z.email('Invalid email address format').max(254),
  password: z.string().min(8, 'Password must be at least 8 characters long').max(128),
  name: z.string().trim().min(1).max(100).optional(),
  preferredCurrency: Currency.default('USD'),
});

export const POST = handle(async (request) => {
  const { email: rawEmail, password, name: rawName, preferredCurrency } = await parseBody(request, SignupBody);
  const email = rawEmail.trim().toLowerCase();
  const name = (rawName || email.split('@')[0] || 'Pilot').trim();

  await rateLimit('signup:ip', [clientIp(request)], 3, 60 * 60);

  const strength = validatePasswordStrength(password);
  if (!strength.valid) return fail('VALIDATION_ERROR', strength.message ?? 'Password is too weak.', 400);

  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return fail('CONFLICT', "We couldn't create an account with these details. If you already have one, sign in instead.", 409);
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { email, name, passwordHash, preferredCurrency, isAiEnabled: false },
      select: { id: true, name: true, email: true },
    });

    // Starter accounts (opening balances; live balances are derived from transactions).
    const starter = [
      { name: 'Primary Checking', institution: 'WealthPilot Reserve', type: 'CHECKING' as const, cents: 250000, mask: '•••• 1001' },
      { name: 'High-Yield Savings', institution: 'WealthPilot Treasury', type: 'SAVINGS' as const, cents: 1000000, mask: '•••• 2002' },
      { name: 'Cash Reserve', institution: 'Cash Wallet', type: 'CASH' as const, cents: 30000, mask: '•••• 3003' },
    ];
    await tx.financialAccount.createMany({
      data: starter.map((a) => ({
        userId: created.id,
        name: a.name,
        institution: a.institution,
        type: a.type,
        currency: preferredCurrency,
        openingBalanceCents: BigInt(a.cents),
        balanceCents: BigInt(a.cents),
        accountNumberMask: a.mask,
      })),
    });

    await writeAudit(tx, created.id, 'USER_REGISTERED', 'account created');
    return created;
  });

  const response = ok({ user }, 201);
  response.headers.set('Set-Cookie', await startSession(user.id));
  return response;
});
