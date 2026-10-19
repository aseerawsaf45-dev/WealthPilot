/**
 * WealthPilot — Apply confirmed category suggestions (ML-01). POST /api/v1/transactions/recategorize
 * { items: [{ id, category }] ≤ 100 } → the updated transactions.
 */

import { z } from 'zod';
import { authed, parseBody, ok } from '@/server/http';
import { rateLimit } from '@/server/rateLimit';
import { recategorizeTransactions } from '@/server/repos/ledger';

const Body = z.object({
  items: z.array(z.object({ id: z.string().min(1).max(40), category: z.string().trim().min(1).max(60) })).min(1).max(100),
});

export const POST = authed(async (request, { userId }) => {
  const { items } = await parseBody(request, Body);
  await rateLimit('tx:bulk', [userId], 10, 60);
  return ok({ transactions: await recategorizeTransactions(userId, items) });
});
