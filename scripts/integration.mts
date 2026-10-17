/**
 * WealthPilot — DB integration tests (repos + session + rate limit + audit chain).
 *
 * Runs against DATABASE_URL from .env: `npm run test:integration`. Point it at a Neon branch,
 * not production, when you can. It creates two throwaway users (itest+…@wealthpilot.test) and
 * deletes them (cascade) at the end; only pseudonymous rate-limit rows remain.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { prisma } from '../src/server/db.ts';
import { HttpError, requireSession, startSession } from '../src/server/http.ts';
import { rateLimit } from '../src/server/rateLimit.ts';
import { chainHash } from '../src/server/audit.ts';
import * as ledger from '../src/server/repos/ledger.ts';
import * as planning from '../src/server/repos/planning.ts';

const tag = crypto.randomBytes(4).toString('hex');
let userA = '';
let userB = '';

async function expect404(p: Promise<unknown>) {
  await assert.rejects(p, (e: unknown) => e instanceof HttpError && e.status === 404);
}

before(async () => {
  const mk = (n: string) =>
    prisma.user.create({ data: { email: `itest+${n}-${tag}@wealthpilot.test`, name: `itest ${n}` }, select: { id: true } });
  userA = (await mk('a')).id;
  userB = (await mk('b')).id;
});

after(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
  await prisma.$disconnect();
});

describe('ledger: derived balances, void, cross-tenant', () => {
  it('derives the balance from opening + live transactions, and VOID restores it', async () => {
    const acc = await ledger.createAccount(userA, {
      name: 'Checking', institution: 'Test', type: 'checking', currency: 'USD',
      balanceCents: 100000, accountNumberMask: '•••• 1234', isIncludedInNetWorth: true,
    });
    assert.strictEqual(acc.balanceCents, 100000);

    const { transaction, account } = await ledger.createTransaction(userA, {
      accountId: acc.id, financialDate: '2026-10-10', merchant: 'Blue Bottle', category: 'General',
      amountCents: -650, status: 'cleared', tags: [], isTransfer: false,
    });
    assert.strictEqual(account?.balanceCents, 99350);

    const voided = await ledger.voidTransaction(userA, transaction.id);
    assert.strictEqual(voided.account?.balanceCents, 100000);
    assert.ok(!(await ledger.listTransactions(userA)).some((t) => t.id === transaction.id), 'VOID rows are hidden');
  });

  it("returns 404 for every attempt by user B on user A's rows", async () => {
    const accA = (await ledger.listAccounts(userA))[0];
    const { transaction } = await ledger.createTransaction(userA, {
      accountId: accA.id, financialDate: '2026-10-11', merchant: 'Rent', category: 'Housing',
      amountCents: -120000, status: 'cleared', tags: [], isTransfer: false,
    });
    const goal = await planning.createGoal(userA, {
      name: 'Trip', targetCents: 5000, currentCents: 0, category: 'Travel', priority: 'low', isPaused: false,
    });
    const imp = await ledger.importTransactions(userA, accA.id, [{ financialDate: '2026-10-12', merchant: 'X', amountCents: -1 }]);

    await expect404(ledger.updateTransaction(userB, transaction.id, { category: 'Hacked' }));
    await expect404(ledger.voidTransaction(userB, transaction.id));
    await expect404(ledger.createTransaction(userB, {
      accountId: accA.id, financialDate: '2026-10-11', merchant: 'x', category: 'General',
      amountCents: -1, status: 'cleared', tags: [], isTransfer: false,
    }));
    await expect404(ledger.importTransactions(userB, accA.id, [{ financialDate: '2026-10-12', merchant: 'X', amountCents: -1 }]));
    await expect404(ledger.rollbackImport(userB, imp.batchId));
    await expect404(planning.patchGoal(userB, goal.id, { isPaused: true }));

    assert.strictEqual((await ledger.listTransactions(userB)).length, 0);
    assert.strictEqual((await ledger.listAccounts(userB)).length, 0);
    const still = (await ledger.listTransactions(userA)).find((t) => t.id === transaction.id);
    assert.strictEqual(still?.category, 'Housing', "A's row is unchanged");
  });
});

describe('import: dedupe, rollback, re-import', () => {
  it('skips duplicates on re-import, and rollback frees the fingerprints', async () => {
    const acc = await ledger.createAccount(userA, {
      name: 'Card', institution: 'Test', type: 'credit', currency: 'USD',
      balanceCents: 0, accountNumberMask: '•••• 9999', isIncludedInNetWorth: true,
    });
    const rows = [
      { financialDate: '2026-10-10', merchant: 'Spotify', amountCents: -1199, category: 'General' },
      { financialDate: '2026-10-10', merchant: 'Spotify', amountCents: -1199, category: 'General' },
      { financialDate: '2026-10-11', merchant: 'Bad', amountCents: 1.5 }, // rejected, reported
    ];
    const first = await ledger.importTransactions(userA, acc.id, rows);
    assert.strictEqual(first.inserted, 2, 'two identical charges on one day are both kept');
    assert.strictEqual(first.rejected.length, 1);
    assert.strictEqual(first.account?.balanceCents, -2398);

    const again = await ledger.importTransactions(userA, acc.id, rows);
    assert.strictEqual(again.inserted, 0);
    assert.strictEqual(again.duplicates, 2);

    const rb = await ledger.rollbackImport(userA, first.batchId);
    assert.strictEqual(rb.voidedIds.length, 2);
    assert.strictEqual(rb.accounts.find((a) => a.id === acc.id)?.balanceCents, 0);

    const third = await ledger.importTransactions(userA, acc.id, rows);
    assert.strictEqual(third.inserted, 2, 'rolled-back rows can be imported again');
  });
});

describe('platform: rate limit, audit chain, session revocation', () => {
  it('allows 5 hits then returns 429 with Retry-After', async () => {
    const id = crypto.randomUUID();
    for (let i = 0; i < 5; i++) await rateLimit('itest', [id], 5, 60);
    await assert.rejects(rateLimit('itest', [id], 5, 60), (e: unknown) =>
      e instanceof HttpError && e.status === 429 && Number(new Headers(e.headers).get('Retry-After')) > 0
    );
  });

  it("keeps user A's audit rows as an unbroken hash chain", async () => {
    const rows = await prisma.auditEvent.findMany({ where: { userId: userA }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    assert.ok(rows.length >= 5);
    let prev: string | null = null;
    for (const r of rows) {
      assert.strictEqual(r.checksumBefore, prev);
      assert.strictEqual(r.checksumAfter, chainHash(prev, { userId: userA, eventType: r.eventType, actor: r.actor, details: r.details, createdAt: r.createdAt }));
      assert.ok(!/@|\d{4}\s?\d{4}/.test(r.details), 'no emails or card-like numbers in audit details');
      prev = r.checksumAfter;
    }
  });

  it('rejects a revoked session even though its token signature is valid', async () => {
    const cookie = (await startSession(userA)).split(';')[0];
    const req = () => new Request('http://localhost/api/v1/bootstrap', { headers: { cookie } });
    const live = await requireSession(req());
    assert.ok(!(live instanceof Response) && live.userId === userA);

    await prisma.session.updateMany({ where: { userId: userA }, data: { revokedAt: new Date() } });
    const dead = await requireSession(req());
    assert.ok(dead instanceof Response && dead.status === 401);
  });
});
