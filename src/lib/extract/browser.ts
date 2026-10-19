'use client';

/**
 * Browser-only readers: images (OCR on device), PDFs (text layer, OCR fallback), Excel and CSV.
 * Heavy libraries load lazily on first use and are self-hosted under /vendor (see scripts/copy-vendor.mjs).
 * Nothing here talks to the server.
 */

import { parseCsvText, tableToRows, type Cell } from './table';
import { parseDocumentText } from './text';
import { localeDayOrder } from './dates';
import { MAX_FILE_BYTES, type ExtractResult } from './types';

export type Progress = (p: { file: string; stage: string; pct: number }) => void;

interface Opts {
  fallbackCurrency: string;
  locale?: string;
  onProgress?: Progress;
}

/** What a file really is, from its first bytes (the name and MIME type can lie). */
async function sniff(file: File): Promise<'pdf' | 'xlsx' | 'xls' | 'png' | 'jpeg' | 'webp' | 'gif' | 'heic' | 'text' | 'unknown'> {
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ascii = String.fromCharCode(...b);
  if (ascii.startsWith('%PDF')) return 'pdf';
  if (b[0] === 0x50 && b[1] === 0x4b) return 'xlsx'; // zip container (xlsx); other zips fail to parse below
  if (b[0] === 0xd0 && b[1] === 0xcf) return 'xls';
  if (b[0] === 0x89 && ascii.slice(1, 4) === 'PNG') return 'png';
  if (b[0] === 0xff && b[1] === 0xd8) return 'jpeg';
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return 'webp';
  if (ascii.startsWith('GIF8')) return 'gif';
  if (ascii.slice(4, 8) === 'ftyp' && /heic|heix|mif1|msf1|hevc/.test(ascii.slice(8, 12))) return 'heic';
  // Text: no NUL bytes in the first 4 KB.
  const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  return head.includes(0) ? 'unknown' : 'text';
}

/** Scales an image to ≤ 2000 px on the long side and greyscale-boosts it for OCR. */
async function prepareImage(blob: Blob): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = Math.max(0, Math.min(255, (g - 128) * 1.35 + 128)); // mild contrast stretch
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

type OcrWorker = Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>;
let workerPromise: Promise<OcrWorker> | null = null;
let currentProgress: ((pct: number) => void) | null = null;

async function ocrWorker(): Promise<OcrWorker> {
  workerPromise ??= (async () => {
    const { createWorker, OEM } = await import('tesseract.js');
    return createWorker('eng', OEM.LSTM_ONLY, {
      workerPath: '/vendor/tesseract/worker.min.js',
      corePath: '/vendor/tesseract/core',
      langPath: '/vendor/tesseract/lang',
      gzip: true,
      workerBlobURL: false,
      logger: (m: { status: string; progress: number }) => {
        if (m.status === 'recognizing text') currentProgress?.(m.progress);
      },
    });
  })().catch((e) => {
    workerPromise = null;
    throw e;
  });
  return workerPromise;
}

async function ocr(source: HTMLCanvasElement, onPct: (pct: number) => void): Promise<string> {
  const worker = await ocrWorker();
  currentProgress = onPct;
  try {
    const { data } = await worker.recognize(source);
    return data.text ?? '';
  } finally {
    currentProgress = null;
  }
}

async function readImage(file: File, blob: Blob, opts: Opts): Promise<ExtractResult> {
  const p = (stage: string, pct: number) => opts.onProgress?.({ file: file.name, stage, pct });
  p('Preparing image', 5);
  const canvas = await prepareImage(blob);
  p('Reading text on your device', 15);
  const text = await ocr(canvas, (x) => p('Reading text on your device', 15 + Math.round(x * 80)));
  p('Finding the transaction', 98);
  const result = parseDocumentText(text, { file: file.name, fallbackCurrency: opts.fallbackCurrency, dayOrder: localeDayOrder(opts.locale), kind: 'image', method: 'OCR on your device' });
  return { ...result, previewUrl: URL.createObjectURL(blob) };
}

