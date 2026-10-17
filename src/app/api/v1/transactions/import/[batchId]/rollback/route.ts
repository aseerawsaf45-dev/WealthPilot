/**
 * WealthPilot — Undo one import batch. POST /api/v1/transactions/import/:batchId/rollback
 */

import { authed, ok } from '@/server/http';
import { rateLimit } from '@/server/rateLimit';
import { rollbackImport } from '@/server/repos/ledger';

type Ctx = { params: Promise<{ batchId: string }> };

export const POST = authed<Ctx>(async (_request, { userId }, ctx) => {
  await rateLimit('import:rollback', [userId], 5, 60 * 60);
  const { batchId } = await ctx.params;
  return ok(await rollbackImport(userId, batchId));
});
