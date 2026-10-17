/**
 * WealthPilot — Accounts. GET/POST /api/v1/accounts
 */

import { authed, parseBody, ok } from '@/server/http';
import { AccountInput } from '@/server/schemas';
import { listAccounts, createAccount } from '@/server/repos/ledger';

export const GET = authed(async (_request, { userId }) => ok(await listAccounts(userId)));

export const POST = authed(async (request, { userId }) => ok(await createAccount(userId, await parseBody(request, AccountInput)), 201));
