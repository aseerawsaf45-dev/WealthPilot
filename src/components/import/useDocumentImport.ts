'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { api, ApiError } from '../../lib/api';
import { convertMinor } from '../../lib/fx';
import { formatMoney } from '../../lib/money';
import { merchantHistory, suggestCategory, isUncategorized, normalizeMerchant } from '../../lib/ml';
import { MAX_FILES, rowKey, type ExtractedRow, type ExtractResult } from '../../lib/extract/types';
import type { Transaction } from '../../types/finance';

export interface FileState {
  id: string;
  name: string;
  stage: string;
  pct: number;
  error?: string;
  result?: ExtractResult;
  aiState?: 'idle' | 'working' | 'done' | 'error';
  aiNote?: string;
}

export interface SavedBatch {
  batchId: string;
  inserted: number;
  duplicates: number;
  rejected: number;
  accountName: string;
}

/** True when an existing transaction is probably the same one (±2 days, same amount, similar payee). */
function findDuplicate(row: ExtractedRow, existing: Transaction[]): Transaction | undefined {
  const key = normalizeMerchant(row.merchant);
  const d = Date.parse(`${row.financialDate}T00:00:00Z`);
  return existing.find((t) => {
    if (t.amountCents !== row.amountCents) return false;
    if (Math.abs(Date.parse(`${t.financialDate}T00:00:00Z`) - d) > 2 * 86_400_000) return false;
    const k = normalizeMerchant(t.merchant);
    return !key || !k || k.includes(key) || key.includes(k);
  });
}

/**
 * Upload → read on device → (optional) AI → review/edit → save. Shared by the Import page and the
 * assistant. Nothing is saved until `save()` is called from an explicit button press.
 */
