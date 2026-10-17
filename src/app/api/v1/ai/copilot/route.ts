/**
 * WealthPilot — AI copilot. POST /api/v1/ai/copilot  { message ≤ 500 chars }
 *
 * Works without AI consent (calculated answers only). With consent, Groq (or opted-in Gemini as
 * backup) may phrase the answer, but every number still comes from server tools (plan §7).
 * Quotas: 5/min/user → 429; daily and shared limits → calculated answers (src/server/ai/gate.ts).
 */

import { z } from 'zod';
import { authed, parseBody, ok } from '@/server/http';
import { rateLimit } from '@/server/rateLimit';
import { loadCopilotContext } from '@/server/ai/data';
import { resolveLlm } from '@/server/ai/gate';
import { answerQuestion } from '@/server/ai/orchestrator';

export const maxDuration = 30; // two model calls with 8 s timeouts + DB

const Body = z.object({ message: z.string().trim().min(1, 'Ask a question.').max(500, 'Keep questions under 500 characters.') });

export const POST = authed(async (request, { userId }) => {
  const { message } = await parseBody(request, Body);
  await rateLimit('ai:min', [userId], 5, 60);

  const { consent, data } = await loadCopilotContext(userId); // consent read from the DB, never the token
  const { llm, limitations } = await resolveLlm(userId, consent);
  return ok(await answerQuestion(message, data, { llm, limitations }));
});
