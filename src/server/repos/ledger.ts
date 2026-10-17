/**
 * WealthPilot — Ledger repository: accounts, transactions, CSV import.
 * Every function takes the session userId first and scopes every query by it.
 * Balances are derived (opening + SUM of non-VOID transactions), never written.
 */

import crypto from 'crypto';
import type { z } from 'zod';
import { prisma } from '../db';
import { writeAudit, sha256 } from '../audit';
import { HttpError } from '../http';
import { toClientAccount, toClientTransaction } from '../mappers';
import { AccountInput, AccountPatch, TransactionInput, TransactionPatch, ImportRow } from '../schemas';
import { autoCategorizeMerchant } from '@/services/financeService';
import { assertSoxSplitPreservation } from '@/lib/compliance/soxCompliance';
import type { AccountType as DbAccountType, TransactionStatus } from '@prisma/client';

const LIVE = { not: 'VOID' as TransactionStatus };
const notFound = (what: string) => new HttpError('NOT_FOUND', `${what} not found.`, 404);

export async function listAccounts(userId: string) {
  const [rows, sums] = await Promise.all([
    prisma.financialAccount.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.transaction.groupBy({ by: ['accountId'], where: { userId, status: LIVE }, _sum: { amountCents: true } }),
  ]);
  const sumById = new Map(sums.map((s) => [s.accountId, s._sum.amountCents ?? BigInt(0)]));
  return rows.map((r) => toClientAccount(r, sumById.get(r.id) ?? BigInt(0)));
}

async function accountWithBalance(userId: string, accountId: string) {
  const [row, agg] = await Promise.all([
    prisma.financialAccount.findFirst({ where: { id: accountId, userId } }),
    prisma.transaction.aggregate({ where: { userId, accountId, status: LIVE }, _sum: { amountCents: true } }),
  ]);
  return row ? toClientAccount(row, agg._sum.amountCents ?? BigInt(0)) : null;
}

export async function createAccount(userId: string, input: z.infer<typeof AccountInput>) {
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.financialAccount.create({
      data: {
        userId,
        name: input.name,
        institution: input.institution,
        type: input.type.toUpperCase() as DbAccountType,
        currency: input.currency,
        openingBalanceCents: BigInt(input.balanceCents),
        balanceCents: BigInt(input.balanceCents),
        accountNumberMask: input.accountNumberMask,
        isManual: true,
        isIncludedInNetWorth: input.isIncludedInNetWorth,
      },
    });
    await writeAudit(tx, userId, 'ACCOUNT_CREATED', `account=${created.id} type=${created.type}`);
    return created;
  });
  return toClientAccount(row, BigInt(0));
}

export async function patchAccount(userId: string, id: string, patch: z.infer<typeof AccountPatch>) {
  const existing = await prisma.financialAccount.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) throw notFound('Account');

  // Balances are derived, so "set balance to X" means opening = X − SUM(live transactions).
  let openingBalanceCents: bigint | undefined;
  if (patch.balanceCents !== undefined) {
    const agg = await prisma.transaction.aggregate({ where: { userId, accountId: id, status: LIVE }, _sum: { amountCents: true } });
    openingBalanceCents = BigInt(patch.balanceCents) - (agg._sum.amountCents ?? BigInt(0));
  }

  await prisma.$transaction(async (tx) => {
    await tx.financialAccount.update({
      where: { id },
      data: {
        name: patch.name,
        institution: patch.institution,
        type: patch.type ? (patch.type.toUpperCase() as DbAccountType) : undefined,
        accountNumberMask: patch.accountNumberMask,
        isIncludedInNetWorth: patch.isIncludedInNetWorth,
        openingBalanceCents,
        balanceCents: patch.balanceCents === undefined ? undefined : BigInt(patch.balanceCents),
      },
    });
    await writeAudit(tx, userId, 'ACCOUNT_UPDATED', `account=${id} fields=${Object.keys(patch).join(',')}`);
  });
  return accountWithBalance(userId, id);
}

/**
 * Deleting an account deletes its transactions (FK cascade), so it is refused with 409 while
 * live transactions exist unless the caller confirmed with cascade=true. Bills keep existing
 * with no payment account (FK SetNull).
 */
