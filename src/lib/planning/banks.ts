/**
 * Bank suggestions from public data: Wikidata (which banks exist, how well-known they are) and
 * recent news (GDELT). Deterministic and explained: we never invent rates for a bank; the country's
 * average rate (World Bank) is the benchmark. Not financial advice.
 */

export interface BankInfo {
  id: string; // Wikidata Q-id or "gsib:<slug>"
  name: string;
  website: string | null;
  kind: 'local' | 'international';
  hq: string | null; // ISO-2 of headquarters for international banks
  fame: number; // Wikipedia language editions (sitelinks)
  aliases: string[]; // names used to match headlines
}

export interface NewsArticle {
  title: string;
  url: string;
  domain: string;
  date: string; // YYYY-MM-DD
  sourceCountry: string;
}

/**
 * Global systemically important banks (FSB list, Nov 2024). Their presence in a country is shown
 * only when recent local news mentions them there.
 */
export const GSIBS: Array<{ name: string; hq: string; website: string; aliases?: string[] }> = [
  { name: 'JPMorgan Chase', hq: 'US', website: 'https://www.jpmorganchase.com', aliases: ['JPMorgan', 'J.P. Morgan', 'Chase'] },
  { name: 'Citigroup', hq: 'US', website: 'https://www.citigroup.com', aliases: ['Citibank', 'Citi '] },
  { name: 'HSBC', hq: 'GB', website: 'https://www.hsbc.com' },
  { name: 'Standard Chartered', hq: 'GB', website: 'https://www.sc.com', aliases: ['StanChart'] },
  { name: 'Bank of America', hq: 'US', website: 'https://www.bankofamerica.com' },
  { name: 'Barclays', hq: 'GB', website: 'https://www.barclays.com' },
  { name: 'BNP Paribas', hq: 'FR', website: 'https://group.bnpparibas' },
  { name: 'Deutsche Bank', hq: 'DE', website: 'https://www.db.com' },
  { name: 'Goldman Sachs', hq: 'US', website: 'https://www.goldmansachs.com' },
  { name: 'Morgan Stanley', hq: 'US', website: 'https://www.morganstanley.com' },
  { name: 'Wells Fargo', hq: 'US', website: 'https://www.wellsfargo.com' },
  { name: 'UBS', hq: 'CH', website: 'https://www.ubs.com' },
  { name: 'Santander', hq: 'ES', website: 'https://www.santander.com' },
  { name: 'Société Générale', hq: 'FR', website: 'https://www.societegenerale.com', aliases: ['Societe Generale', 'SocGen'] },
  { name: 'Crédit Agricole', hq: 'FR', website: 'https://www.credit-agricole.com', aliases: ['Credit Agricole'] },
  { name: 'ING', hq: 'NL', website: 'https://www.ing.com', aliases: ['ING Bank', 'ING Group'] },
  { name: 'Mitsubishi UFJ', hq: 'JP', website: 'https://www.mufg.jp', aliases: ['MUFG'] },
  { name: 'Mizuho', hq: 'JP', website: 'https://www.mizuhogroup.com' },
  { name: 'Sumitomo Mitsui', hq: 'JP', website: 'https://www.smfg.co.jp', aliases: ['SMBC', 'SMFG'] },
  { name: 'ICBC', hq: 'CN', website: 'https://www.icbc.com.cn', aliases: ['Industrial and Commercial Bank of China'] },
  { name: 'Bank of China', hq: 'CN', website: 'https://www.boc.cn' },
  { name: 'China Construction Bank', hq: 'CN', website: 'http://www.ccb.com', aliases: ['CCB'] },
  { name: 'Agricultural Bank of China', hq: 'CN', website: 'https://www.abchina.com' },
  { name: 'Royal Bank of Canada', hq: 'CA', website: 'https://www.rbc.com', aliases: ['RBC'] },
  { name: 'Toronto-Dominion Bank', hq: 'CA', website: 'https://www.td.com', aliases: ['TD Bank'] },
];

// Words counted in headlines (transparent lexicon, not interpretation).
const NEGATIVE = ['fraud', 'scam', 'penalty', 'penalised', 'penalized', 'fined', 'fine of', 'default', 'loss', 'losses', 'exit', 'exits', 'quit', 'probe', 'investigation', 'collapse', 'crisis', 'npl', 'bad loan', 'non-performing', 'downgrade', 'sanction', 'hack', 'cyber', 'scandal', 'embezzle', 'laundering', 'liquidity crunch', 'bailout', 'layoff', 'lawsuit', 'outage', 'merger forced', 'weak bank'];
const POSITIVE = ['profit', 'growth', 'award', 'expansion', 'expand', 'upgrade', 'partnership', 'partners', 'record', 'acquire', 'acquires', 'acquisition', 'launch', 'launches', 'wins', 'best bank', 'strong', 'rises', 'surge', 'dividend', 'digital', 'green bond', 'takes over', 'take over', 'in talks to take over'];

