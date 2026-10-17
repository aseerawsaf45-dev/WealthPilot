/**
 * WealthPilot — Loads one user's data for the copilot. The ONLY place the copilot reads the DB.
 * userId comes from the session (route handler); tools then run purely on this snapshot.
 */

import { prisma } from '../db';
import { cents, todayIn, addDays } from '../mappers';
import type { FinanceData } from './tools';
import type { AiConsentState } from './privacy';

export async function loadCopilotContext(userId: string): Promise<{ consent: AiConsentState; data: FinanceData }> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { timezone: true, preferredCurrency: true, isAiEnabled: true, aiConsentAt: true, aiConsentVersion: true, aiProviders: true, region: true },
  });
  const today = todayIn(user.timezone);
  const since = addDays(today, -400); // ≥ 13 months: covers year-to-date and month-over-month comparisons

  const [txs, budgets, goals, bills, debts] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, status: { not: 'VOID' }, financialDate: { gte: since } },
      select: { financialDate: true, amountCents: true, category: true, currency: true, isTransfer: true, merchant: true, splits: { select: { category: true, amountCents: true } } },
      orderBy: { financialDate: 'desc' },
      take: 5000, // shortcut: newest 5,000 rows in the window; aggregate in SQL if users exceed this
    }),
    prisma.budgetCategory.findMany({ where: { userId, monthYear: today.slice(0, 7) }, select: { category: true, allocatedCents: true, alertThresholdPercent: true, monthYear: true } }),
    prisma.savingsGoal.findMany({ where: { userId }, select: { id: true, name: true, targetCents: true, currentCents: true, targetDate: true, isPaused: true } }),
    prisma.billSubscription.findMany({ where: { userId }, select: { name: true, amountCents: true, nextDueDate: true, status: true } }),
    prisma.debtAccount.findMany({ where: { userId }, select: { name: true, balanceCents: true, aprPercent: true, minimumPaymentCents: true } }),
  ]);

  return {
    consent: {
      isAiEnabled: user.isAiEnabled,
      aiConsentAt: user.aiConsentAt,
      aiConsentVersion: user.aiConsentVersion,
      aiProviders: user.aiProviders,
      region: user.region,
    },
    data: {
      today,
      currency: user.preferredCurrency,
      transactions: txs.map((t) => ({
        ...t,
        amountCents: cents(t.amountCents),
        splits: t.splits.map((s) => ({ category: s.category, amountCents: cents(s.amountCents) })),
      })),
      budgets: budgets.map((b) => ({ ...b, allocatedCents: cents(b.allocatedCents) })),
      goals: goals.map((g) => ({ ...g, targetCents: cents(g.targetCents), currentCents: cents(g.currentCents) })),
      bills: bills.map((b) => ({ ...b, amountCents: cents(b.amountCents) })),
      debts: debts.map((d) => ({ ...d, balanceCents: cents(d.balanceCents), minimumPaymentCents: cents(d.minimumPaymentCents) })),
    },
  };
}
