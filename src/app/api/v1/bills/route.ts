/**
 * WealthPilot — Bills. GET/POST /api/v1/bills (state derived in the user's timezone)
 */

import { authed, parseBody, ok } from '@/server/http';
import { BillInput } from '@/server/schemas';
import { listBills, createBill } from '@/server/repos/planning';
import { userToday } from '@/server/repos/user';

export const GET = authed(async (_request, { userId }) => ok(await listBills(userId, await userToday(userId))));

export const POST = authed(async (request, { userId }) => {
  const input = await parseBody(request, BillInput);
  return ok(await createBill(userId, input, await userToday(userId)), 201);
});
