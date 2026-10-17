/**
 * WealthPilot — Decides, per request, whether any model may be called and which ones.
 * Consent comes from the DB (canUseLlm). Quotas: 20/day/user and a shared per-minute budget
 * switch to calculated answers (with a note) instead of failing.
 */

import { rateLimitHit } from '../rateLimit';
import { canUseLlm, type AiConsentState } from './privacy';
import { groqClient, geminiClient, llmChain, type LlmClient } from './providers';

export async function resolveLlm(userId: string, consent: AiConsentState): Promise<{ llm: LlmClient | null; limitations: string[] }> {
  const limitations: string[] = [];
  const consented = canUseLlm(consent, 'groq') || canUseLlm(consent, 'gemini');
  if (!consented) return { llm: null, limitations };

  // Groq first; Gemini only as a backup for users who opted in and whose region allows it.
  const clients = [canUseLlm(consent, 'groq') ? groqClient() : null, canUseLlm(consent, 'gemini') ? geminiClient() : null].filter(
    (c): c is LlmClient => c !== null
  );
  const llm = llmChain(clients);
  if (!llm) {
    limitations.push("AI wording isn't configured on this server; showing calculated results.");
    return { llm: null, limitations };
  }
  if (!(await rateLimitHit('ai:day', [userId], 20, 24 * 60 * 60)).allowed) {
    limitations.push("You've reached today's AI limit; showing calculated results.");
    return { llm: null, limitations };
  }
  // Groq's free tier allows ~8K tokens/min for the whole app (~3 questions); overflow uses calculated answers.
  if (!(await rateLimitHit('ai:global', ['all'], 3, 60)).allowed) {
    limitations.push('The AI is busy right now; showing calculated results.');
    return { llm: null, limitations };
  }
  return { llm, limitations };
}
