import type { CopilotFact } from '../types/finance';
// Exact financial mathematics and currency formatting using integer minor units (cents)

import { minorUnits } from './currency';

// Display defaults. Only the browser changes these (FinanceContext sets the user's base currency);
// server code always passes the currency explicitly.
let displayCurrency = 'USD';
let displayLocale = 'en-US';

export function setDisplayCurrency(currency: string, locale?: string): void {
  displayCurrency = currency || 'USD';
  if (locale && locale !== displayLocale) {
    try {
      if (Intl.NumberFormat.supportedLocalesOf([locale]).length) displayLocale = locale;
    } catch {
      /* invalid tag: keep the current locale */
    }
  }
}

export function getDisplayCurrency(): string {
  return displayCurrency;
}

// Glyphs several currencies share; we never show one of these alone for a non-owner currency.
const SHARED_GLYPHS = new Set(['$', '¥', 'kr', '£', 'R', 'Rs', '₨', 'P', 'K', 'L', 'Fr']);
const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string, compact: boolean): Intl.NumberFormat {
  const key = `${displayLocale}|${currency}|${compact}`;
  let f = formatters.get(key);
  if (!f) {
    const digits = minorUnits(currency);
    try {
      f = new Intl.NumberFormat(displayLocale, {
        style: 'currency',
        currency,
        ...(compact
          ? { notation: 'compact', maximumFractionDigits: 1 }
          : { minimumFractionDigits: digits, maximumFractionDigits: digits }),
      });
    } catch {
      f = new Intl.NumberFormat(displayLocale, compact ? { notation: 'compact', maximumFractionDigits: 1 } : { minimumFractionDigits: digits, maximumFractionDigits: digits });
    }
    formatters.set(key, f);
  }
  return f;
}

const symbols = new Map<string, string>();

/** "$" for USD, "CA$" for CAD, "৳" for BDT: the locale symbol, or the narrow one when the locale only knows the code. */
function symbolFor(currency: string): string {
  const key = `${displayLocale}|${currency}`;
  let sym = symbols.get(key);
  if (sym === undefined) {
    const part = (display: 'symbol' | 'narrowSymbol') => {
      try {
        return new Intl.NumberFormat(displayLocale, { style: 'currency', currency, currencyDisplay: display }).formatToParts(0).find((p) => p.type === 'currency')?.value;
      } catch {
        return undefined;
      }
    };
    sym = part('symbol') ?? currency;
    if (sym === currency) {
      const narrow = part('narrowSymbol');
      if (narrow && !SHARED_GLYPHS.has(narrow)) sym = narrow;
    }
    symbols.set(key, sym);
  }
  return sym;
}

function render(minor: number, currency: string, compact: boolean): string {
  const value = minor / 10 ** minorUnits(currency); // presentation boundary only
  const sym = symbolFor(currency);
  const parts = formatter(currency, compact).formatToParts(value);
  const hasCurrency = parts.some((p) => p.type === 'currency');
  const isCode = /^[A-Z]{2,3}$/.test(sym);
  let out = parts
    .map((p, i) => {
      if (p.type === 'currency') return sym;
      // en-US writes "BDT 1,500"; once the code is swapped for "৳" the gap is not wanted.
      const besideCurrency = parts[i - 1]?.type === 'currency' || parts[i + 1]?.type === 'currency';
      if (p.type === 'literal' && besideCurrency && !isCode && /^\s+$/.test(p.value)) return '';
      return p.value;
    })
    .join('');
  if (!hasCurrency) out = `${sym} ${out}`;
  // A code like "BDT" reads better with a space before the number.
  if (isCode) {
    const neg = out.startsWith('-') ? '-' : '';
    const rest = out.slice(neg.length);
    if (rest.startsWith(sym) && /\d/.test(rest.charAt(sym.length))) out = `${neg}${sym} ${rest.slice(sym.length)}`;
  }
  return out;
}

/** Symbol of the current display currency (for form labels like "Amount (৳)"). */
export function displaySymbol(currency?: string): string {
  return symbolFor(currency || displayCurrency);
}

