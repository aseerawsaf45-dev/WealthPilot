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
import { canUseLlm } from '@/server/ai/privacy';
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

  const { consent, data } = await loadCopilotContext(userId);
  // Calculated-only plans don't use the AI quota; AI-worded ones share the copilot's 5/min.
  const aiAllowed = canUseLlm(consent, 'groq') || canUseLlm(consent, 'gemini');
  await rateLimit(aiAllowed ? 'ai:min' : 'plan:calc', [userId], aiAllowed ? 5 : 20, 60);
  const goal = data.goals.find((g) => g.id === id);
  if (!goal) throw new HttpError('NOT_FOUND', 'Goal not found.', 404);
  const args = { goalName: goal.name, ...(targetDate && { targetDate }) };

  const { llm, limitations } = aiAllowed ? await resolveLlm(userId, consent) : { llm: null, limitations: [] };
  // Matched by id (two goals may share a name), calculated once and handed to the narrator as-is.
  const plan = planGoal({ ...args, goalId: goal.id }, data);
  const answer = await answerQuestion(PLAN_QUESTION, data, { llm, limitations }, { calls: [{ name: 'plan_goal', args }], outputs: [plan], narrate: true });

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
    contingencies: plan.contingencies.map((c) => ({ ...c, summary: fill(c.summary) })),
    limitations: answer.limitations,
    source: answer.source,
    targetDate: targetDate ?? goal.targetDate ?? null,
    basis: {
      targetCents: goal.targetCents,
      currentCents: goal.currentCents,
      targetDate: goal.targetDate ?? null,
      avgIncomeCents: plan.averages?.incomeCents,
      avgSpendingCents: plan.averages?.spendingCents,
    },
  };
  // Saved on the goal so the card shows it and reopening needs no recalculation (or AI quota).
  return ok({ plan: snapshot, goal: await saveGoalPlan(userId, id, snapshot) });
});
