'use client';

import { useMemo } from 'react';
import { useFinance } from './FinanceContext';
import { buildInsights, type InsightReport, type MlTx } from '../lib/ml';
import { convertMinor } from '../lib/fx';
import { calculateNetWorth } from '../services/financeService';
import { useToday } from '../lib/dates';

/**
 * Deterministic insights over the data already loaded (signed in or demo). Every page shares one
 * memoized report; amounts in other currencies are converted to the base currency (rows without a
 * rate are left out, as in every other total).
 */
export function useInsights(): InsightReport {
  const { transactions, accounts, bills, budgets, goals, debts, preferences, fx } = useFinance();
  const currency = preferences.baseCurrency || 'USD';
  const today = useToday();

  return useMemo(() => {
    const txs: MlTx[] = [];
    for (const t of transactions) {
      if (t.currency === currency) {
        txs.push(t);
        continue;
      }
      const amount = convertMinor(t.amountCents, t.currency, currency, fx);
      if (amount === null) continue;
      txs.push({
        ...t,
        amountCents: amount,
        currency,
        splits: t.splits?.map((s) => ({ ...s, amountCents: convertMinor(s.amountCents, t.currency, currency, fx) ?? 0 })),
      });
    }
    const nw = calculateNetWorth(accounts, { base: currency, fx });
    let liquid = 0;
    for (const a of accounts) {
      if (!['checking', 'savings', 'cash'].includes(a.type) || a.balanceCents <= 0) continue;
      liquid += convertMinor(a.balanceCents, a.currency, currency, fx) ?? 0;
    }
    return buildInsights({
      today,
      currency,
      transactions: txs,
      bills,
      budgets,
      goals,
      debts,
      liquidCents: liquid,
      assetsCents: nw.totalAssetsCents,
      liabilitiesCents: nw.totalLiabilitiesCents,
    });
  }, [transactions, accounts, bills, budgets, goals, debts, currency, fx, today]);
}
