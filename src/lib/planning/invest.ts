/**
 * Investment projection (deterministic, explainable). Expected return comes from the country's
 * deposit rate plus a risk premium, adjusted for political stability; the range is a lognormal
 * band (P10/P50/P90) from a fixed volatility per risk profile, no random simulation.
 * Money is integer minor units of the plan currency; rates are basis points.
 */

import { SCENARIOS, SHOCK_EXPOSURE, type ScenarioId } from './scenarios';

export type RiskProfile = 'conservative' | 'balanced' | 'growth';

export interface MacroPoint {
  value: number;
  year: string;
}

/** World Bank indicators for one country (any can be missing). */
export interface CountryMacroData {
  country: string;
  inflationPct: MacroPoint | null;
  lendingRatePct: MacroPoint | null;
  depositRatePct: MacroPoint | null;
  realRatePct: MacroPoint | null;
  gdpGrowthPct: MacroPoint | null;
  politicalStability: MacroPoint | null; // −2.5 (unstable) … +2.5 (stable)
  depreciationPctPerYear: MacroPoint | null; // average yearly loss of the local currency vs USD (negative = it gained)
  source: string;
  fetchedAt: string;
}

export const RISK: Record<RiskProfile, { label: string; premiumBps: number; volBps: number; description: string }> = {
  conservative: { label: 'Conservative', premiumBps: 0, volBps: 500, description: 'Mostly deposits and bonds' },
  balanced: { label: 'Balanced', premiumBps: 300, volBps: 1000, description: 'A mix of bonds and shares' },
  growth: { label: 'Growth', premiumBps: 500, volBps: 1600, description: 'Mostly shares' },
};

export interface ReturnAssumption {
  returnBps: number;
  volBps: number;
  inflationBps: number;
  depreciationBps: number;
  notes: string[];
}

/** Expected yearly return and risk for a plan, from country data (or labelled fallbacks). */
export function assumptions(macro: CountryMacroData | null, risk: RiskProfile, overrideReturnBps?: number | null): ReturnAssumption {
  const notes: string[] = [];
  const r = RISK[risk];
  const bps = (p: MacroPoint | null) => (p ? Math.round(p.value * 100) : null);
  const inflation = bps(macro?.inflationPct ?? null);
  const deposit = bps(macro?.depositRatePct ?? null);
  const lending = bps(macro?.lendingRatePct ?? null);
  let base: number;
  if (deposit !== null) {
    base = deposit;
    notes.push(`Base return = deposit rate ${macro!.depositRatePct!.value.toFixed(1)}% (${macro!.depositRatePct!.year}).`);
  } else if (lending !== null) {
    base = lending - 300;
    notes.push(`No deposit rate published; base = lending rate ${macro!.lendingRatePct!.value.toFixed(1)}% − 3%.`);
  } else if (inflation !== null) {
    base = inflation + 100;
    notes.push('No interest-rate data; base = inflation + 1%.');
  } else {
    base = 500;
    notes.push('No country data; base return assumed 5%.');
  }
  let ret = base + r.premiumBps;
  let vol = r.volBps;
  if (r.premiumBps) notes.push(`${r.label} adds a ${r.premiumBps / 100}% risk premium for shares.`);
  const ps = macro?.politicalStability?.value;
  if (ps !== undefined && ps !== null) {
    if (ps < -1) {
      ret -= 150;
      vol += 400;
      notes.push(`Political stability ${ps.toFixed(2)} (very low): −1.5% expected return, wider range.`);
    } else if (ps < 0) {
      ret -= 50;
      vol += 200;
      notes.push(`Political stability ${ps.toFixed(2)} (below average): −0.5% expected return, wider range.`);
    }
  }
  if (overrideReturnBps !== undefined && overrideReturnBps !== null) {
    ret = overrideReturnBps;
    notes.push(`You set the expected return to ${(overrideReturnBps / 100).toFixed(1)}%.`);
  }
  return { returnBps: ret, volBps: vol, inflationBps: inflation ?? 300, depreciationBps: bps(macro?.depreciationPctPerYear ?? null) ?? 0, notes: inflation === null ? [...notes, 'Inflation assumed 3%.'] : notes };
}

