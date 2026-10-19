/**
 * How debts, loans and investments affect each other (deterministic).
 * Both sides are compared in nominal terms: a debt's APR vs the plan's expected return after tax.
 */

import { calculateDebtPayoffSchedule } from '../../services/debtService';
import { compareOffers, emi } from './loans';
import type { DebtAccount } from '../../types/finance';

export interface DebtVsInvest {
  afterTaxReturnBps: number;
  payFirst: Array<{ id: string; name: string; aprBps: number }>; // debts dearer than the expected return
  investFirst: Array<{ id: string; name: string; aprBps: number }>;
  /** Interest saved by putting `monthlyCents` toward the dear debts first (avalanche) instead of investing it. */
  interestSavedCents: number;
  monthsSooner: number;
  /** What the same money would grow to if invested over the same months, gain only. */
  investGainCents: number;
  recommendation: 'pay_debt' | 'invest' | 'split' | 'no_debt';
}

export function payDebtOrInvest(debts: DebtAccount[], monthlyCents: number, returnBps: number, taxBps = 0): DebtVsInvest {
  const afterTaxReturnBps = Math.round(returnBps * (1 - taxBps / 10_000));
  const live = debts.filter((d) => d.balanceCents > 0);
  const tag = (d: DebtAccount) => ({ id: d.id, name: d.name, aprBps: Math.round(d.aprPercent * 100) });
  const payFirst = live.filter((d) => d.aprPercent * 100 > afterTaxReturnBps).map(tag);
  const investFirst = live.filter((d) => d.aprPercent * 100 <= afterTaxReturnBps).map(tag);
  if (!live.length) return { afterTaxReturnBps, payFirst, investFirst, interestSavedCents: 0, monthsSooner: 0, investGainCents: 0, recommendation: 'no_debt' };

  const dear = live.filter((d) => payFirst.some((p) => p.id === d.id));
  const base = calculateDebtPayoffSchedule(dear.length ? dear : live, 0, 'avalanche');
  const extra = calculateDebtPayoffSchedule(dear.length ? dear : live, monthlyCents, 'avalanche');
  const interestSaved = Math.max(0, base.totalInterestPaidCents - extra.totalInterestPaidCents);
  // Same money invested for as long as the faster payoff takes.
  const months = Math.max(1, extra.totalMonths);
  const r = afterTaxReturnBps / 10_000 / 12;
  let bal = 0;
  for (let m = 0; m < months; m++) bal = Math.round(bal * (1 + r)) + monthlyCents;
  const investGain = bal - monthlyCents * months;

  return {
    afterTaxReturnBps,
    payFirst,
    investFirst,
    interestSavedCents: interestSaved,
    monthsSooner: Math.max(0, base.totalMonths - extra.totalMonths),
    investGainCents: investGain,
    recommendation: !payFirst.length ? 'invest' : !investFirst.length ? 'pay_debt' : 'split',
  };
}

const PURPOSE_CATEGORY = { personal: 'personal_loan', car: 'car_loan', home: 'mortgage', education: 'student_loan', business: 'personal_loan' } as const;
export type LoanPurpose = keyof typeof PURPOSE_CATEGORY;

/** A taken loan becomes a debt in the Debt Planner: EMI is its minimum payment. */
export function loanToDebtInput(o: { name: string; lender: string; principalCents: number; aprBps: number; termMonths: number; purpose: LoanPurpose }, dueDateDay: number) {
  return {
    name: `${o.name} (${o.lender})`.slice(0, 80),
    balanceCents: o.principalCents,
    aprPercent: o.aprBps / 100,
    minimumPaymentCents: emi(o.principalCents, o.aprBps, o.termMonths),
    dueDateDay: Math.min(28, Math.max(1, dueDateDay)),
    category: PURPOSE_CATEGORY[o.purpose],
  };
}

/** Money left each month after spending, debt minimums and the EMIs of loans being considered. */
export function freeCashFlow(avgIncomeCents: number, avgSpendingCents: number, debts: DebtAccount[], consideringEmis: number[] = []): number {
  // shortcut: minimums are subtracted even if their payments are also in average spending (conservative); match payments to debts to fix.
  const minimums = debts.reduce((s, d) => s + d.minimumPaymentCents, 0);
  return avgIncomeCents - avgSpendingCents - minimums - consideringEmis.reduce((s, e) => s + e, 0);
}

/**
 * Net worth over time for two choices with the same monthly amount:
 *  A "invest": debts follow their minimums, the amount is invested every month;
 *  B "debt first": the amount goes to debts (avalanche) until they're gone, then is invested.
 * Yearly points; integer minor units.
 */
export function netWorthPaths(debts: DebtAccount[], monthlyCents: number, returnBps: number, months: number) {
  const r = returnBps / 10_000 / 12;
  const slow = calculateDebtPayoffSchedule(debts, 0, 'avalanche');
  const fast = calculateDebtPayoffSchedule(debts, monthlyCents, 'avalanche');
  const minOnly = slow.balanceByMonth ?? [0];
  const fastBal = fast.balanceByMonth ?? [0];
  const debtAt = (series: number[], m: number) => series[Math.min(m, series.length - 1)] ?? 0;
  // Same total outflow in both paths: the amount + all minimums. While debts remain, the payoff
  // simulation already rolls freed minimums onto the next debt; once all are paid they are invested.
  const minimums = debts.reduce((s, d) => s + d.minimumPaymentCents, 0);
  let investA = 0;
  let investB = 0;
  const points: Array<{ month: number; investCents: number; debtFirstCents: number }> = [];
  for (let m = 1; m <= months; m++) {
    investA = Math.round(investA * (1 + r)) + monthlyCents + (m > slow.totalMonths ? minimums : 0);
    investB = Math.round(investB * (1 + r)) + (m > fast.totalMonths ? monthlyCents + minimums : 0);
    if (m % 12 === 0 || m === months) points.push({ month: m, investCents: investA - debtAt(minOnly, m), debtFirstCents: investB - debtAt(fastBal, m) });
  }
  return points;
}

/** Offers being considered are alternatives: only the cheapest one's EMI counts against free cash flow. */
export function consideredEmis(offers: Array<{ name: string; lender: string; principalCents: number; aprBps: number; termMonths: number; feeCents: number; status: string }>): number[] {
  const best = compareOffers(offers.filter((o) => o.status === 'considering'))[0];
  return best ? [best.emiCents] : [];
}
