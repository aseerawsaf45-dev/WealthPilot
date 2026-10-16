// Exact financial mathematics and currency formatting using integer minor units (cents)

export function formatMoney(cents: number, currency = 'USD'): string {
  const isNegative = cents < 0;
  const absCents = Math.abs(cents);
  const dollars = (absCents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const currencySymbol = currency === 'BDT' ? '৳' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : `${currency} `;
  return isNegative ? `-${currencySymbol}${dollars}` : `${currencySymbol}${dollars}`;
}

export function formatCompactMoney(cents: number, currency = 'USD'): string {
  const isNegative = cents < 0;
  const absDollars = Math.abs(cents) / 100;
  const currencySymbol = currency === 'BDT' ? '৳' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : `${currency} `;

  let formatted: string;
  if (absDollars >= 1_000_000) {
    formatted = `${(absDollars / 1_000_000).toFixed(1)}M`;
  } else if (absDollars >= 1_000) {
    formatted = `${(absDollars / 1_000).toFixed(1)}k`;
  } else {
    formatted = absDollars.toFixed(0);
  }

  return isNegative ? `-${currencySymbol}${formatted}` : `${currencySymbol}${formatted}`;
}

export function dollarsToCents(dollars: number | string): number {
  const num = typeof dollars === 'string' ? parseFloat(dollars.replace(/[^0-9.-]+/g, '')) : dollars;
  if (isNaN(num)) return 0;
  // Round to nearest integer to avoid JS floating point representations like 19.99 * 100 = 1998.9999999999998
  return Math.round(num * 100);
}

export function centsToDollars(cents: number): number {
  return cents / 100;
}

/**
 * Validates that the sum of splits equals the original transaction amount exactly.
 * Essential for preserving accounting integrity.
 */
export function validateSplitPreservation(
  originalCents: number,
  splits: Array<{ amountCents: number }>
): { isValid: boolean; differenceCents: number } {
  const totalSplitCents = splits.reduce((sum, split) => sum + split.amountCents, 0);
  const differenceCents = originalCents - totalSplitCents;
  return {
    isValid: differenceCents === 0,
    differenceCents,
  };
}

/**
 * Calculates budget pacing based on current elapsed days in the period.
 */
export function calculateBudgetPace(
  spentCents: number,
  allocatedCents: number,
  dayOfMonth = 15,
  daysInMonth = 30
): {
  percentUsed: number;
  projectedEndCents: number;
  paceStatus: 'under' | 'on_track' | 'over';
} {
  if (allocatedCents <= 0) {
    return {
      percentUsed: 0,
      projectedEndCents: spentCents,
      paceStatus: spentCents > 0 ? 'over' : 'on_track',
    };
  }

  const percentUsed = Math.round((spentCents / allocatedCents) * 100);
  const elapsedRatio = Math.max(0.01, dayOfMonth / daysInMonth);
  const projectedEndCents = Math.round(spentCents / elapsedRatio);

  let paceStatus: 'under' | 'on_track' | 'over' = 'on_track';
  if (percentUsed > 100 || projectedEndCents > allocatedCents * 1.05) {
    paceStatus = 'over';
  } else if (projectedEndCents < allocatedCents * 0.85) {
    paceStatus = 'under';
  }

  return {
    percentUsed,
    projectedEndCents,
    paceStatus,
  };
}

/**
 * Security: Formula Injection Protection (CSV / Spreadsheet defense)
 * Prefixes cells beginning with '=', '+', '-', '@' with a single apostrophe `'`
 * to neutralize malicious spreadsheet macros.
 */
export function sanitizeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  const dangerousChars = ['=', '+', '-', '@', '\t', '\r'];
  if (dangerousChars.some((char) => str.startsWith(char))) {
    // Only prefix if it's not a standard negative or positive number
    const isPureNumber = /^-?\d+(\.\d+)?$/.test(str);
    if (!isPureNumber) {
      return `'${str}`;
    }
  }
  // Wrap in quotes if it contains commas, quotes, or newlines
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