export function useDocumentImport() {
  const { accounts, transactions, preferences, fx, commitImportedTransactions, rollbackImportBatch } = useFinance();
  const [files, setFiles] = useState<FileState[]>([]);
  const [rows, setRows] = useState<ExtractedRow[]>([]);
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SavedBatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const account = accounts.find((a) => a.id === accountId) ?? accounts[0];
  const accountCurrency = account?.currency ?? preferences.baseCurrency ?? 'USD';
  const canUseAiReading = !!preferences.isAuthenticated && !!preferences.isAiEnabled && !!preferences.aiProviders?.includes('documents');

  const history = useMemo(() => merchantHistory(transactions), [transactions]);

  /** Category suggestions (your history first) and duplicate warnings for freshly read rows. */
  const enrich = useCallback(
    (list: ExtractedRow[]): ExtractedRow[] =>
      list.map((r) => {
        const out = { ...r, warnings: [...r.warnings] };
        if (isUncategorized(out.category)) {
          const s = suggestCategory(out.merchant, history, preferences.autoCategorizationRules ?? []);
          if (s) out.category = s.category;
        }
        if (out.financialDate && findDuplicate(out, transactions)) out.warnings.push('Possible duplicate of an existing transaction');
        return out;
      }),
    [history, transactions, preferences.autoCategorizationRules]
  );

  const patchFile = (id: string, patch: Partial<FileState>) => setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const addFiles = useCallback(
    async (list: FileList | File[]) => {
      const incoming = Array.from(list);
      if (!incoming.length) return;
      setError(null);
      setSaved(null);
      const room = MAX_FILES - files.length;
      if (room <= 0) {
        setError(`Up to ${MAX_FILES} files at a time. Save or clear the current ones first.`);
        return;
      }
      if (incoming.length > room) setError(`Only the first ${room} file${room === 1 ? '' : 's'} were added (limit ${MAX_FILES}).`);
      const batch = incoming.slice(0, room).map((file) => ({ file, state: { id: rowKey(), name: file.name, stage: 'Waiting', pct: 0 } as FileState }));
      setFiles((prev) => [...prev, ...batch.map((b) => b.state)]);

      // One at a time: OCR is heavy and shares one worker.
      while (busy.current) await new Promise((r) => setTimeout(r, 150));
      busy.current = true;
      try {
        const { extractFile } = await import('../../lib/extract/browser');
        for (const { file, state } of batch) {
          try {
            const result = await extractFile(file, {
              fallbackCurrency: accountCurrency,
              locale: preferences.locale,
              onProgress: (p) => patchFile(state.id, { stage: p.stage, pct: p.pct }),
            });
            patchFile(state.id, { stage: result.rows.length ? `${result.rows.length} found` : 'Nothing found', pct: 100, result, aiState: 'idle' });
            setRows((prev) => [...prev, ...enrich(result.rows)]);
          } catch (e) {
            patchFile(state.id, { stage: 'Failed', pct: 100, error: e instanceof Error ? e.message : 'Could not read this file.' });
          }
        }
      } finally {
        busy.current = false;
      }
    },
    [files.length, accountCurrency, preferences.locale, enrich]
  );

  /** Lets Groq structure the text this device read (opt-in). Replaces that file's rows; still reviewed. */
  const readWithAi = useCallback(
    async (fileId: string) => {
      const f = files.find((x) => x.id === fileId);
      if (!f?.result?.text) return;
      patchFile(fileId, { aiState: 'working', aiNote: undefined });
      try {
        const res = await api.post<{ rows: Array<{ financialDate: string | null; merchant: string; amountCents: number; category: string | null }>; currency: string; dropped: number; documentType: string }>(
          '/ai/extract',
          { text: f.result.text, currencyHint: f.result.rows[0]?.currency ?? accountCurrency, ...(f.result.receipt ? { kindHint: 'receipt' } : {}) }
        );
        if (!res.rows.length) {
          patchFile(fileId, { aiState: 'error', aiNote: 'The AI found nothing it could confirm in the text. The on-device result is unchanged.' });
          return;
        }
        // A single receipt: keep the date this device found when the AI didn't return one.
        const deviceDate = f.result.rows.length === 1 ? f.result.rows[0].financialDate : '';
        const aiRows: ExtractedRow[] = res.rows.map((r, i) => ({
          key: rowKey(),
          financialDate: r.financialDate ?? (res.rows.length === 1 ? deviceDate : ''),
          merchant: r.merchant,
          amountCents: r.amountCents,
          currency: res.currency,
          category: r.category || 'General',
          confidence: 'medium',
          warnings: ['Read by AI: check it'],
          source: { file: f.name, line: i + 1 },
        }));
        setRows((prev) => [...prev.filter((r) => r.source.file !== f.name), ...enrich(aiRows)]);
        patchFile(fileId, {
          aiState: 'done',
          aiNote: `AI read ${aiRows.length} row${aiRows.length === 1 ? '' : 's'}${res.dropped ? `; ${res.dropped} not found in the text were dropped` : ''}.`,
        });
      } catch (e) {
        patchFile(fileId, { aiState: 'error', aiNote: e instanceof ApiError ? e.message : 'AI reading failed. The on-device result is unchanged.' });
      }
    },
    [files, accountCurrency, enrich]
  );

  const updateRow = (key: string, patch: Partial<ExtractedRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch, confidence: 'high', warnings: r.warnings.filter((w) => w.startsWith('Possible duplicate')) } : r)));
  const removeRows = (keys: string[]) => setRows((prev) => prev.filter((r) => !keys.includes(r.key)));
  const addRow = () =>
    setRows((prev) => [...prev, { key: rowKey(), financialDate: '', merchant: '', amountCents: 0, currency: accountCurrency, category: 'General', confidence: 'high', warnings: [], source: { file: 'Added by you' } }]);

  const problems = (r: ExtractedRow) => [!r.financialDate && 'date', !r.merchant.trim() && 'description', !r.amountCents && 'amount'].filter(Boolean) as string[];
  const ready = rows.filter((r) => problems(r).length === 0);
  const totals = ready.reduce(
    (acc, r) => {
      const v = r.currency === accountCurrency ? r.amountCents : convertMinor(r.amountCents, r.currency, accountCurrency, fx);
      if (v === null) acc.unconvertible += 1;
      else if (v < 0) acc.out -= v;
      else acc.in += v;
      return acc;
    },
    { in: 0, out: 0, unconvertible: 0 }
  );

  /** Saves the ready rows into the chosen account (other currencies converted at today's rate, noted on the row). */
  const save = useCallback(async () => {
    if (!account) {
      setError('Create an account first, then import into it.');
      return null;
    }
    const toSave = rows.filter((r) => problems(r).length === 0);
    if (!toSave.length) return null;
    setSaving(true);
    setError(null);
    const prepared = [];
    for (const r of toSave) {
      let amount = r.amountCents;
      let notes = r.notes;
      if (r.currency !== account.currency) {
        const v = convertMinor(r.amountCents, r.currency, account.currency, fx);
        if (v === null) continue;
        amount = v;
        notes = [`Original: ${formatMoney(r.amountCents, r.currency)} (converted at the ${fx?.day} rate)`, notes].filter(Boolean).join(' · ').slice(0, 500);
      }
      prepared.push({
        accountId: account.id,
        financialDate: r.financialDate,
        merchant: r.merchant.trim().slice(0, 120),
        normalizedMerchant: r.merchant.trim(),
        category: r.category.trim() || 'General',
        amountCents: amount,
        currency: account.currency,
        status: 'cleared' as const,
        notes,
        tags: [],
        isTransfer: false,
        source: 'csv_import' as const,
      });
    }
    const res = await commitImportedTransactions(prepared);
    setSaving(false);
    if (!res) {
      setError('Nothing was saved. Check the rows and try again.');
      return null;
    }
    const batch = { ...res, accountName: account.name };
    setSaved(batch);
    setRows([]);
    setFiles([]);
    return batch;
  }, [account, rows, fx, commitImportedTransactions]);

  const undo = useCallback(async () => {
    if (!saved) return false;
    const ok = await rollbackImportBatch(saved.batchId);
    if (ok) setSaved(null);
    return ok;
  }, [saved, rollbackImportBatch]);

  const reset = () => {
    for (const f of files) if (f.result?.previewUrl) URL.revokeObjectURL(f.result.previewUrl);
    setFiles([]);
    setRows([]);
    setError(null);
  };

  return {
    files,
    rows,
    accountId: account?.id ?? '',
    setAccountId,
    accountCurrency,
    canUseAiReading,
    addFiles,
    readWithAi,
    updateRow,
    removeRows,
    addRow,
    problems,
    readyCount: ready.length,
    totals,
    save,
    saving,
    saved,
    undo,
    reset,
    error,
    setError,
  };
}

export type DocumentImport = ReturnType<typeof useDocumentImport>;
