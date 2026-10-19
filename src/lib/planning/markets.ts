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

export interface AllocationItem {
  symbol: string;
  label: string;
  weightPct: number;
}

export type MixId = 'core' | 'global' | 'lower_swings' | 'growth' | 'resilient';

export interface SuggestedMix {
  id: MixId;
  name: string;
  summary: string;
  picks: Suggestion[];
  expectedReturnBps: number | null; // weighted history-based (10y, else 5y) return
  volatilityBps: number | null; // weighted, rough
  worstDrawdownBps: number | null; // weighted, as a rough "how bad can it get"
  notes: string[];
  suggested?: boolean;
}

export const MIX_IDS: MixId[] = ['core', 'global', 'lower_swings', 'growth', 'resilient'];

const ALLOC: Record<Risk, { equity: number; bond: number; gold: number; cash: number }> = {
  conservative: { equity: 25, bond: 50, gold: 10, cash: 15 },
  balanced: { equity: 55, bond: 30, gold: 10, cash: 5 },
  growth: { equity: 80, bond: 10, gold: 10, cash: 0 },
};

const longRet = (s: InstrumentStats) => s.return10yBps ?? s.return5yBps ?? s.return3yBps;
const pctTxt = (bps: number | null) => `${((bps ?? 0) / 100).toFixed(1)}%`;

/** Weighted history stats for any allocation (funds without data are skipped). */
export function mixStats(allocation: AllocationItem[], stats: InstrumentStats[]) {
  const by = new Map(stats.map((s) => [s.symbol, s]));
  const wavg = (f: (s: InstrumentStats) => number | null) => {
    let acc = 0;
    let w = 0;
    for (const a of allocation) {
      const s = by.get(a.symbol);
      const v = s ? f(s) : null;
      if (v === null || v === undefined || a.weightPct <= 0) continue;
      acc += v * a.weightPct;
      w += a.weightPct;
    }
    return w ? Math.round(acc / w) : null;
  };
  return { expectedReturnBps: wavg(longRet), volatilityBps: wavg((s) => s.volatilityBps), worstDrawdownBps: wavg((s) => s.maxDrawdownBps) };
}

