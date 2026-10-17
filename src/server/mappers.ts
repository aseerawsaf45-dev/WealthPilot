/**
 * WealthPilot — DB row → client type mappers + pure derived values.
 *
 * The UI keeps its existing types (src/types/finance.ts); everything the server
 * derives (balances, budget spend, bill state) is computed here so it can be unit-tested.
 */

import type {
  FinancialAccount as DbAccount,
  Transaction as DbTransaction,
  TransactionSplit as DbSplit,
  BudgetCategory as DbBudget,
  SavingsGoal as DbGoal,
  BillSubscription as DbBill,
  DebtAccount as DbDebt,
  AuditEvent as DbAudit,
} from '@prisma/client';
import type {
  FinancialAccount,
  Transaction,
  BudgetCategory,
  SavingsGoal,
  BillSubscription,
  DebtAccount,
  AuditEvent,
  AccountType,
  GoalPlanSnapshot,
} from '@/types/finance';

/** BigInt minor units → JSON-safe number (throws rather than losing precision). */
export function cents(value: bigint): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new RangeError('Amount exceeds safe integer range');
  return n;
}

/** YYYY-MM-DD for "now" in the user's IANA timezone (falls back to UTC on a bad zone). */
export function todayIn(timezone: string, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const SOURCE_TO_CLIENT = { MANUAL: 'manual', CSV_IMPORT: 'csv_import', BANK_FEED: 'provider_sync', DEMO: 'demo' } as const;

export function toClientAccount(row: DbAccount, txSumCents: bigint): FinancialAccount {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    institution: row.institution,
    type: row.type.toLowerCase() as AccountType,
    currency: row.currency,
    balanceCents: cents(row.openingBalanceCents + txSumCents), // derived, never stored
    accountNumberMask: row.accountNumberMask,
    isManual: row.isManual,
    lastSyncedAt: row.lastSyncedAt.toISOString(),
    isIncludedInNetWorth: row.isIncludedInNetWorth,
  };
}

export function toClientTransaction(row: DbTransaction & { splits?: DbSplit[] }): Transaction {
  return {
    id: row.id,
    userId: row.userId,
    accountId: row.accountId,
    financialDate: row.financialDate,
    postedAt: row.postedAt.toISOString(),
    merchant: row.merchant,
    normalizedMerchant: row.normalizedMerchant,
    category: row.category,
    amountCents: cents(row.amountCents),
    currency: row.currency,
    status: row.status === 'VOID' ? 'cleared' : (row.status.toLowerCase() as Transaction['status']),
    notes: row.notes ?? undefined,
    tags: row.tags,
    isTransfer: row.isTransfer,
    transferPairId: row.linkedTransferId ?? undefined,
    splits: row.splits?.length
      ? row.splits.map((s) => ({ id: s.id, category: s.category, amountCents: cents(s.amountCents), note: s.note ?? undefined }))
      : undefined,
    source: SOURCE_TO_CLIENT[row.source],
    // importFingerprint stays server-side: the client recomputes its own preview fingerprint.
  };
}

/**
 * Spend per category for one month: expenses only, transfers and VOID rows excluded,
 * split rows counted under their own categories.
 */
export function spendByCategory(
  txs: Array<{ financialDate: string; amountCents: number; category: string; isTransfer: boolean; splits?: { category: string; amountCents: number }[] }>,
  monthYear: string
): Map<string, number> {
  const spent = new Map<string, number>();
  for (const t of txs) {
    if (t.isTransfer || !t.financialDate.startsWith(monthYear)) continue;
    const parts = t.splits?.length ? t.splits : [{ category: t.category, amountCents: t.amountCents }];
    for (const p of parts) {
      if (p.amountCents < 0) spent.set(p.category, (spent.get(p.category) ?? 0) - p.amountCents);
    }
  }
  return spent;
}

export function toClientBudget(row: DbBudget, spentCents: number): BudgetCategory {
  return {
    id: row.id,
    category: row.category,
    allocatedCents: cents(row.allocatedCents),
    spentCents,
    period: 'monthly',
    rolloverEnabled: row.rolloverEnabled,
    rolloverCents: 0, // shortcut: rollover amounts aren't computed yet; add when month-to-month budgets ship
    alertThresholdPercent: row.alertThresholdPercent,
  };
}

export function toClientGoal(row: DbGoal): SavingsGoal {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    targetCents: cents(row.targetCents),
    currentCents: cents(row.currentCents),
    targetDate: row.targetDate ?? undefined,
    priority: row.priority as SavingsGoal['priority'],
    category: row.category,
    isPaused: row.isPaused,
    createdAt: row.createdAt.toISOString(),
    // Written only by saveGoalPlan with the GoalPlanSnapshot shape.
    plan: (row.plan as unknown as GoalPlanSnapshot | null) ?? undefined,
    planUpdatedAt: row.planUpdatedAt?.toISOString(),
  };
}

/** Bill state derived at read time in the user's timezone (no cron). */
export function billState(nextDueDate: string, storedStatus: string, today: string): BillSubscription['status'] {
  if (storedStatus === 'paused') return 'paused';
  if (nextDueDate < today) return 'overdue';
  if (nextDueDate <= addDays(today, 7)) return 'due_soon';
  return 'active';
}

export function toClientBill(row: DbBill, today: string): BillSubscription {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    amountCents: cents(row.amountCents),
    // BIWEEKLY has no client label yet; show it as weekly rather than drop the bill.
    frequency: (row.frequency === 'BIWEEKLY' ? 'weekly' : row.frequency.toLowerCase()) as BillSubscription['frequency'],
    nextDueDate: row.nextDueDate,
    category: row.category,
    accountId: row.accountId ?? '',
    isAutoPay: row.isAutoPay,
    status: billState(row.nextDueDate, row.status, today),
    confidence: 'confirmed',
  };
}

export function toClientDebt(row: DbDebt): DebtAccount {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    balanceCents: cents(row.balanceCents),
    aprPercent: row.aprPercent,
    minimumPaymentCents: cents(row.minimumPaymentCents),
    dueDateDay: row.dueDateDay,
    category: row.category as DebtAccount['category'],
  };
}

export function toClientAudit(row: DbAudit): AuditEvent {
  return {
    id: row.id,
    userId: row.userId ?? '',
    timestamp: row.createdAt.toISOString(),
    action: row.eventType,
    entityType: row.actor.toLowerCase(),
    entityId: row.id,
    details: row.details,
    ipAddressMask: 'not stored',
  };
}
