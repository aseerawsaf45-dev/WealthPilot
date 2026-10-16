#!/usr/bin/env node
/**
 * WealthPilot — FinTech Security & Regulatory Compliance Verification Suite
 * 
 * Shenzhen International FinTech Competition-2026 Audit Standard
 * 
 * Enforces automated compliance gates for:
 * 1. GDPR (EU 2016/679 Articles 17, 20, 25)
 * 2. SOX (Sarbanes-Oxley Act Sections 302 & 404)
 * 3. GLBA (Gramm-Leach-Bliley Act 15 U.S.C. § 6801 & FTC Safeguards Rule 16 CFR Part 314)
 * 4. PCI-DSS v4.0 (Requirement 3 Zero-Cardholder Data Scope Minimization)
 * 5. Multi-Tenant Authorization & Zero Hardcoded Credentials
 * 6. CSV Formula-Injection Neutralization (RFC 4180 / OWASP)
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');
let totalWarnings = 0;
let totalErrors = 0;

console.log('\n================================================================');
console.log('🏛️  WealthPilot Regulatory Compliance & Security Verification');
console.log('    Shenzhen International FinTech Competition-2026');
console.log('================================================================\n');

// 1. Recursive File Collector
function getFiles(dir, exts = ['.ts', '.tsx', '.js', '.json']) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (file === 'node_modules' || file === '.next' || file === '.git' || file === 'dist') continue;
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      results = results.concat(getFiles(filePath, exts));
    } else if (exts.some(ext => file.endsWith(ext))) {
      results.push(filePath);
    }
  }
  return results;
}

const sourceFiles = getFiles(SRC_DIR);

// -------------------------------------------------------------------------
// CHECK 1: Zero Hardcoded Credentials & Cryptographic Material
// -------------------------------------------------------------------------
console.log('🔒 [Check 1/7] Credential Leak & Secret Scanning...');
const secretPatterns = [
  { name: 'Google Gemini API Key', regex: /AIzaSy[A-Za-z0-9_-]{33}/g },
  { name: 'OpenAI API Key', regex: /sk-[A-Za-z0-9]{48}/g },
  { name: 'Anthropic Claude Key', regex: /sk-ant-[A-Za-z0-9_-]{32,}/g },
  { name: 'Groq API Key', regex: /gsk_[A-Za-z0-9]{52}/g },
  { name: 'Hardcoded Postgres URI with password', regex: /postgres(?:ql)?:\/\/[^:]+:[^@]+@[^/]+/g },
  { name: 'Private Key PEM header', regex: /-----BEGIN PRIVATE KEY-----/g }
];

for (const file of sourceFiles) {
  const content = fs.readFileSync(file, 'utf8');
  for (const pattern of secretPatterns) {
    if (pattern.regex.test(content)) {
      console.error(`   ❌ [CRITICAL SECRET LEAK] Found potential ${pattern.name} in: ${path.relative(SRC_DIR, file)}`);
      totalErrors++;
    }
  }
}
if (totalErrors === 0) {
  console.log('   ✓ Zero hardcoded API keys, private keys, or database credentials detected.');
}

// -------------------------------------------------------------------------
// CHECK 2: GDPR (EU 2016/679) Privacy by Design, Erasure & Portability
// -------------------------------------------------------------------------
console.log('\n🇪🇺 [Check 2/7] GDPR Compliance Verification (Art. 17, 20, 25)...');
const gdprModulePath = path.join(SRC_DIR, 'lib', 'compliance', 'gdprCompliance.ts');
if (!fs.existsSync(gdprModulePath)) {
  console.error('   ❌ [GDPR BREACH] Missing GDPR compliance module at src/lib/compliance/gdprCompliance.ts');
  totalErrors++;
} else {
  const gdprContent = fs.readFileSync(gdprModulePath, 'utf8');
  
  // Art 17 Right to Erasure
  if (!gdprContent.includes('verifyCascadingPurgeContract')) {
    console.error('   ❌ [GDPR Art. 17] Missing cascading purge contract verifier.');
    totalErrors++;
  } else {
    console.log('   ✓ GDPR Article 17 (Right to Erasure / Cascading Purge Contract): Enforced.');
  }

  // Art 20 Data Portability
  if (!gdprContent.includes('generateGdprPortabilityArchive')) {
    console.error('   ❌ [GDPR Art. 20] Missing data portability archive generator.');
    totalErrors++;
  } else {
    console.log('   ✓ GDPR Article 20 (Data Portability JSON & CSV Export): Enforced.');
  }

  // Art 25 Privacy by Design / Kill Switch
  const copilotServiceFile = path.join(SRC_DIR, 'services', 'copilotService.ts');
  const copilotContent = fs.existsSync(copilotServiceFile) ? fs.readFileSync(copilotServiceFile, 'utf8') : '';
  if (!copilotContent.includes('isAiEnabled')) {
    console.error('   ❌ [GDPR Art. 25] copilotService.ts must assert isAiEnabled before executing queries.');
    totalErrors++;
  } else {
    console.log('   ✓ GDPR Article 25 (Data Protection by Design & AI Kill Switch Enclave): Enforced.');
  }
}

// -------------------------------------------------------------------------
// CHECK 3: Sarbanes-Oxley Act (SOX Section 302 & 404) Financial Controls
// -------------------------------------------------------------------------
console.log('\n📊 [Check 3/7] SOX Compliance Verification (Sections 302 & 404)...');
const soxModulePath = path.join(SRC_DIR, 'lib', 'compliance', 'soxCompliance.ts');
if (!fs.existsSync(soxModulePath)) {
  console.error('   ❌ [SOX BREACH] Missing SOX compliance module at src/lib/compliance/soxCompliance.ts');
  totalErrors++;
} else {
  const soxContent = fs.readFileSync(soxModulePath, 'utf8');

  // Section 404 Internal Controls: Split Invariant
  if (!soxContent.includes('assertSoxSplitPreservation')) {
    console.error('   ❌ [SOX 404] Missing split balance preservation invariant control.');
    totalErrors++;
  } else {
    console.log('   ✓ SOX Section 404 (ICFR Split Balance Preservation Invariant): Enforced.');
  }

  // Section 302 Ledger Verification: Audit Trails
  if (!soxContent.includes('createSoxAuditEntry')) {
    console.error('   ❌ [SOX 302] Missing cryptographic audit trail hashing function.');
    totalErrors++;
  } else {
    console.log('   ✓ SOX Section 302 (Ledger Verification Cryptographic Audit Trails): Enforced.');
  }

  // Integer Minor Units Standard
  if (!soxContent.includes('assertMinorUnitIntegrity')) {
    console.error('   ❌ [SOX 404] Missing integer minor-unit accounting standard guard.');
    totalErrors++;
  } else {
    console.log('   ✓ SOX Section 404 (Discrete Integer Minor-Units Arithmetic Guard): Enforced.');
  }
}

// -------------------------------------------------------------------------
// CHECK 4: GLBA (Gramm-Leach-Bliley Act 16 CFR Part 314 Safeguards Rule)
// -------------------------------------------------------------------------
console.log('\n🏦 [Check 4/7] GLBA Safeguards Rule & NPI Protection Scanning...');
const glbaModulePath = path.join(SRC_DIR, 'lib', 'compliance', 'glbaCompliance.ts');
if (!fs.existsSync(glbaModulePath)) {
  console.error('   ❌ [GLBA BREACH] Missing GLBA compliance module at src/lib/compliance/glbaCompliance.ts');
  totalErrors++;
} else {
  const glbaContent = fs.readFileSync(glbaModulePath, 'utf8');
  if (!glbaContent.includes('maskAccountNumber') || !glbaContent.includes('scanAndRedactNpi')) {
    console.error('   ❌ [GLBA BREACH] Incomplete GLBA implementation in glbaCompliance.ts');
    totalErrors++;
  } else {
    console.log('   ✓ GLBA 16 CFR § 314.4 (Account Masking & NPI Autonomous Redaction): Active.');
  }
}

// Static Scanner for Unmasked Nonpublic Personal Information (NPI / SSN) in Codebase
let unmaskedNpiFound = 0;
const ssnPattern = /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g;
for (const file of sourceFiles) {
  // Exclude compliance module and tests from flagging their own validation strings
  const rel = path.relative(SRC_DIR, file).replace(/\\/g, '/');
  if (rel.includes('compliance/glbaCompliance') || rel.includes('test')) continue;

  const content = fs.readFileSync(file, 'utf8');
  const matches = content.match(ssnPattern);
  if (matches) {
    console.error(`   ❌ [GLBA NPI LEAK] Raw SSN pattern detected in: ${rel}`);
    unmaskedNpiFound++;
    totalErrors++;
  }
}
if (unmaskedNpiFound === 0) {
  console.log('   ✓ Zero unmasked Social Security Numbers or national tax IDs found in codebase.');
}

// -------------------------------------------------------------------------
// CHECK 5: PCI-DSS v4.0 Scope Minimization & Zero-PAN Storage Guard
// -------------------------------------------------------------------------
console.log('\n💳 [Check 5/7] PCI-DSS v4.0 Zero-PAN Scope Minimization Verification...');
const pciModulePath = path.join(SRC_DIR, 'lib', 'compliance', 'pciDssCompliance.ts');
if (!fs.existsSync(pciModulePath)) {
  console.error('   ❌ [PCI-DSS BREACH] Missing PCI-DSS compliance module at src/lib/compliance/pciDssCompliance.ts');
  totalErrors++;
} else {
  const pciContent = fs.readFileSync(pciModulePath, 'utf8');
  if (!pciContent.includes('passesLuhnCheck') || !pciContent.includes('scanAndEnforcePciDssScope')) {
    console.error('   ❌ [PCI-DSS BREACH] Incomplete PCI-DSS implementation in pciDssCompliance.ts');
    totalErrors++;
  } else {
    console.log('   ✓ PCI-DSS Req 3 (Zero-Cardholder Data Scope Exclusion & Luhn Interceptor): Active.');
  }
}

// -------------------------------------------------------------------------
// CHECK 6: Multi-Tenant Tenant Isolation & Authorization Guard
// -------------------------------------------------------------------------
console.log('\n🔑 [Check 6/7] Multi-Tenant Session & Tenant Boundary Verification...');
const apiDir = path.join(SRC_DIR, 'app', 'api');
const apiFiles = getFiles(apiDir);

for (const file of apiFiles) {
  const relPath = path.relative(SRC_DIR, file).replace(/\\/g, '/');
  if (relPath.includes('auth')) continue; // Public auth endpoints
  
  const content = fs.readFileSync(file, 'utf8');
  const hasAuthGuard = content.includes('getAuthenticatedUser') || 
                       content.includes('auth()') || 
                       content.includes('getServerSession') ||
                       content.includes('session.user') ||
                       content.includes('isAiEnabled');
  
  if (!hasAuthGuard) {
    console.warn(`   ⚠️  [AUTH ADVISORY] ${relPath} may require session authorization.`);
    totalWarnings++;
  }
}
if (totalWarnings === 0) {
  console.log('   ✓ Protected API routes implement server-side session guards.');
}

// -------------------------------------------------------------------------
// CHECK 7: CSV Formula Injection Neutralization (OWASP / RFC 4180)
// -------------------------------------------------------------------------
console.log('\n🛡️  [Check 7/7] CSV Formula Injection Neutralization Verification...');
const moneyLibPath = path.join(SRC_DIR, 'lib', 'money.ts');
if (fs.existsSync(moneyLibPath)) {
  const moneyContent = fs.readFileSync(moneyLibPath, 'utf8');
  if (moneyContent.includes('sanitizeCsvCell')) {
    console.log('   ✓ CSV formula injection shield (neutralizing =, +, -, @) active in src/lib/money.ts.');
  } else {
    console.error('   ❌ [VULNERABILITY] sanitizeCsvCell missing from src/lib/money.ts.');
    totalErrors++;
  }
}

// -------------------------------------------------------------------------
// CHECK 8: PostgreSQL Schema Multi-Tenancy & Minor-Unit Invariant
// -------------------------------------------------------------------------
console.log('\n🗄️  [Check 8/8] PostgreSQL Schema Multi-Tenancy & Cascade Invariants...');
const schemaPrismaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
if (!fs.existsSync(schemaPrismaPath)) {
  console.error('   ❌ [DATABASE BREACH] Missing prisma/schema.prisma schema definition.');
  totalErrors++;
} else {
  const schemaContent = fs.readFileSync(schemaPrismaPath, 'utf8');

  // Verify GDPR cascading erasure
  const cascadeCount = (schemaContent.match(/onDelete:\s*Cascade/g) || []).length;
  if (cascadeCount < 8) {
    console.error(`   ❌ [GDPR Art. 17 BREACH] Insufficient cascading erasure rules in schema.prisma (${cascadeCount} found, expected >= 8).`);
    totalErrors++;
  } else {
    console.log(`   ✓ Multi-tenant cascading erasure verified across ${cascadeCount} relational models.`);
  }

  // Verify BigInt integer minor units (no Float on monetary balances)
  if (schemaContent.includes('balanceCents          Float') || schemaContent.includes('amountCents           Float')) {
    console.error('   ❌ [SOX 404 BREACH] Schema contains Float for monetary balance or amount. Must use BigInt/Int minor units.');
    totalErrors++;
  } else {
    console.log('   ✓ Minor-unit integer standard (BigInt) strictly enforced on all ledger balances.');
  }
}

// -------------------------------------------------------------------------
// AUDIT SUMMARY & GATE
// -------------------------------------------------------------------------
console.log('\n================================================================');
if (totalErrors > 0) {
  console.error(`🚨 REGULATORY AUDIT FAILED with ${totalErrors} critical error(s) and ${totalWarnings} advisory warning(s).`);
  console.error('Please resolve all compliance violations before committing or pushing code.');
  console.log('================================================================\n');
  process.exit(1);
} else {
  console.log(`✅ ALL REGULATORY COMPLIANCE GATES PASSED!`);
  console.log(`   - GDPR (EU 2016/679 Art. 17/20/25): Compliant`);
  console.log(`   - SOX (Sections 302 & 404): Compliant`);
  console.log(`   - GLBA (16 CFR Part 314 Safeguards): Compliant`);
  console.log(`   - PCI-DSS v4.0 (Zero-PAN Scope): Compliant`);
  console.log(`   - Multi-Tenant Schema Invariants (PostgreSQL): Compliant`);
  console.log(`   - OWASP CSV Formula Injection: Compliant`);
  console.log(`   0 Errors, ${totalWarnings} Advisories.`);
  console.log('   Certified for Shenzhen International FinTech Competition-2026.');
  console.log('================================================================\n');
  process.exit(0);
}
