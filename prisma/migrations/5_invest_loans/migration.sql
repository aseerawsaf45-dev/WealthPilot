-- CreateTable
CREATE TABLE "investment_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "initialCents" BIGINT NOT NULL,
    "monthlyCents" BIGINT NOT NULL,
    "horizonMonths" INTEGER NOT NULL,
    "riskProfile" TEXT NOT NULL,
    "expectedReturnBps" INTEGER,
    "taxBps" INTEGER NOT NULL DEFAULT 0,
    "scenarios" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_offers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lender" TEXT NOT NULL,
    "principalCents" BIGINT NOT NULL,
    "aprBps" INTEGER NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "feeCents" BIGINT NOT NULL DEFAULT 0,
    "purpose" TEXT NOT NULL,
    "country" TEXT,
    "status" TEXT NOT NULL DEFAULT 'considering',
    "debtId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "country_macros" (
    "country" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "country_macros_pkey" PRIMARY KEY ("country")
);

-- CreateIndex
CREATE INDEX "investment_plans_userId_idx" ON "investment_plans"("userId");

-- CreateIndex
CREATE INDEX "loan_offers_userId_idx" ON "loan_offers"("userId");

-- AddForeignKey
ALTER TABLE "investment_plans" ADD CONSTRAINT "investment_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_offers" ADD CONSTRAINT "loan_offers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

