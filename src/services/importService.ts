// CSV Import, Parsing, Validation, and Duplicate Fingerprinting Service
import { Transaction } from '../types/finance';
import { dollarsToCents, fromMinor, sanitizeCsvCell } from '../lib/money';

export interface CsvPreview {
  headers: string[];
  rows: string[][];
  rowCount: number;
  delimiter: string;
}

export interface ColumnMapping {
  dateCol: number;
  merchantCol: number;
  amountCol: number;
  categoryCol?: number;
  notesCol?: number;
}

export interface ParsedImportRow {
  rowNumber: number;
  financialDate: string;
  merchant: string;
  amountCents: number;
  category: string;
  notes?: string;
  isValid: boolean;
  validationError?: string;
  isDuplicate?: boolean;
}

export function parseCsvRaw(csvText: string): CsvPreview {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { headers: [], rows: [], rowCount: 0, delimiter: ',' };
  }

  // Detect delimiter (, or ; or \t)
  const firstLine = lines[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  let delimiter = ',';
  if (semicolonCount > commaCount && semicolonCount > tabCount) delimiter = ';';
  if (tabCount > commaCount && tabCount > semicolonCount) delimiter = '\t';

  // Simple, resilient CSV row splitter taking quotes into account
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1, 10).map(parseLine);

  return {
    headers,
    rows,
    rowCount: lines.length - 1,
    delimiter,
  };
}

export function generateTransactionFingerprint(date: string, merchant: string, amountCents: number): string {
  const cleanMerchant = merchant.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${date}_${cleanMerchant}_${amountCents}`;
}

export function processCsvData(
  csvText: string,
  mapping: ColumnMapping,
  existingTransactions: Transaction[],
  accountId: string,
  userId: string
): {
  validRows: ParsedImportRow[];
  invalidRows: ParsedImportRow[];
  duplicateCount: number;
} {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) {
    return { validRows: [], invalidRows: [], duplicateCount: 0 };
  }

  const existingFingerprints = new Set(
    existingTransactions.map((t) => t.importFingerprint || generateTransactionFingerprint(t.financialDate, t.merchant, t.amountCents))
  );

  const delimiter = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
  const dataLines = lines.slice(1);

  const validRows: ParsedImportRow[] = [];
  const invalidRows: ParsedImportRow[] = [];
  let duplicateCount = 0;

  dataLines.forEach((line, idx) => {
    // Basic regex-safe CSV tokenizer
    const parts = line.split(delimiter).map((s) => s.replace(/^["']|["']$/g, '').trim());

    const dateVal = parts[mapping.dateCol] || '';
    const merchantVal = parts[mapping.merchantCol] || 'Unknown Merchant';
    const amountVal = parts[mapping.amountCol] || '';
    const categoryVal = mapping.categoryCol !== undefined ? parts[mapping.categoryCol] || 'Uncategorized' : 'General';
    const notesVal = mapping.notesCol !== undefined ? parts[mapping.notesCol] : '';

    // Date check (support YYYY-MM-DD or MM/DD/YYYY)
    let standardizedDate = dateVal;
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateVal)) {
      const [m, d, y] = dateVal.split('/');
      standardizedDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    const isValidDate = !isNaN(Date.parse(standardizedDate));
    const amountCents = dollarsToCents(amountVal);

    if (!isValidDate) {
      invalidRows.push({
        rowNumber: idx + 2,
        financialDate: dateVal,
        merchant: merchantVal,
        amountCents: 0,
        category: categoryVal,
        isValid: false,
        validationError: 'Invalid or unparseable date format',
      });
      return;
    }

    if (amountCents === 0 && amountVal.trim() !== '0' && amountVal.trim() !== '$0') {
      invalidRows.push({
        rowNumber: idx + 2,
        financialDate: standardizedDate,
        merchant: merchantVal,
        amountCents: 0,
        category: categoryVal,
        isValid: false,
        validationError: 'Invalid monetary amount',
      });
      return;
    }

    const fingerprint = generateTransactionFingerprint(standardizedDate, merchantVal, amountCents);
    const isDuplicate = existingFingerprints.has(fingerprint);
    if (isDuplicate) {
      duplicateCount++;
    }

    validRows.push({
      rowNumber: idx + 2,
      financialDate: standardizedDate,
      merchant: merchantVal,
      amountCents,
      category: categoryVal,
      notes: notesVal,
      isValid: true,
      isDuplicate,
    });
  });

  return { validRows, invalidRows, duplicateCount };
}

/**
 * Neutralized CSV Export:
 * Protects against CSV formula injection by wrapping cells with single quotes if they start with formula triggers.
 */
export function exportTransactionsToCsv(transactions: Transaction[]): string {
  const headers = ['ID', 'Date', 'Merchant', 'Category', 'Amount', 'Currency', 'Status', 'Account ID', 'Notes'];
  const rows = transactions.map((t) => [
    sanitizeCsvCell(t.id),
    sanitizeCsvCell(t.financialDate),
    sanitizeCsvCell(t.merchant),
    sanitizeCsvCell(t.category),
    sanitizeCsvCell(fromMinor(t.amountCents, t.currency)),
    sanitizeCsvCell(t.currency),
    sanitizeCsvCell(t.status),
    sanitizeCsvCell(t.accountId),
    sanitizeCsvCell(t.notes || ''),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
