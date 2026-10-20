/**
 * Loads clearly labelled SAMPLE partner offers (fictional organisations) so the "Near you" section
 * isn't empty before real deals are signed. Idempotent: re-running replaces the samples only.
 * Run: DATABASE_URL=... APP_URL=https://your-site npx tsx scripts/seed-sample-offers.mts
 * Remove later in the Admin tab (or re-run with --remove).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const site = (process.env.APP_URL ?? '').replace(/\/$/, '');
if (!/^https:\/\//.test(site) && !process.argv.includes('--remove')) throw new Error('Set APP_URL to the https site address (sample "Terms" links point to it).');
const terms = `${site}/#partner-offers`;
const days = (n: number) => new Date(Date.now() + n * 86_400_000);

type Sample = { partner: string; relationship: 'partner' | 'sponsor' | 'advertiser'; kind: 'discount' | 'investment'; title: string; description: string; discountBps?: number; country: string; locations: Array<[string, number, number]> };
const SAMPLES: Sample[] = [
  { partner: 'Sample Café Dhaka', relationship: 'partner', kind: 'discount', title: 'Coffee and snacks', description: 'Example of a partner café discount shown to members nearby.', discountBps: 1000, country: 'BD', locations: [['Gulshan 2', 23.7937, 90.4144], ['Dhanmondi 27', 23.7536, 90.3746]] },
  { partner: 'Sample Grocer BD', relationship: 'sponsor', kind: 'discount', title: 'Weekly groceries', description: 'Example of a sponsored supermarket offer on household essentials.', discountBps: 500, country: 'BD', locations: [['Banani', 23.7937, 90.4066], ['Chattogram GEC', 22.3593, 91.8212]] },
  { partner: 'Sample Pharmacy', relationship: 'advertiser', kind: 'discount', title: 'Medicines and health checks', description: 'Example of an advertiser offer, usable online and in store.', discountBps: 800, country: 'BD', locations: [] },
  { partner: 'Sample Savings Bank BD', relationship: 'sponsor', kind: 'investment', title: 'Fixed-term savings account', description: 'Example of a sponsored deposit product. Real offers show the provider’s published rate and terms.', country: 'BD', locations: [['Motijheel', 23.7330, 90.4172]] },
  { partner: 'Sample Fund Co.', relationship: 'advertiser', kind: 'investment', title: 'Monthly index fund plan', description: 'Example of an advertised investment plan. Check the provider is licensed before investing.', country: 'BD', locations: [] },
  { partner: 'Sample Coffee NYC', relationship: 'partner', kind: 'discount', title: 'Morning coffee', description: 'Example of a partner café discount shown to members nearby.', discountBps: 1500, country: 'US', locations: [['Midtown', 40.7549, -73.984], ['Brooklyn', 40.6782, -73.9442]] },
  { partner: 'Sample Credit Union', relationship: 'sponsor', kind: 'investment', title: 'Share certificate', description: 'Example of a sponsored savings certificate. Real offers show the published rate and terms.', country: 'US', locations: [] },
];

await prisma.$transaction(async (tx) => {
  // Samples only: real partners are never touched.
  const old = await tx.offer.findMany({ where: { isSample: true }, select: { partnerId: true } });
  await tx.offer.deleteMany({ where: { isSample: true } });
  const orphaned = [...new Set(old.map((o) => o.partnerId))];
  for (const id of orphaned) if (!(await tx.offer.count({ where: { partnerId: id } }))) await tx.partner.delete({ where: { id } });
  if (process.argv.includes('--remove')) return;
  for (const s of SAMPLES) {
    const partner = (await tx.partner.findFirst({ where: { name: s.partner } })) ?? (await tx.partner.create({ data: { name: s.partner, relationship: s.relationship } }));
    await tx.offer.create({
      data: {
        partnerId: partner.id,
        kind: s.kind,
        title: s.title,
        description: s.description,
        discountBps: s.discountBps ?? null,
        country: s.country,
        termsUrl: terms,
        actionUrl: null, // samples link nowhere
        validFrom: days(-1),
        validUntil: days(60),
        lastVerifiedAt: new Date(),
        isSample: true,
        status: 'live',
        locations: { create: s.locations.map(([label, lat, lng]) => ({ label, lat, lng })) },
      },
    });
  }
}, { timeout: 60_000 }); // ~20 round trips to a remote database
console.log(process.argv.includes('--remove') ? 'Removed sample offers.' : `Loaded ${SAMPLES.length} sample offers.`);
await prisma.$disconnect();