/** Rounds weights to whole percents that add up to exactly 100 (largest remainders). */
function normalise(picks: Suggestion[]): Suggestion[] {
  const live = picks.filter((p) => p.weightPct > 0);
  const total = live.reduce((s, p) => s + p.weightPct, 0);
  if (!total) return [];
  const raw = live.map((p) => (p.weightPct * 100) / total);
  const floors = raw.map(Math.floor);
  let left = 100 - floors.reduce((s, x) => s + x, 0);
  const order = raw.map((r, i) => [r - floors[i], i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    floors[i]++;
    left--;
  }
  return live.map((p, i) => ({ ...p, weightPct: floors[i] }));
}

interface Recipe {
  id: MixId;
  name: string;
  summary: string;
  shift: { equity: number; bond: number; gold: number; cash: number }; // added to the risk split
  regions: 'risk_adjusted' | 'none' | 'lowest_vol' | 'best_return';
  regionShare: number; // share of equity given to regions
}

const RECIPES: Recipe[] = [
  { id: 'core', name: 'Core', summary: 'World shares at the centre, plus the regions with the best long-run return for their risk', shift: { equity: 0, bond: 0, gold: 0, cash: 0 }, regions: 'risk_adjusted', regionShare: 0.4 },
  { id: 'global', name: 'Simple global', summary: 'Just three funds: the whole world of shares, international bonds and cash', shift: { equity: 0, bond: 0, gold: -100, cash: 0 }, regions: 'none', regionShare: 0 },
  { id: 'lower_swings', name: 'Lower swings', summary: 'Fewer shares and more bonds and gold, so falls are smaller (and growth slower)', shift: { equity: -20, bond: 12, gold: 5, cash: 3 }, regions: 'lowest_vol', regionShare: 0.25 },
  { id: 'growth', name: 'Growth tilt', summary: 'More shares, leaning to the regions that grew most over 10 years and still rose last year', shift: { equity: 15, bond: -10, gold: 0, cash: -5 }, regions: 'best_return', regionShare: 0.5 },
  { id: 'resilient', name: 'Crisis-resilient', summary: 'Built for shocks like wars, sanctions or a currency crash: more gold, bonds and cash', shift: { equity: -20, bond: 5, gold: 10, cash: 5 }, regions: 'lowest_vol', regionShare: 0.2 },
];

function buildMix(r: Recipe, stats: InstrumentStats[], risk: Risk, horizonYears: number): SuggestedMix | null {
  const by = new Map(stats.map((s) => [s.symbol, s]));
  const base = ALLOC[risk];
  const a = {
    equity: Math.max(0, base.equity + r.shift.equity),
    bond: Math.max(0, base.bond + r.shift.bond),
    gold: Math.max(0, r.shift.gold <= -100 ? 0 : base.gold + r.shift.gold),
    cash: Math.max(0, base.cash + r.shift.cash),
  };
  const notes: string[] = [];
  if (horizonYears < 3) {
    const move = Math.round(a.equity / 2);
    a.equity -= move;
    a.cash += move;
    notes.push('Under 3 years, half the share allocation moves to cash: shares can fall a lot in a single year.');
  }
  const picks: Suggestion[] = [];
  const has = (sym: string) => {
    const s = by.get(sym);
    return !!s && longRet(s) !== null;
  };
  const add = (sym: string, w: number, reasons: string[]) => {
    if (!has(sym) || w <= 0) return false;
    picks.push({ symbol: sym, label: by.get(sym)!.label, weightPct: w, reasons });
    return true;
  };

  const eligible = stats.filter((s) => s.asset === 'equity' && s.symbol !== 'ACWI' && longRet(s) !== null && s.volatilityBps);
  let regions: InstrumentStats[] = [];
  if (r.regions === 'risk_adjusted') regions = eligible.filter((s) => (s.return1yBps ?? 0) > 0).sort((x, y) => (longRet(y)! - 200) / y.volatilityBps! - (longRet(x)! - 200) / x.volatilityBps!).slice(0, 2);
  if (r.regions === 'best_return') regions = eligible.filter((s) => (s.return1yBps ?? 0) > 0).sort((x, y) => longRet(y)! - longRet(x)!).slice(0, 2);
  if (r.regions === 'lowest_vol') regions = eligible.filter((s) => (longRet(s) ?? 0) > 0).sort((x, y) => x.volatilityBps! - y.volatilityBps!).slice(0, 1);
  const regionShare = regions.length ? Math.round(a.equity * r.regionShare) : 0;
  const why = (s: InstrumentStats) =>
    r.regions === 'lowest_vol'
      ? `Steadiest region: ups and downs of ${((s.volatilityBps ?? 0) / 100).toFixed(0)}% a year, ${pctTxt(longRet(s))}/yr over 10 years`
      : r.regions === 'best_return'
        ? `Grew ${pctTxt(longRet(s))}/yr over 10 years and is up ${pctTxt(s.return1yBps)} over the last year`
        : `Best long-run return per unit of risk among regions (${pctTxt(longRet(s))}/yr, volatility ${((s.volatilityBps ?? 0) / 100).toFixed(0)}%)`;
  if (add('ACWI', a.equity - regionShare, ['Core holding: thousands of companies across the world'])) {
    for (const s of regions) add(s.symbol, Math.round(regionShare / regions.length), [why(s)]);
  } else if (a.equity) add('SPY', a.equity, ['Broad shares fund (world fund data unavailable)']);
  add(has('BNDX') ? 'BNDX' : 'AGG', a.bond, ['Bonds steady the portfolio when shares fall']);
  add('GLD', a.gold, ['Gold has often held value in crises, wars and currency falls']);
  add('BIL', a.cash, ['Cash-like Treasury bills for money needed soon']);
  const final = normalise(picks);
  if (!final.length) return null;
  for (const p of final) {
    const s = by.get(p.symbol)!;
    if ((s.maxDrawdownBps ?? 0) < -4000) p.reasons.push(`Has fallen ${Math.abs((s.maxDrawdownBps ?? 0) / 100).toFixed(0)}% from a peak in the last 10 years`);
  }
  notes.push('All funds are priced in US dollars: if your currency weakens against the dollar, returns in your currency are higher, and lower if it strengthens.');
  return { id: r.id, name: r.name, summary: r.summary, picks: final, ...mixStats(final, stats), notes };
}

/** Five named, history-based mixes for a risk profile and horizon (deterministic). */
export function suggestMixes(stats: InstrumentStats[], risk: Risk, horizonYears: number, opts: { lowStability?: boolean; stressTested?: boolean } = {}): SuggestedMix[] {
  const out = RECIPES.map((r) => buildMix(r, stats, risk, horizonYears)).filter((m): m is SuggestedMix => !!m);
  // De-duplicate mixes that came out identical (e.g. too little data).
  const seen = new Set<string>();
  const unique = out.filter((m) => {
    const k = m.picks.map((p) => `${p.symbol}:${p.weightPct}`).join(',');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const resilient = unique.find((m) => m.id === 'resilient');
  if (resilient && (opts.lowStability || opts.stressTested)) resilient.suggested = true;
  else if (unique[0]) unique[0].suggested = true;
  return unique;
}

/** The core mix (kept for existing callers). */
export function suggestMix(stats: InstrumentStats[], risk: Risk, horizonYears: number): SuggestedMix {
  return suggestMixes(stats, risk, horizonYears).find((m) => m.id === 'core') ?? { id: 'core', name: 'Core', summary: '', picks: [], expectedReturnBps: null, volatilityBps: null, worstDrawdownBps: null, notes: [] };
}
