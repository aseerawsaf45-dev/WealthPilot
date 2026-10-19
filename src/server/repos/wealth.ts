/**
 * WealthPilot — investment plans and loan offers (session-scoped, audited).
 * Taking a loan creates its DebtAccount and marks the offer taken in one transaction.
 */

import type { z } from 'zod';
import type { InvestmentPlan as DbPlan, LoanOffer as DbOffer } from '@prisma/client';
import { prisma } from '../db';
import { writeAudit } from '../audit';
import { HttpError } from '../http';
import { cents, toClientDebt } from '../mappers';
import { InvestmentPlanInput, InvestmentPlanPatch, LoanOfferInput, LoanOfferPatch } from '../schemas';
import { loanToDebtInput } from '@/lib/planning/link';
import type { InvestmentPlan, LoanOffer } from '@/types/finance';

const notFound = (what: string) => new HttpError('NOT_FOUND', `${what} not found.`, 404);

export function toClientPlan(r: DbPlan): InvestmentPlan {
  return {
    id: r.id,
    name: r.name,
    country: r.country,
    currency: r.currency,
    initialCents: cents(r.initialCents),
    monthlyCents: cents(r.monthlyCents),
    horizonMonths: r.horizonMonths,
    riskProfile: r.riskProfile as InvestmentPlan['riskProfile'],
    expectedReturnBps: r.expectedReturnBps,
    taxBps: r.taxBps,
    scenarios: r.scenarios,
    updatedAt: r.updatedAt.toISOString(),
  };
}

export function toClientOffer(r: DbOffer): LoanOffer {
  return {
    id: r.id,
    name: r.name,
    lender: r.lender,
    principalCents: cents(r.principalCents),
    aprBps: r.aprBps,
    termMonths: r.termMonths,
    feeCents: cents(r.feeCents),
    purpose: r.purpose as LoanOffer['purpose'],
    country: r.country,
    status: r.status as LoanOffer['status'],
    debtId: r.debtId,
    updatedAt: r.updatedAt.toISOString(),
  };
}

const big = (v: number | undefined) => (v === undefined ? undefined : BigInt(v));

// ---- Investment plans ---------------------------------------------------------

export async function listPlans(userId: string) {
  return (await prisma.investmentPlan.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })).map(toClientPlan);
}

export async function createPlan(userId: string, input: z.infer<typeof InvestmentPlanInput>) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.investmentPlan.create({ data: { ...input, userId, initialCents: BigInt(input.initialCents), monthlyCents: BigInt(input.monthlyCents) } });
    await writeAudit(tx, userId, 'INVESTMENT_PLAN_CREATED', `plan=${row.id}`);
    return toClientPlan(row);
  });
}

export async function patchPlan(userId: string, id: string, patch: z.infer<typeof InvestmentPlanPatch>) {
  if (!(await prisma.investmentPlan.findFirst({ where: { id, userId }, select: { id: true } }))) throw notFound('Plan');
  return prisma.$transaction(async (tx) => {
    const row = await tx.investmentPlan.update({ where: { id }, data: { ...patch, initialCents: big(patch.initialCents), monthlyCents: big(patch.monthlyCents) } });
    await writeAudit(tx, userId, 'INVESTMENT_PLAN_UPDATED', `plan=${id} fields=${Object.keys(patch).join(',')}`);
    return toClientPlan(row);
  });
}

export async function deletePlan(userId: string, id: string) {
  if (!(await prisma.investmentPlan.findFirst({ where: { id, userId }, select: { id: true } }))) throw notFound('Plan');
  await prisma.$transaction(async (tx) => {
    await tx.investmentPlan.delete({ where: { id } });
    await writeAudit(tx, userId, 'INVESTMENT_PLAN_DELETED', `plan=${id}`);
  });
  return { id };
}

// ---- Loan offers ----------------------------------------------------------------

export async function listOffers(userId: string) {
  return (await prisma.loanOffer.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })).map(toClientOffer);
}

export async function createOffer(userId: string, input: z.infer<typeof LoanOfferInput>) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.loanOffer.create({ data: { ...input, userId, principalCents: BigInt(input.principalCents), feeCents: BigInt(input.feeCents) } });
    await writeAudit(tx, userId, 'LOAN_OFFER_CREATED', `offer=${row.id}`);
    return toClientOffer(row);
  });
}

export async function patchOffer(userId: string, id: string, patch: z.infer<typeof LoanOfferPatch>) {
  const existing = await prisma.loanOffer.findFirst({ where: { id, userId }, select: { status: true } });
  if (!existing) throw notFound('Loan offer');
  if (existing.status === 'taken') throw new HttpError('CONFLICT', 'This loan was taken; edit it in the Debt planner.', 409);
  return prisma.$transaction(async (tx) => {
    const row = await tx.loanOffer.update({ where: { id }, data: { ...patch, principalCents: big(patch.principalCents), feeCents: big(patch.feeCents) } });
    await writeAudit(tx, userId, 'LOAN_OFFER_UPDATED', `offer=${id}`);
    return toClientOffer(row);
  });
}

export async function deleteOffer(userId: string, id: string) {
  if (!(await prisma.loanOffer.findFirst({ where: { id, userId }, select: { id: true } }))) throw notFound('Loan offer');
  await prisma.$transaction(async (tx) => {
    await tx.loanOffer.delete({ where: { id } }); // a debt created from it stays
    await writeAudit(tx, userId, 'LOAN_OFFER_DELETED', `offer=${id}`);
  });
  return { id };
}

/** "Take this loan": the offer becomes a debt (EMI = minimum payment). Atomic and idempotent. */
export async function takeOffer(userId: string, id: string, dueDateDay: number) {
  return prisma.$transaction(async (tx) => {
    // Status flip first, conditional on still "considering", so a double click can't create two debts.
    const flipped = await tx.loanOffer.updateMany({ where: { id, userId, status: 'considering' }, data: { status: 'taken' } });
    if (!flipped.count) {
      const exists = await tx.loanOffer.findFirst({ where: { id, userId }, select: { id: true } });
      throw exists ? new HttpError('CONFLICT', 'This loan is already in your debts.', 409) : notFound('Loan offer');
    }
    const offer = await tx.loanOffer.findUniqueOrThrow({ where: { id } });
    const d = loanToDebtInput({ ...toClientOffer(offer) }, dueDateDay);
    const debt = await tx.debtAccount.create({
      data: { userId, name: d.name, balanceCents: BigInt(d.balanceCents), aprPercent: d.aprPercent, minimumPaymentCents: BigInt(d.minimumPaymentCents), dueDateDay: d.dueDateDay, category: d.category },
    });
    const updated = await tx.loanOffer.update({ where: { id }, data: { debtId: debt.id } });
    await writeAudit(tx, userId, 'LOAN_TAKEN', `offer=${id} debt=${debt.id}`);
    return { offer: toClientOffer(updated), debt: toClientDebt(debt) };
  });
}
