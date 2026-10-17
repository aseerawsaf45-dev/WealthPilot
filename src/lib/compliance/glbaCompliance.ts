/**
 * WealthPilot — Gramm-Leach-Bliley Act (GLBA) Compliance Module
 * 
 * Enforces:
 * - 15 U.S.C. Subchapter I & FTC Safeguards Rule (16 CFR Part 314)
 * - Nonpublic Personal Information (NPI) Safeguarding
 * - Account Number Masking (Truncation Standard)
 * - Autonomous PII & Financial Identifier Redaction
 */

export interface GlbaScanResult {
  hasNpiLeak: boolean;
  detectedTypes: string[];
  sanitizedText: string;
}

/**
 * GLBA Safeguards Rule (16 CFR § 314.4):
 * Masks financial account numbers to preserve only the last 4 digits (e.g. `****4821`).
 */
export function maskAccountNumber(rawNumber: string): string {
  if (!rawNumber) return '****0000';
  const clean = rawNumber.replace(/[\s-]/g, '');
  if (clean.length <= 4) return `****${clean}`;
  const last4 = clean.slice(-4);
  return `****${last4}`;
}

/**
 * GLBA NPI Shield: Scans strings for unmasked Nonpublic Personal Information:
 * - Social Security Numbers (SSN): `\d{3}-\d{2}-\d{4}`
 * - Routing Numbers: 9-digit ABA routing numbers
 * - Plaintext API Tokens / Passwords
 */
export function scanAndRedactNpi(input: string): GlbaScanResult {
  let sanitized = input;
  const detectedTypes: string[] = [];

  // Check 1: Social Security Number (SSN) / National ID
  const ssnRegex = /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g;
  if (ssnRegex.test(sanitized)) {
    detectedTypes.push('US_SSN_OR_NATIONAL_ID');
    sanitized = sanitized.replace(ssnRegex, '[REDACTED_NPI_SSN]');
  }

  // Check 2: Passwords / Secret tokens in query parameters or memos
  const secretRegex = /(?:password|secret|token|api_?key|auth)\s*[:=]\s*['"]?([^\s&'",;]+)['"]?/gi;
  if (secretRegex.test(sanitized)) {
    detectedTypes.push('AUTHENTICATION_SECRET');
    sanitized = sanitized.replace(secretRegex, 'secret=[REDACTED_GLBA]');
  }

  // Check 3: Raw Unmasked Bank Account Numbers (> 6 consecutive digits)
  const bankAccRegex = /\b(acc|account|routing)[\s:#_-]+(\d{6,17})\b/gi;
  if (bankAccRegex.test(sanitized)) {
    detectedTypes.push('RAW_BANK_ACCOUNT_NUMBER');
    sanitized = sanitized.replace(bankAccRegex, (_, prefix, digits) => {
      const masked = maskAccountNumber(digits);
      return `${prefix}: ${masked}`;
    });
  }

  return {
    hasNpiLeak: detectedTypes.length > 0,
    detectedTypes,
    sanitizedText: sanitized,
  };
}

/**
 * GLBA Verification: Confirms an account entity meets the Safeguards Rule masking standard.
 */
export function verifyGlbaAccountMasking(accountNumberMask: string | undefined): boolean {
  if (!accountNumberMask) return false;
  return /^\*{3,4}\d{4}$/.test(accountNumberMask);
}
