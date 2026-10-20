/**
 * WealthPilot — partner offers (discounts and investment opportunities from organisations with a
 * partnership, sponsorship or advertising deal). Admin-managed; users only read live offers.
 * Stats are anonymous daily counts (no user id, no location).
 */

import type { z } from 'zod';
import { prisma } from '../db';
import { writeAudit } from '../audit';
import { HttpError } from '../http';
import { OfferInput, PartnerInput } from '../schemas';
import type { PartnerOffer } from '@/types/finance';

const VERIFIED_WITHIN_DAYS = 90;
const notFound = (what: string) => new HttpError('NOT_FOUND', `${what} not found.`, 404);
const day = (d = new Date()) => d.toISOString().slice(0, 10);
const ymdDate = (s: string) => new Date(`${s}T00:00:00Z`);

const withRefs = { partner: { select: { name: true, website: true, relationship: true } }, locations: { select: { label: true, lat: true, lng: true } } } as const;

type Row = Awaited<ReturnType<typeof listRows>>[number];
const listRows = (where: object) => prisma.offer.findMany({ where, include: withRefs, orderBy: [{ validUntil: 'asc' }], take: 200 });

function toClientOffer(r: Row): PartnerOffer {
  return {
    id: r.id,
    kind: r.kind as PartnerOffer['kind'],
    title: r.title,
    description: r.description,
    discountBps: r.discountBps,
    country: r.country,
    termsUrl: r.termsUrl,
    actionUrl: r.actionUrl,
    validFrom: day(r.validFrom),
    validUntil: day(r.validUntil),
    lastVerifiedAt: r.lastVerifiedAt.toISOString(),
    isSample: r.isSample,
    status: r.status as PartnerOffer['status'],
    partnerId: r.partnerId,
    partner: { name: r.partner.name, website: r.partner.website, relationship: r.partner.relationship as PartnerOffer['partner']['relationship'] },
    locations: r.locations,
  };
}

/** What users see: live, currently valid, recently verified offers in one country. */
export async function listLiveOffers(country: string) {
  const now = new Date();
  const rows = await prisma.offer.findMany({
    where: { country, status: 'live', validFrom: { lte: now }, validUntil: { gt: now }, lastVerifiedAt: { gte: new Date(now.getTime() - VERIFIED_WITHIN_DAYS * 86_400_000) } },
    include: withRefs,
    orderBy: [{ validUntil: 'asc' }],
    take: 50,
  });
  return rows.map(toClientOffer);
}

/** Counts a view or click on a live offer; anything else is ignored (no error, nothing revealed). */
export async function countEvent(offerId: string, type: 'view' | 'click') {
  const live = await prisma.offer.findFirst({ where: { id: offerId, status: 'live', validUntil: { gt: new Date() } }, select: { id: true } });
  if (!live) return;
  const inc = type === 'view' ? { views: { increment: 1 } } : { clicks: { increment: 1 } };
  await prisma.offerStat.upsert({
    where: { offerId_day: { offerId, day: day() } },
    create: { offerId, day: day(), views: type === 'view' ? 1 : 0, clicks: type === 'click' ? 1 : 0 },
    update: inc,
  });
}

// ---- Admin -----------------------------------------------------------------------------

export async function adminListOffers() {
  return (await listRows({})).map(toClientOffer);
}

export async function listPartners() {
  return prisma.partner.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, website: true, relationship: true, contractEnds: true } });
}

export async function createPartner(adminId: string, input: z.infer<typeof PartnerInput>) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.partner.create({ data: { ...input, contractEnds: input.contractEnds ? ymdDate(input.contractEnds) : null } });
    await writeAudit(tx, adminId, 'PARTNER_CREATED', `partner=${row.id} relationship=${row.relationship}`, 'ADMIN');
    return row;
  });
}

function offerData(input: z.infer<typeof OfferInput>) {
  const { partnerId, kind, title, description, discountBps, country, termsUrl, actionUrl, isSample, status, validFrom, validUntil } = input;
  return { partnerId, kind, title, description, discountBps, country, termsUrl, actionUrl, isSample, status, validFrom: ymdDate(validFrom), validUntil: ymdDate(validUntil) };
}

export async function createOffer(adminId: string, input: z.infer<typeof OfferInput>) {
  if (!(await prisma.partner.findUnique({ where: { id: input.partnerId }, select: { id: true } }))) throw notFound('Partner');
  return prisma.$transaction(async (tx) => {
    const row = await tx.offer.create({
      data: { ...offerData(input), lastVerifiedAt: input.verified ? new Date() : new Date(0), locations: { create: input.locations } },
      include: withRefs,
    });
    await writeAudit(tx, adminId, 'OFFER_CREATED', `offer=${row.id} status=${row.status}`, 'ADMIN');
    return toClientOffer(row);
  });
}

/** Full replace (the admin form always sends every field); locations are replaced too. */
export async function updateOffer(adminId: string, id: string, input: z.infer<typeof OfferInput>) {
  const existing = await prisma.offer.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound('Offer');
  if (!(await prisma.partner.findUnique({ where: { id: input.partnerId }, select: { id: true } }))) throw notFound('Partner');
  return prisma.$transaction(async (tx) => {
    await tx.offerLocation.deleteMany({ where: { offerId: id } });
    const row = await tx.offer.update({
      where: { id },
      data: { ...offerData(input), ...(input.verified && { lastVerifiedAt: new Date() }), locations: { create: input.locations } },
      include: withRefs,
    });
    await writeAudit(tx, adminId, 'OFFER_UPDATED', `offer=${id} status=${row.status}`, 'ADMIN');
    return toClientOffer(row);
  });
}

export async function deleteOffer(adminId: string, id: string) {
  const existing = await prisma.offer.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound('Offer');
  await prisma.$transaction(async (tx) => {
    await tx.offer.delete({ where: { id } });
    await writeAudit(tx, adminId, 'OFFER_DELETED', `offer=${id}`, 'ADMIN');
  });
  return { id };
}

/** Views, clicks and click-through per offer over the last `days` days (sponsor reports). */
export async function offerStats(days = 30) {
  const since = day(new Date(Date.now() - (days - 1) * 86_400_000));
  const rows = await prisma.offerStat.groupBy({ by: ['offerId'], where: { day: { gte: since } }, _sum: { views: true, clicks: true } });
  return { since, rows: rows.map((r) => ({ offerId: r.offerId, views: r._sum.views ?? 0, clicks: r._sum.clicks ?? 0 })) };
}
