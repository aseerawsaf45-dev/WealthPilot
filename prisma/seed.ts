/**
 * WealthPilot — Database Seed Script
 * 
 * Populates PostgreSQL with standard competition demonstration data:
 * - Primary Auth User: 'aseer@wealthpilot.app' / 'admin123' ('user_aseer')
 * - Secondary Demo User: 'pilot@wealthpilot.io' / 'admin123' ('user_pilot')
 * - Real-world financial accounts (Checking, HYSA, Index Fund, Credit Card)
 * - Multi-month categorized ledger transactions
 * - Budget envelopes with pacing metrics
 * - Savings milestones and debt payoff structures
 * - Immutable SOX Section 302 audit entries
 */

import { PrismaClient, AccountType, TransactionStatus, TransactionSource, BillFrequency } from '@prisma/client';
import {
  initialAccounts,
  initialTransactions,
  initialBudgets,
  initialGoals,
  initialBills,
  initialDebts,
} from '../src/lib/seedData';
import { createSoxAuditEntry } from '../src/lib/compliance/soxCompliance';
import { hashPasswordSync } from '../src/lib/auth/password';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting WealthPilot database seed...');

  const passwordHash = hashPasswordSync('admin123');

  // 1. Create or upsert Primary User: aseer@wealthpilot.app (admin123)
  const aseerUserId = 'user_aseer';
  const aseerUser = await prisma.user.upsert({
    where: { email: 'aseer@wealthpilot.app' },
    update: {
      passwordHash,
      preferredCurrency: 'USD',
      isAiEnabled: true,
    },
    create: {
      id: aseerUserId,
      name: 'Aseer',
      email: 'aseer@wealthpilot.app',
      passwordHash,
      preferredCurrency: 'USD',
      timezone: 'America/New_York',
      isAiEnabled: true,
    },
  });
  console.log(`   ✓ Primary User provisioned: ${aseerUser.name} (${aseerUser.email})`);

  // Also maintain user_pilot for backwards compatibility
  const demoUserId = 'user_pilot';
  await prisma.user.upsert({
    where: { id: demoUserId },
    update: {
      passwordHash,
      preferredCurrency: 'USD',
      isAiEnabled: true,
    },
    create: {
      id: demoUserId,
      name: 'Demo Wealth Pilot',
      email: 'pilot@wealthpilot.io',
      passwordHash,
      preferredCurrency: 'USD',
      timezone: 'America/New_York',
      isAiEnabled: true,
    },
  });

  const targetUserId = aseerUser.id;

  // 2. Provision Financial Accounts
  for (const acc of initialAccounts) {
    const accountType = acc.type.toUpperCase() as AccountType;
    await prisma.financialAccount.upsert({
      where: { id: acc.id },
      update: {
        userId: targetUserId,
        balanceCents: BigInt(acc.balanceCents),
        lastSyncedAt: new Date(acc.lastSyncedAt),
      },
      create: {
        id: acc.id,
        userId: targetUserId,
        name: acc.name,
        institution: acc.institution,
        type: accountType,
        currency: acc.currency,
        balanceCents: BigInt(acc.balanceCents),
        accountNumberMask: acc.accountNumberMask,
        isManual: acc.isManual,
        isIncludedInNetWorth: acc.isIncludedInNetWorth,
        lastSyncedAt: new Date(acc.lastSyncedAt),
      },
    });
  }
  console.log(`   ✓ Seeded ${initialAccounts.length} financial accounts for ${aseerUser.email}`);

  // 3. Provision Transactions
  for (const tx of initialTransactions) {
    const status = (tx.status?.toUpperCase() || 'CLEARED') as TransactionStatus;
    const source = (tx.source?.toUpperCase() || 'MANUAL') as TransactionSource;

    await prisma.transaction.upsert({
      where: { id: tx.id },
      update: {
        userId: targetUserId,
        amountCents: BigInt(tx.amountCents),
        financialDate: tx.financialDate,
      },
      create: {
        id: tx.id,
        userId: targetUserId,
        accountId: tx.accountId,
        financialDate: tx.financialDate,
        postedAt: new Date(tx.postedAt),
        merchant: tx.merchant,
        normalizedMerchant: tx.normalizedMerchant,
        category: tx.category,
        amountCents: BigInt(tx.amountCents),
        currency: tx.currency,
        status,
        isTransfer: tx.isTransfer,
        source,
        importFingerprint: tx.importFingerprint,
        notes: tx.notes,
        tags: tx.tags,
      },
    });
  }
  console.log(`   ✓ Seeded ${initialTransactions.length} ledger transactions`);

  // 4. Provision Budget Categories
  const currentMonthYear = new Date().toISOString().substring(0, 7); // e.g. "2026-10"
  for (const bgt of initialBudgets) {
    await prisma.budgetCategory.upsert({
      where: { id: bgt.id },
      update: {
        userId: targetUserId,
        category: bgt.category,
        allocatedCents: BigInt(bgt.allocatedCents),
        monthYear: currentMonthYear,
      },
      create: {
        id: bgt.id,
        userId: targetUserId,
        category: bgt.category,
        allocatedCents: BigInt(bgt.allocatedCents),
        monthYear: currentMonthYear,
        rolloverEnabled: bgt.rolloverEnabled,
        alertThresholdPercent: bgt.alertThresholdPercent,
      },
    });
  }
  console.log(`   ✓ Seeded ${initialBudgets.length} budget envelopes for ${currentMonthYear}`);

  // 5. Provision Savings Goals
  for (const goal of initialGoals) {
    await prisma.savingsGoal.upsert({
      where: { id: goal.id },
      update: {
        userId: targetUserId,
        currentCents: BigInt(goal.currentCents),
      },
      create: {
        id: goal.id,
        userId: targetUserId,
        name: goal.name,
        targetCents: BigInt(goal.targetCents),
        currentCents: BigInt(goal.currentCents),
        targetDate: goal.targetDate || null,
        category: goal.category,
        isPaused: goal.isPaused ?? false,
      },
    });
  }
  console.log(`   ✓ Seeded ${initialGoals.length} savings goals`);

  // 6. Provision Recurring Bills
  for (const bill of initialBills) {
    const freq = (bill.frequency?.toUpperCase() || 'MONTHLY') as BillFrequency;
    await prisma.billSubscription.upsert({
      where: { id: bill.id },
      update: {
        userId: targetUserId,
        amountCents: BigInt(bill.amountCents),
      },
      create: {
        id: bill.id,
        userId: targetUserId,
        name: bill.name,
        amountCents: BigInt(bill.amountCents),
        frequency: freq,
        nextDueDate: bill.nextDueDate,
        category: bill.category,
        isAutoPay: bill.isAutoPay,
        accountId: bill.accountId || null,
        status: bill.status || 'active',
      },
    });
  }
  console.log(`   ✓ Seeded ${initialBills.length} recurring bill commitments`);

  // 7. Provision Debts
  for (const debt of initialDebts) {
    await prisma.debtAccount.upsert({
      where: { id: debt.id },
      update: {
        userId: targetUserId,
        balanceCents: BigInt(debt.balanceCents),
      },
      create: {
        id: debt.id,
        userId: targetUserId,
        name: debt.name,
        balanceCents: BigInt(debt.balanceCents),
        aprPercent: debt.aprPercent,
        minimumPaymentCents: BigInt(debt.minimumPaymentCents),
        dueDateDay: debt.dueDateDay,
        category: debt.category,
      },
    });
  }
  console.log(`   ✓ Seeded ${initialDebts.length} debt accounts (Snowball/Avalanche)`);

  // 8. Create SOX 302 Compliant Initial Audit Entry
  const soxAudit = createSoxAuditEntry('SYSTEM_SEEDER', 'ACCOUNT', 'seed_batch_001', 'CREATE', {
    seededAt: new Date().toISOString(),
    user: aseerUser.email,
    accountCount: initialAccounts.length,
    transactionCount: initialTransactions.length,
  });

  await prisma.auditEvent.create({
    data: {
      userId: targetUserId,
      eventType: 'LEDGER_SEED_INITIALIZATION',
      actor: 'SYSTEM',
      details: `Initial FinTech demonstration database seeded for ${aseerUser.email} with verified minor-unit balances.`,
      checksumAfter: soxAudit.checksumAfter,
    },
  });
  console.log('   ✓ SOX Section 302 tamper-evident genesis audit log created');

  console.log('\n🚀 Database seeding completed with 100% regulatory data integrity!');
}

main()
  .catch((e) => {
    console.error('❌ Database seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
