/**
 * Market history statistics and history-based suggestions (deterministic). Inputs are monthly
 * closing prices of broad index funds; outputs are rates in basis points. Past returns don't
 * guarantee future results; the UI says so.
 */

export type AssetClass = 'equity' | 'bond' | 'gold' | 'cash';

export interface Instrument {
  symbol: string;
  label: string;
  region: string;
  asset: AssetClass;
}

/** Broad, liquid USD funds that track a region or an asset class. */
export const UNIVERSE: Instrument[] = [
  { symbol: 'ACWI', label: 'World shares', region: 'World', asset: 'equity' },
  { symbol: 'SPY', label: 'US shares (S&P 500)', region: 'United States', asset: 'equity' },
  { symbol: 'VGK', label: 'Europe shares', region: 'Europe', asset: 'equity' },
  { symbol: 'EWJ', label: 'Japan shares', region: 'Japan', asset: 'equity' },
  { symbol: 'MCHI', label: 'China shares', region: 'China', asset: 'equity' },
  { symbol: 'INDA', label: 'India shares', region: 'India', asset: 'equity' },
  { symbol: 'AAXJ', label: 'Asia ex-Japan shares', region: 'Asia', asset: 'equity' },
  { symbol: 'EEM', label: 'Emerging-market shares', region: 'Emerging markets', asset: 'equity' },
  { symbol: 'ILF', label: 'Latin America shares', region: 'Latin America', asset: 'equity' },
  { symbol: 'AFK', label: 'Africa shares', region: 'Africa', asset: 'equity' },
  { symbol: 'GLD', label: 'Gold', region: 'Global', asset: 'gold' },
  { symbol: 'AGG', label: 'US bonds', region: 'United States', asset: 'bond' },
  { symbol: 'BNDX', label: 'International bonds', region: 'Global', asset: 'bond' },
  { symbol: 'BIL', label: 'US Treasury bills (cash)', region: 'United States', asset: 'cash' },
];

export interface PricePoint {
  date: string; // YYYY-MM
  close: number;
}

export interface InstrumentStats extends Instrument {
  lastPrice: number | null;
  lastTime: string | null; // ISO, when the price was quoted
  currency: string;
  return1yBps: number | null;
  return3yBps: number | null; // annualised
  return5yBps: number | null;
  return10yBps: number | null;
  volatilityBps: number | null; // annualised, from monthly returns
  maxDrawdownBps: number | null; // worst peak-to-trough fall (negative)
  history: PricePoint[];
}

const bps = (x: number) => Math.round(x * 10_000);

/** Annualised return over the last N years; a series up to 3 months short still counts (scaled to its real span). */
function annualised(points: PricePoint[], years: number): number | null {
  const n = Math.min(years * 12, points.length - 1);
  if (n < years * 12 - 3 || n < 1) return null;
  const end = points[points.length - 1].close;
  const start = points[points.length - 1 - n].close;
  if (!(start > 0) || !(end > 0)) return null;
  return bps((end / start) ** (12 / n) - 1);
}

export function computeStats(inst: Instrument, history: PricePoint[], quote: { price: number | null; time: string | null; currency: string }): InstrumentStats {
  const h = history.filter((p) => p.close > 0);
  const rets = h.slice(1).map((p, i) => p.close / h[i].close - 1);
  const mean = rets.reduce((s, r) => s + r, 0) / Math.max(1, rets.length);
  const sd = Math.sqrt(rets.reduce((s, r) => s + (r - mean) ** 2, 0) / Math.max(1, rets.length - 1));
  let peak = 0;
  let dd = 0;
  for (const p of h) {
    peak = Math.max(peak, p.close);
    if (peak > 0) dd = Math.min(dd, p.close / peak - 1);
  }
  return {
    ...inst,
    lastPrice: quote.price,
    lastTime: quote.time,
    currency: quote.currency,
    return1yBps: annualised(h, 1),
    return3yBps: annualised(h, 3),
    return5yBps: annualised(h, 5),
    return10yBps: annualised(h, 10),
    volatilityBps: rets.length >= 12 ? bps(sd * Math.sqrt(12)) : null,
    maxDrawdownBps: h.length >= 12 ? bps(dd) : null,
    history: h,
  };
}

export type Risk = 'conservative' | 'balanced' | 'growth';

export interface Suggestion {
  symbol: string;
  label: string;
  weightPct: number;
  reasons: string[];
}

