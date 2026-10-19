/**
 * Free text (OCR of a photo, or a PDF's text layer) → transactions, with rules only.
 *  - Statement: many lines that start with a date and end with an amount → one row per line.
 *  - Receipt: one purchase → merchant (top lines), date, total (the "Total" line, else the largest
 *    amount) and the item lines for an optional split.
 */

import { toMinor } from '../money';
import { chooseDayOrder, findDateInText, parseDate, type DayOrder } from './dates';
import { todayYmd } from '../dates';
import { currencyIn } from './table';
import { rowKey, type ExtractedRow, type ExtractResult } from './types';

// A currency prefix is a real symbol or code, never arbitrary letters ("Gulshan 2" is not money).
const CODES = 'USD|EUR|GBP|BDT|INR|JPY|CNY|RMB|AUD|CAD|SGD|AED|SAR|QAR|KWD|PKR|LKR|NPR|MYR|CHF|HKD|NZD|ZAR|THB|IDR|PHP|VND|KRW|NGN|KES|EGP|TRY|BRL|MXN|SEK|NOK|DKK|PLN';
const CUR_PREFIX = String.raw`(?:[$€£¥₹৳₩₦₱₺₫₪₴₽฿]|R\$|Rs\.?|Tk\.?|(?:${CODES})(?=\s?\d))`;
const STARTS_WITH_CURRENCY = new RegExp(String.raw`^[(-]?\s*${CUR_PREFIX}`, 'i');
const AMOUNT = new RegExp(String.raw`[(-]?\s*(?:${CUR_PREFIX}\s?)?\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{1,3})?\)?(?:\s?(?:cr|dr|-))?`, 'gi');
const TOTAL_LINE = /\b(grand\s*total|total\s*(?:amount|due|payable|paid)?|amount\s*(?:due|paid|payable)|net\s*(?:payable|amount)|balance\s*due|to\s*pay|sum|total)\b/i;
const NOT_ITEM = /\b(sub\s*total|subtotal|tax|vat|gst|service\s*charge|tip|change|cash|card|visa|mastercard|amex|discount|rounding|tendered|balance|total|paid|due|qty|quantity)\b/i;
const NOT_MERCHANT = /\b(receipt|invoice|tax\s*invoice|bill|order|table|cashier|date|time|tel|phone|www\.|http|vat\s*reg|gst\s*no|thank)\b/i;

/** Money written on a line (minor units of `currency`) with where it starts, in order. */
function moneyOn(line: string, currency: string): Array<{ value: number; index: number }> {
  const out: Array<{ value: number; index: number }> = [];
  for (const m of line.matchAll(AMOUNT)) {
    const raw = m[0].trim();
    // Money has decimals ("12.50"), a currency sign/code ("¥1500", "BDT 500") or thousands grouping ("1,500").
    // Bare integers (quantities, "1L", years, house numbers) are not amounts.
    const body = raw.replace(/\s?(cr|dr|-)$/i, '');
    const hasDecimals = /[.,]\d{1,3}\)?$/.test(body) && !/[.,]\d{3}\)?$/.test(body);
    const hasCurrency = STARTS_WITH_CURRENCY.test(body);
    const grouped = /\d{1,3}(?:[.,]\d{3})+\)?$/.test(body);
    if (!hasDecimals && !hasCurrency && !grouped) continue;
    if (body.replace(/\D/g, '').length > 9) continue; // ids, account numbers
    const v = toMinor(raw.replace(/\b(cr|dr)\b/i, ''), currency);
    if (v !== 0) out.push({ value: /\bdr\b|-$/i.test(raw) ? -Math.abs(v) : v, index: m.index ?? 0 });
  }
  return out;
}

const amountsOn = (line: string, currency: string) => moneyOn(line, currency).map((m) => m.value);

