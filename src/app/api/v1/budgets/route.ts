/**
 * WealthPilot — Budgets. GET /api/v1/budgets?month=YYYY-MM · PUT upserts by category for the current month
 */

import { authed, parseBody, ok, HttpError } from '@/server/http';
import { BudgetInput, monthYear } from '@/server/schemas';
import { listBudgets, upsertBudget } from '@/server/repos/planning';
import { userToday } from '@/server/repos/user';

export const GET = authed(async (request, { userId }) => {
  const month = request.nextUrl.searchParams.get('month') ?? (await userToday(userId)).slice(0, 7);
  if (!monthYear.safeParse(month).success) throw new HttpError('VALIDATION_ERROR', 'month: Use YYYY-MM', 400);
  return ok(await listBudgets(userId, month));
});

export const PUT = authed(async (request, { userId }) => {
  const input = await parseBody(request, BudgetInput);
  return ok(await upsertBudget(userId, (await userToday(userId)).slice(0, 7), input));
});
