/**
 * Builds src/lib/planning/banks-snapshot.json: well-known banks per country from Wikidata (CC0).
 * The app shows this when the live Wikidata query is slow or unreachable from the host.
 * Run: npx tsx scripts/fetch-banks.mts   (about 1 request per second; takes ~10 minutes)
 *      npx tsx scripts/fetch-banks.mts --thin   (only countries with fewer than 5 banks)
 */

import fs from 'node:fs';
import { COUNTRY_CODES } from '../src/lib/countries.ts';
import { wikidataBankQuery, parseWikidataBanks, type BankInfo } from '../src/lib/planning/banks.ts';

const OUT = 'src/lib/planning/banks-snapshot.json';
const UA = 'WealthPilot/1.0 (bank snapshot script; personal finance planner)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchCountry(country: string, minLinks = 2): Promise<BankInfo[] | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(wikidataBankQuery(country, minLinks))}`, {
        headers: { accept: 'application/sparql-results+json', 'user-agent': UA },
        signal: AbortSignal.timeout(60_000),
      });
      if (res.status === 429) {
        await sleep(Number(res.headers.get('retry-after') ?? 30) * 1000);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { results: { bindings: Array<Record<string, { value: string }>> } };
      return parseWikidataBanks(body.results.bindings, country);
    } catch (e) {
      console.warn(country, 'attempt', attempt + 1, (e as Error).message);
      await sleep(5000 * (attempt + 1));
    }
  }
  return null;
}

const previous = fs.existsSync(OUT) ? (JSON.parse(fs.readFileSync(OUT, 'utf8')) as { countries: Record<string, unknown[]> }).countries : {};
const thin = process.argv.includes('--thin');
const countries = (thin ? { ...previous } : {}) as Record<string, Array<Omit<BankInfo, 'aliases'>>>;
let failed = 0;
for (const code of thin ? COUNTRY_CODES.filter((c) => (previous[c]?.length ?? 0) < 5) : COUNTRY_CODES) {
  let banks = await fetchCountry(code);
  // Small countries: lesser-known banks are better than an empty list.
  if (banks && banks.length < 5) banks = (await fetchCountry(code, 0)) ?? banks;
  if (banks === null) failed++;
  // Keep the previous snapshot for a country whose query failed this time.
  const list = banks ?? ((previous[code] as Array<Omit<BankInfo, 'aliases'>>) || []);
  if (list.length) countries[code] = list.map(({ aliases: _a, ...b }: BankInfo | Omit<BankInfo, 'aliases'> & { aliases?: string[] }) => b);
  process.stdout.write(`${code}:${banks?.length ?? 'x'} `);
  await sleep(1000);
}
fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), source: 'Wikidata (CC0)', countries }) + '\n');
console.log(`\nWrote ${OUT}: ${Object.keys(countries).length} countries, ${failed} failed.`);
