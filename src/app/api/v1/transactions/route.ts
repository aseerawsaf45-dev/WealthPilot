/**
 * WealthPilot — Transactions. GET/POST /api/v1/transactions
 */

import { authed, parseBody, ok } from '@/server/http';
import { rateLimit } from '@/server/rateLimit';
import { TransactionInput } from '@/server/schemas';
import { listTransactions, createTransaction } from '@/server/repos/ledger';

export const GET = authed(async (_request, { userId }) => {
  await rateLimit('tx:read', [userId], 120, 60);
  return ok(await listTransactions(userId));
});

export const POST = authed(async (request, { userId }) => {
  await rateLimit('tx:write', [userId], 60, 60);
  return ok(await createTransaction(userId, await parseBody(request, TransactionInput)), 201);
});
