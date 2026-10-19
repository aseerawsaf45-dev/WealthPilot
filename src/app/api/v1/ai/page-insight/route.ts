/**
 * WealthPilot — "AI activity" for every page. POST /api/v1/ai/page-insight { segment, refresh? }
 *
 * Runs the page's server tools (numbers computed here), then — with AI consent — lets the model word a
 * short summary through the same grounded pipeline as the copilot (placeholders only, template fallback).
 * Cached per user + page while the numbers are unchanged, so tab switches don't spend AI quota.
 */

import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { authed, parseBody, ok } from '@/server/http';
import { rateLimit } from '@/server/rateLimit';
import { loadCopilotContext } from '@/server/ai/data';
import { resolveLlm } from '@/server/ai/gate';
import { answerQuestion } from '@/server/ai/orchestrator';
import { runTool } from '@/server/ai/tools';
import { SEGMENT_TOOLS } from '@/server/ai/commands';
import { getPageInsight, savePageInsight } from '@/server/repos/insights';
import { SEGMENTS, SEGMENT_IDS } from '@/lib/assistant';

export const maxDuration = 30;

const Body = z.object({ segment: z.enum(SEGMENT_IDS), refresh: z.boolean().default(false) });

export const POST = authed(async (request, { userId }) => {
  const { segment, refresh } = await parseBody(request, Body);
  await rateLimit('ai:page', [userId], 12, 60);

  const { consent, data } = await loadCopilotContext(userId);
  const seg = SEGMENT_TOOLS[segment];
  const call = seg.overview?.(data.today) ?? { name: 'get_insights', args: {} };
  const calls = call.name === 'get_insights' ? [call] : [call, { name: 'get_insights', args: {} }];

  // The cache key is the computed numbers themselves: any change in the user's data changes it.
  const computed = calls.map((c) => runTool(c.name, c.args, data));
  const dataHash = createHash('sha256').update(segment).update(JSON.stringify(computed.map((o) => [o.template, o.facts]))).digest('hex');
  if (!refresh) {
    const hit = await getPageInsight(userId, segment, dataHash);
    if (hit) return ok({ ...(hit.payload as object), cached: true, generatedAt: hit.createdAt });
  }

  const label = SEGMENTS.find((s) => s.id === segment)!.label;
  // Fixed server text (no user input), so nothing in it can steer the model.
  const question = `In two or three short sentences, say what matters most on the ${label} page right now and one useful next step.`;
  const { llm, limitations } = await resolveLlm(userId, consent);
  const answer = await answerQuestion(question, data, { llm, limitations }, { calls, narrate: true, scope: segment });
  const generatedAt = await savePageInsight(userId, segment, dataHash, answer as unknown as Prisma.InputJsonValue);
  return ok({ ...answer, cached: false, generatedAt });
});
