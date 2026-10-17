---
name: wealthpilot-api-route
description: >-
  Recipe for adding or changing a WealthPilot backend route under src/app/api/v1/**
  (Next.js 16 route handlers + Prisma + Zod) as a full vertical slice: auth, tenant
  scoping, validation, rate limit, audit, response shape, FinanceContext wiring, tests.
  Use for any new endpoint, any change to an existing endpoint, or when moving a
  FinanceContext localStorage feature onto the server.
---

# WealthPilot API route (vertical slice)

Read `BACKEND_AND_AI_PLAN.md` §6 for the endpoint's contract first. If the endpoint is not there, add it to the plan before coding.

## Checklist (all required)

1. **Session first.** `const session = await requireSession(request)` (`src/server/http.ts`, created in SEC-03). It returns 401 itself. The user id comes **only** from the session, never from body, query or params.
2. **Validate input with Zod** at the top. Money arrives as an integer minor-unit number: `z.number().int().safe()`, then `BigInt(x)`. Dates are `YYYY-MM-DD` strings (`z.string().regex(/^\d{4}-\d{2}-\d{2}$/)`). Cap list sizes and string lengths.
3. **Scope every query** with `userId: session.userId`. For `:id` routes, use `findFirst({ where: { id, userId } })` (not `findUnique({ where: { id } })`) and return 404, not 403, when nothing matches, so ids from other users aren't revealed.
4. **Mutations** run in `prisma.$transaction` when more than one row changes (transfer pairs, imports, bill pay). Account balances are **derived** (opening + non-VOID sum), so never write a balance. Deletes of transactions are `status: VOID`. `importFingerprint` is set only on `CSV_IMPORT` rows. Write an `AuditEvent` through `writeAudit()` (hash-chained, from SEC-05) inside the same transaction. Audit `details` must not contain email, account numbers or merchant notes.
5. **Mutating routes** (POST/PATCH/DELETE) call `assertSameOrigin(request)` (CSRF defence on top of `SameSite=Lax`).
6. **Rate limit** where the plan's table says so: `await rateLimit(key, limit, windowSec)`.
7. **Response shape:** `ok(data, status?)` → `{ success: true, data }`; `fail(code, message, status)` → `{ success: false, error: { code, message } }`. Never return `error.message` from a caught exception. Log the error server-side and return `INTERNAL_ERROR`.
8. **BigInt** values serialize as JSON numbers through the polyfill in `src/server/db.ts` (assert safe integers; no string fallback). Import `prisma` from there. Compute "today"/"this month" in `user.timezone`.
9. **Next 16 dynamic params are async:** `export async function GET(req: NextRequest, ctx: RouteContext<'/api/v1/transactions/[id]'>) { const { id } = await ctx.params }`. Check `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` if unsure.
10. **Frontend wiring:** replace the matching `FinanceContext` localStorage mutation with `api.post/patch/del` (`src/lib/api.ts`), then update local state **from the response**, not from the optimistic input.
11. **Tests:** add cases to `scripts/test-runner.mts`: happy path, validation failure, and **cross-tenant access returns 404** (user B can't read or change user A's row).
12. Run `npm test`, `npx tsc --noEmit`, `npm run check:security`, then `node scripts/agent-memory.mjs log <agent> "<route> done"`.

## Skeleton

```ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { requireSession, assertSameOrigin, ok, fail } from '@/server/http';

const Body = z.object({
  accountId: z.string().min(1).max(40),
  amountCents: z.number().int().safe(),
  financialDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  merchant: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(60),
});

export async function POST(request: NextRequest) {
  const session = await requireSession(request);
  if (session instanceof Response) return session;
  assertSameOrigin(request);

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('VALIDATION_ERROR', 'Please review the submitted information.', 400);

  const account = await prisma.financialAccount.findFirst({
    where: { id: parsed.data.accountId, userId: session.userId },
    select: { id: true, currency: true },
  });
  if (!account) return fail('NOT_FOUND', 'Account not found.', 404);

  // ...$transaction: create row, update balance, writeAudit()
  return ok({ /* created row */ }, 201);
}
```
