/**
 * WealthPilot — Account Management & GDPR Article 17 Right to Erasure API
 * 
 * DELETE:
 * - Irrevocably eradicates the user account and all cascaded ledger models:
 *   FinancialAccount, Transaction, TransactionSplit, BudgetCategory, SavingsGoal,
 *   BillSubscription, DebtAccount, CopilotMessage, and AuditEvent.
 * - Complies with GDPR Art. 17 and FINRA Rule 4511 data sanitization.
 * - Clears session cookie and returns cryptographic erasure proof.
 * 
 * PUT:
 * - Updates user profile attributes (name, preferredCurrency, timezone, isAiEnabled, password).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { getSessionFromRequest, buildClearSessionCookieHeader } from '@/lib/auth/session';
import { hashPassword, comparePassword, validatePasswordStrength } from '@/lib/auth/password';
import { verifyCascadingPurgeContract } from '@/lib/compliance/gdprCompliance';

export async function DELETE(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Valid session required to delete account' },
        { status: 401 }
      );
    }

    const userId = session.userId;

    // Verify user exists and count records prior to cascade
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: {
            accounts: true,
            transactions: true,
            budgets: true,
            savingsGoals: true,
            debts: true,
            auditLogs: true,
          },
        },
      },
    });

    if (!user) {
      const response = NextResponse.json(
        { success: true, message: 'Account already removed' },
        { status: 200 }
      );
      response.headers.set('Set-Cookie', buildClearSessionCookieHeader());
      return response;
    }

    const counts = {
      accounts: user._count.accounts,
      transactions: user._count.transactions,
      budgets: user._count.budgets,
      goals: user._count.savingsGoals,
      debts: user._count.debts,
      auditLogs: user._count.auditLogs,
    };

    // Execute cascading deletion in PostgreSQL
    await prisma.user.delete({
      where: { id: userId },
    });

    // Generate GDPR Article 17 Erasure Confirmation
    const erasureConfirmation = verifyCascadingPurgeContract(userId, counts);

    const response = NextResponse.json(
      {
        success: true,
        message: 'User account and all associated financial records permanently eradicated under GDPR Article 17.',
        compliance: 'GDPR_ARTICLE_17_RIGHT_TO_ERASURE',
        erasureConfirmation,
      },
      { status: 200 }
    );

    response.headers.set('Set-Cookie', buildClearSessionCookieHeader());
    return response;
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Account deletion failed';
    return NextResponse.json(
      { success: false, error: errMessage },
      { status: 500 }
    );
  }
}

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  preferredCurrency: z.enum(['USD', 'BDT']).optional(),
  timezone: z.string().optional(),
  isAiEnabled: z.boolean().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
});

export async function PUT(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { name, preferredCurrency, timezone, isAiEnabled, currentPassword, newPassword } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const updateData: {
      name?: string;
      preferredCurrency?: string;
      timezone?: string;
      isAiEnabled?: boolean;
      passwordHash?: string;
    } = {};

    if (name !== undefined) updateData.name = name;
    if (preferredCurrency !== undefined) updateData.preferredCurrency = preferredCurrency;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (isAiEnabled !== undefined) updateData.isAiEnabled = isAiEnabled;

    // Handle password update if requested
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { success: false, error: 'Current password is required to set a new password' },
          { status: 400 }
        );
      }

      const isCurrentValid = user.passwordHash ? await comparePassword(currentPassword, user.passwordHash) : false;
      if (!isCurrentValid) {
        return NextResponse.json(
          { success: false, error: 'Current password verification failed' },
          { status: 401 }
        );
      }

      const strength = validatePasswordStrength(newPassword);
      if (!strength.valid) {
        return NextResponse.json(
          { success: false, error: strength.message },
          { status: 400 }
        );
      }

      updateData.passwordHash = await hashPassword(newPassword);
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        preferredCurrency: true,
        timezone: true,
        isAiEnabled: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Profile updated successfully',
        user: updatedUser,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Update failed';
    return NextResponse.json(
      { success: false, error: errMessage },
      { status: 500 }
    );
  }
}
