/**
 * WealthPilot — Current User Profile API (`/api/v1/auth/me`)
 * 
 * Returns the currently authenticated user's profile and multi-tenant ledger statistics.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { getSessionFromRequest } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json(
        { authenticated: false, user: null },
        { status: 200 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        name: true,
        email: true,
        preferredCurrency: true,
        timezone: true,
        isAiEnabled: true,
        createdAt: true,
        _count: {
          select: {
            accounts: true,
            transactions: true,
            budgets: true,
            savingsGoals: true,
            bills: true,
            debts: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { authenticated: false, user: null },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        authenticated: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          preferredCurrency: user.preferredCurrency,
          timezone: user.timezone,
          isAiEnabled: user.isAiEnabled,
          createdAt: user.createdAt,
          counts: user._count,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Failed to retrieve session';
    return NextResponse.json(
      { authenticated: false, error: errMessage },
      { status: 500 }
    );
  }
}
