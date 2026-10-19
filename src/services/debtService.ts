// Debt Payoff Planning Service: Snowball (lowest balance first) vs Avalanche (highest APR first)
import { DebtAccount, DebtPayoffComparison } from '../types/finance';

interface AmortizationMonth {
  month: number;
  remainingBalanceCents: number;
  interestChargedCents: number;
  principalPaidCents: number;
}

export function calculateDebtPayoffSchedule(
  debts: DebtAccount[],
  monthlyExtraPaymentCents: number,
  strategy: 'snowball' | 'avalanche'
): DebtPayoffComparison {
  if (debts.length === 0) {
    return {
      strategy,
      totalMonths: 0,
      totalInterestPaidCents: 0,
      monthlyExtraPaymentCents,
      debtOrder: [],
    };
  }

  // Clone debts with working balance
  const activeDebts = debts.map((d) => ({
    id: d.id,
    name: d.name,
    balanceCents: d.balanceCents,
    aprPercent: d.aprPercent,
    minPaymentCents: d.minimumPaymentCents,
    totalInterestCents: 0,
    payoffMonth: 0,
    isPaidOff: d.balanceCents <= 0,
  }));

  // Sort according to strategy:
  // Snowball: lowest balance first
  // Avalanche: highest APR first
  activeDebts.sort((a, b) => {
    if (strategy === 'snowball') {
      return a.balanceCents - b.balanceCents;
    } else {
      return b.aprPercent - a.aprPercent;
    }
  });

  let currentMonth = 0;
  const maxSimulationMonths = 360; // 30-year safety ceiling
  const balanceByMonth = [activeDebts.reduce((s, d) => s + Math.max(0, d.balanceCents), 0)];

  while (activeDebts.some((d) => !d.isPaidOff) && currentMonth < maxSimulationMonths) {
    if (currentMonth > 0) balanceByMonth.push(activeDebts.reduce((s, d) => s + Math.max(0, d.balanceCents), 0));
    currentMonth++;
    let freedUpFromPreviousDebts = 0;

    // First pass: Accrue monthly interest and pay minimums
    for (const debt of activeDebts) {
      if (debt.isPaidOff) {
        freedUpFromPreviousDebts += debt.minPaymentCents;
        continue;
      }

      // Monthly interest: (balance * (APR / 100)) / 12
      const monthlyRate = debt.aprPercent > 0 ? (debt.aprPercent / 100) / 12 : 0;
      const interestCents = Math.round(debt.balanceCents * monthlyRate);
      debt.balanceCents += interestCents;
      debt.totalInterestCents += interestCents;

      // Minimum payment applied
      const payment = Math.min(debt.balanceCents, debt.minPaymentCents);
      debt.balanceCents -= payment;

      if (debt.balanceCents <= 0) {
        debt.isPaidOff = true;
        debt.payoffMonth = currentMonth;
        // Remaining unpaid minimum becomes available for snowball/avalanche
        freedUpFromPreviousDebts += (debt.minPaymentCents - payment);
      }
    }

    // Second pass: Apply extra monthly payment + freed up payments to target debt
    let extraAvailable = monthlyExtraPaymentCents + freedUpFromPreviousDebts;

    for (const debt of activeDebts) {
      if (debt.isPaidOff || extraAvailable <= 0) continue;

      const extraApplied = Math.min(debt.balanceCents, extraAvailable);
      debt.balanceCents -= extraApplied;
      extraAvailable -= extraApplied;

      if (debt.balanceCents <= 0) {
        debt.isPaidOff = true;
        debt.payoffMonth = currentMonth;
      }
    }
  }

  // Calculate final totals
  const totalInterestPaidCents = activeDebts.reduce((acc, d) => acc + d.totalInterestCents, 0);

  return {
    strategy,
    totalMonths: currentMonth,
    totalInterestPaidCents,
    monthlyExtraPaymentCents,
    balanceByMonth: [...balanceByMonth, activeDebts.reduce((s, d) => s + Math.max(0, d.balanceCents), 0)],
    debtOrder: activeDebts.map((d) => ({
      id: d.id,
      name: d.name,
      payoffMonth: d.payoffMonth || currentMonth,
      interestPaidCents: d.totalInterestCents,
    })),
  };
}