export async function deleteAccount(userId: string, id: string, cascade: boolean) {
  const existing = await prisma.financialAccount.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) throw notFound('Account');
  const liveCount = await prisma.transaction.count({ where: { userId, accountId: id, status: LIVE } });
  if (liveCount > 0 && !cascade) {
    throw new HttpError('CONFLICT', `This account has ${liveCount} transactions. Deleting it also deletes them.`, 409);
  }
  await prisma.$transaction(async (tx) => {
    await tx.financialAccount.delete({ where: { id } });
    await writeAudit(tx, userId, 'ACCOUNT_DELETED', `account=${id} transactions=${liveCount}`);
  });
  return { id, deletedTransactions: liveCount };
}

async function userRules(userId: string) {
  const rules = await prisma.merchantRule.findMany({ where: { userId }, select: { normalizedMerchant: true, category: true } });
  return rules.map((r) => ({ keyword: r.normalizedMerchant, category: r.category }));
}

function pickCategory(category: string | undefined, merchant: string, rules: { keyword: string; category: string }[]) {
  return !category || category === 'General' || category === 'Uncategorized' ? autoCategorizeMerchant(merchant, rules) : category;
}

export async function listTransactions(userId: string, take = 2000) {
  const rows = await prisma.transaction.findMany({
    where: { userId, status: LIVE },
    include: { splits: true },
    orderBy: [{ financialDate: 'desc' }, { id: 'desc' }],
    take, // shortcut: bootstrap returns the newest 2,000 rows; add cursor pagination (/transactions?cursor) past that
  });
  return rows.map(toClientTransaction);
}

export async function createTransaction(userId: string, input: z.infer<typeof TransactionInput>) {
  const account = await prisma.financialAccount.findFirst({ where: { id: input.accountId, userId }, select: { id: true, currency: true } });
  if (!account) throw notFound('Account');

  const category = pickCategory(input.category, input.merchant, await userRules(userId));
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.transaction.create({
      data: {
        userId,
        accountId: account.id,
        financialDate: input.financialDate,
        merchant: input.merchant,
        normalizedMerchant: input.merchant.trim(),
        category,
        amountCents: BigInt(input.amountCents),
        currency: account.currency,
        status: input.status.toUpperCase() as TransactionStatus,
        isTransfer: input.isTransfer,
        source: 'MANUAL', // no importFingerprint on manual rows
        notes: input.notes || null,
        tags: input.tags,
      },
      include: { splits: true },
    });
    await writeAudit(tx, userId, 'TRANSACTION_CREATED', `transaction=${created.id}`);
    return created;
  });
  return { transaction: toClientTransaction(row), account: await accountWithBalance(userId, account.id) };
}

export async function updateTransaction(userId: string, id: string, patch: z.infer<typeof TransactionPatch>) {
  const existing = await prisma.transaction.findFirst({ where: { id, userId, status: LIVE }, include: { splits: true } });
  if (!existing) throw notFound('Transaction');

  const moved = patch.accountId !== undefined && patch.accountId !== existing.accountId;
  if (moved) {
    const target = await prisma.financialAccount.findFirst({ where: { id: patch.accountId, userId }, select: { id: true } });
    if (!target) throw notFound('Account');
  }

  const amountCents = patch.amountCents ?? Number(existing.amountCents);
  if (patch.splits?.length) {
    const check = assertSoxSplitPreservation(amountCents, patch.splits);
    if (!check.compliant) throw new HttpError('VALIDATION_ERROR', 'Split amounts must add up exactly to the transaction amount.', 400);
  } else if (patch.amountCents !== undefined && existing.splits.length && patch.splits === undefined) {
    throw new HttpError('VALIDATION_ERROR', 'This transaction is split. Update the splits together with the amount.', 400);
  }

  const row = await prisma.$transaction(async (tx) => {
    if (patch.splits) {
      await tx.transactionSplit.deleteMany({ where: { transactionId: id } });
      if (patch.splits.length) {
        await tx.transactionSplit.createMany({
          data: patch.splits.map((s) => ({ transactionId: id, category: s.category, amountCents: BigInt(s.amountCents), note: s.note || null })),
        });
      }
    }
    const updated = await tx.transaction.update({
      where: { id },
      data: {
        accountId: moved ? patch.accountId : undefined,
        financialDate: patch.financialDate,
        merchant: patch.merchant,
        normalizedMerchant: patch.merchant?.trim(),
        category: patch.category,
        amountCents: patch.amountCents === undefined ? undefined : BigInt(patch.amountCents),
        status: patch.status ? (patch.status.toUpperCase() as TransactionStatus) : undefined,
        notes: patch.notes,
        tags: patch.tags,
        isTransfer: patch.isTransfer,
      },
      include: { splits: true },
    });
    await writeAudit(tx, userId, 'TRANSACTION_UPDATED', `transaction=${id} fields=${Object.keys(patch).join(',')}`);
    return updated;
  });
  return {
    transaction: toClientTransaction(row),
    account: await accountWithBalance(userId, row.accountId),
    previousAccount: moved ? await accountWithBalance(userId, existing.accountId) : null,
  };
}

