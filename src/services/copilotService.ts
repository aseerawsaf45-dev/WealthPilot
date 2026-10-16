// Grounded AI Financial Copilot Service with Intent Routing, Deterministic Arithmetic, and Adversarial Guardrails
import { Transaction, FinancialAccount, BudgetCategory, SavingsGoal, DebtAccount, CopilotMessage } from '../types/finance';
import { formatMoney } from '../lib/money';

export interface CopilotQueryContext {
  accounts: FinancialAccount[];
  transactions: Transaction[];
  budgets: BudgetCategory[];
  goals: SavingsGoal[];
  debts: DebtAccount[];
  isAiEnabled: boolean;
}

export function sanitizePromptInput(input: string): { isSafe: boolean; sanitized: string; flaggedReason?: string } {
  const lower = input.toLowerCase();
  const injectionTriggers = [
    'ignore previous instructions',
    'disregard all previous',
    'system prompt',
    'reveal secret',
    'drop table',
    'eval(',
    'execute transaction',
    'transfer money',
  ];

  for (const trigger of injectionTriggers) {
    if (lower.includes(trigger)) {
      return {
        isSafe: false,
        sanitized: input,
        flaggedReason: `Potential prompt manipulation detected: '${trigger}'`,
      };
    }
  }

  return { isSafe: true, sanitized: input.trim() };
}

