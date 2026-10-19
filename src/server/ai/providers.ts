/**
 * WealthPilot — LLM provider adapters (plan §7.1, §6.6). Plain fetch, no SDK.
 *
 * Groq (primary) and Gemini (opt-in backup) both speak the OpenAI chat-completions format.
 * 8 s timeout, one retry on 5xx, 429 surfaces as rate_limited. llmChain() tries providers in
 * order and tags the reply with the one that answered; if all fail, the orchestrator falls back
 * to calculated answers.
 */

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
  /** Set by llmChain: which provider produced this reply. */
  provider?: ProviderName;
}

export interface LlmRequest {
  messages: LlmMessage[];
  tools?: { type: 'function'; function: { name: string; description: string; parameters: unknown } }[];
  /** Ask for a JSON object reply (document extraction). */
  json?: boolean;
  maxTokens?: number;
}

/** The orchestrator depends on this shape only, so tests and evals can pass a fake. */
export type LlmClient = (req: LlmRequest) => Promise<LlmMessage>;
export type ProviderName = 'groq' | 'gemini';

export class ProviderError extends Error {
  constructor(public kind: 'rate_limited' | 'unavailable', message: string) {
    super(message);
  }
}

const TIMEOUT_MS = 8000;

function openAiCompatibleClient(name: ProviderName, url: string, key: string, model: string, extra: Record<string, unknown>): LlmClient {
  return async ({ messages, tools, json, maxTokens }) => {
    const body = {
      model,
      messages: messages.map(({ provider: _provider, ...m }) => m), // never send our own bookkeeping field
      temperature: json ? 0 : 0.2,
      max_completion_tokens: Math.min(maxTokens ?? 700, 1500),
      ...extra,
      ...(tools?.length && { tools, tool_choice: 'auto' }),
      ...(json && { response_format: { type: 'json_object' } }),
    };

    for (let attempt = 0; attempt < 2; attempt++) {
      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(TIMEOUT_MS),
          cache: 'no-store',
        });
      } catch {
        throw new ProviderError('unavailable', `${name} request failed or timed out`);
      }
      if (res.status === 429) throw new ProviderError('rate_limited', `${name} rate limit reached`);
      if (res.status >= 500 && attempt === 0) continue;
      if (!res.ok) throw new ProviderError('unavailable', `${name} returned ${res.status}`);
      const json = (await res.json().catch(() => null)) as { choices?: { message?: LlmMessage }[] } | null;
      const message = json?.choices?.[0]?.message;
      if (!message) throw new ProviderError('unavailable', `${name} returned no message`);
      return { ...message, provider: name };
    }
    throw new ProviderError('unavailable', `${name} unavailable`);
  };
}

/** Returns null when no key is configured. */
export function groqClient(): LlmClient | null {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
  // reasoning tokens count against Groq's 8K TPM, so keep reasoning short on gpt-oss models
  return openAiCompatibleClient('groq', 'https://api.groq.com/openai/v1/chat/completions', key, model, model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {});
}

/** Gemini free tier: only for users who opted in and whose region allows it (see privacy.ts canUseLlm). */
export function geminiClient(): LlmClient | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  return openAiCompatibleClient('gemini', 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', key, model, {});
}

/** Tries each client in order; the next one is used when one is rate-limited or down. */
export function llmChain(clients: LlmClient[]): LlmClient | null {
  if (!clients.length) return null;
  return async (req) => {
    let lastError: unknown;
    for (const client of clients) {
      try {
        return await client(req);
      } catch (e) {
        if (!(e instanceof ProviderError)) throw e;
        lastError = e;
      }
    }
    throw lastError;
  };
}
