/**
 * Tables (CSV/TSV/XLSX) → transactions. One RFC 4180 parser (quoted fields, "" escapes, newlines in
 * quotes, apostrophes are plain text), header-based column detection with content fallbacks, separate
 * debit/credit columns, DR/CR indicator columns and per-column day/month order detection.
 */

import { toMinor } from '../money';
import { isIsoCurrency } from '../currency';
import { chooseDayOrder, parseDate, type DayOrder } from './dates';
import { todayYmd } from '../dates';
import { rowKey, MAX_ROWS, type ExtractedRow } from './types';

export type Cell = string | number | Date | null | undefined;

/** Picks the delimiter that splits the first lines most consistently (outside quotes). */
export function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 10);
  let best = ',';
  let bestScore = -1;
  for (const d of [',', ';', '\t', '|']) {
    const counts = sample.map((line) => {
      let n = 0;
      let q = false;
      for (const ch of line) {
        if (ch === '"') q = !q;
        else if (ch === d && !q) n++;
      }
      return n;
    });
    const min = Math.min(...counts);
    const score = min > 0 ? min * 10 - (Math.max(...counts) - min) : -1;
    if (score > bestScore) [best, bestScore] = [d, score];
  }
  return best;
}

export function parseDelimited(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field.trim() === '') {
      quoted = true;
      field = '';
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows.map((r) => r.map((c) => c.trim()));
}

export type Role = 'date' | 'merchant' | 'amount' | 'debit' | 'credit' | 'direction' | 'category' | 'currency' | 'notes' | 'ignore';

const HEADER_RULES: Array<[Role, RegExp]> = [
  ['ignore', /balance|running|available|closing|opening|cheque\s*no|check\s*no|ref(erence)?\s*no/i],
  ['debit', /debit|withdraw|paid\s*out|money\s*out|outflow|spent|^dr$|charges?$/i],
  ['credit', /credit(?!\s*card)|deposit|paid\s*in|money\s*in|inflow|received|^cr$/i],
  ['direction', /^(type|dr\s*\/\s*cr|cr\s*\/\s*dr|debit\s*\/\s*credit|direction|in\s*\/\s*out|transaction\s*type)$/i],
  ['date', /date|posted|booking|value\s*day|time/i],
  ['currency', /currency|ccy|^cur$/i],
  ['amount', /amount|^value$|^sum$|^total$|amt/i],
  ['category', /categor/i],
  ['notes', /note|memo|comment|remark/i],
  ['merchant', /description|merchant|payee|narration|details|particulars|name|transaction|counterparty|beneficiary|vendor|store|reference|^item$/i],
];

const looksDate = (v: Cell) => v instanceof Date || (typeof v === 'number' ? v > 20000 && v < 80000 : !!parseDate(String(v ?? ''), 'dmy'));
const looksAmount = (v: Cell) => typeof v === 'number' || /^[(\-+]?\s*[^\d\s]{0,3}\s*\d[\d.,\s]*\)?\s*(?:[A-Z]{3}|cr|dr)?$/i.test(String(v ?? '').trim());

export interface ColumnMap {
  roles: Role[];
  headerRow: boolean;
}

/** Header names first; when the first row isn't a header, roles come from the cell contents. */
export function detectColumns(table: Cell[][]): ColumnMap {
  const width = Math.max(...table.slice(0, 20).map((r) => r.length));
  const first = table[0] ?? [];
  const headerRow = first.some((c) => typeof c === 'string' && /[a-z]{3,}/i.test(c) && !looksDate(c) && !looksAmount(c));
  const roles: Role[] = Array(width).fill('ignore');

  if (headerRow) {
    first.forEach((h, i) => {
      const name = String(h ?? '').trim();
      const rule = HEADER_RULES.find(([, re]) => re.test(name));
      roles[i] = rule ? rule[0] : 'ignore';
    });
    // Two "merchant"-like columns: keep the first, the other becomes notes.
    let seen = false;
    roles.forEach((r, i) => {
      if (r === 'merchant') {
        if (seen) roles[i] = 'notes';
        seen = true;
      }
    });
  }

  // Fill gaps from content: date, amount and the most text-heavy column.
  const body = table.slice(headerRow ? 1 : 0, 40);
  const share = (i: number, test: (v: Cell) => boolean) => body.filter((r) => r[i] !== undefined && r[i] !== '' && test(r[i])).length / Math.max(1, body.length);
  if (!roles.includes('date')) {
    const i = [...Array(width).keys()].find((k) => roles[k] === 'ignore' && share(k, looksDate) > 0.6);
    if (i !== undefined) roles[i] = 'date';
  }
  if (!roles.includes('amount') && !roles.includes('debit') && !roles.includes('credit')) {
    const nums = [...Array(width).keys()].filter((k) => roles[k] === 'ignore' && share(k, looksAmount) > 0.6);
    if (nums.length) roles[nums[0]] = 'amount'; // leftmost numeric column (a trailing one is usually a balance)
  }
  if (!roles.includes('merchant')) {
    let best = -1;
    let bestLen = 0;
    for (let k = 0; k < width; k++) {
      if (roles[k] !== 'ignore') continue;
      const avg = body.reduce((s, r) => s + String(r[k] ?? '').length, 0) / Math.max(1, body.length);
      if (avg > bestLen && share(k, (v) => typeof v === 'string' && /[a-z]/i.test(v)) > 0.5) [best, bestLen] = [k, avg];
    }
    if (best >= 0) roles[best] = 'merchant';
  }
  return { roles, headerRow };
}

