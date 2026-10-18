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
import { SEGMENT_IDS } from '@/lib/assistant';

export const maxDuration = 30; // two model calls with 8 s timeouts + DB

// scope = the "/segment" picked in the chat; a scope alone asks for that segment's overview.
const Body = z
  .object({ message: z.string().trim().max(500, 'Keep questions under 500 characters.').default(''), scope: z.enum(SEGMENT_IDS).optional() })
  .refine((b) => b.message || b.scope, { message: 'Ask a question.', path: ['message'] });

export const POST = authed(async (request, { userId }) => {
  const { message, scope } = await parseBody(request, Body);
  await rateLimit('ai:min', [userId], 5, 60);

  const { consent, data } = await loadCopilotContext(userId); // consent read from the DB, never the token
  const { llm, limitations } = await resolveLlm(userId, consent);
  return ok(await answerQuestion(message, data, { llm, limitations }, { scope }));
});
