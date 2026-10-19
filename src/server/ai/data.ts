/**
 * WealthPilot — Loads one user's data for the copilot. The ONLY place the copilot reads the DB.
 * userId comes from the session (route handler); tools then run purely on this snapshot.
 */

import { prisma } from '../db';
import { cents, todayIn, addDays } from '../mappers';
import type { FinanceData } from './tools';
import type { AiConsentState } from './privacy';
import { getFxRates } from '../repos/fx';
import { listAccounts } from '../repos/ledger';
import { listPlans, listOffers } from '../repos/wealth';
import { getCountryMacro } from '../repos/macro';
import { convertMinor } from '@/lib/fx';

export async function loadCopilotContext(userId: string): Promise<{ consent: AiConsentState; data: FinanceData }> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { timezone: true, preferredCurrency: true, isAiEnabled: true, aiConsentAt: true, aiConsentVersion: true, aiProviders: true, region: true },
  });
  const today = todayIn(user.timezone);
  const since = addDays(today, -400); // ≥ 13 months: covers year-to-date and month-over-month comparisons

  const [txs, budgets, goals, bills, debts, accounts, fx, investments, loanOffers] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, status: { not: 'VOID' }, financialDate: { gte: since } },
      select: { id: true, financialDate: true, amountCents: true, category: true, currency: true, isTransfer: true, merchant: true, splits: { select: { category: true, amountCents: true } } },
      orderBy: { financialDate: 'desc' },
      take: 5000, // shortcut: newest 5,000 rows in the window; aggregate in SQL if users exceed this
    }),
    prisma.budgetCategory.findMany({ where: { userId, monthYear: today.slice(0, 7) }, select: { id: true, category: true, allocatedCents: true, alertThresholdPercent: true, monthYear: true } }),
    prisma.savingsGoal.findMany({ where: { userId }, select: { id: true, name: true, targetCents: true, currentCents: true, targetDate: true, isPaused: true } }),
    prisma.billSubscription.findMany({ where: { userId }, select: { id: true, name: true, amountCents: true, nextDueDate: true, status: true, frequency: true } }),
    prisma.debtAccount.findMany({ where: { userId }, select: { id: true, name: true, balanceCents: true, aprPercent: true, minimumPaymentCents: true } }),
    listAccounts(userId),
    getFxRates(),
    listPlans(userId),
    listOffers(userId),
  ]);
  // Public country data for the user's plans (and their region), for the investment tools.
  const countries = [...new Set([...investments.map((p) => p.country), ...(user.region && user.region !== 'EU' ? [user.region] : [])])].slice(0, 5);
  const macro = Object.fromEntries(await Promise.all(countries.map(async (c) => [c, await getCountryMacro(c)] as const)));

  // Foreign-currency rows are converted to the preferred currency (an estimate, stated in every answer).
  // Rows with no rate keep their currency and are left out of category totals as before.
  const base = user.preferredCurrency;
  let converted = 0;
  const conv = (amount: bigint, currency: string): { amountCents: number; currency: string } => {
    const n = cents(amount);
    if (currency === base) return { amountCents: n, currency };
    const v = convertMinor(n, currency, base, fx);
    if (v === null) return { amountCents: n, currency };
    converted += 1;
    return { amountCents: v, currency: base };
  };
  // Balances (derived, per account currency) → base currency for runway, forecast and debt ratio.
  let liquidCents = 0;
  let assetsCents = 0;
  let liabilitiesCents = 0;
  for (const a of accounts) {
    const v = a.currency === base ? a.balanceCents : convertMinor(a.balanceCents, a.currency, base, fx);
    if (v === null || !a.isIncludedInNetWorth) continue;
    if (v >= 0) assetsCents += v;
    else liabilitiesCents -= v;
    if (v > 0 && ['checking', 'savings', 'cash'].includes(a.type)) liquidCents += v;
  }

  const transactions = txs.map((t) => {
    const main = conv(t.amountCents, t.currency);
    return {
      ...t,
      ...main,
      splits: t.splits.map((s) => ({ category: s.category, amountCents: conv(s.amountCents, t.currency).amountCents })),
    };
  });

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
      transactions,
      ...(converted && fx ? { fxNote: `Amounts in other currencies were converted to ${base} at the ${fx.day} market rate, so totals that include them are estimates.` } : {}),
      budgets: budgets.map((b) => ({ ...b, allocatedCents: cents(b.allocatedCents) })),
      goals: goals.map((g) => ({ ...g, targetCents: cents(g.targetCents), currentCents: cents(g.currentCents) })),
      bills: bills.map((b) => ({ ...b, amountCents: cents(b.amountCents), frequency: b.frequency.toLowerCase() as 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual' })),
      debts: debts.map((d) => ({ ...d, balanceCents: cents(d.balanceCents), minimumPaymentCents: cents(d.minimumPaymentCents) })),
      accounts: accounts.map((a) => ({ id: a.id, name: a.name })),
      balances: { liquidCents, assetsCents, liabilitiesCents },
      investments,
      loanOffers,
      macro,
      region: user.region,
    },
  };
}
