/**
 * Stress-test scenarios for investment plans. Fixed, documented assumptions (not forecasts, no live
 * news): magnitudes are in the range of past episodes (2008 crisis, 2020 pandemic, 2022 energy shock,
 * currency crises). Each applies a one-off market drop, then a weaker return for a while, plus
 * extra inflation and local-currency depreciation. The drop is scaled by how risky the plan is.
 */

export type ScenarioId = 'conflict' | 'sanctions' | 'oil_shock' | 'rate_hike' | 'currency_crash' | 'political_instability' | 'recession';

export interface Scenario {
  id: ScenarioId;
  label: string;
  description: string;
  shockPct: number; // one-off change to a fully risky portfolio, e.g. -25
  driftBpsPerYear: number; // change to the yearly return during `months`
  months: number;
  inflationAddBps: number;
  depreciationAddBps: number; // extra yearly loss of the local currency vs USD
}

export const SCENARIOS: Scenario[] = [
  { id: 'conflict', label: 'Regional conflict / war', description: 'Fighting in or near the country: markets fall, prices and the currency weaken.', shockPct: -18, driftBpsPerYear: -300, months: 12, inflationAddBps: 300, depreciationAddBps: 500 },
  { id: 'sanctions', label: 'Sanctions & capital controls', description: 'International sanctions or limits on moving money abroad.', shockPct: -25, driftBpsPerYear: -400, months: 24, inflationAddBps: 500, depreciationAddBps: 1500 },
  { id: 'oil_shock', label: 'Oil / energy price shock', description: 'A jump in global energy prices raises costs and inflation.', shockPct: -10, driftBpsPerYear: -150, months: 12, inflationAddBps: 400, depreciationAddBps: 200 },
  { id: 'rate_hike', label: 'Global interest-rate hikes', description: 'Major central banks raise rates fast: bonds and shares reprice, money flows to the USD.', shockPct: -12, driftBpsPerYear: -100, months: 12, inflationAddBps: -100, depreciationAddBps: 300 },
  { id: 'currency_crash', label: 'Local currency crash', description: 'A sharp devaluation against major currencies.', shockPct: -8, driftBpsPerYear: 0, months: 12, inflationAddBps: 800, depreciationAddBps: 3000 },
  { id: 'political_instability', label: 'Election / political instability', description: 'Unrest or a disputed transfer of power.', shockPct: -12, driftBpsPerYear: -200, months: 18, inflationAddBps: 200, depreciationAddBps: 800 },
  { id: 'recession', label: 'Global recession', description: 'A worldwide downturn like 2008 or 2020.', shockPct: -30, driftBpsPerYear: -300, months: 18, inflationAddBps: -100, depreciationAddBps: 300 },
];

export const SCENARIO_IDS = SCENARIOS.map((s) => s.id) as [ScenarioId, ...ScenarioId[]];
export const scenarioById = (id: string) => SCENARIOS.find((s) => s.id === id);

/** How much of a market shock a plan feels. */
export const SHOCK_EXPOSURE = { conservative: 0.35, balanced: 0.7, growth: 1 } as const;

/** Scenarios worth testing for a country (low political stability, weak currency, high inflation). */
export function suggestedScenarios(macro: { politicalStability?: number | null; depreciationPctPerYear?: number | null; inflationPct?: number | null } | null): ScenarioId[] {
  if (!macro) return ['recession'];
  const out: ScenarioId[] = ['recession'];
  if ((macro.politicalStability ?? 0) < -0.5) out.push('political_instability');
  if ((macro.politicalStability ?? 0) < -1) out.push('conflict');
  if ((macro.depreciationPctPerYear ?? 0) > 4) out.push('currency_crash');
  if ((macro.inflationPct ?? 0) > 6) out.push('oil_shock');
  return out;
}