/** Formats integer minor units in the given (or the display) currency with ISO decimals. */
export function formatMoney(cents: number, currency?: string): string {
  return render(cents, currency || displayCurrency, false);
}

/** Short form for tight spaces: "$48.1K", "৳1.2M". */
export function formatCompactMoney(cents: number, currency?: string): string {
  return render(cents, currency || displayCurrency, true);
}

/**
 * Parses what a person typed ("1,245.50", "1.234,56", "(5.75)", "৳ 500", "-12") into integer
 * minor units of `currency` using string arithmetic only. Unparseable input gives 0.
 */
export function toMinor(input: number | string, currency?: string): number {
  const digits = minorUnits(currency || displayCurrency);
  let raw = typeof input === 'number' ? (Number.isFinite(input) ? input.toFixed(Math.max(digits, 2) + 2) : '') : String(input);
  raw = raw.trim();
  let negative = false;
  if (/^\(.*\)$/.test(raw)) {
    negative = true;
    raw = raw.slice(1, -1);
  }
  if (/^[^\d]*-/.test(raw) || /-[^\d]*$/.test(raw)) negative = true;
  raw = raw.replace(/[^0-9.,]/g, '');
  if (!/\d/.test(raw)) return 0;

  // Work out which separator is the decimal point.
  const lastDot = raw.lastIndexOf('.');
  const lastComma = raw.lastIndexOf(',');
  let decimalSep: '.' | ',' | null = null;
  if (lastDot >= 0 && lastComma >= 0) decimalSep = lastDot > lastComma ? '.' : ',';
  else if (lastDot >= 0) decimalSep = (raw.match(/\./g) ?? []).length === 1 ? '.' : null;
  else if (lastComma >= 0) {
    const after = raw.length - lastComma - 1;
    decimalSep = (raw.match(/,/g) ?? []).length === 1 && after > 0 && after !== 3 ? ',' : null;
  }
  let whole = raw;
  let frac = '';
  if (decimalSep) {
    const at = raw.lastIndexOf(decimalSep);
    whole = raw.slice(0, at);
    frac = raw.slice(at + 1).replace(/[^0-9]/g, '');
  }
  whole = whole.replace(/[^0-9]/g, '') || '0';
  const padded = (frac + '0'.repeat(digits + 1)).slice(0, digits + 1);
  let minor = BigInt(whole) * BigInt(10) ** BigInt(digits) + BigInt(padded.slice(0, digits) || '0');
  if (Number(padded[digits]) >= 5) minor += BigInt(1); // round half away from zero
  const n = Number(minor);
  if (!Number.isSafeInteger(n)) return 0;
  return negative && n !== 0 ? -n : n;
}

/** Back-compat name; prefer toMinor(value, currency). */
export function dollarsToCents(dollars: number | string, currency?: string): number {
  return toMinor(dollars, currency);
}

/** Integer minor units → plain decimal string for an input field ("19.99", "1500" for JPY). */
export function fromMinor(minor: number, currency?: string): string {
  const digits = minorUnits(currency || displayCurrency);
  const neg = minor < 0;
  const abs = String(Math.abs(Math.trunc(minor))).padStart(digits + 1, '0');
  const whole = digits ? abs.slice(0, -digits) : abs;
  const frac = digits ? abs.slice(-digits) : '';
  return `${neg ? '-' : ''}${whole}${frac ? `.${frac}` : ''}`;
}

export function centsToDollars(cents: number, currency?: string): number {
  return cents / 10 ** minorUnits(currency || displayCurrency);
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

/** Formats a server-calculated copilot/planner fact for display (the only source of numbers in AI answers). */
export function formatFact(f: CopilotFact): string {
  switch (f.unit) {
    case 'cents':
      return formatMoney(Number(f.value), f.currency);
    case 'pct':
      return `${f.value}%`;
    case 'days':
      return `${f.value} days`;
    case 'months':
      return Number(f.value) === 1 ? '1 month' : `${f.value} months`;
    default:
      return String(f.value);
  }
}
