/**
 * Loan maths in integer minor units. Rates are basis points (1% = 100 bps); rate arithmetic uses
 * floats only as ratios, every amount is rounded to an integer.
 */

export interface AmortRow {
  month: number;
  paymentCents: number;
  interestCents: number;
  principalCents: number;
  balanceCents: number;
}

export interface Amortization {
  emiCents: number;
  schedule: AmortRow[];
  totalInterestCents: number;
  totalPaidCents: number;
}

const monthlyRate = (aprBps: number) => aprBps / 10_000 / 12;

/** Fixed monthly payment (EMI). Zero APR → principal / months. */
export function emi(principalCents: number, aprBps: number, months: number): number {
  if (months <= 0 || principalCents <= 0) return 0;
  const r = monthlyRate(aprBps);
  if (r === 0) return Math.ceil(principalCents / months);
  return Math.ceil((principalCents * r) / (1 - (1 + r) ** -months));
}

/** Full schedule; the last payment absorbs rounding so the balance ends at exactly 0. */
export function amortize(principalCents: number, aprBps: number, months: number, extraMonthlyCents = 0): Amortization {
  const pay = emi(principalCents, aprBps, months);
  const r = monthlyRate(aprBps);
  const schedule: AmortRow[] = [];
  let balance = principalCents;
  let totalInterest = 0;
  for (let m = 1; balance > 0 && m <= Math.max(months, 1) * 2 + 1; m++) {
    const interest = Math.round(balance * r);
    let payment = pay + extraMonthlyCents;
    if (payment >= balance + interest) payment = balance + interest;
    const principal = payment - interest;
    balance -= principal;
    totalInterest += interest;
    schedule.push({ month: m, paymentCents: payment, interestCents: interest, principalCents: principal, balanceCents: balance });
  }
  return { emiCents: pay, schedule, totalInterestCents: totalInterest, totalPaidCents: principalCents + totalInterest };
}

/**
 * Effective annual rate (bps) including upfront fees: the rate at which the payments repay only the
 * cash actually received (principal − fee). Bisection; display only.
 */
export function effectiveAprBps(principalCents: number, feeCents: number, aprBps: number, months: number): number {
  const pay = emi(principalCents, aprBps, months);
  const received = principalCents - feeCents;
  if (received <= 0 || pay <= 0) return aprBps;
  const pv = (r: number) => (r === 0 ? pay * months : (pay * (1 - (1 + r) ** -months)) / r);
  let lo = 0;
  let hi = 1; // 1200% APR monthly upper bound
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (pv(mid) > received) lo = mid;
    else hi = mid;
  }
  return Math.round(((lo + hi) / 2) * 12 * 10_000);
}

/** Largest loan whose EMI fits in `emiCents` (inverse of emi, rounded down). */
export function maxPrincipal(emiCents: number, aprBps: number, months: number): number {
  if (emiCents <= 0 || months <= 0) return 0;
  const r = monthlyRate(aprBps);
  let p = Math.floor(r === 0 ? emiCents * months : (emiCents * (1 - (1 + r) ** -months)) / r);
  while (p > 0 && emi(p, aprBps, months) > emiCents) p--; // emi rounds up; step down past the edge
  return p;
}

/**
 * How much the user can borrow: monthly room at 36% (healthy) and 43% (most lenders' limit) of
 * income after existing debt payments, and the loan each buys at this rate and term.
 */
export function borrowCapacity(monthlyIncomeCents: number, existingMinimumsCents: number, aprBps: number, months: number) {
  if (monthlyIncomeCents <= 0) return null;
  const room = (pct: number) => Math.max(0, Math.floor((monthlyIncomeCents * pct) / 100) - existingMinimumsCents);
  const safeEmiCents = room(36);
  const maxEmiCents = room(43);
  return { safeEmiCents, maxEmiCents, safePrincipalCents: maxPrincipal(safeEmiCents, aprBps, months), maxPrincipalCents: maxPrincipal(maxEmiCents, aprBps, months) };
}

export type DtiBand = 'healthy' | 'stretched' | 'risky' | 'unknown';

/** Debt-to-income after the new loan: (new EMI + existing minimums) / average monthly income. */
export function affordability(newEmiCents: number, existingMinimumsCents: number, monthlyIncomeCents: number): { dtiPct: number | null; band: DtiBand } {
  if (monthlyIncomeCents <= 0) return { dtiPct: null, band: 'unknown' };
  const dtiPct = Math.round(((newEmiCents + existingMinimumsCents) * 1000) / monthlyIncomeCents) / 10;
  return { dtiPct, band: dtiPct <= 36 ? 'healthy' : dtiPct <= 43 ? 'stretched' : 'risky' };
}

/** What paying extra each month (and/or a lump sum now) saves on a loan. */
export function prepaymentSavings(principalCents: number, aprBps: number, months: number, extraMonthlyCents: number, lumpCents = 0) {
  const base = amortize(principalCents, aprBps, months);
  // Same EMI (+ extra) on the reduced balance: the term shortens, the payment doesn't drop.
  const sameEmi = amortizeWithPayment(principalCents - lumpCents, aprBps, base.emiCents + extraMonthlyCents);
  return {
    monthsSaved: Math.max(0, base.schedule.length - sameEmi.schedule.length),
    interestSavedCents: Math.max(0, base.totalInterestCents - sameEmi.totalInterestCents),
    newMonths: sameEmi.schedule.length,
  };
}

function amortizeWithPayment(principalCents: number, aprBps: number, paymentCents: number): Amortization {
  const r = monthlyRate(aprBps);
  const schedule: AmortRow[] = [];
  let balance = Math.max(0, principalCents);
  let totalInterest = 0;
  for (let m = 1; balance > 0 && m <= 1200; m++) {
    const interest = Math.round(balance * r);
    const payment = Math.min(paymentCents, balance + interest);
    if (payment <= interest) break; // never pays off
    balance -= payment - interest;
    totalInterest += interest;
    schedule.push({ month: m, paymentCents: payment, interestCents: interest, principalCents: payment - interest, balanceCents: balance });
  }
  return { emiCents: paymentCents, schedule, totalInterestCents: totalInterest, totalPaidCents: principalCents + totalInterest };
}

export interface OfferInput {
  id?: string;
  name: string;
  lender: string;
  principalCents: number;
  aprBps: number;
  termMonths: number;
  feeCents: number;
}

/** Side-by-side cost of offers, cheapest total cost first. */
export function compareOffers(offers: OfferInput[]) {
  return offers
    .map((o) => {
      const a = amortize(o.principalCents, o.aprBps, o.termMonths);
      return { ...o, emiCents: a.emiCents, totalInterestCents: a.totalInterestCents, totalCostCents: a.totalInterestCents + o.feeCents, effectiveAprBps: effectiveAprBps(o.principalCents, o.feeCents, o.aprBps, o.termMonths) };
    })
    .sort((a, b) => a.totalCostCents - b.totalCostCents);
}
