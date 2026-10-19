/**
 * WealthPilot — ISO 4217 currency table.
 * Minor-unit exponents are fixed here (not read from Intl) so the server and every browser
 * agree on how many decimals an integer amount has. Display names come from Intl at runtime.
 */

/** Active ISO 4217 codes (funds/precious-metal codes excluded). */
export const CURRENCY_CODES = [
  'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN', 'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF',
  'BMD', 'BND', 'BOB', 'BRL', 'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY', 'COP', 'CRC',
  'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EGP', 'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS',
  'GIP', 'GMD', 'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HTG', 'HUF', 'IDR', 'ILS', 'INR', 'IQD', 'IRR', 'ISK', 'JMD',
  'JOD', 'JPY', 'KES', 'KGS', 'KHR', 'KMF', 'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL',
  'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR', 'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD',
  'NGN', 'NIO', 'NOK', 'NPR', 'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR', 'RON', 'RSD',
  'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD', 'SHP', 'SLE', 'SOS', 'SRD', 'SSP', 'STN', 'SVC', 'SYP',
  'SZL', 'THB', 'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH', 'UGX', 'USD', 'UYU', 'UZS', 'VES',
  'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XOF', 'XPF', 'YER', 'ZAR', 'ZMW', 'ZWG',
] as const;

export type CurrencyCode = (typeof CURRENCY_CODES)[number];

const CODE_SET: ReadonlySet<string> = new Set(CURRENCY_CODES);

/** ISO 4217 exponents that are not 2. */
const EXPONENT: Record<string, number> = {
  BIF: 0, CLP: 0, DJF: 0, GNF: 0, ISK: 0, JPY: 0, KMF: 0, KRW: 0, PYG: 0, RWF: 0, UGX: 0, VND: 0, VUV: 0,
  XAF: 0, XOF: 0, XPF: 0,
  BHD: 3, IQD: 3, JOD: 3, KWD: 3, LYD: 3, OMR: 3, TND: 3,
};

/** Currencies offered first in pickers. */
export const POPULAR_CURRENCIES: CurrencyCode[] = ['USD', 'EUR', 'GBP', 'BDT', 'INR', 'CNY', 'JPY', 'CAD', 'AUD', 'SGD', 'AED', 'SAR', 'CHF', 'HKD', 'MYR', 'PKR'];

export function isIsoCurrency(code: unknown): code is CurrencyCode {
  return typeof code === 'string' && CODE_SET.has(code);
}

/** Number of decimals in one major unit (USD 2, JPY 0, KWD 3). Unknown codes get 2. */
export function minorUnits(code: string): number {
  return EXPONENT[code] ?? 2;
}

/** 10^exponent as a bigint (e.g. 100n for USD). */
export function minorFactor(code: string): bigint {
  return BigInt(10) ** BigInt(minorUnits(code));
}

const nameCache = new Map<string, string>();

/** Human name ("Bangladeshi Taka"), falling back to the code where Intl has no name. */
export function currencyName(code: string, locale = 'en'): string {
  const key = `${locale}:${code}`;
  const hit = nameCache.get(key);
  if (hit) return hit;
  let name = code;
  try {
    name = new Intl.DisplayNames([locale], { type: 'currency' }).of(code) ?? code;
  } catch {
    /* old runtime */
  }
  nameCache.set(key, name);
  return name;
}

/** Narrow symbol ("$", "৳", "€"), or the code when the locale has none. */
export function currencySymbol(code: string, locale = 'en-US'): string {
  try {
    const part = new Intl.NumberFormat(locale, { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0)
      .find((p) => p.type === 'currency');
    return part?.value ?? code;
  } catch {
    return code;
  }
}

/** Picker options: popular first, then the rest alphabetically. */
export function currencyOptions(locale = 'en'): Array<{ code: CurrencyCode; name: string; symbol: string }> {
  const rest = CURRENCY_CODES.filter((c) => !POPULAR_CURRENCIES.includes(c));
  return [...POPULAR_CURRENCIES, ...rest].map((code) => ({ code, name: currencyName(code, locale), symbol: currencySymbol(code) }));
}