/** Delete = VOID (audit trail kept; derived balance updates automatically). */
export async function voidTransaction(userId: string, id: string) {
  const existing = await prisma.transaction.findFirst({ where: { id, userId, status: LIVE }, select: { accountId: true } });
  if (!existing) throw notFound('Transaction');
  await prisma.$transaction(async (tx) => {
    await tx.transaction.update({ where: { id }, data: { status: 'VOID', importFingerprint: null } });
    await writeAudit(tx, userId, 'TRANSACTION_VOIDED', `transaction=${id}`);
  });
  return { id, account: await accountWithBalance(userId, existing.accountId) };
}

/**
 * sha256(date|merchant|amount|occurrence-in-file). The occurrence index keeps two identical
 * coffees on one day distinct, while re-importing the same file maps onto the same fingerprints.
 */
export function importFingerprints(rows: { financialDate: string; merchant: string; amountCents: number }[]): string[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const key = `${r.financialDate}|${r.merchant.trim().toLowerCase()}|${r.amountCents}`;
    const occurrence = seen.get(key) ?? 0;
    seen.set(key, occurrence + 1);
    return sha256(`${key}|${occurrence}`);
  });
}

export async function importTransactions(userId: string, accountId: string, rawRows: unknown[]) {
  const account = await prisma.financialAccount.findFirst({ where: { id: accountId, userId }, select: { id: true, currency: true } });
  if (!account) throw notFound('Account');

  const valid: z.infer<typeof ImportRow>[] = [];
  const rejected: { index: number; message: string }[] = [];
  rawRows.forEach((raw, index) => {
    const parsed = ImportRow.safeParse(raw);
    if (parsed.success) valid.push(parsed.data);
    else rejected.push({ index, message: parsed.error.issues[0]?.message ?? 'Invalid row' });
  });

  const rules = await userRules(userId);
  const fingerprints = importFingerprints(valid);
  const batchId = crypto.randomUUID();

  const inserted = await prisma.$transaction(async (tx) => {
    const result = valid.length
      ? await tx.transaction.createMany({
          data: valid.map((r, i) => ({
            userId,
            accountId: account.id,
            financialDate: r.financialDate,
            merchant: r.merchant,
            normalizedMerchant: r.merchant.trim(),
            category: pickCategory(r.category, r.merchant, rules),
            amountCents: BigInt(r.amountCents),
            currency: account.currency,
            status: 'CLEARED' as TransactionStatus,
            source: 'CSV_IMPORT' as const,
            importFingerprint: fingerprints[i],
            importBatchId: batchId,
            notes: r.notes || null,
            tags: ['csv_import'],
          })),
          skipDuplicates: true, // @@unique([userId, importFingerprint])
        })
      : { count: 0 };
    await writeAudit(tx, userId, 'CSV_IMPORTED', `batch=${batchId} inserted=${result.count} rejected=${rejected.length}`);
    return result.count;
  });

  const rows = await prisma.transaction.findMany({ where: { userId, importBatchId: batchId }, include: { splits: true } });
  return {
    batchId,
    inserted,
    duplicates: valid.length - inserted,
    rejected,
    transactions: rows.map(toClientTransaction),
    account: await accountWithBalance(userId, account.id),
  };
}

export async function rollbackImport(userId: string, batchId: string) {
  const rows = await prisma.transaction.findMany({ where: { userId, importBatchId: batchId, status: LIVE }, select: { id: true } });
  if (!rows.length) throw notFound('Import batch');
  const ids = rows.map((r) => r.id);
  await prisma.$transaction(async (tx) => {
    // NULL the fingerprint so the same file can be imported again later.
    await tx.transaction.updateMany({ where: { userId, id: { in: ids } }, data: { status: 'VOID', importFingerprint: null } });
    await writeAudit(tx, userId, 'IMPORT_ROLLED_BACK', `batch=${batchId} voided=${ids.length}`);
  });
  return { voidedIds: ids, accounts: await listAccounts(userId) };
}