async function readPdf(file: File, opts: Opts): Promise<ExtractResult> {
  const p = (stage: string, pct: number) => opts.onProgress?.({ file: file.name, stage, pct });
  p('Opening PDF', 5);
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs';
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages = Math.min(doc.numPages, 20);
  const lines: string[] = [];
  let ocrUsed = false;
  for (let n = 1; n <= pages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    // Rebuild lines from positioned text items (same baseline → same line, left to right).
    const byLine = new Map<number, Array<{ x: number; s: string }>>();
    for (const item of content.items as Array<{ str?: string; transform?: number[] }>) {
      if (!item.str?.trim() || !item.transform) continue;
      const y = Math.round(item.transform[5] / 3) * 3;
      const list = byLine.get(y) ?? [];
      list.push({ x: item.transform[4], s: item.str });
      byLine.set(y, list);
    }
    const pageLines = [...byLine.entries()].sort((a, b) => b[0] - a[0]).map(([, parts]) => parts.sort((a, b) => a.x - b.x).map((q) => q.s).join(' '));
    if (pageLines.join('').trim().length < 20) {
      // Scanned page: render and OCR it.
      ocrUsed = true;
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise;
      const text = await ocr(canvas, (x) => p(`OCR page ${n} of ${pages}`, Math.round(((n - 1 + x) / pages) * 90) + 5));
      lines.push(...text.split(/\r?\n/));
    } else lines.push(...pageLines);
    p(`Reading page ${n} of ${pages}`, Math.round((n / pages) * 90) + 5);
  }
  const result = parseDocumentText(lines.join('\n'), {
    file: file.name,
    fallbackCurrency: opts.fallbackCurrency,
    dayOrder: localeDayOrder(opts.locale),
    kind: 'pdf',
    method: ocrUsed ? 'PDF (scanned pages read with OCR on your device)' : 'PDF text',
  });
  if (doc.numPages > pages) result.errors.push(`Only the first ${pages} pages were read.`);
  return result;
}

async function readSheet(file: File, opts: Opts): Promise<ExtractResult> {
  opts.onProgress?.({ file: file.name, stage: 'Reading spreadsheet', pct: 20 });
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  // The first sheet with a table on it.
  for (const name of wb.SheetNames) {
    const table = XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[name], { header: 1, raw: true, blankrows: false, defval: '' });
    if (table.length < 2) continue;
    const { rows, map, errors } = tableToRows(table, { file: file.name, fallbackCurrency: opts.fallbackCurrency, dayOrder: localeDayOrder(opts.locale) });
    const cols = map.headerRow ? map.roles.map((r, i) => (r === 'ignore' ? null : `${String(table[0][i] ?? '').trim()} → ${r}`)).filter(Boolean).join(', ') : 'detected from contents';
    return { file: file.name, kind: 'xlsx', rows, method: `Excel sheet "${name}" · ${cols}`, errors };
  }
  return { file: file.name, kind: 'xlsx', rows: [], method: 'Excel', errors: ['No table found in this workbook.'] };
}

async function readText(file: File, opts: Opts): Promise<ExtractResult> {
  const text = await file.text();
  const dayOrder = localeDayOrder(opts.locale);
  // Delimited data (CSV/TSV)?
  const firstLines = text.split(/\r?\n/).slice(0, 5);
  if (firstLines.filter((l) => /[,;\t|]/.test(l)).length >= Math.min(2, firstLines.length)) {
    const { table, rows, map, errors } = parseCsvText(text, { file: file.name, fallbackCurrency: opts.fallbackCurrency, dayOrder });
    const cols = map.headerRow ? map.roles.map((r, i) => (r === 'ignore' ? null : `${table[0][i]} → ${r}`)).filter(Boolean).join(', ') : 'detected from contents';
    return { file: file.name, kind: 'csv', rows, method: `CSV · ${cols}`, errors };
  }
  return parseDocumentText(text, { file: file.name, fallbackCurrency: opts.fallbackCurrency, dayOrder, kind: 'text', method: 'Text file' });
}

/** Reads one file into reviewable rows. Throws only for unsupported or oversized files. */
export async function extractFile(file: File, opts: Opts): Promise<ExtractResult> {
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is larger than ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB.`);
  if (file.size === 0) throw new Error(`${file.name} is empty.`);
  const kind = await sniff(file);
  switch (kind) {
    case 'pdf':
      return readPdf(file, opts);
    case 'xlsx':
    case 'xls':
      return readSheet(file, opts);
    case 'png':
    case 'jpeg':
    case 'webp':
    case 'gif':
      return readImage(file, file, opts);
    case 'heic': {
      opts.onProgress?.({ file: file.name, stage: 'Converting HEIC photo', pct: 3 });
      const heic2any = (await import('heic2any')).default;
      const jpeg = (await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })) as Blob;
      return readImage(file, jpeg, opts);
    }
    case 'text':
      return readText(file, opts);
    default:
      throw new Error(`${file.name}: this file type isn't supported. Use a photo (JPG, PNG, WebP, HEIC), PDF, CSV or Excel file.`);
  }
}

export const ACCEPT = '.csv,.tsv,.txt,.xlsx,.xls,.pdf,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,text/csv,application/pdf,image/*,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';
