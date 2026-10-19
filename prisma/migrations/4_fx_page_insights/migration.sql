-- CreateTable
CREATE TABLE "fx_snapshots" (
    "day" TEXT NOT NULL,
    "base" TEXT NOT NULL,
    "rates" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fx_snapshots_pkey" PRIMARY KEY ("day")
);

-- CreateTable
CREATE TABLE "page_insights" (
    "userId" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "dataHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_insights_pkey" PRIMARY KEY ("userId","segment")
);

-- AddForeignKey
ALTER TABLE "page_insights" ADD CONSTRAINT "page_insights_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
