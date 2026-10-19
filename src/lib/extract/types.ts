/**
 * WealthPilot — document extraction (Phase D). Files are parsed in the browser; raw files never
 * reach the server. Every extracted row is reviewed and editable before anything is saved.
 */

export type ExtractKind = 'csv' | 'xlsx' | 'pdf' | 'image' | 'text';
export type Confidence = 'high' | 'medium' | 'low';

export interface ExtractedRow {
  key: string; // stable id for the review grid
  financialDate: string; // YYYY-MM-DD ('' when unknown: the user must fill it)
  merchant: string;
  /** Signed integer minor units of `currency` (< 0 expense). */
  amountCents: number;
  currency: string;
  category: string;
  notes?: string;
  confidence: Confidence;
  /** Why the row needs a look ("Date guessed", "Amount unclear"…). */
  warnings: string[];
  source: { file: string; page?: number; line?: number };
}

export interface ExtractResult {
  file: string;
  kind: ExtractKind;
  rows: ExtractedRow[];
  /** Text read from a PDF/image (shown to the user, and the only thing AI may see, after redaction). */
  text?: string;
  previewUrl?: string; // object URL for image thumbnails
  method: string; // "CSV columns: Date, Description, Amount" / "OCR (on device)"
  errors: string[];
  /** The document looked like a single receipt (vs a statement with many lines). */
  receipt?: { total?: number; items: Array<{ name: string; amountCents: number }> };
}

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_FILES = 5;
export const MAX_ROWS = 2000;

let n = 0;
export const rowKey = () => `r${Date.now().toString(36)}${(n++).toString(36)}`;
