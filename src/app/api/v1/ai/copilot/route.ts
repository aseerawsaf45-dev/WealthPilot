/**
 * WealthPilot — AI copilot. POST /api/v1/ai/copilot  { message ≤ 500 chars }
 *
 * Works without AI consent (calculated answers only). With consent + GROQ_API_KEY, Groq may
 * phrase the answer, but every number still comes from server tools (plan §7).
 * Quotas: 5/min/user → 429. 20/day/user and a shared per-minute budget → calculated answers, not errors.
 */

import { z } from 'zod';
import { authed, parseBody, ok } from '@/server/http';
import { rateLimit, rateLimitHit } from '@/server/rateLimit';
import { loadCopilotContext } from '@/server/ai/data';
import { canUseLlm } from '@/server/ai/privacy';
import { groqClient } from '@/server/ai/providers';
import { answerQuestion } from '@/server/ai/orchestrator';

export const maxDuration = 30; // two model calls with 8 s timeouts + DB

const Body = z.object({ message: z.string().trim().min(1, 'Ask a question.').max(500, 'Keep questions under 500 characters.') });

export const POST = authed(async (request, { userId }) => {
  const { message } = await parseBody(request, Body);
  await rateLimit('ai:min', [userId], 5, 60);

  const { consent, data } = await loadCopilotContext(userId); // consent read from the DB, never the token
  const limitations: string[] = [];
  let llm = canUseLlm(consent, 'groq') ? groqClient() : null;

  if (canUseLlm(consent, 'groq') && !llm) {
    limitations.push("AI wording isn't configured on this server; showing calculated results.");
  }
  if (llm && !(await rateLimitHit('ai:day', [userId], 20, 24 * 60 * 60)).allowed) {
    llm = null;
    limitations.push("You've reached today's AI limit; showing calculated results.");
  }
  // Groq's free tier allows ~8K tokens/min for the whole app (~3 questions); overflow uses calculated answers.
  if (llm && !(await rateLimitHit('ai:global', ['all'], 3, 60)).allowed) {
    llm = null;
    limitations.push('The AI is busy right now; showing calculated results.');
  }

  return ok(await answerQuestion(message, data, { llm, limitations }));
});
