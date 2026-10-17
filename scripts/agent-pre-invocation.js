#!/usr/bin/env node
/**
 * WealthPilot — Agent Lifecycle Hook: PreInvocation
 * 
 * Invoked by Antigravity before any model execution on this repository.
 * Enforces Shenzhen International FinTech Competition-2026 audit guidelines:
 * - Integer minor-units (cents / BigInt) arithmetic invariant
 * - Strict multi-tenant isolation (session.userId binding)
 * - SOX Section 302 / 404 audit trail requirement
 * - GDPR Article 17 cascading erasure compliance
 * - NIST SP 800-63B password hashing & credential privacy
 */

const fs = require('fs');
const path = require('path');

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    // Fallback timeout in case stdin doesn't close immediately
    setTimeout(() => resolve({}), 2000);
  });
}

async function main() {
  await readStdin();

  const complianceGuidelines = [
    '🛡️ WEALTHPILOT AGENT FINTECH AUDIT PROTOCOL ACTIVE:',
    '1. Currency Invariant: NEVER use IEEE 754 floats for currency math. All financial amounts must be integer minor-units (amountCents / BigInt).',
    '2. Multi-Tenant Authorization: Every database query, API route, and server mutation MUST bind to authenticated session.userId.',
    '3. GDPR Article 17: User deletion must cascade across all 9 domain models without leaving orphaned records.',
    '4. SOX Section 302/404: Any ledger mutation must be logged to AuditEvent with cryptographic checksums.',
    '5. NIST SP 800-63B: Passwords must be salted and hashed with bcrypt (>= 10 rounds). Plaintext passwords must never be stored.',
  ].join(' ');

  const output = {
    injectSteps: [
      {
        ephemeralMessage: complianceGuidelines,
      },
    ],
  };

  process.stdout.write(JSON.stringify(output, null, 2));
  process.exit(0);
}

main().catch(() => {
  process.stdout.write(JSON.stringify({}));
  process.exit(0);
});
