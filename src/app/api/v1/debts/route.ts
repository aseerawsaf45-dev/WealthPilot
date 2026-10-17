/**
 * WealthPilot — Debts. GET/POST /api/v1/debts (payoff schedules stay client-side, pure)
 */

import { authed, parseBody, ok } from '@/server/http';
import { DebtInput } from '@/server/schemas';
import { listDebts, createDebt } from '@/server/repos/planning';

export const GET = authed(async (_request, { userId }) => ok(await listDebts(userId)));

export const POST = authed(async (request, { userId }) => ok(await createDebt(userId, await parseBody(request, DebtInput)), 201));