export interface SuggestedMix {
  picks: Suggestion[];
  expectedReturnBps: number | null; // weighted history-based (10y, else 5y) return
  worstDrawdownBps: number | null; // weighted, as a rough "how bad can it get"
  notes: string[];
}

const ALLOC: Record<Risk, { equity: number; bond: number; gold: number; cash: number }> = {
  conservative: { equity: 25, bond: 50, gold: 10, cash: 15 },
  balanced: { equity: 55, bond: 30, gold: 10, cash: 5 },
  growth: { equity: 80, bond: 10, gold: 10, cash: 0 },
};

const longRet = (s: InstrumentStats) => s.return10yBps ?? s.return5yBps ?? s.return3yBps;

/**
 * History-based mix: the asset split comes from the risk profile; inside shares, the world fund is
 * the core and up to two regions with the best long-run return per unit of risk (and a positive
 * last year) are added. Short horizons shift weight from shares to bonds/cash.
 */
export function suggestMix(stats: InstrumentStats[], risk: Risk, horizonYears: number): SuggestedMix {
  const by = new Map(stats.map((s) => [s.symbol, s]));
  const a = { ...ALLOC[risk] };
  const notes: string[] = [];
  if (horizonYears < 3) {
    const move = Math.round(a.equity / 2);
    a.equity -= move;
    a.cash += move;
    notes.push('Under 3 years, half the share allocation moves to cash: shares can fall a lot in a single year.');
  }
  const picks: Suggestion[] = [];
  const add = (sym: string, w: number, reasons: string[]) => {
    const s = by.get(sym);
    if (!s || w <= 0 || longRet(s) === null) return false;
    picks.push({ symbol: sym, label: s.label, weightPct: w, reasons });
    return true;
  };

  // Shares: world core + best risk-adjusted regions with positive momentum.
  const regions = stats
    .filter((s) => s.asset === 'equity' && s.symbol !== 'ACWI' && longRet(s) !== null && s.volatilityBps)
    .map((s) => ({ s, ratio: (longRet(s)! - 200) / s.volatilityBps! }))
    .filter((x) => (x.s.return1yBps ?? 0) > 0)
    .sort((x, y) => y.ratio - x.ratio)
    .slice(0, 2);
  const regionShare = regions.length ? Math.round(a.equity * 0.4) : 0;
  if (add('ACWI', a.equity - regionShare, ['Core holding: thousands of companies across the world'])) {
    for (const r of regions) {
      add(r.s.symbol, Math.round(regionShare / regions.length), [
        `Best long-run return per unit of risk among regions (${((longRet(r.s) ?? 0) / 100).toFixed(1)}%/yr, volatility ${((r.s.volatilityBps ?? 0) / 100).toFixed(0)}%)`,
        `Up ${((r.s.return1yBps ?? 0) / 100).toFixed(1)}% over the last year`,
      ]);
    }
  } else if (a.equity) {
    add('SPY', a.equity, ['Broad shares fund (world fund data unavailable)']);
  }
  add(by.get('BNDX') && longRet(by.get('BNDX')!) !== null ? 'BNDX' : 'AGG', a.bond, ['Bonds steady the portfolio when shares fall']);
  add('GLD', a.gold, ['Gold has often held value in crises, wars and currency falls']);
  add('BIL', a.cash, ['Cash-like Treasury bills for money needed soon']);

  const total = picks.reduce((s, p) => s + p.weightPct, 0) || 1;
  const wavg = (f: (s: InstrumentStats) => number | null) => {
    let acc = 0;
    let w = 0;
    for (const p of picks) {
      const v = f(by.get(p.symbol)!);
      if (v === null) continue;
      acc += v * p.weightPct;
      w += p.weightPct;
    }
    return w ? Math.round(acc / w) : null;
  };
  for (const p of picks) {
    const s = by.get(p.symbol)!;
    if ((s.maxDrawdownBps ?? 0) < -4000) p.reasons.push(`Has fallen ${Math.abs((s.maxDrawdownBps ?? 0) / 100).toFixed(0)}% from a peak in the last 10 years`);
  }
  if (total !== 100) notes.push('Weights rounded.');
  notes.push('All funds are priced in US dollars: if your currency weakens against the dollar, returns in your currency are higher, and lower if it strengthens.');
  return { picks, expectedReturnBps: wavg(longRet), worstDrawdownBps: wavg((s) => s.maxDrawdownBps), notes };
}
