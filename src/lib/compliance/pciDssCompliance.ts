/**
 * WealthPilot — PCI-DSS v4.0 Compliance Module
 * 
 * Enforces:
 * - Requirement 3: Protect Stored Account Data
 * - Strict Zero-Cardholder-Data Scope Exclusion: WealthPilot is a PFM tool and
 *   MUST NOT accept, store, or log 16-digit Primary Account Numbers (PAN) or CVVs.
 * - Luhn Algorithm Validation to detect and intercept credit/debit card numbers.
 */

/**
 * Standard Luhn Check (Mod 10 algorithm) to verify validity of potential card numbers.
 */
export function passesLuhnCheck(digits: string): boolean {
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits.charAt(i), 10);
    if (isNaN(n)) return false;
    if (alternate) {
      n *= 2;
      if (n > 9) n = (n % 10) + 1;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

export interface PciDssScanResult {
  isCompliant: boolean;
  detectedViolations: string[];
  sanitizedText: string;
}

/**
 * PCI-DSS Scope Interceptor:
 * Scans payloads, memos, and import buffers to intercept and sanitize card numbers.
 */
export function scanAndEnforcePciDssScope(input: string): PciDssScanResult {
  const violations: string[] = [];
  let sanitized = input;

  // Pattern matching standard Visa, Mastercard, Amex, Discover, UnionPay lengths (13-19 digits)
  const panRegex = /\b(?:\d[ -]*?){13,19}\b/g;

  const matches = input.match(panRegex);
  if (matches) {
    for (const match of matches) {
      const cleanDigits = match.replace(/[\s-]/g, '');
      if (cleanDigits.length >= 13 && cleanDigits.length <= 19 && passesLuhnCheck(cleanDigits)) {
        violations.push(`CARDHOLDER_PAN_DETECTED (${cleanDigits.slice(0, 4)}...${cleanDigits.slice(-4)})`);
        sanitized = sanitized.replace(match, `[REDACTED_PCI_PAN_${cleanDigits.slice(-4)}]`);
      }
    }
  }

  // Intercept CVV / CVC mentions (e.g. "cvv: 123", "cvc: 4567")
  const cvvRegex = /\b(?:cvv|cvc|cid|security_code)\s*[:=]\s*\d{3,4}\b/gi;
  if (cvvRegex.test(sanitized)) {
    violations.push('CARD_SECURITY_CODE_CVV');
    sanitized = sanitized.replace(cvvRegex, '[REDACTED_PCI_CVV]');
  }

  return {
    isCompliant: violations.length === 0,
    detectedViolations: violations,
    sanitizedText: sanitized,
  };
}
