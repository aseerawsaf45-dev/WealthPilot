-- CreateTable
CREATE TABLE "external_cache" (
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_cache_pkey" PRIMARY KEY ("key")
);

