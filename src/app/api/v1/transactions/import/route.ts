/**
 * WealthPilot — CSV import commit. POST /api/v1/transactions/import  { accountId, rows[] ≤ 2000 }
 * Parsing stays in the browser; the raw file never reaches the server. Rows are re-validated here.
 */

import { authed, parseBody, ok } from '@/server/http';
import { rateLimit } from '@/server/rateLimit';
import { ImportInput } from '@/server/schemas';
import { importTransactions } from '@/server/repos/ledger';

export const POST = authed(async (request, { userId }) => {
  const { accountId, rows } = await parseBody(request, ImportInput);
  await rateLimit('import', [userId], 5, 60 * 60);
  return ok(await importTransactions(userId, accountId, rows), 201);
});
