import type { SavingsGoal } from '../types/finance';

const MAX_AGE_DAYS = 30;

/**
 * Why a saved goal plan no longer matches the goal, or null when it is current.
 * The plan stores the goal's values it was calculated from (`basis`).
 */
export function planStaleReason(goal: SavingsGoal, now = new Date()): string | null {
  const { plan, planUpdatedAt } = goal;
  if (!plan) return null;
  if (plan.basis.targetCents !== goal.targetCents) return 'The goal target changed';
  if (plan.basis.currentCents !== goal.currentCents) return 'Your savings changed';
  if ((plan.basis.targetDate ?? null) !== (goal.targetDate ?? null)) return 'The deadline changed';
  if (planUpdatedAt && now.getTime() - Date.parse(planUpdatedAt) > MAX_AGE_DAYS * 86_400_000) return 'Older than 30 days';
  return null;
}

/** "today", "yesterday", "5 days ago". */
export function daysAgo(iso: string, now = new Date()): string {
  const days = Math.floor((now.getTime() - Date.parse(iso)) / 86_400_000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
}
