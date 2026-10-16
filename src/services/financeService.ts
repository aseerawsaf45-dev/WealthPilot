// Core Financial Domain Calculations and Aggregations
import { FinancialAccount, Transaction, BudgetCategory } from '../types/finance';

export interface CashFlowSummary {
  totalIncomeCents: number;
  totalExpenseCents: number;
  netSavingsCents: number;
  savingsRatePercent: number;
}

export interface CategoryBreakdownItem {
  category: string;
  totalCents: number;
  percentage: number;
  transactionCount: number;
}

export function calculateNetWorth(accounts: FinancialAccount[]): {
  netWorthCents: number;
  totalAssetsCents: number;
  totalLiabilitiesCents: number;
} {
  let totalAssetsCents = 0;
  let totalLiabilitiesCents = 0;

  accounts.forEach((acc) => {
    if (!acc.isIncludedInNetWorth) return;

    if (acc.balanceCents >= 0) {
      totalAssetsCents += acc.balanceCents;
    } else {
      totalLiabilitiesCents += Math.abs(acc.balanceCents);
    }
  });

  return {
    netWorthCents: totalAssetsCents - totalLiabilitiesCents,
    totalAssetsCents,
    totalLiabilitiesCents,
  };
}

export function calculateCashFlow(transactions: Transaction[]): CashFlowSummary {
  let totalIncomeCents = 0;
  let totalExpenseCents = 0;

  transactions.forEach((tx) => {
    // Crucial rule: Exclude internal transfers from cash flow calculations!
    if (tx.isTransfer) return;

    if (tx.amountCents > 0) {
      totalIncomeCents += tx.amountCents;
    } else {
      totalExpenseCents += Math.abs(tx.amountCents);
    }
  });

  const netSavingsCents = totalIncomeCents - totalExpenseCents;
  const savingsRatePercent = totalIncomeCents > 0 ? Math.round((netSavingsCents / totalIncomeCents) * 100) : 0;

  return {
    totalIncomeCents,
    totalExpenseCents,
    netSavingsCents,
    savingsRatePercent,
  };
}

export function calculateCategoryBreakdown(transactions: Transaction[]): CategoryBreakdownItem[] {
  const map = new Map<string, { totalCents: number; count: number }>();
  let totalSpentCents = 0;

  transactions.forEach((tx) => {
    if (tx.isTransfer || tx.amountCents >= 0) return;

    const absCents = Math.abs(tx.amountCents);
    totalSpentCents += absCents;

    // Handle split transactions individually
    if (tx.splits && tx.splits.length > 0) {
      tx.splits.forEach((split) => {
        const splitAbs = Math.abs(split.amountCents);
        const existing = map.get(split.category) || { totalCents: 0, count: 0 };
        map.set(split.category, {
          totalCents: existing.totalCents + splitAbs,
          count: existing.count + 1,
        });
      });
    } else {
      const existing = map.get(tx.category) || { totalCents: 0, count: 0 };
      map.set(tx.category, {
        totalCents: existing.totalCents + absCents,
        count: existing.count + 1,
      });
    }
  });

  const results: CategoryBreakdownItem[] = [];
  map.forEach((val, category) => {
    const percentage = totalSpentCents > 0 ? Math.round((val.totalCents / totalSpentCents) * 100) : 0;
    results.push({
      category,
      totalCents: val.totalCents,
      percentage,
      transactionCount: val.count,
    });
  });

  return results.sort((a, b) => b.totalCents - a.totalCents);
}

export function autoCategorizeMerchant(
  merchantName: string,
  rules: Array<{ keyword: string; category: string }>
): string {
  const lower = merchantName.toLowerCase();
  for (const rule of rules) {
    if (lower.includes(rule.keyword.toLowerCase())) {
      return rule.category;
    }
  }
  return 'General';
}
