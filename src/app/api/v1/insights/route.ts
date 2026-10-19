/**
 * WealthPilot — Deterministic insights (plan §8: ML-01..05). GET /api/v1/insights
 * Recurring payments, unusual charges, 30/60/90-day forecast, month-over-month, budget pace, goal ETAs.
 * Pure server computation over the session user's data; no AI provider is called.
 */

import { authed, ok } from '@/server/http';
import { rateLimit } from '@/server/rateLimit';
import { loadCopilotContext } from '@/server/ai/data';
import { insightReport } from '@/server/ai/tools';

export const GET = authed(async (_request, { userId }) => {
  await rateLimit('insights', [userId], 30, 60);
  const { data } = await loadCopilotContext(userId);
  const report = insightReport(data);
  return ok({ ...report, fxNote: data.fxNote ?? null });
});
