/**
 * Signed-out demo: the same deterministic goal planner as the server (planGoal), run in the browser
 * over the in-memory demo data. Calculated text only; no AI, nothing leaves the page.
 */

import { planGoal, type FinanceData } from '../server/ai/tools';
import { formatFact } from './money';
import { todayYmd } from './dates';
import type { BillSubscription, BudgetCategory, CopilotFact, DebtAccount, GoalPlanSnapshot, SavingsGoal, Transaction } from '../types/finance';

export function demoGoalPlan(
  goal: SavingsGoal,
  state: { transactions: Transaction[]; budgets: BudgetCategory[]; goals: SavingsGoal[]; bills: BillSubscription[]; debts: DebtAccount[]; currency: string },
  targetDate?: string,
): GoalPlanSnapshot {
  const today = todayYmd();
  const data: FinanceData = {
    today,
    currency: state.currency,
    transactions: state.transactions,
    budgets: state.budgets.map((b) => ({ ...b, monthYear: today.slice(0, 7) })),
    goals: state.goals.map((g) => ({ ...g, targetDate: g.targetDate ?? null })),
    bills: state.bills,
    debts: state.debts,
  };
  const plan = planGoal({ goalName: goal.name, goalId: goal.id, ...(targetDate && { targetDate }) }, data);
  const facts: CopilotFact[] = plan.facts.map((f, i) => ({ ...f, id: `f${i + 1}` }) as CopilotFact);
  const fill = (text: string) => text.replace(/\{\{#(\d+)\}\}/g, (_, i: string) => (facts[Number(i)] ? formatFact(facts[Number(i)]) : ''));
  return {
    verdict: plan.verdict,
    answer: fill(plan.template),
    insights: [],
    facts,
    steps: plan.steps.map(fill),
    milestones: plan.milestones.map((m) => ({ label: m.label, date: String(plan.facts[m.factIndex].value) })),
    contingencies: plan.contingencies.map((c) => ({ ...c, summary: fill(c.summary) })),
    limitations: [...plan.limitations, 'Demo data: sign in to plan with your own income and spending.'],
    source: 'rules',
    targetDate: targetDate ?? goal.targetDate ?? null,
    basis: { targetCents: goal.targetCents, currentCents: goal.currentCents, targetDate: goal.targetDate ?? null, avgIncomeCents: plan.averages?.incomeCents, avgSpendingCents: plan.averages?.spendingCents },
  };
}
