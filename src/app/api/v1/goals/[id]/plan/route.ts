/**
 * WealthPilot — AI goal planner. POST /api/v1/goals/:id/plan  { targetDate? }
 *
 * Is this goal reachable by the date on the user's real income and spending, and how? Every
 * number comes from planGoal (server). With AI consent the model words the guidance (grounded,
 * template fallback); without it the calculated plan is returned. Same quotas as the copilot.
 */

import { z } from 'zod';
import { authed, parseBody, ok, HttpError, type IdContext } from '@/server/http';
import { rateLimit } from '@/server/rateLimit';
import { ymd } from '@/server/schemas';
import { loadCopilotContext } from '@/server/ai/data';
import { resolveLlm } from '@/server/ai/gate';
import { answerQuestion, fillPlaceholders } from '@/server/ai/orchestrator';
import { planGoal } from '@/server/ai/tools';
import { saveGoalPlan } from '@/server/repos/planning';
import type { GoalPlanSnapshot } from '@/types/finance';

export const maxDuration = 30;

const Body = z.object({ targetDate: ymd.optional() });
// Fixed server text: the goal name never goes into the question, so it can't inject instructions.
const PLAN_QUESTION = 'Explain whether this savings goal is reachable by its deadline and give a short, encouraging step-by-step plan.';

export const POST = authed<IdContext>(async (request, { userId }, ctx) => {
  const { id } = await ctx.params;
  const { targetDate } = await parseBody(request, Body);
  await rateLimit('ai:min', [userId], 5, 60);

  const { consent, data } = await loadCopilotContext(userId);
  const goal = data.goals.find((g) => g.id === id);
  if (!goal) throw new HttpError('NOT_FOUND', 'Goal not found.', 404);
  // planGoal matches by name; putting this goal first makes duplicate names resolve to it.
  const scoped = { ...data, goals: [goal, ...data.goals.filter((g) => g !== goal)] };
  const args = { goalName: goal.name, ...(targetDate && { targetDate }) };

  const { llm, limitations } = await resolveLlm(userId, consent);
  const plan = planGoal(args, scoped);
  const answer = await answerQuestion(PLAN_QUESTION, scoped, { llm, limitations }, { calls: [{ name: 'plan_goal', args }], narrate: true });

  // plan_goal is the only call, so its fact #i is fact f(i+1) in the answer.
  const factMap = new Map(answer.facts.map((f) => [f.id, f]));
  const fill = (text: string) => fillPlaceholders(text.replace(/\{\{#(\d+)\}\}/g, (_, i: string) => `{{f${Number(i) + 1}}}`), factMap, false) ?? text;

  const snapshot: GoalPlanSnapshot = {
    verdict: plan.verdict,
    answer: answer.answer,
    insights: answer.insights,
    facts: answer.facts,
    steps: plan.steps.map(fill),
    milestones: plan.milestones.map((m) => ({ label: m.label, date: String(plan.facts[m.factIndex].value) })),
    limitations: answer.limitations,
    source: answer.source,
    targetDate: targetDate ?? goal.targetDate ?? null,
    basis: { targetCents: goal.targetCents, currentCents: goal.currentCents, targetDate: goal.targetDate ?? null },
  };
  // Saved on the goal so the card shows it and reopening needs no recalculation (or AI quota).
  return ok({ plan: snapshot, goal: await saveGoalPlan(userId, id, snapshot) });
});