export interface ProjectionPoint {
  month: number;
  contributedCents: number;
  medianCents: number;
  lowCents: number; // P10
  highCents: number; // P90
  realCents: number; // median in today's money (after inflation)
  usdTermsCents: number; // median after the currency's trend vs USD (same currency units, adjusted)
}

export interface Projection {
  points: ProjectionPoint[]; // yearly (and the final month)
  final: ProjectionPoint;
  afterTaxCents: number;
  gainCents: number;
  stressLossPct: number | null; // worst-year drop with the chosen scenarios vs no scenario
}

const Z90 = 1.2816;

export function projectInvestment(input: {
  initialCents: number;
  monthlyCents: number;
  months: number;
  a: ReturnAssumption;
  taxBps?: number;
  scenarios?: ScenarioId[];
  risk: RiskProfile;
}): Projection {
  const { initialCents, monthlyCents, months, a } = input;
  const exposure = SHOCK_EXPOSURE[input.risk];
  const chosen = SCENARIOS.filter((s) => input.scenarios?.includes(s.id));
  let bal = initialCents;
  let baseline = initialCents;
  let contributed = initialCents;
  let weightedYears = 0; // contribution-weighted time invested, for the band width
  let inflationIndex = 1;
  let fxIndex = 1;
  let worst = 0;
  const points: ProjectionPoint[] = [];

  for (let m = 1; m <= months; m++) {
    let retBps = a.returnBps;
    let infBps = a.inflationBps;
    let depBps = a.depreciationBps;
    for (const s of chosen) {
      if (m === 1) bal = Math.round(bal * (1 + (s.shockPct / 100) * exposure));
      if (m <= s.months) {
        retBps += s.driftBpsPerYear * exposure;
        infBps += s.inflationAddBps;
        depBps += s.depreciationAddBps;
      }
    }
    bal = Math.round(bal * (1 + retBps / 10_000 / 12)) + monthlyCents;
    baseline = Math.round(baseline * (1 + a.returnBps / 10_000 / 12)) + monthlyCents;
    contributed += monthlyCents;
    inflationIndex *= 1 + infBps / 10_000 / 12;
    fxIndex *= 1 - depBps / 10_000 / 12;
    if (m <= 12 && baseline > 0) worst = Math.min(worst, (bal - baseline) / baseline);

    if (m % 12 === 0 || m === months) {
      weightedYears = contributed > 0 ? (initialCents * (m / 12) + monthlyCents * ((m * (m - 1)) / 2) / 12) / contributed : 0;
      const spread = (a.volBps / 10_000) * Math.sqrt(Math.max(0, weightedYears));
      points.push({
        month: m,
        contributedCents: contributed,
        medianCents: bal,
        lowCents: Math.round(bal * Math.exp(-Z90 * spread)),
        highCents: Math.round(bal * Math.exp(Z90 * spread)),
        realCents: Math.round(bal / inflationIndex),
        usdTermsCents: Math.round(bal * fxIndex),
      });
    }
  }
  const final = points[points.length - 1] ?? { month: 0, contributedCents: initialCents, medianCents: initialCents, lowCents: initialCents, highCents: initialCents, realCents: initialCents, usdTermsCents: initialCents };
  const gain = final.medianCents - final.contributedCents;
  const tax = gain > 0 ? Math.round((gain * (input.taxBps ?? 0)) / 10_000) : 0;
  return { points, final, afterTaxCents: final.medianCents - tax, gainCents: gain, stressLossPct: chosen.length ? Math.round(worst * 1000) / 10 : null };
}

/** Yearly return after tax and inflation, in bps (what a debt's APR is compared against). */
export function realAfterTaxReturnBps(a: ReturnAssumption, taxBps = 0): number {
  return Math.round(a.returnBps * (1 - taxBps / 10_000) - a.inflationBps);
}
