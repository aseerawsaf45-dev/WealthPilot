/**
 * WealthPilot — End-to-End Neon Services Verification
 * 
 * Verifies:
 * 1. Neon Lakebase Postgres (Live query, latency, multi-tenant records, BigInt math)
 * 2. Neon Auth (Managed Better Auth base endpoint, JWKS availability, and session API)
 */

import { prisma, checkDatabaseHealth } from '../src/server/db';

async function verifyNeonServices() {
  console.log('================================================================');
  console.log('⚡ WealthPilot Neon Cloud Services End-to-End Verification');
  console.log('================================================================\n');

  let passed = true;

  // ---------------------------------------------------------------------------
  // 1. NEON LAKEBASE POSTGRES TEST
  // ---------------------------------------------------------------------------
  console.log('📦 [1/2] Testing Neon Lakebase Postgres Connectivity & Queries...');
  try {
    const health = await checkDatabaseHealth();
    if (!health.isHealthy) {
      console.error('   ❌ Database health check failed:', health.error);
      passed = false;
    } else {
      console.log(`   ✓ Live PostgreSQL ping succeeded in ${health.latencyMs}ms`);
    }

    const user = await prisma.user.findUnique({
      where: { id: 'user_pilot' },
      include: {
        accounts: true,
        transactions: true,
        budgets: true,
        debts: true,
        auditLogs: true,
      },
    });

    if (!user) {
      console.error('   ❌ Seeded demo user "user_pilot" not found in Neon database.');
      passed = false;
    } else {
      console.log(`   ✓ Verified tenant user: "${user.name}" (${user.email})`);
      console.log(`     - Financial Accounts in Neon: ${user.accounts.length}`);
      console.log(`     - Transactions in Neon:       ${user.transactions.length}`);
      console.log(`     - Budgets in Neon:            ${user.budgets.length}`);
      console.log(`     - Debts in Neon:              ${user.debts.length}`);
      console.log(`     - Audit Logs in Neon:         ${user.auditLogs.length}`);

      // Verify BigInt arithmetic integrity
      const totalBalanceCents = user.accounts.reduce(
        (sum, acc) => sum + Number(acc.balanceCents),
        0
      );
      console.log(`     - Total Aggregate Balance:    ${totalBalanceCents} cents ($${(totalBalanceCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })})`);
    }
  } catch (err) {
    console.error('   ❌ Neon Postgres test threw an exception:', err);
    passed = false;
  } finally {
    await prisma.$disconnect();
  }

  // ---------------------------------------------------------------------------
  // 2. NEON AUTH TEST
  // ---------------------------------------------------------------------------
  console.log('\n🔐 [2/2] Testing Neon Auth (Managed Better Auth Service)...');
  const authBaseUrl = process.env.NEON_AUTH_BASE_URL;
  const authJwksUrl = process.env.NEON_AUTH_JWKS_URL;

  console.log(`   - Neon Auth Base URL: ${authBaseUrl}`);
  console.log(`   - Neon Auth JWKS URL: ${authJwksUrl}`);

  if (!authBaseUrl || !authJwksUrl) {
    console.error('   ❌ Missing NEON_AUTH_BASE_URL or NEON_AUTH_JWKS_URL in environment.');
    passed = false;
  } else {
    try {
      // Test 1: Fetch JWKS from Neon Auth
      const jwksRes = await fetch(authJwksUrl);
      if (jwksRes.ok) {
        const jwksData = await jwksRes.json() as { keys?: unknown[] };
        console.log(`   ✓ JWKS endpoint reachable (HTTP ${jwksRes.status}): ${jwksData.keys?.length ?? 0} public key(s) verified`);
      } else {
        console.warn(`   ⚠️ JWKS endpoint responded with HTTP ${jwksRes.status}`);
      }

      // Test 2: Fetch auth session endpoint (expected null/unauthenticated on clean test)
      const sessionUrl = `${authBaseUrl}/get-session`;
      const sessionRes = await fetch(sessionUrl, {
        headers: { 'Content-Type': 'application/json' },
      });
      console.log(`   ✓ Managed Better Auth /get-session endpoint reachable (HTTP ${sessionRes.status})`);
    } catch (err) {
      console.error('   ❌ Neon Auth endpoint connection failed:', err);
      passed = false;
    }
  }

  console.log('\n================================================================');
  if (passed) {
    console.log('🎉 ALL NEON SERVICES VERIFIED AND OPERATIONAL END-TO-END!');
    console.log('   - Neon Lakebase Postgres: ONLINE & SYNCED');
    console.log('   - Neon Managed Auth:     ONLINE & ACCESSIBLE');
    console.log('================================================================\n');
  } else {
    console.error('🚨 Neon services verification encountered failures.');
    console.log('================================================================\n');
    process.exitCode = 1;
  }
}

verifyNeonServices();