const SYMBOL_CURRENCY: Array<[RegExp, string]> = [
  [/€/, 'EUR'], [/£/, 'GBP'], [/₹/, 'INR'], [/৳|\bTk\.?\b/i, 'BDT'], [/₩/, 'KRW'], [/₦/, 'NGN'], [/₱/, 'PHP'], [/₺/, 'TRY'],
  [/₫/, 'VND'], [/₪/, 'ILS'], [/₴/, 'UAH'], [/₽/, 'RUB'], [/฿/, 'THB'], [/R\$/, 'BRL'], [/CHF/, 'CHF'], [/¥|￥/, 'JPY'],
];

/** Currency written in a value or text ("€12", "12 EUR"), or null. */
export function currencyIn(text: string): string | null {
  const code = text.match(/\b([A-Z]{3})\b/);
  if (code && isIsoCurrency(code[1])) return code[1];
  for (const [re, c] of SYMBOL_CURRENCY) if (re.test(text)) return c;
  return null;
}

const amountOf = (v: Cell, currency: string): number | null => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return toMinor(v, currency);
  const s = String(v).trim();
  if (!/\d/.test(s)) return null;
  let n = toMinor(s.replace(/\b(cr|dr)\b/i, ''), currency);
  if (/\bdr\b/i.test(s) && n > 0) n = -n;
  return n;
};

/**
 * Turns a parsed table into reviewable rows. `fallbackCurrency` is used when the file names none
 * (normally the target account's currency).
 */
export function tableToRows(table: Cell[][], opts: { file: string; fallbackCurrency: string; dayOrder: DayOrder; map?: ColumnMap }): { rows: ExtractedRow[]; map: ColumnMap; errors: string[] } {
  const errors: string[] = [];
  const map = opts.map ?? detectColumns(table);
  const col = (r: Role) => map.roles.indexOf(r);
  const [iDate, iMerch, iAmt, iDeb, iCred, iDir, iCat, iCur, iNotes] = (['date', 'merchant', 'amount', 'debit', 'credit', 'direction', 'category', 'currency', 'notes'] as Role[]).map(col);
  if (iDate < 0) errors.push('No date column found. Pick it in the column list.');
  if (iAmt < 0 && iDeb < 0 && iCred < 0) errors.push('No amount column found. Pick it in the column list.');
  const body = table.slice(map.headerRow ? 1 : 0).slice(0, MAX_ROWS);
  if (table.length - (map.headerRow ? 1 : 0) > MAX_ROWS) errors.push(`Only the first ${MAX_ROWS} rows are imported.`);
  const order = iDate >= 0 ? chooseDayOrder(body.map((r) => String(r[iDate] ?? '')), opts.dayOrder, todayYmd()) : opts.dayOrder;

  const rows: ExtractedRow[] = [];
  body.forEach((r, idx) => {
    const warnings: string[] = [];
    const rawCur = iCur >= 0 ? String(r[iCur] ?? '').trim().toUpperCase() : '';
    const amountText = [iAmt, iDeb, iCred].filter((i) => i >= 0).map((i) => String(r[i] ?? '')).join(' ');
    const currency = isIsoCurrency(rawCur) ? rawCur : currencyIn(amountText) ?? opts.fallbackCurrency;

    let amount: number | null = null;
    if (iDeb >= 0 || iCred >= 0) {
      const d = iDeb >= 0 ? amountOf(r[iDeb], currency) : null;
      const c = iCred >= 0 ? amountOf(r[iCred], currency) : null;
      if (d) amount = -Math.abs(d);
      else if (c) amount = Math.abs(c);
      else if (iAmt >= 0) amount = amountOf(r[iAmt], currency);
    } else if (iAmt >= 0) amount = amountOf(r[iAmt], currency);
    if (amount !== null && iDir >= 0) {
      const dir = String(r[iDir] ?? '').toLowerCase();
      if (/^(dr|debit|withdrawal|out|expense|purchase|payment)/.test(dir)) amount = -Math.abs(amount);
      else if (/^(cr|credit|deposit|in|income|refund)/.test(dir)) amount = Math.abs(amount);
    }
    const date = iDate >= 0 ? parseDate(r[iDate] as string, order) : null;
    const merchant = String((iMerch >= 0 ? r[iMerch] : '') ?? '').trim().slice(0, 120);

    if (amount === null || amount === 0) return; // headers repeated mid-file, totals, blank lines
    if (!date) warnings.push('Date missing or unreadable');
    if (!merchant) warnings.push('Description missing');
    rows.push({
      key: rowKey(),
      financialDate: date ?? '',
      merchant: merchant || 'Unknown',
      amountCents: amount,
      currency,
      category: iCat >= 0 && String(r[iCat] ?? '').trim() ? String(r[iCat]).trim().slice(0, 60) : 'General',
      notes: iNotes >= 0 && r[iNotes] ? String(r[iNotes]).trim().slice(0, 500) : undefined,
      confidence: warnings.length ? 'low' : 'high',
      warnings,
      source: { file: opts.file, line: idx + (map.headerRow ? 2 : 1) },
    });
  });

  // A file with only positive amounts and no debit/credit info: most likely spending written as positive numbers.
  if (rows.length >= 3 && iDeb < 0 && iCred < 0 && iDir < 0 && rows.every((x) => x.amountCents > 0)) {
    for (const x of rows) {
      x.amountCents = -x.amountCents;
      x.warnings.push('Sign guessed: treated as spending');
      x.confidence = x.confidence === 'high' ? 'medium' : x.confidence;
    }
    errors.push('All amounts were positive, so they are treated as spending. Flip any income rows in the review.');
  }
  return { rows, map, errors };
}

/** CSV/TSV text → rows. */
export function parseCsvText(text: string, opts: { file: string; fallbackCurrency: string; dayOrder: DayOrder }) {
  const table = parseDelimited(text);
  return { table, ...tableToRows(table, opts) };
}
