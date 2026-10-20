/**
 * WealthPilot — Everything the dashboard needs in one round trip. GET /api/v1/bootstrap
 */

import { authed, ok } from '@/server/http';
import { rateLimit } from '@/server/rateLimit';
import { todayIn } from '@/server/mappers';
import { listAccounts, listTransactions } from '@/server/repos/ledger';
import { listBudgets, listGoals, listBills, listDebts } from '@/server/repos/planning';
import { getProfile, listAudit } from '@/server/repos/user';
import { getFxRates } from '@/server/repos/fx';
import { listPlans, listOffers } from '@/server/repos/wealth';

export const GET = authed(async (_request, { userId }) => {
  await rateLimit('bootstrap', [userId], 60, 60);
  const profile = await getProfile(userId);
  const today = todayIn(profile.timezone);
  const [accounts, transactions, budgets, goals, bills, debts, auditLogs, fx, investments, loanOffers] = await Promise.all([
    listAccounts(userId),
    listTransactions(userId),
    listBudgets(userId, today.slice(0, 7)),
    listGoals(userId),
    listBills(userId, today),
    listDebts(userId),
    listAudit(userId),
    getFxRates(),
    listPlans(userId),
    listOffers(userId),
  ]);
  return ok({ preferences: profile.preferences, isAdmin: profile.isAdmin, today, accounts, transactions, budgets, goals, bills, debts, auditLogs, fx, investments, loanOffers });
});
