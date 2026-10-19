// Core Financial Domain Calculations and Aggregations
import { FinancialAccount, Transaction, BudgetCategory } from '../types/finance';
import { convertMinor, type FxRates } from '../lib/fx';

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

export interface Conversion {
  /** Currency the totals are in. Without it, amounts are added as-is (single-currency callers). */
  base?: string;
  fx?: FxRates | null;
}

/** Converts to the base currency; null = no rate (the amount is left out and reported). */
function toBase(amount: number, currency: string | undefined, conv: Conversion, missing: Set<string>, flags: { converted: boolean }): number | null {
  if (!conv.base || !currency || currency === conv.base) return amount;
  const v = convertMinor(amount, currency, conv.base, conv.fx);
  if (v === null) {
    missing.add(currency);
    return null;
  }
  flags.converted = true;
  return v;
}

export function calculateNetWorth(
  accounts: FinancialAccount[],
  conv: Conversion = {},
): {
  netWorthCents: number;
  totalAssetsCents: number;
  totalLiabilitiesCents: number;
  /** True when some balances were converted from another currency (the total is an estimate). */
  converted: boolean;
  /** Currencies left out because no exchange rate was available. */
  missingCurrencies: string[];
} {
  let totalAssetsCents = 0;
  let totalLiabilitiesCents = 0;
  const missing = new Set<string>();
  const flags = { converted: false };

  accounts.forEach((acc) => {
    if (!acc.isIncludedInNetWorth) return;
    const v = toBase(acc.balanceCents, acc.currency, conv, missing, flags);
    if (v === null) return;
    if (v >= 0) {
      totalAssetsCents += v;
    } else {
      totalLiabilitiesCents += Math.abs(v);
    }
  });

  return {
    netWorthCents: totalAssetsCents - totalLiabilitiesCents,
    totalAssetsCents,
    totalLiabilitiesCents,
    converted: flags.converted,
    missingCurrencies: [...missing],
  };
}

export function calculateCashFlow(transactions: Transaction[], conv: Conversion = {}): CashFlowSummary {
  let totalIncomeCents = 0;
  let totalExpenseCents = 0;
  const missing = new Set<string>();
  const flags = { converted: false };

  transactions.forEach((tx) => {
    // Crucial rule: Exclude internal transfers from cash flow calculations!
    if (tx.isTransfer) return;
    const v = toBase(tx.amountCents, tx.currency, conv, missing, flags);
    if (v === null) return;

    if (v > 0) {
      totalIncomeCents += v;
    } else {
      totalExpenseCents += Math.abs(v);
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
