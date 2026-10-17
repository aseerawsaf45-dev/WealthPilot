/**
 * WealthPilot — LLM provider adapter (plan §7.1, §6.6). Plain fetch, no SDK.
 *
 * Groq (OpenAI-compatible) only. 8 s timeout, one retry on 5xx, 429 surfaces as rate_limited
 * so the orchestrator falls back to calculated answers. Gemini is a stretch goal (same call
 * shape) and is deliberately not wired yet.
 */

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

export interface LlmRequest {
  messages: LlmMessage[];
  tools?: { type: 'function'; function: { name: string; description: string; parameters: unknown } }[];
}

/** The orchestrator depends on this shape only, so tests and evals can pass a fake. */
export type LlmClient = (req: LlmRequest) => Promise<LlmMessage>;

export class ProviderError extends Error {
  constructor(public kind: 'rate_limited' | 'unavailable', message: string) {
    super(message);
  }
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const TIMEOUT_MS = 8000;

/** Returns null when no key is configured (the app then runs in calculated-answers mode). */
export function groqClient(): LlmClient | null {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
  const isReasoning = model.startsWith('openai/gpt-oss');

  return async ({ messages, tools }) => {
    const body = {
      model,
      messages,
      temperature: 0.2,
      max_completion_tokens: 700,
      ...(isReasoning && { reasoning_effort: 'low' }), // reasoning tokens count against the 8K TPM
      ...(tools?.length && { tools, tool_choice: 'auto' }),
    };

    for (let attempt = 0; attempt < 2; attempt++) {
      let res: Response;
      try {
        res = await fetch(GROQ_URL, {
          method: 'POST',
          headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(TIMEOUT_MS),
          cache: 'no-store',
        });
      } catch {
        throw new ProviderError('unavailable', 'Groq request failed or timed out');
      }
      if (res.status === 429) throw new ProviderError('rate_limited', 'Groq rate limit reached');
      if (res.status >= 500 && attempt === 0) continue;
      if (!res.ok) throw new ProviderError('unavailable', `Groq returned ${res.status}`);
      const json = (await res.json().catch(() => null)) as { choices?: { message?: LlmMessage }[] } | null;
      const message = json?.choices?.[0]?.message;
      if (!message) throw new ProviderError('unavailable', 'Groq returned no message');
      return message;
    }
    throw new ProviderError('unavailable', 'Groq unavailable');
  };
}
