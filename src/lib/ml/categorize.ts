/**
 * ML-01 — Category suggestions. Order: the user's own rules → what the user called this merchant
 * before (their history) → built-in keywords. Suggestions only; the user confirms every change.
 */

import { normalizeMerchant, type MlTx } from './util';

export interface CategorySuggestion {
  category: string;
  source: 'your_rule' | 'your_history' | 'keyword';
  /** 0..100: share of past rows with this category, or a fixed level for rules/keywords. */
  confidence: number;
}

const UNSET = new Set(['', 'general', 'uncategorized', 'other', 'misc']);
export const isUncategorized = (category: string) => UNSET.has(category.trim().toLowerCase());

/** Built-in keywords (lowercase substrings) → category. Kept short and global. */
const KEYWORDS: Array<[RegExp, string]> = [
  [/\b(uber|lyft|bolt|grab|pathao|ola|didi|careem|taxi|metro|subway|transit|train|bus|parking|toll)\b/, 'Transport'],
  [/\b(shell|chevron|exxon|bp|esso|petrol|fuel|gas station|total energies|caltex)\b/, 'Transport'],
  [/\b(netflix|spotify|hulu|disney|youtube premium|prime video|apple music|hbo|chorki|hoichoi|deezer)\b/, 'Subscriptions'],
  [/\b(icloud|google storage|dropbox|onedrive|adobe|microsoft 365|notion|github|openai|chatgpt)\b/, 'Subscriptions'],
  [/\b(starbucks|cafe|coffee|restaurant|pizza|burger|kfc|mcdonald|domino|subway sandwich|foodpanda|doordash|grubhub|deliveroo|ubereats|uber eats|zomato|swiggy|bistro|diner|bakery)\b/, 'Dining'],
  [/\b(walmart|target|costco|kroger|aldi|lidl|tesco|carrefour|whole foods|safeway|grocery|supermarket|shwapno|meena bazar|chaldal|agora|big bazaar|dmart|mart)\b/, 'Groceries'],
  [/\b(electric|electricity|water|utility|utilities|power|desco|dpdc|titas|gas bill|internet|broadband|wifi|comcast|verizon|at&t|t-mobile|vodafone|grameenphone|robi|banglalink|airtel|jio)\b/, 'Utilities'],
  [/\b(rent|landlord|lease|mortgage|housing|apartment)\b/, 'Housing'],
  [/\b(pharmacy|hospital|clinic|doctor|dental|medical|health|cvs|walgreens|lab test)\b/, 'Health'],
  [/\b(gym|fitness|yoga|sport)\b/, 'Wellness'],
  [/\b(amazon|ebay|aliexpress|daraz|flipkart|shopee|lazada|temu|shein|ikea|zara|h&m|uniqlo|mall)\b/, 'Shopping'],
  [/\b(school|tuition|university|college|course|udemy|coursera|books?)\b/, 'Education'],
  [/\b(airline|airways|air|hotel|airbnb|booking\.com|expedia|travel|flight)\b/, 'Travel'],
  [/\b(insurance|premium)\b/, 'Insurance'],
  [/\b(salary|payroll|paycheck|wages|bonus)\b/, 'Income'],
  [/\b(interest|dividend)\b/, 'Investment Income'],
  [/\b(bkash|nagad|rocket|paypal|venmo|zelle|wise|western union|remit)\b/, 'Transfers'],
];

export function keywordCategory(merchant: string): string | null {
  const m = merchant.toLowerCase();
  for (const [re, cat] of KEYWORDS) if (re.test(m)) return cat;
  return null;
}

/** What the user has called each normalized merchant before (only rows they categorized). */
export function merchantHistory(txs: MlTx[]): Map<string, Map<string, number>> {
  const hist = new Map<string, Map<string, number>>();
  for (const t of txs) {
    if (t.isTransfer || isUncategorized(t.category)) continue;
    const key = normalizeMerchant(t.merchant);
    if (!key) continue;
    const m = hist.get(key) ?? new Map<string, number>();
    m.set(t.category, (m.get(t.category) ?? 0) + 1);
    hist.set(key, m);
  }
  return hist;
}

export function suggestCategory(
  merchant: string,
  history: Map<string, Map<string, number>>,
  rules: Array<{ keyword: string; category: string }> = [],
): CategorySuggestion | null {
  const lower = merchant.toLowerCase();
  const rule = rules.find((r) => r.keyword && lower.includes(r.keyword.toLowerCase()));
  if (rule) return { category: rule.category, source: 'your_rule', confidence: 95 };

  const past = history.get(normalizeMerchant(merchant));
  if (past?.size) {
    let best = '';
    let n = 0;
    let total = 0;
    for (const [cat, c] of past) {
      total += c;
      if (c > n) [best, n] = [cat, c];
    }
    return { category: best, source: 'your_history', confidence: Math.round((n * 100) / total) };
  }

  const kw = keywordCategory(merchant);
  return kw ? { category: kw, source: 'keyword', confidence: 60 } : null;
}

/** Suggestions for every uncategorized expense/income row that has one. */
export function suggestCategories(
  txs: MlTx[],
  rules: Array<{ keyword: string; category: string }> = [],
): Array<{ id?: string; merchant: string; financialDate: string; amountCents: number; current: string; suggestion: CategorySuggestion }> {
  const history = merchantHistory(txs);
  const out = [];
  for (const t of txs) {
    if (t.isTransfer || !isUncategorized(t.category)) continue;
    const s = suggestCategory(t.merchant, history, rules);
    if (s && !isUncategorized(s.category)) out.push({ id: t.id, merchant: t.merchant, financialDate: t.financialDate, amountCents: t.amountCents, current: t.category, suggestion: s });
  }
  return out;
}
