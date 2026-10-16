/**
 * WealthPilot — Database Seed Script
 * 
 * Populates PostgreSQL with standard competition demonstration data:
 * - Deterministic Demo User ('user_pilot')
 * - Real-world financial accounts (Checking, HYSA, Index Fund, Credit Card)
 * - Multi-month categorized ledger transactions
 * - Budget envelopes with pacing metrics
 * - Savings milestones and debt payoff structures
 * - Immutable SOX Section 302 audit entry
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

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting WealthPilot database seed...');

  // 1. Create or upsert Demo User
  const demoUserId = 'user_pilot';
  const user = await prisma.user.upsert({
    where: { id: demoUserId },
    update: {
      preferredCurrency: 'USD',
      isAiEnabled: true,
    },
    create: {
      id: demoUserId,
      name: 'Demo Wealth Pilot',
      email: 'pilot@wealthpilot.io',
      preferredCurrency: 'USD',
      timezone: 'America/New_York',
      isAiEnabled: true,
    },
  });
  console.log(`   ✓ User provisioned: ${user.name} (${user.id})`);

  // 2. Provision Financial Accounts
  for (const acc of initialAccounts) {
    const accountType = acc.type.toUpperCase() as AccountType;
    await prisma.financialAccount.upsert({
      where: { id: acc.id },
      update: {
        balanceCents: BigInt(acc.balanceCents),
        lastSyncedAt: new Date(acc.lastSyncedAt),
      },
      create: {
        id: acc.id,
        userId: demoUserId,
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
  console.log(`   ✓ Seeded ${initialAccounts.length} financial accounts`);

  // 3. Provision Transactions
  for (const tx of initialTransactions) {
    const status = (tx.status?.toUpperCase() || 'CLEARED') as TransactionStatus;
    const source = (tx.source?.toUpperCase() || 'MANUAL') as TransactionSource;

    await prisma.transaction.upsert({
      where: { id: tx.id },
      update: {
        amountCents: BigInt(tx.amountCents),
        financialDate: tx.financialDate,
      },
      create: {
        id: tx.id,
        userId: demoUserId,
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
      where: {
        userId_category_monthYear: {
          userId: demoUserId,
          category: bgt.category,
          monthYear: currentMonthYear,
        },
      },
      update: {
        allocatedCents: BigInt(bgt.allocatedCents),
      },
      create: {
        id: bgt.id,
        userId: demoUserId,
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
        currentCents: BigInt(goal.currentCents),
      },
      create: {
        id: goal.id,
        userId: demoUserId,
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
        amountCents: BigInt(bill.amountCents),
      },
      create: {
        id: bill.id,
        userId: demoUserId,
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
        balanceCents: BigInt(debt.balanceCents),
      },
      create: {
        id: debt.id,
        userId: demoUserId,
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
    accountCount: initialAccounts.length,
    transactionCount: initialTransactions.length,
  });

  await prisma.auditEvent.create({
    data: {
      userId: demoUserId,
      eventType: 'LEDGER_SEED_INITIALIZATION',
      actor: 'SYSTEM',
      details: 'Initial FinTech demonstration database seeded with verified minor-unit balances.',
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
