/**
 * WealthPilot — Planning repository: budgets, goals, bills, debts.
 * Every function takes the session userId first and scopes every query by it.
 */

import type { z } from 'zod';
import type { BillFrequency } from '@prisma/client';
import { prisma } from '../db';
import { writeAudit } from '../audit';
import { HttpError } from '../http';
import { cents, spendByCategory, toClientBudget, toClientGoal, toClientBill, toClientDebt } from '../mappers';
import { BudgetInput, BudgetPatch, GoalInput, GoalPatch, BillInput, DebtInput, DebtPatch } from '../schemas';

const notFound = (what: string) => new HttpError('NOT_FOUND', `${what} not found.`, 404);

// ---- Budgets ----------------------------------------------------------------

async function monthSpend(userId: string, month: string) {
  const txs = await prisma.transaction.findMany({
    where: { userId, status: { not: 'VOID' }, isTransfer: false, financialDate: { startsWith: month } },
    select: { financialDate: true, amountCents: true, category: true, isTransfer: true, splits: { select: { category: true, amountCents: true } } },
  });
  return spendByCategory(
    txs.map((t) => ({ ...t, amountCents: cents(t.amountCents), splits: t.splits.map((s) => ({ category: s.category, amountCents: cents(s.amountCents) })) })),
    month
  );
}

// shortcut: budgets are per calendar month with no carry-forward; a new month starts empty until rollover ships.
export async function listBudgets(userId: string, month: string) {
  const [rows, spent] = await Promise.all([
    prisma.budgetCategory.findMany({ where: { userId, monthYear: month }, orderBy: { createdAt: 'asc' } }),
    monthSpend(userId, month),
  ]);
  return rows.map((r) => toClientBudget(r, spent.get(r.category) ?? 0));
}

/** Upsert by (category, month). */
export async function upsertBudget(userId: string, month: string, input: z.infer<typeof BudgetInput>) {
  const data = {
    allocatedCents: BigInt(input.allocatedCents),
    rolloverEnabled: input.rolloverEnabled,
    alertThresholdPercent: input.alertThresholdPercent,
  };
  const row = await prisma.$transaction(async (tx) => {
    const saved = await tx.budgetCategory.upsert({
      where: { userId_category_monthYear: { userId, category: input.category, monthYear: month } },
      create: { userId, category: input.category, monthYear: month, ...data },
      update: data,
    });
    await writeAudit(tx, userId, 'BUDGET_SAVED', `budget=${saved.id} month=${month}`);
    return saved;
  });
  return toClientBudget(row, (await monthSpend(userId, month)).get(row.category) ?? 0);
}

export async function patchBudget(userId: string, id: string, patch: z.infer<typeof BudgetPatch>) {
  const existing = await prisma.budgetCategory.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) throw notFound('Budget');
  const row = await prisma.$transaction(async (tx) => {
    const saved = await tx.budgetCategory.update({
      where: { id },
      data: {
        allocatedCents: patch.allocatedCents === undefined ? undefined : BigInt(patch.allocatedCents),
        rolloverEnabled: patch.rolloverEnabled,
        alertThresholdPercent: patch.alertThresholdPercent,
      },
    });
    await writeAudit(tx, userId, 'BUDGET_UPDATED', `budget=${id}`);
    return saved;
  });
  return toClientBudget(row, (await monthSpend(userId, row.monthYear)).get(row.category) ?? 0);
}

// ---- Goals ------------------------------------------------------------------

export async function listGoals(userId: string) {
  return (await prisma.savingsGoal.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })).map(toClientGoal);
}

export async function createGoal(userId: string, input: z.infer<typeof GoalInput>) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.savingsGoal.create({
      data: {
        userId,
        name: input.name,
        targetCents: BigInt(input.targetCents),
        currentCents: BigInt(input.currentCents),
        targetDate: input.targetDate ?? null,
        category: input.category,
        priority: input.priority,
        isPaused: input.isPaused,
      },
    });
    await writeAudit(tx, userId, 'GOAL_CREATED', `goal=${row.id}`);
    return toClientGoal(row);
  });
}

export async function patchGoal(userId: string, id: string, patch: z.infer<typeof GoalPatch>) {
  const existing = await prisma.savingsGoal.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) throw notFound('Goal');
  return prisma.$transaction(async (tx) => {
    const row = await tx.savingsGoal.update({
      where: { id },
      data: {
        name: patch.name,
        targetCents: patch.targetCents === undefined ? undefined : BigInt(patch.targetCents),
        currentCents: patch.currentCents === undefined ? undefined : BigInt(patch.currentCents),
        targetDate: patch.targetDate,
        category: patch.category,
        priority: patch.priority,
        isPaused: patch.isPaused,
      },
    });
    await writeAudit(tx, userId, 'GOAL_UPDATED', `goal=${id} fields=${Object.keys(patch).join(',')}`);
    return toClientGoal(row);
  });
}

// ---- Bills ------------------------------------------------------------------

export async function listBills(userId: string, today: string) {
  const rows = await prisma.billSubscription.findMany({ where: { userId }, orderBy: { nextDueDate: 'asc' } });
  return rows.map((r) => toClientBill(r, today));
}

export async function createBill(userId: string, input: z.infer<typeof BillInput>, today: string) {
  let accountId: string | null = null;
  if (input.accountId) {
    const account = await prisma.financialAccount.findFirst({ where: { id: input.accountId, userId }, select: { id: true } });
    if (!account) throw notFound('Account');
    accountId = account.id;
  }
  return prisma.$transaction(async (tx) => {
    const row = await tx.billSubscription.create({
      data: {
        userId,
        name: input.name,
        amountCents: BigInt(input.amountCents),
        frequency: input.frequency.toUpperCase() as BillFrequency,
        nextDueDate: input.nextDueDate,
        category: input.category,
        isAutoPay: input.isAutoPay,
        accountId,
        status: input.status,
      },
    });
    await writeAudit(tx, userId, 'BILL_CREATED', `bill=${row.id}`);
    return toClientBill(row, today);
  });
}

// ---- Debts ------------------------------------------------------------------

export async function listDebts(userId: string) {
  return (await prisma.debtAccount.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })).map(toClientDebt);
}

export async function createDebt(userId: string, input: z.infer<typeof DebtInput>) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.debtAccount.create({
      data: {
        userId,
        name: input.name,
        balanceCents: BigInt(input.balanceCents),
        aprPercent: input.aprPercent,
        minimumPaymentCents: BigInt(input.minimumPaymentCents),
        dueDateDay: input.dueDateDay,
        category: input.category,
      },
    });
    await writeAudit(tx, userId, 'DEBT_CREATED', `debt=${row.id}`);
    return toClientDebt(row);
  });
}

export async function patchDebt(userId: string, id: string, patch: z.infer<typeof DebtPatch>) {
  const existing = await prisma.debtAccount.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) throw notFound('Debt');
  return prisma.$transaction(async (tx) => {
    const row = await tx.debtAccount.update({
      where: { id },
      data: {
        name: patch.name,
        balanceCents: patch.balanceCents === undefined ? undefined : BigInt(patch.balanceCents),
        aprPercent: patch.aprPercent,
        minimumPaymentCents: patch.minimumPaymentCents === undefined ? undefined : BigInt(patch.minimumPaymentCents),
        dueDateDay: patch.dueDateDay,
        category: patch.category,
      },
    });
    await writeAudit(tx, userId, 'DEBT_UPDATED', `debt=${id}`);
    return toClientDebt(row);
  });
}
