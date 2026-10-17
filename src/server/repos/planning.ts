/**
 * WealthPilot — Planning repository: budgets, goals, bills, debts.
 * Every function takes the session userId first and scopes every query by it.
 */

import type { z } from 'zod';
import type { BillFrequency } from '@prisma/client';
import { prisma } from '../db';
import { writeAudit } from '../audit';
import { HttpError } from '../http';
import { cents, addDays, spendByCategory, toClientBudget, toClientGoal, toClientBill, toClientDebt, toClientTransaction } from '../mappers';
import { BudgetInput, BudgetPatch, GoalInput, GoalPatch, BillInput, BillPatch, BillPayInput, DebtInput, DebtPatch } from '../schemas';

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

// ---- Deletes, contributions, bill edits and payments -------------------------

export async function deleteBudget(userId: string, id: string) {
  const existing = await prisma.budgetCategory.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) throw notFound('Budget');
  await prisma.$transaction(async (tx) => {
    await tx.budgetCategory.delete({ where: { id } });
    await writeAudit(tx, userId, 'BUDGET_DELETED', `budget=${id}`);
  });
  return { id };
}

export async function deleteGoal(userId: string, id: string) {
  const existing = await prisma.savingsGoal.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) throw notFound('Goal');
  await prisma.$transaction(async (tx) => {
    await tx.savingsGoal.delete({ where: { id } });
    await writeAudit(tx, userId, 'GOAL_DELETED', `goal=${id}`);
  });
  return { id };
}

/** Atomic add/withdraw; never below zero. shortcut: history lives in the audit log, not a GoalContribution table. */
export async function contributeToGoal(userId: string, id: string, amountCents: number) {
  return prisma.$transaction(async (tx) => {
    const goal = await tx.savingsGoal.findFirst({ where: { id, userId }, select: { currentCents: true } });
    if (!goal) throw notFound('Goal');
    if (goal.currentCents + BigInt(amountCents) < BigInt(0)) {
      throw new HttpError('VALIDATION_ERROR', 'You cannot withdraw more than is saved in this goal.', 400);
    }
    const row = await tx.savingsGoal.update({ where: { id }, data: { currentCents: { increment: BigInt(amountCents) } } });
    await writeAudit(tx, userId, amountCents > 0 ? 'GOAL_CONTRIBUTION' : 'GOAL_WITHDRAWAL', `goal=${id}`);
    return toClientGoal(row);
  });
}

async function ownedAccountId(userId: string, accountId: string | undefined): Promise<string | null | undefined> {
  if (accountId === undefined) return undefined;
  if (accountId === '') return null;
  const account = await prisma.financialAccount.findFirst({ where: { id: accountId, userId }, select: { id: true } });
  if (!account) throw notFound('Account');
  return account.id;
}

export async function patchBill(userId: string, id: string, patch: z.infer<typeof BillPatch>, today: string) {
  const existing = await prisma.billSubscription.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) throw notFound('Bill');
  const accountId = await ownedAccountId(userId, patch.accountId);
  return prisma.$transaction(async (tx) => {
    const row = await tx.billSubscription.update({
      where: { id },
      data: {
        name: patch.name,
        amountCents: patch.amountCents === undefined ? undefined : BigInt(patch.amountCents),
        frequency: patch.frequency ? (patch.frequency.toUpperCase() as BillFrequency) : undefined,
        nextDueDate: patch.nextDueDate,
        category: patch.category,
        accountId,
        isAutoPay: patch.isAutoPay,
        status: patch.status,
      },
    });
    await writeAudit(tx, userId, 'BILL_UPDATED', `bill=${id} fields=${Object.keys(patch).join(',')}`);
    return toClientBill(row, today);
  });
}

export async function deleteBill(userId: string, id: string) {
  const existing = await prisma.billSubscription.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) throw notFound('Bill');
  await prisma.$transaction(async (tx) => {
    await tx.billSubscription.delete({ where: { id } });
    await writeAudit(tx, userId, 'BILL_DELETED', `bill=${id}`);
  });
  return { id };
}

/** Next due date after `ymd` for a frequency. Month steps clamp to the month's last day (Jan 31 -> Feb 28). */
export function nextDueAfter(ymd: string, frequency: BillFrequency): string {
  if (frequency === 'WEEKLY') return addDays(ymd, 7);
  if (frequency === 'BIWEEKLY') return addDays(ymd, 14);
  const months = frequency === 'MONTHLY' ? 1 : frequency === 'QUARTERLY' ? 3 : 12;
  const [y, m, d] = ymd.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  // shortcut: a clamped date stays clamped (Jan 31 -> Feb 28 -> Mar 28); store the original day if users notice.
  return new Date(Date.UTC(y, m - 1 + months, Math.min(d, lastDay))).toISOString().slice(0, 10);
}

/**
 * Mark the bill due on `dueDate` as paid: advances nextDueDate and, if the bill has a payment
 * account, records the expense, all in one transaction. The conditional update on nextDueDate
 * makes it idempotent: a double click or a second tab gets 409 instead of a second payment.
 */
export async function payBill(userId: string, id: string, input: z.infer<typeof BillPayInput>, today: string) {
  const bill = await prisma.billSubscription.findFirst({ where: { id, userId } });
  if (!bill) throw notFound('Bill');

  const result = await prisma.$transaction(async (tx) => {
    const { count } = await tx.billSubscription.updateMany({
      where: { id, userId, nextDueDate: input.dueDate },
      data: { nextDueDate: nextDueAfter(input.dueDate, bill.frequency) },
    });
    if (!count) throw new HttpError('CONFLICT', 'This bill was already marked as paid.', 409);

    let transactionId: string | null = null;
    if (input.recordTransaction && bill.accountId && bill.amountCents > BigInt(0)) {
      const account = await tx.financialAccount.findFirst({ where: { id: bill.accountId, userId }, select: { currency: true } });
      if (account) {
        const created = await tx.transaction.create({
          data: {
            userId,
            accountId: bill.accountId,
            financialDate: today,
            merchant: bill.name,
            normalizedMerchant: bill.name.trim(),
            category: bill.category,
            amountCents: -bill.amountCents,
            currency: account.currency,
            source: 'MANUAL',
            notes: `Bill payment (due ${input.dueDate})`,
            tags: ['bill_payment'],
          },
          select: { id: true },
        });
        transactionId = created.id;
      }
    }
    await writeAudit(tx, userId, 'BILL_PAID', `bill=${id}${transactionId ? ` transaction=${transactionId}` : ''}`);
    return { transactionId, row: await tx.billSubscription.findUniqueOrThrow({ where: { id } }) };
  });

  const transaction = result.transactionId
    ? await prisma.transaction.findFirst({ where: { id: result.transactionId, userId }, include: { splits: true } })
    : null;
  return { bill: toClientBill(result.row, today), transaction: transaction ? toClientTransaction(transaction) : null, accountId: bill.accountId };
}

export async function deleteDebt(userId: string, id: string) {
  const existing = await prisma.debtAccount.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) throw notFound('Debt');
  await prisma.$transaction(async (tx) => {
    await tx.debtAccount.delete({ where: { id } });
    await writeAudit(tx, userId, 'DEBT_DELETED', `debt=${id}`);
  });
  return { id };
}
