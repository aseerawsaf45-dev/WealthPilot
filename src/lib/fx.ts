/**
 * WealthPilot — exchange-rate conversion in integer arithmetic.
 * Rates are integer strings scaled by FX_SCALE: units of a currency per 1 unit of the snapshot base.
 * Converted amounts are estimates and must be labelled as such wherever they are shown.
 */

import { minorUnits } from './currency';

export const FX_SCALE = BigInt(1_000_000_000);

export interface FxRates {
  day: string; // YYYY-MM-DD the rates are from
  base: string;
  rates: Record<string, string>;
  source: string;
}

/** Turns a decimal rate from a feed ("122.15", 1.0834e-4) into a FX_SCALE integer string at the ingest boundary. */
export function scaleRate(rate: number | string): string | null {
  const n = typeof rate === 'number' ? rate : Number(rate);
  if (!Number.isFinite(n) || n <= 0) return null;
  const [whole, frac = ''] = n.toFixed(9).split('.');
  const scaled = BigInt(whole) * FX_SCALE + BigInt((frac + '000000000').slice(0, 9));
  return scaled > BigInt(0) ? scaled.toString() : null;
}

function rateOf(code: string, fx: FxRates): bigint | null {
  if (code === fx.base) return FX_SCALE;
  const r = fx.rates[code];
  if (!r || !/^\d+$/.test(r)) return null;
  const v = BigInt(r);
  return v > BigInt(0) ? v : null;
}

/** Round-half-to-even division for bigints (banker's rounding, no bias across many conversions). */
function divRound(num: bigint, den: bigint): bigint {
  const neg = (num < BigInt(0)) !== (den < BigInt(0));
  const n = num < BigInt(0) ? -num : num;
  const d = den < BigInt(0) ? -den : den;
  let q = n / d;
  const r = n % d;
  const twice = r * BigInt(2);
  if (twice > d || (twice === d && q % BigInt(2) === BigInt(1))) q += BigInt(1);
  return neg ? -q : q;
}

/** Converts minor units between currencies, or null when a rate is missing. Same currency is exact. */
export function convertMinor(amount: number, from: string, to: string, fx: FxRates | null | undefined): number | null {
  if (from === to) return amount;
  if (!fx) return null;
  const rFrom = rateOf(from, fx);
  const rTo = rateOf(to, fx);
  if (!rFrom || !rTo) return null;
  const ten = BigInt(10);
  const num = BigInt(Math.trunc(amount)) * rTo * ten ** BigInt(minorUnits(to));
  const den = rFrom * ten ** BigInt(minorUnits(from));
  const out = Number(divRound(num, den));
  return Number.isSafeInteger(out) ? out : null;
}

/**
 * Sums amounts in mixed currencies into `to`. Amounts without a rate are left out and their
 * currencies are reported, so the UI can say what the total excludes.
 */
export function sumConverted(
  items: Array<{ amount: number; currency: string }>,
  to: string,
  fx: FxRates | null | undefined,
): { total: number; converted: boolean; missing: string[] } {
  let total = 0;
  let converted = false;
  const missing = new Set<string>();
  for (const it of items) {
    const v = convertMinor(it.amount, it.currency, to, fx);
    if (v === null) missing.add(it.currency);
    else {
      total += v;
      if (it.currency !== to) converted = true;
    }
  }
  return { total, converted, missing: [...missing] };
}
