/**
 * WealthPilot — Monthly report (API-09). GET /api/v1/reports/monthly?month=YYYY-MM
 * Income, spending, net and per-category totals in the user's base currency, vs the previous month.
 */

import { authed, ok, HttpError } from '@/server/http';
import { rateLimit } from '@/server/rateLimit';
import { monthYear } from '@/server/schemas';
import { loadCopilotContext } from '@/server/ai/data';
import { monthSummary, pctChange, addMonths } from '@/lib/ml';

export const GET = authed(async (request, { userId }) => {
  await rateLimit('reports', [userId], 30, 60);
  const { data } = await loadCopilotContext(userId);
  const raw = request.nextUrl.searchParams.get('month') ?? data.today.slice(0, 7);
  const parsed = monthYear.safeParse(raw);
  if (!parsed.success) throw new HttpError('VALIDATION_ERROR', 'Use month=YYYY-MM.', 400);
  const month = parsed.data;
  const rows = data.transactions.filter((t) => t.currency === data.currency);
  const current = monthSummary(rows, month);
  const previous = monthSummary(rows, addMonths(`${month}-01`, -1).slice(0, 7));
  return ok({
    month,
    currency: data.currency,
    current,
    previous,
    incomeChangePct: pctChange(previous.incomeCents, current.incomeCents),
    expenseChangePct: pctChange(previous.expenseCents, current.expenseCents),
    notes: [...(data.fxNote ? [data.fxNote] : []), 'Transfers between your own accounts are excluded.'],
  });
});