export function executeCopilotQuery(
  rawQuery: string,
  context: CopilotQueryContext
): CopilotMessage {
  const messageId = `copilot_${Date.now()}`;
  const now = new Date().toISOString();

  // Guard 1: AI Kill Switch Check
  if (!context.isAiEnabled) {
    return {
      id: messageId,
      sender: 'assistant',
      timestamp: now,
      content: 'AI Financial Copilot is currently disabled in your Privacy Settings. WealthPilot operates in offline local privacy mode with zero external or model query processing.',
      evidence: {
        scope: 'Privacy Enforced',
        transactionCount: 0,
        dateRange: 'N/A',
        confidence: 'verified_fact',
      },
    };
  }

  // Guard 2: Prompt Injection and Safety Check
  const safety = sanitizePromptInput(rawQuery);
  if (!safety.isSafe) {
    return {
      id: messageId,
      sender: 'assistant',
      timestamp: now,
      content: `I detected an unsafe instruction or unsupported operational command (${safety.flaggedReason}). As a safety boundary, I only provide read-only financial insights grounded in your existing accounts and transactions.`,
      evidence: {
        scope: 'Safety Boundary',
        transactionCount: 0,
        dateRange: 'N/A',
        confidence: 'verified_fact',
      },
    };
  }

  const query = safety.sanitized.toLowerCase();
  const txs = context.transactions;

  // Intent 1: Spending summary this month
  if (query.includes('spending') || query.includes('summarize') || query.includes('expenses') || query.includes('how much did i spend')) {
    const expenseTxs = txs.filter((t) => t.amountCents < 0 && !t.isTransfer);
    const totalSpentCents = Math.abs(expenseTxs.reduce((sum, t) => sum + t.amountCents, 0));

    // Category breakdown
    const categoryTotals: Record<string, number> = {};
    expenseTxs.forEach((t) => {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Math.abs(t.amountCents);
    });

    const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
    const topCategoryList = sortedCategories
      .slice(0, 3)
      .map(([cat, cents]) => `${cat}: ${formatMoney(cents)} (${Math.round((cents / totalSpentCents) * 100)}%)`)
      .join(', ');

    return {
      id: messageId,
      sender: 'assistant',
      timestamp: now,
      content: `Your total recorded outflow is ${formatMoney(totalSpentCents)} across ${expenseTxs.length} expense transactions. Your top spending categories are ${topCategoryList}. Transfers between accounts are excluded to prevent double-counting.`,
      intent: 'spending_summary',
      evidence: {
        scope: 'Non-transfer Outflow Records',
        transactionCount: expenseTxs.length,
        dateRange: 'All active periods',
        reconciledTotalCents: totalSpentCents,
        confidence: 'verified_fact',
      },
    };
  }

  // Intent 2: Dining / Specific category spike
  if (query.includes('dining') || query.includes('food') || query.includes('restaurants')) {
    const diningTxs = txs.filter((t) => t.category.toLowerCase().includes('dining') || t.category.toLowerCase().includes('food'));
    const totalDiningCents = Math.abs(diningTxs.reduce((sum, t) => sum + t.amountCents, 0));
    const recentMerchants = Array.from(new Set(diningTxs.map((t) => t.merchant))).slice(0, 4);

    return {
      id: messageId,
      sender: 'assistant',
      timestamp: now,
      content: `You have spent ${formatMoney(totalDiningCents)} on Dining across ${diningTxs.length} transactions. Frequent merchants include ${recentMerchants.join(', ')}.`,
      intent: 'category_analysis',
      evidence: {
        scope: 'Dining Category Drill-down',
        transactionCount: diningTxs.length,
        dateRange: 'Current period',
        reconciledTotalCents: totalDiningCents,
        confidence: 'verified_fact',
      },
    };
  }

  // Intent 3: Duplicate detection
  if (query.includes('duplicate') || query.includes('double charge')) {
    const seenMap = new Map<string, Transaction[]>();
    txs.forEach((t) => {
      const key = `${t.financialDate}_${t.merchant.toLowerCase()}_${t.amountCents}`;
      if (!seenMap.has(key)) seenMap.set(key, []);
      seenMap.get(key)!.push(t);
    });

    const duplicates = Array.from(seenMap.values()).filter((arr) => arr.length > 1);
    if (duplicates.length === 0) {
      return {
        id: messageId,
        sender: 'assistant',
        timestamp: now,
        content: `I scanned all ${txs.length} transactions and found 0 exact duplicate matches with identical date, merchant, and amount.`,
        intent: 'duplicate_audit',
        evidence: {
          scope: 'Duplicate Scan',
          transactionCount: txs.length,
          dateRange: 'Full ledger',
          confidence: 'verified_fact',
        },
      };
    } else {
      const dupDetails = duplicates.map((d) => `${d[0].merchant} on ${d[0].financialDate} (${d.length}x for ${formatMoney(Math.abs(d[0].amountCents))})`).join('; ');
      return {
        id: messageId,
        sender: 'assistant',
        timestamp: now,
        content: `Found ${duplicates.length} potential duplicate groups: ${dupDetails}. Please review to confirm if any are accidental double postings.`,
        intent: 'duplicate_audit',
        evidence: {
          scope: 'Duplicate Scan',
          transactionCount: txs.length,
          dateRange: 'Full ledger',
          confidence: 'actionable_suggestion',
        },
      };
    }
  }

  // Intent 4: Debt comparison
  if (query.includes('debt') || query.includes('snowball') || query.includes('avalanche') || query.includes('payoff')) {
    const totalDebtCents = context.debts.reduce((sum, d) => sum + d.balanceCents, 0);
    return {
      id: messageId,
      sender: 'assistant',
      timestamp: now,
      content: `You currently have ${context.debts.length} active debt accounts with a total balance of ${formatMoney(totalDebtCents)}. In the Planning module, you can compare Snowball (which prioritizes lowest balances for psychological momentum) vs. Avalanche (which attacks high APR debt first to minimize total interest paid).`,
      intent: 'debt_inquiry',
      evidence: {
        scope: 'Liabilities Ledger',
        transactionCount: context.debts.length,
        dateRange: 'Current Liabilities',
        reconciledTotalCents: totalDebtCents,
        confidence: 'calculated_estimate',
      },
    };
  }

  // Intent 5: Goals & savings
  if (query.includes('goal') || query.includes('save') || query.includes('emergency fund')) {
    const activeGoals = context.goals.filter((g) => !g.isPaused);
    const totalTarget = activeGoals.reduce((s, g) => s + g.targetCents, 0);
    const totalCurrent = activeGoals.reduce((s, g) => s + g.currentCents, 0);
    const percentOverall = totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0;

    return {
      id: messageId,
      sender: 'assistant',
      timestamp: now,
      content: `You have ${activeGoals.length} active savings goals with ${formatMoney(totalCurrent)} saved toward your target of ${formatMoney(totalTarget)} (${percentOverall}% funded).`,
      intent: 'goal_tracking',
      evidence: {
        scope: 'Savings Goals',
        transactionCount: activeGoals.length,
        dateRange: 'All active targets',
        reconciledTotalCents: totalCurrent,
        confidence: 'verified_fact',
      },
    };
  }

  // Default Fallback
  return {
    id: messageId,
    sender: 'assistant',
    timestamp: now,
    content: `I am your WealthPilot Copilot. I can summarize your spending, explain category spikes, scan for duplicate charges, track savings goals, or evaluate debt payoff strategies. What would you like to review?`,
    intent: 'general_help',
    evidence: {
      scope: 'Active Workspace Ledger',
      transactionCount: txs.length,
      dateRange: 'All records',
      confidence: 'verified_fact',
    },
  };
}
