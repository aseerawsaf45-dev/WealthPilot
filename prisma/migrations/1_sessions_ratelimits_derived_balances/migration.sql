-- DropIndex
DROP INDEX "transactions_importFingerprint_idx";

-- AlterTable
ALTER TABLE "financial_accounts" ADD COLUMN     "openingBalanceCents" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "savings_goals" ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'medium';

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "importBatchId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "aiConsentAt" TIMESTAMP(3),
ADD COLUMN     "aiConsentVersion" TEXT,
ADD COLUMN     "aiProviders" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "chatHistoryEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "passwordChangedAt" TIMESTAMP(3),
ADD COLUMN     "region" TEXT,
ADD COLUMN     "uiPrefs" JSONB NOT NULL DEFAULT '{}',
ALTER COLUMN "isAiEnabled" SET DEFAULT false;

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_buckets" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "merchant_rules" (
    "userId" TEXT NOT NULL,
    "normalizedMerchant" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_rules_pkey" PRIMARY KEY ("userId","normalizedMerchant")
);

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "transactions_userId_importBatchId_idx" ON "transactions"("userId", "importBatchId");

-- Backfill (hand-written): fingerprints only on CSV rows, so manual duplicates can't collide with the unique index.
UPDATE "transactions" SET "importFingerprint" = NULL WHERE "source" <> 'CSV_IMPORT';

-- CreateIndex
CREATE UNIQUE INDEX "transactions_userId_importFingerprint_key" ON "transactions"("userId", "importFingerprint");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_rules" ADD CONSTRAINT "merchant_rules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Derived balances: keep today's displayed balance by moving it into the opening balance.
UPDATE "financial_accounts" a SET "openingBalanceCents" = a."balanceCents" - COALESCE(
  (SELECT SUM(t."amountCents") FROM "transactions" t WHERE t."accountId" = a."id" AND t."status" <> 'VOID'), 0);

-- AI is opt-in (SEC-11): nobody has recorded consent yet.
UPDATE "users" SET "isAiEnabled" = false WHERE "aiConsentAt" IS NULL;
