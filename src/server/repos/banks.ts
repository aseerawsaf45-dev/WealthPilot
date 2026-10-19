/**
 * WealthPilot — banks per country (Wikidata) and their recent news (GDELT), public data only.
 * Wikidata: 30-day cache. GDELT: one query per country, 6-hour cache, globally throttled to
 * 1 request / 5.5 s (their limit is 1 per 5 s).
 */

import { cached, cachedAt } from './externalCache';
import { countryName } from '@/lib/countries';
import { GSIBS, bankKey, mentions, parseGdelt, type BankInfo, type NewsArticle } from '@/lib/planning/banks';

const UA = 'WealthPilot/1.0 (personal finance planner; contact via site)';

async function wikidataBanks(country: string): Promise<BankInfo[] | null> {
  const query = `SELECT ?bank ?bankLabel (MAX(?links) AS ?fame) (SAMPLE(?site) AS ?web) (GROUP_CONCAT(DISTINCT ?alias; separator="|") AS ?aliases) WHERE {
    ?c wdt:P297 "${country}".
    ?bank wdt:P31/wdt:P279* wd:Q22687; wdt:P17 ?c; wikibase:sitelinks ?links.
    FILTER NOT EXISTS { ?bank wdt:P31/wdt:P279* wd:Q66344 }
    FILTER NOT EXISTS { ?bank wdt:P576 ?end }
    OPTIONAL { ?bank wdt:P856 ?site }
    OPTIONAL { ?bank skos:altLabel ?alias FILTER(LANG(?alias) = "en") }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  } GROUP BY ?bank ?bankLabel ORDER BY DESC(?fame) LIMIT 15`;
  const res = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}`, {
    headers: { accept: 'application/sparql-results+json', 'user-agent': UA },
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { results?: { bindings?: Array<Record<string, { value: string }>> } };
  const seen = new Set<string>();
  const out: BankInfo[] = [];
  for (const b of body.results?.bindings ?? []) {
    const name = b.bankLabel?.value ?? '';
    if (!name || /^Q\d+$/.test(name)) continue; // no English label
    const key = bankKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: b.bank.value.split('/').pop()!,
      name,
      website: b.web?.value ?? null,
      kind: 'local',
      hq: country,
      fame: Number(b.fame?.value ?? 0),
      aliases: (b.aliases?.value ?? '').split('|').filter((a) => a.length >= 3 && a.length <= 40).slice(0, 4),
    });
  }
  return out.slice(0, 12);
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

export async function getBankData(country: string): Promise<BankData> {
  const local = (await cached(`banks:${country}`, 30 * 86_400_000, () => wikidataBanks(country))) ?? [];
  const international: BankInfo[] = GSIBS.filter((g) => g.hq !== country).map((g) => ({
    id: `gsib:${bankKey(g.name).replace(/ /g, '-')}`,
    name: g.name,
    website: g.website,
    kind: 'international',
    hq: g.hq,
    fame: 40,
    aliases: g.aliases ?? [],
  }));
  const all = [...local, ...international];
  const news = (await cached(`news:banks:${country}`, 6 * 3_600_000, () => gdeltNews(country, all), 30 * 60_000)) ?? [];
  // International banks count only when local news mentions them.
  const present = international.filter((b) => news.some((a) => mentions(a.title, b)));
  return { country, banks: [...local, ...present], news, banksAsOf: await cachedAt(`banks:${country}`), newsAsOf: await cachedAt(`news:banks:${country}`) };
}