export function headlineSignal(title: string): number {
  const t = ` ${title.toLowerCase()} `;
  let s = 0;
  for (const w of NEGATIVE) if (t.includes(w)) s -= 1;
  for (const w of POSITIVE) if (t.includes(w)) s += 1;
  return s;
}

const norm = (s: string) => s.toLowerCase().replace(/\b(plc|ltd|limited|bank|group|the|inc|corporation|co)\b/g, ' ').replace(/[^a-z0-9À-￿ ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Does a headline name this bank? Full name or alias, case-insensitive, on word boundaries. */
export function mentions(title: string, bank: Pick<BankInfo, 'name' | 'aliases'>): boolean {
  const t = ` ${title.toLowerCase().replace(/[^a-z0-9À-￿&.\- ]+/g, ' ')} `;
  const names = [bank.name, ...bank.aliases].map((n) => n.toLowerCase().replace(/\b(plc|ltd|limited)\b/g, '').trim()).filter((n) => n.length >= 3);
  return names.some((n) => t.includes(` ${n} `) || t.includes(` ${n}'`) || t.includes(` ${n},`) || t.includes(` ${n}:`));
}

/** Match key for de-duplicating banks with near-identical names. */
export const bankKey = (name: string) => norm(name);

export interface BankPick {
  bank: BankInfo;
  articles: NewsArticle[];
  signal: number;
  score: number;
  group: 'worth' | 'other' | 'caution';
  reasons: string[];
}

/** Ranks banks for a purpose; every pick carries the reasons it got its place. */
export function rankBanks(banks: BankInfo[], news: NewsArticle[], purpose: 'loan' | 'deposit'): BankPick[] {
  const picks = banks.map((bank) => {
    const articles = news.filter((a) => mentions(a.title, bank)).slice(0, 6);
    const signals = articles.map((a) => headlineSignal(a.title));
    const signal = signals.reduce((s, x) => s + x, 0);
    const worst = Math.min(0, ...signals);
    const reasons: string[] = [];
    if (bank.kind === 'international') reasons.push(`International bank (headquartered in ${bank.hq}) seen in local news`);
    if (bank.fame >= 15) reasons.push('Widely known (covered in many languages)');
    if (articles.length >= 3) reasons.push(`Busy in the news: ${articles.length} recent articles`);
    else if (articles.length) reasons.push(`${articles.length} recent article${articles.length === 1 ? '' : 's'}`);
    if (signal > 0) reasons.push('Recent coverage is mostly positive (growth, expansion, deals)');
    if (worst <= -1) reasons.push('Recent headline needs a look (e.g. losses, exit, penalties or probes)');
    if (purpose === 'deposit' && bank.kind === 'local' && bank.fame >= 5) reasons.push('Established local bank for savings deposits');
    if (!reasons.length) reasons.push(bank.kind === 'local' ? 'Established local bank; no recent news found' : 'International bank');
    const score = Math.log2(1 + bank.fame) * 2 + Math.min(articles.length, 6) + signal * 1.5 + (bank.kind === 'local' ? 1 : 0);
    return { bank, articles, signal, score, group: 'other' as BankPick['group'], reasons, worst };
  });
  picks.sort((a, b) => b.score - a.score);
  let worth = 0;
  for (const p of picks) {
    if (p.worst <= -2 || (p.worst <= -1 && p.signal < 0)) p.group = 'caution';
    else if (worth < 3) {
      p.group = 'worth';
      worth++;
    }
  }
  return picks.map(({ worst: _worst, ...p }) => p);
}

/** Keeps a model line only if every number in it appears in that bank's headlines. */
export function groundBrief(pick: Pick<BankPick, 'articles' | 'reasons'>, text: string | undefined): { text: string; source: 'llm' | 'rules' } {
  const heads = pick.articles.map((a) => a.title).join(' ');
  if (text && text.trim() && (text.match(/\d[\d.,]*\d|\d/g) ?? []).every((n) => heads.includes(n))) return { text: text.trim(), source: 'llm' };
  return { text: pick.reasons.join('; '), source: 'rules' };
}

/** GDELT ArtList JSON → articles (deduped by title, http(s) links only). null = rate-limit notice / not JSON. */
export function parseGdelt(text: string): NewsArticle[] | null {
  if (!text.trim().startsWith('{')) return null;
  let body: { articles?: Array<{ title?: string; url?: string; domain?: string; seendate?: string; sourcecountry?: string }> };
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  const seen = new Set<string>();
  const out: NewsArticle[] = [];
  for (const a of body.articles ?? []) {
    const title = (a.title ?? '').replace(/\s+/g, ' ').trim();
    const k = title.toLowerCase();
    if (!title || seen.has(k) || !/^https?:\/\//.test(a.url ?? '')) continue;
    seen.add(k);
    const d = a.seendate ?? '';
    out.push({ title: title.slice(0, 240), url: a.url!, domain: a.domain ?? '', date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, sourceCountry: a.sourcecountry ?? '' });
  }
  return out;
}
