/**
 * WealthPilot — AI document reading. POST /api/v1/ai/extract { text, currencyHint, kindHint? }
 *
 * The browser reads the file (OCR / PDF text / spreadsheet) and sends TEXT only, never the file.
 * Needs the separate "documents" opt-in (Groq only). Text is redacted (card, account and phone
 * numbers, emails) before it leaves the server; the reply is grounded against the same text.
 * The user still reviews and edits every row before anything is saved.
 */

import { z } from 'zod';
import { authed, parseBody, ok, HttpError } from '@/server/http';
import { rateLimit, rateLimitHit } from '@/server/rateLimit';
import { loadCopilotContext } from '@/server/ai/data';
import { canReadDocuments, redactDocumentText } from '@/server/ai/privacy';
import { groqClient } from '@/server/ai/providers';
import { extractWithLlm, MAX_DOC_CHARS } from '@/server/ai/extract';
import { recordDocumentExtraction } from '@/server/repos/user';
import { Currency } from '@/server/schemas';

export const maxDuration = 30;

const Body = z.object({
  text: z.string().min(1).max(MAX_DOC_CHARS * 2),
  currencyHint: Currency,
  kindHint: z.enum(['receipt', 'statement', 'invoice']).optional(),
});

export const POST = authed(async (request, { userId }) => {
  const { text, currencyHint, kindHint } = await parseBody(request, Body);
  await rateLimit('ai:extract', [userId], 6, 60);

  const { consent, data } = await loadCopilotContext(userId);
  if (!canReadDocuments(consent)) throw new HttpError('AI_DISABLED', 'Turn on AI document reading first.', 403);
  const llm = groqClient();
  if (!llm) throw new HttpError('AI_UNAVAILABLE', "AI document reading isn't configured on this server.", 503);
  if (!(await rateLimitHit('ai:day', [userId], 20, 24 * 60 * 60)).allowed) throw new HttpError('RATE_LIMITED', "You've reached today's AI limit. The on-device result is still available.", 429);

  const redacted = redactDocumentText(text).slice(0, MAX_DOC_CHARS);
  try {
    const result = await extractWithLlm(llm, redacted, { currencyHint, today: data.today, kindHint });
    await recordDocumentExtraction(userId, result.rows.length, result.dropped);
    return ok({ ...result, redactedChars: text.length - redacted.length });
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError('AI_UNAVAILABLE', 'AI could not read this document. The on-device result is still available.', 503);
  }
});
