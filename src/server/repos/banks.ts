/**
 * WealthPilot — banks per country (Wikidata) and their recent news (GDELT), public data only.
 * Wikidata: 30-day cache. GDELT: one query per country, 6-hour cache, globally throttled to
 * 1 request / 5.5 s (their limit is 1 per 5 s).
 */

import { cached, cachedAt } from './externalCache';
import { countryName } from '@/lib/countries';
import { GSIBS, bankKey, mentions, parseGdelt, wikidataBankQuery, parseWikidataBanks, type BankInfo, type NewsArticle } from '@/lib/planning/banks';
import snapshot from '@/lib/planning/banks-snapshot.json';

const UA = 'WealthPilot/1.0 (personal finance planner; contact via site)';

async function wikidataBanks(country: string): Promise<BankInfo[] | null> {
  const res = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(wikidataBankQuery(country))}`, {
    headers: { accept: 'application/sparql-results+json', 'user-agent': UA },
    signal: AbortSignal.timeout(8_000),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { results?: { bindings?: Array<Record<string, { value: string }>> } };
  const banks = parseWikidataBanks(body.results?.bindings ?? [], country);
  return banks.length ? banks : null; // an empty answer is not cached over the snapshot
}

/** Bundled list (scripts/fetch-banks.mts) for when Wikidata is slow or unreachable from the host. */
function snapshotBanks(country: string): BankInfo[] {
  const list = (snapshot as { countries: Record<string, Array<Omit<BankInfo, 'aliases'>>> }).countries[country] ?? [];
  return list.map((b) => ({ ...b, aliases: [] }));
}

let lastGdelt = 0;
async function gdeltThrottle() {
  const wait = lastGdelt + 5500 - Date.now();
  lastGdelt = Math.max(Date.now(), lastGdelt + 5500);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

async function gdeltNews(country: string, banks: BankInfo[]): Promise<NewsArticle[] | null> {
  const names = banks.map((b) => b.name.replace(/\b(PLC|Ltd\.?|Limited)\b/gi, '').replace(/"/g, '').trim()).filter((n) => n.length >= 3);
  if (!names.length) return [];
  const where = countryName(country).replace(/[^A-Za-z ]/g, '').toLowerCase().replace(/\s+/g, '');
  // shortcut: one OR-query per country (GDELT allows 1 request / 5 s); split into batches if names exceed the query limit.
  const query = `(${names.slice(0, 20).map((n) => `"${n}"`).join(' OR ')}) sourcecountry:${where}`;
  await gdeltThrottle();
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=75&format=json&timespan=30d&sort=DateDesc`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000), cache: 'no-store', headers: { 'user-agent': UA } });
  const text = await res.text();
  return res.ok ? parseGdelt(text) : null;
}

export interface BankData {
  country: string;
  banks: BankInfo[]; // local (Wikidata) + international seen in local news
  news: NewsArticle[];
  banksAsOf: string | null;
  newsAsOf: string | null;
}

/** The promise's value if it settles within `ms`, else null (the work carries on and fills the cache). */
const within = <T,>(ms: number, p: Promise<T | null>) => Promise.race([p, new Promise<null>((r) => setTimeout(r, ms, null))]);

export async function getBankData(country: string): Promise<BankData> {
  // Live data when it answers within 2.5 s; otherwise the snapshot now (the live fetch keeps running and fills the cache).
  const live = await within(2500, cached(`banks:${country}`, 30 * 86_400_000, () => wikidataBanks(country)));
  const local = live ?? snapshotBanks(country);
  const international: BankInfo[] = GSIBS.filter((g) => g.hq !== country && !local.some((b) => bankKey(b.name) === bankKey(g.name))).map((g) => ({
    id: `gsib:${bankKey(g.name).replace(/ /g, '-')}`,
    name: g.name,
    website: g.website,
    kind: 'international',
    hq: g.hq,
    fame: 40,
    aliases: g.aliases ?? [],
  }));
  const all = [...local, ...international];
  // News is optional: GDELT is throttled to 1 request / 5.5 s, so don't hold the bank list for it.
  const news = (await within(1500,cached(`news:banks:${country}`, 6 * 3_600_000, () => gdeltNews(country, all), 30 * 60_000))) ?? [];
  // International banks count only when local news mentions them.
  const present = international.filter((b) => news.some((a) => mentions(a.title, b)));
  return { country, banks: [...local, ...present], news, banksAsOf: live ? await cachedAt(`banks:${country}`) : (snapshot as { generatedAt: string }).generatedAt, newsAsOf: await cachedAt(`news:banks:${country}`) };
}
