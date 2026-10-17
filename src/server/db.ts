/**
 * WealthPilot — Prisma Client Singleton & Database Enclave
 * 
 * Best Practices:
 * 1. Global singleton pattern to prevent connection pool exhaustion during Next.js HMR.
 * 2. BigInt JSON serialization polyfill to guarantee integer minor units serialize seamlessly.
 * 3. Connection health check & graceful fallback diagnostic.
 */

import { PrismaClient } from '@prisma/client';

// Polyfill BigInt.prototype.toJSON to serialize BigInt minor-units (cents) as discrete numbers
if (typeof BigInt !== 'undefined' && !('toJSON' in BigInt.prototype)) {
  Object.defineProperty(BigInt.prototype, 'toJSON', {
    get() {
      return () => {
        const num = Number(this);
        // Money goes on the wire as JSON numbers only; never silently switch to strings.
        if (!Number.isSafeInteger(num)) throw new RangeError('BigInt amount exceeds safe JSON integer range');
        return num;
      };
    },
    configurable: true,
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    // Default 5 s expired real edits (each write is ~6–9 round trips; ~0.5 s each from far-away clients) → P2028 → 500.
    transactionOptions: { maxWait: 10_000, timeout: 30_000 },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Verifies live connection to PostgreSQL database.
 * Returns true if database is connected, false otherwise.
 */
export async function checkDatabaseHealth(): Promise<{ isHealthy: boolean; latencyMs?: number; error?: string }> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { isHealthy: true, latencyMs: Date.now() - start };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { isHealthy: false, error: message };
  }
}
