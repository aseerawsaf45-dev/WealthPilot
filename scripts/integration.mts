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
import { scanAndEnforcePciDssScope } from '../src/lib/compliance/pciDssCompliance.ts';
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

describe('assistant chat history', () => {
  it('saves only with history on, scopes every chat to its owner, and erases chats when history is turned off', async () => {
    const copilot = await import('../src/server/repos/copilot.ts');
    const { updatePreferences } = await import('../src/server/repos/user.ts');
    const messages = [{ id: 'm1', sender: 'user' as const, timestamp: '2026-10-18T00:00:00Z', content: 'add $12 coffee' }];
    await assert.rejects(copilot.createConversation(userA, { title: 'off', messages }), (e: unknown) => e instanceof HttpError && e.status === 403);

    await updatePreferences(userA, { chatHistoryEnabled: true });
    const chat = await copilot.createConversation(userA, { title: 'Coffee', messages });
    assert.strictEqual((await copilot.getConversation(userA, chat.id)).title, 'Coffee');

    await updatePreferences(userB, { chatHistoryEnabled: true });
    await expect404(copilot.getConversation(userB, chat.id));
    await expect404(copilot.updateConversation(userB, chat.id, { title: 'Hacked' }));
    await expect404(copilot.deleteConversation(userB, chat.id));
    assert.strictEqual((await copilot.listConversations(userB)).length, 0);

    await updatePreferences(userA, { chatHistoryEnabled: false });
    assert.strictEqual((await copilot.listConversations(userA)).length, 0, 'turning history off deletes saved chats');
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

describe('full CRUD: edit, delete, pay, contribute (and cross-tenant 404s)', () => {
  it('sets an account balance via the derived opening balance, and guards delete with 409', async () => {
    const acc = await ledger.createAccount(userA, {
      name: 'Wallet', institution: 'Test', type: 'cash', currency: 'USD', balanceCents: 1000, accountNumberMask: '•••• 0001', isIncludedInNetWorth: true,
    });
    await ledger.createTransaction(userA, { accountId: acc.id, financialDate: '2026-10-11', merchant: 'Snack', category: 'Dining', amountCents: -300, status: 'cleared', tags: [], isTransfer: false });
    const edited = await ledger.patchAccount(userA, acc.id, { name: 'Pocket', balanceCents: 5000 });
    assert.strictEqual(edited?.balanceCents, 5000, 'current balance equals what the user typed');
    assert.strictEqual(edited?.name, 'Pocket');

    await expect404(ledger.patchAccount(userB, acc.id, { name: 'x' }));
    await expect404(ledger.deleteAccount(userB, acc.id, true));
    await assert.rejects(ledger.deleteAccount(userA, acc.id, false), (e: unknown) => e instanceof HttpError && e.status === 409);
    assert.deepStrictEqual(await ledger.deleteAccount(userA, acc.id, true), { id: acc.id, deletedTransactions: 1 });
  });

  it('moves a transaction between accounts and updates both balances', async () => {
    const [a1, a2] = await Promise.all(
      ['One', 'Two'].map((n, i) =>
        ledger.createAccount(userA, { name: n, institution: 'T', type: 'checking', currency: 'USD', balanceCents: 0, accountNumberMask: `•••• 100${i}`, isIncludedInNetWorth: true })
      )
    );
    const { transaction } = await ledger.createTransaction(userA, { accountId: a1.id, financialDate: '2026-10-12', merchant: 'Shop', category: 'General', amountCents: -700, status: 'cleared', tags: [], isTransfer: false });
    const moved = await ledger.updateTransaction(userA, transaction.id, { accountId: a2.id });
    assert.strictEqual(moved.account?.balanceCents, -700);
    assert.strictEqual(moved.previousAccount?.balanceCents, 0);
  });

  it('pays a bill once per due date, records the expense and advances the date', async () => {
    const acc = (await ledger.listAccounts(userA))[0];
    const bill = await planning.createBill(userA, {
      name: 'Internet', amountCents: 8000, frequency: 'monthly', nextDueDate: '2026-01-31', category: 'Utilities', accountId: acc.id, isAutoPay: false, status: 'active',
    }, '2026-10-17');
    const paid = await planning.payBill(userA, bill.id, { dueDate: '2026-01-31', recordTransaction: true }, '2026-10-17');
    assert.strictEqual(paid.bill.nextDueDate, '2026-02-28', 'month-end clamps to February');
    assert.strictEqual(paid.transaction?.amountCents, -8000);
    await assert.rejects(planning.payBill(userA, bill.id, { dueDate: '2026-01-31', recordTransaction: true }, '2026-10-17'), (e: unknown) => e instanceof HttpError && e.status === 409);
    await expect404(planning.payBill(userB, bill.id, { dueDate: '2026-02-28', recordTransaction: true }, '2026-10-17'));
    await expect404(planning.patchBill(userB, bill.id, { name: 'x' }, '2026-10-17'));
    const edited = await planning.patchBill(userA, bill.id, { amountCents: 9000, accountId: '' }, '2026-10-17');
    assert.strictEqual(edited.amountCents, 9000);
    assert.strictEqual(edited.accountId, '', 'payment account can be cleared');
    await expect404(planning.deleteBill(userB, bill.id));
    await planning.deleteBill(userA, bill.id);
  });

  it('adds to and withdraws from a goal, never below zero', async () => {
    const goal = await planning.createGoal(userA, { name: 'Bike', targetCents: 50000, currentCents: 1000, category: 'Fun', priority: 'low', isPaused: false });
    assert.strictEqual((await planning.contributeToGoal(userA, goal.id, 2500)).currentCents, 3500);
    assert.strictEqual((await planning.contributeToGoal(userA, goal.id, -500)).currentCents, 3000);
    await assert.rejects(planning.contributeToGoal(userA, goal.id, -999999), (e: unknown) => e instanceof HttpError && e.status === 400);
    await expect404(planning.contributeToGoal(userB, goal.id, 100));
    await expect404(planning.deleteGoal(userB, goal.id));
    await planning.deleteGoal(userA, goal.id);
  });

  it('saves the AI plan on the goal, returns it with the goal, and only for the owner', async () => {
    const goal = await planning.createGoal(userA, { name: 'Laptop', targetCents: 200000, currentCents: 50000, category: 'Tech', priority: 'medium', isPaused: false });
    const snapshot = {
      verdict: 'stretch' as const, answer: 'x', insights: [], facts: [], steps: ['Save monthly'], milestones: [{ label: '50% saved', date: '2027-01-01' }],
      limitations: [], source: 'rules' as const, targetDate: null, basis: { targetCents: 200000, currentCents: 50000, targetDate: null },
    };
    await expect404(planning.saveGoalPlan(userB, goal.id, snapshot));
    const saved = await planning.saveGoalPlan(userA, goal.id, snapshot);
    assert.strictEqual(saved.plan?.verdict, 'stretch');
    assert.ok(saved.planUpdatedAt);
    const listed = (await planning.listGoals(userA)).find((g) => g.id === goal.id);
    assert.deepStrictEqual(listed?.plan?.steps, ['Save monthly'], 'bootstrap/listGoals returns the saved plan');
    await planning.deleteGoal(userA, goal.id); // plan lives on the goal row, so it goes with it
  });

  it('deletes budgets and debts only for their owner', async () => {
    const budget = await planning.upsertBudget(userA, '2026-10', { category: 'Fun', allocatedCents: 10000, rolloverEnabled: false, alertThresholdPercent: 85 });
    const debt = await planning.createDebt(userA, { name: 'Card', balanceCents: 1000, aprPercent: 20, minimumPaymentCents: 100, dueDateDay: 5, category: 'credit_card' });
    await expect404(planning.deleteBudget(userB, budget.id));
    await expect404(planning.deleteDebt(userB, debt.id));
    await planning.deleteBudget(userA, budget.id);
    await planning.deleteDebt(userA, debt.id);
    assert.strictEqual((await planning.listDebts(userA)).length, 0);
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
      assert.ok(!r.details.includes('@'), 'no emails in audit details');
      assert.ok(scanAndEnforcePciDssScope(r.details).isCompliant, 'no card numbers in audit details');
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

describe('partner offers: visibility rules, admin guard, anonymous counts', () => {
  it('shows only live, current, recently verified offers of the requested country', async () => {
    const offers = await import('../src/server/repos/offers.ts');
    const partner = await offers.createPartner(userA, { name: `itest partner ${tag}`, website: null, relationship: 'sponsor', contractEnds: null });
    const base = { partnerId: partner.id, kind: 'discount' as const, title: 'Coffee', description: 'x', discountBps: 1000, country: 'BD', termsUrl: 'https://example.com/t', actionUrl: null, validFrom: '2026-01-01', validUntil: '2099-01-01', verified: true, isSample: false, status: 'live' as const, locations: [{ label: 'Gulshan', lat: 23.79, lng: 90.41 }] };
    const live = await offers.createOffer(userA, base);
    const expired = await offers.createOffer(userA, { ...base, title: 'old', validFrom: '2020-01-01', validUntil: '2021-01-01' });
    const paused = await offers.createOffer(userA, { ...base, title: 'paused', status: 'paused' });
    const unverified = await offers.createOffer(userA, { ...base, title: 'unchecked', verified: false });
    const elsewhere = await offers.createOffer(userA, { ...base, title: 'us', country: 'US' });
    try {
      const ids = (await offers.listLiveOffers('BD')).map((o) => o.id);
      assert.ok(ids.includes(live.id));
      for (const o of [expired, paused, unverified, elsewhere]) assert.ok(!ids.includes(o.id), `${o.title} hidden`);
      assert.deepStrictEqual((await offers.listLiveOffers('BD')).find((o) => o.id === live.id)?.locations, [{ label: 'Gulshan', lat: 23.79, lng: 90.41 }]);

      // Two clicks at the same time both count; events on hidden offers are ignored.
      await Promise.all([offers.countEvent(live.id, 'click'), offers.countEvent(live.id, 'click'), offers.countEvent(live.id, 'view')]);
      await offers.countEvent(paused.id, 'click');
      const stats = await offers.offerStats(1);
      assert.deepStrictEqual(stats.rows.find((r) => r.offerId === live.id), { offerId: live.id, views: 1, clicks: 2 });
      assert.ok(!stats.rows.some((r) => r.offerId === paused.id));
    } finally {
      await prisma.partner.delete({ where: { id: partner.id } }); // cascades offers, locations, stats
    }
  });

  it('lets only ADMIN_EMAILS use the admin API', async () => {
    const { adminOnly } = await import('../src/server/http.ts');
    const handler = adminOnly(async () => new Response('ok'));
    const emailA = (await prisma.user.findUniqueOrThrow({ where: { id: userA }, select: { email: true } })).email;
    const cookie = (await startSession(userB)).split(';')[0];
    const call = () => handler(new Request('http://localhost/api/v1/admin/offers', { headers: { cookie } }) as never, undefined as never);
    const before = process.env.ADMIN_EMAILS;
    process.env.ADMIN_EMAILS = emailA;
    try {
      assert.strictEqual((await call()).status, 403, 'user B is not an admin');
      process.env.ADMIN_EMAILS = `${emailA}, ${(await prisma.user.findUniqueOrThrow({ where: { id: userB }, select: { email: true } })).email.toUpperCase()}`;
      assert.strictEqual((await call()).status, 200, 'listed (case-insensitive) → allowed');
    } finally {
      process.env.ADMIN_EMAILS = before;
    }
  });
});