const cleanLine = (l: string) => l.replace(/[|_~`]+/g, ' ').replace(/\s+/g, ' ').trim();

export function looksLikeStatement(lines: string[], order: DayOrder): boolean {
  const dated = lines.filter((l) => parseDate(l.slice(0, 14), order) && /\d[.,]\d{2}\b/.test(l));
  return dated.length >= 3;
}

const DATE_LEAD = /^(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}|\d{1,2}[\s-][A-Za-z]{3,9}[\s-]\d{2,4}|[A-Za-z]{3,9}\s\d{1,2},?\s\d{2,4})/;
const NOT_A_TRANSACTION = /\b(opening|closing|brought\s*forward|carried\s*forward|b\/f|c\/f|balance\s*(?:as\s*(?:of|at)|forward))\b/i;

function statementRows(lines: string[], file: string, currency: string, fallbackOrder: DayOrder): ExtractedRow[] {
  const order = chooseDayOrder(lines.map((l) => l.match(DATE_LEAD)?.[0] ?? '').filter(Boolean), fallbackOrder, todayYmd());
  const rows: ExtractedRow[] = [];
  lines.forEach((line, i) => {
    const dateMatch = line.match(DATE_LEAD);
    const date = dateMatch && parseDate(dateMatch[0], order);
    if (!date || NOT_A_TRANSACTION.test(line)) return;
    const rest = line.slice(dateMatch![0].length).trim();
    const money = moneyOn(rest, currency);
    if (!money.length) return;
    // "description … amount balance": with 2+ amounts the last one is usually the running balance.
    const amount = money.length >= 2 ? money[money.length - 2].value : money[0].value;
    const merchant = rest.slice(0, money[0].index).replace(/\b(cr|dr)\b\s*$/i, '').replace(/\s+/g, ' ').trim().slice(0, 120);
    const isCredit = /\b(cr|credit|deposit|salary|refund|received|transfer in)\b/i.test(line);
    rows.push({
      key: rowKey(),
      financialDate: date,
      merchant: merchant || 'Unknown',
      amountCents: amount < 0 || isCredit ? Math.abs(amount) * (amount < 0 && !isCredit ? -1 : 1) : -amount,
      currency,
      category: 'General',
      confidence: merchant ? 'medium' : 'low',
      warnings: money.length >= 2 ? ['Check the amount (a balance column was ignored)'] : [],
      source: { file, line: i + 1 },
    });
  });
  return rows;
}

function receiptRow(lines: string[], text: string, file: string, currency: string, order: DayOrder): { row: ExtractedRow | null; total?: number; items: Array<{ name: string; amountCents: number }> } {
  const warnings: string[] = [];
  // Total: the last line that says "total" (not subtotal) with an amount; else the largest amount.
  let total: number | undefined;
  for (const l of [...lines].reverse()) {
    if (TOTAL_LINE.test(l) && !/sub\s*-?\s*total/i.test(l)) {
      const a = amountsOn(l, currency).filter((x) => x > 0);
      if (a.length) {
        total = a[a.length - 1];
        break;
      }
    }
  }
  if (total === undefined) {
    const all = lines.flatMap((l) => amountsOn(l, currency)).filter((x) => x > 0);
    if (all.length) {
      total = Math.max(...all);
      warnings.push('Total guessed (largest amount)');
    }
  }
  const items: Array<{ name: string; amountCents: number }> = [];
  for (const l of lines) {
    if (NOT_ITEM.test(l)) continue;
    const money = moneyOn(l, currency).filter((x) => x.value > 0);
    const last = money[money.length - 1];
    if (!last) continue;
    const name = l.slice(0, money[0].index).replace(/[.·_…]{2,}/g, ' ').replace(/\s[x×@]\s*\d+\s*$/i, '').replace(/\s+/g, ' ').trim();
    if (/[a-z]{2,}/i.test(name) && (total === undefined || last.value <= total)) items.push({ name: name.slice(0, 60), amountCents: last.value });
  }
  const merchantLine = lines.slice(0, 6).find((l) => /[a-z]{3,}/i.test(l) && !NOT_MERCHANT.test(l) && amountsOn(l, currency).length === 0);
  const date = findDateInText(text, order);
  if (!date) warnings.push('Date not found');
  if (!merchantLine) warnings.push('Store name not found');
  if (total === undefined) return { row: null, items };
  return {
    total,
    items,
    row: {
      key: rowKey(),
      financialDate: date ?? '',
      merchant: (merchantLine ?? 'Receipt').replace(/[^\p{L}\p{N}&'.,\- ]/gu, '').trim().slice(0, 120) || 'Receipt',
      amountCents: -total,
      currency,
      category: 'General',
      notes: items.length ? `${items.length} item${items.length === 1 ? '' : 's'}: ${items.slice(0, 6).map((i) => i.name).join(', ')}`.slice(0, 500) : undefined,
      confidence: warnings.length > 1 ? 'low' : warnings.length ? 'medium' : 'high',
      warnings,
      source: { file },
    },
  };
}

/** Text → rows (statement lines, or one receipt). */
export function parseDocumentText(text: string, opts: { file: string; fallbackCurrency: string; dayOrder: DayOrder; kind: ExtractResult['kind']; method: string }): ExtractResult {
  const lines = text.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const currency = currencyIn(text) ?? opts.fallbackCurrency;
  if (!lines.length) return { file: opts.file, kind: opts.kind, rows: [], text, method: opts.method, errors: ['No text could be read from this file.'] };
  if (looksLikeStatement(lines, opts.dayOrder)) {
    const rows = statementRows(lines, opts.file, currency, opts.dayOrder);
    return { file: opts.file, kind: opts.kind, rows, text, method: `${opts.method} · statement lines`, errors: rows.length ? [] : ['No transaction lines were recognised.'] };
  }
  const r = receiptRow(lines, text, opts.file, currency, opts.dayOrder);
  return {
    file: opts.file,
    kind: opts.kind,
    rows: r.row ? [r.row] : [],
    text,
    method: `${opts.method} · receipt`,
    errors: r.row ? [] : ['No total amount was found. Add the transaction by hand or try a clearer photo.'],
    receipt: { total: r.total, items: r.items },
  };
}
