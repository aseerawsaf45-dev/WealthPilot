'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  UploadCloud,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Sparkles,
  Trash2,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Undo2,
  ChevronDown,
  ArrowDownLeft,
  ArrowUpRight,
  X,
  Camera,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { formatMoney, fromMinor, toMinor } from '../../lib/money';
import { minorUnits, CURRENCY_CODES } from '../../lib/currency';
import { ACCEPT } from '../../lib/extract/browser';
import { MAX_FILE_BYTES, MAX_FILES, type ExtractedRow } from '../../lib/extract/types';
import type { DocumentImport } from './useDocumentImport';

const CONF_STYLE = {
  high: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-800 border-amber-200',
  low: 'bg-rose-50 text-rose-700 border-rose-200',
} as const;

function kindIcon(name: string) {
  if (/\.(csv|tsv|xlsx?|txt)$/i.test(name)) return FileSpreadsheet;
  if (/\.pdf$/i.test(name)) return FileText;
  return ImageIcon;
}

/** Drop / pick / paste files. Big target, keyboard reachable, camera on phones. */
export function DocumentDropzone({ imp, compact = false }: { imp: DocumentImport; compact?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        imp.addFiles(e.dataTransfer.files);
      }}
      className={`relative rounded-3xl border-2 border-dashed transition-all duration-300 ${over ? 'border-sky-500 bg-sky-50/80 scale-[1.01]' : 'border-slate-300 bg-white/60 hover:border-sky-400'} ${compact ? 'p-5' : 'p-8 sm:p-10'} text-center`}
    >
      <input ref={input} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => e.target.files && imp.addFiles(e.target.files).finally(() => (e.target.value = ''))} />
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files && imp.addFiles(e.target.files).finally(() => (e.target.value = ''))} />
      <div className={`mx-auto flex items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/25 ${compact ? 'h-11 w-11' : 'h-14 w-14'} ${over ? 'animate-bounce' : 'wp-float'}`}>
        <UploadCloud className={compact ? 'h-5 w-5' : 'h-7 w-7'} />
      </div>
      <p className={`mt-3 font-extrabold text-[#0F172A] ${compact ? 'text-sm' : 'text-base sm:text-lg'}`}>Drop receipts, statements or spreadsheets</p>
      <p className="mt-1 text-xs font-medium text-slate-500">
        Photos (JPG, PNG, WebP, HEIC), PDF, CSV or Excel · up to {MAX_FILES} files, {Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB each · read on your device
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={() => input.current?.click()} className="btn-primary-anim btn-shimmer inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold text-white shadow-md cursor-pointer">
          <UploadCloud className="h-4 w-4 text-sky-300" /> Choose files
        </button>
        <button type="button" onClick={() => camera.current?.click()} className="btn-glass-anim inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold text-slate-800 cursor-pointer sm:hidden">
          <Camera className="h-4 w-4 text-sky-600" /> Take a photo
        </button>
      </div>
    </div>
  );
}

/** Per-file progress, method, problems and the optional "Read with AI" step. */
function FileCards({ imp, onAskConsent }: { imp: DocumentImport; onAskConsent: () => void }) {
  const [showText, setShowText] = useState<string | null>(null);
  if (!imp.files.length) return null;
  return (
    <ul className="wp-stagger grid grid-cols-1 gap-3 md:grid-cols-2">
      {imp.files.map((f) => {
        const Icon = kindIcon(f.name);
        const working = f.pct < 100;
        return (
          <li key={f.id} className="keel-card overflow-hidden p-4">
            <div className="flex items-start gap-3">
              {f.result?.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                <img src={f.result.previewUrl} alt={`Preview of ${f.name}`} className="h-14 w-14 shrink-0 rounded-xl border border-slate-200 object-cover" />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
                  <Icon className="h-6 w-6" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-[#0F172A]" title={f.name}>
                  {f.name}
                </p>
                <p className={`mt-0.5 text-[11px] font-semibold ${f.error ? 'text-rose-700' : 'text-slate-500'}`}>{f.error ?? f.stage}</p>
                {working && !f.error && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={f.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Reading ${f.name}`}>
                    <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-[width] duration-300" style={{ width: `${Math.max(4, f.pct)}%` }} />
                  </div>
                )}
                {f.result && (
                  <p className="mt-1 text-[10px] font-medium text-slate-400" title={f.result.method}>
                    {f.result.method}
                  </p>
                )}
                {f.result?.errors.map((e) => (
                  <p key={e} className="mt-1 flex items-start gap-1 text-[11px] font-semibold text-amber-800">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {e}
                  </p>
                ))}
                {f.result?.text && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      disabled={f.aiState === 'working'}
                      onClick={() => (imp.canUseAiReading ? imp.readWithAi(f.id) : onAskConsent())}
                      className="btn-anim inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-sky-500 to-indigo-600 px-3 py-1 text-[11px] font-bold text-white shadow-sm disabled:opacity-60 cursor-pointer"
                      title="Send the text read on this device (with card, account and phone numbers removed) to Groq to structure it"
                    >
                      {f.aiState === 'working' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      {f.aiState === 'done' ? 'Read again with AI' : 'Improve with AI'}
                    </button>
                    <button type="button" onClick={() => setShowText(showText === f.id ? null : f.id)} className="btn-anim inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 cursor-pointer">
                      Text read <ChevronDown className={`h-3 w-3 transition-transform ${showText === f.id ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                )}
                {f.aiNote && <p className="wp-pop mt-1.5 text-[11px] font-semibold text-indigo-700">{f.aiNote}</p>}
              </div>
            </div>
            {showText === f.id && f.result?.text && (
              <pre className="wp-pop mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 text-[10px] leading-relaxed text-slate-700">{f.result.text}</pre>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Amount cell: edit the absolute value as text; the In/Out toggle sets the sign. */
function AmountCell({ row, onChange }: { row: ExtractedRow; onChange: (cents: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (row.amountCents ? fromMinor(Math.abs(row.amountCents), row.currency) : '');
  return (
    <input
      inputMode="decimal"
      aria-label={`Amount for ${row.merchant || 'row'}`}
      value={shown}
      placeholder={minorUnits(row.currency) ? '0.00' : '0'}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null) {
          const v = Math.abs(toMinor(draft, row.currency));
          onChange(row.amountCents < 0 || row.amountCents === 0 ? -v : v);
        }
        setDraft(null);
      }}
      className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right font-money text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-500/30"
    />
  );
}

/** The editable grid + account picker + save. */
export function ImportReview({ imp, onAskConsent, onSaved }: { imp: DocumentImport; onAskConsent: () => void; onSaved?: (inserted: number) => void }) {
  const { accounts, transactions } = useFinance();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState('');
  const categories = useMemo(() => [...new Set(transactions.map((t) => t.category))].sort(), [transactions]);
  const account = accounts.find((a) => a.id === imp.accountId);

  const toggle = (key: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(key)) n.delete(key);
    else n.add(key);
    return n;
  });
  const allSelected = imp.rows.length > 0 && selected.size === imp.rows.length;

  return (
    <div className="space-y-5">
      <FileCards imp={imp} onAskConsent={onAskConsent} />

      {imp.saved && (
        <div role="status" className="wp-pop flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="flex items-center gap-2 text-xs font-bold text-emerald-800">
            <CheckCircle2 className="h-4 w-4" />
            Saved {imp.saved.inserted} transaction{imp.saved.inserted === 1 ? '' : 's'} to {imp.saved.accountName}
            {imp.saved.duplicates ? ` · ${imp.saved.duplicates} duplicate${imp.saved.duplicates === 1 ? '' : 's'} skipped` : ''}
            {imp.saved.rejected ? ` · ${imp.saved.rejected} rejected` : ''}
          </p>
          <button type="button" onClick={() => imp.undo()} className="btn-anim inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-white px-3 py-1.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 cursor-pointer">
            <Undo2 className="h-3.5 w-3.5" /> Undo import
          </button>
        </div>
      )}

      {imp.error && (
        <p role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
          <AlertTriangle className="h-4 w-4" /> {imp.error}
          <button type="button" aria-label="Dismiss" onClick={() => imp.setError(null)} className="ml-auto cursor-pointer">
            <X className="h-3.5 w-3.5" />
          </button>
        </p>
      )}

      {imp.rows.length > 0 && (
        <section className="keel-card wp-enter overflow-hidden" aria-label="Review before saving">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 sm:p-5">
            <div>
              <h3 className="text-sm font-extrabold text-[#0F172A]">Check and edit before saving</h3>
              <p className="text-[11px] font-medium text-slate-500">Nothing is saved until you press Save. Rows marked in amber or red need a look.</p>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              Into
              <select
                value={imp.accountId}
                onChange={(e) => imp.setAccountId(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500/30"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.currency})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selected.size > 0 && (
            <div className="wp-pop flex flex-wrap items-center gap-2 border-b border-slate-100 bg-sky-50/70 px-4 py-2.5 text-xs">
              <span className="font-bold text-sky-900">{selected.size} selected</span>
              <input
                list="wp-import-cats"
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value)}
                placeholder="Category"
                aria-label="Category for selected rows"
                className="w-36 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
              />
              <button
                type="button"
                disabled={!bulkCategory.trim()}
                onClick={() => {
                  for (const k of selected) imp.updateRow(k, { category: bulkCategory.trim() });
                  setBulkCategory('');
                }}
                className="btn-anim rounded-full bg-[#0F172A] px-3 py-1.5 font-bold text-white disabled:opacity-50 cursor-pointer"
              >
                Set category
              </button>
              <button
                type="button"
                onClick={() => {
                  for (const r of imp.rows.filter((x) => selected.has(x.key))) imp.updateRow(r.key, { amountCents: -r.amountCents });
                }}
                className="btn-anim rounded-full border border-slate-300 bg-white px-3 py-1.5 font-bold text-slate-700 cursor-pointer"
              >
                Flip in/out
              </button>
              <button
                type="button"
                onClick={() => {
                  imp.removeRows([...selected]);
                  setSelected(new Set());
                }}
                className="btn-anim inline-flex items-center gap-1 rounded-full border border-rose-200 bg-white px-3 py-1.5 font-bold text-rose-700 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            </div>
          )}

          <datalist id="wp-import-cats">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>

          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50/95 text-[10px] font-bold uppercase tracking-wider text-slate-500 backdrop-blur">
                <tr>
                  <th className="px-3 py-2.5">
                    <input type="checkbox" aria-label="Select all rows" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(imp.rows.map((r) => r.key)))} />
                  </th>
                  <th className="px-2 py-2.5">Date</th>
                  <th className="px-2 py-2.5">Description</th>
                  <th className="px-2 py-2.5">In / out</th>
                  <th className="px-2 py-2.5 text-right">Amount</th>
                  <th className="px-2 py-2.5">Currency</th>
                  <th className="px-2 py-2.5">Category</th>
                  <th className="px-2 py-2.5">Check</th>
                  <th className="px-2 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {imp.rows.map((r) => {
                  const missing = imp.problems(r);
                  return (
                    <tr key={r.key} className={`wp-row-in transition-colors ${selected.has(r.key) ? 'bg-sky-50/60' : 'hover:bg-slate-50/70'}`}>
                      <td className="px-3 py-2">
                        <input type="checkbox" aria-label={`Select ${r.merchant || 'row'}`} checked={selected.has(r.key)} onChange={() => toggle(r.key)} />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="date"
                          aria-label="Date"
                          value={r.financialDate}
                          onChange={(e) => imp.updateRow(r.key, { financialDate: e.target.value })}
                          className={`rounded-lg border px-2 py-1.5 text-xs ${missing.includes('date') ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white'}`}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          aria-label="Description"
                          value={r.merchant}
                          maxLength={120}
                          onChange={(e) => imp.updateRow(r.key, { merchant: e.target.value })}
                          className={`w-44 rounded-lg border px-2 py-1.5 text-xs font-semibold ${missing.includes('description') ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white'}`}
                        />
                        {r.notes && <p className="mt-0.5 max-w-[11rem] truncate text-[10px] text-slate-400" title={r.notes}>{r.notes}</p>}
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => imp.updateRow(r.key, { amountCents: -r.amountCents || -1 })}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold cursor-pointer ${r.amountCents > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}
                          aria-label={r.amountCents > 0 ? 'Money in (click to change)' : 'Money out (click to change)'}
                        >
                          {r.amountCents > 0 ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                          {r.amountCents > 0 ? 'In' : 'Out'}
                        </button>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <AmountCell row={r} onChange={(cents) => imp.updateRow(r.key, { amountCents: cents })} />
                      </td>
                      <td className="px-2 py-2">
                        <select
                          aria-label="Row currency"
                          value={r.currency}
                          onChange={(e) => imp.updateRow(r.key, { currency: e.target.value })}
                          className="rounded-lg border border-slate-200 bg-white px-1.5 py-1.5 font-mono text-xs"
                        >
                          {CURRENCY_CODES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          list="wp-import-cats"
                          aria-label="Category"
                          value={r.category}
                          maxLength={60}
                          onChange={(e) => imp.updateRow(r.key, { category: e.target.value })}
                          className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${missing.length ? CONF_STYLE.low : CONF_STYLE[r.confidence]}`} title={[...r.warnings, ...missing.map((m) => `Missing ${m}`)].join(' · ') || 'Looks good'}>
                          {missing.length ? `Add ${missing.join(', ')}` : r.warnings[0] ?? 'Looks good'}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <button type="button" aria-label="Remove row" onClick={() => imp.removeRows([r.key])} className="rounded-full p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={imp.addRow} className="btn-anim inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 cursor-pointer">
                <Plus className="h-3.5 w-3.5" /> Add a row
              </button>
              {account && (
                <span className="text-[11px] font-semibold text-slate-600">
                  <span className="text-emerald-700">+{formatMoney(imp.totals.in, account.currency)}</span> · <span className="text-rose-700">−{formatMoney(imp.totals.out, account.currency)}</span>
                  {imp.rows.some((r) => r.currency !== account.currency) && ' · other currencies converted at today’s rate'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={imp.reset} className="btn-anim rounded-full px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer">
                Discard
              </button>
              <button
                type="button"
                disabled={!imp.readyCount || imp.saving || !account}
                onClick={async () => {
                  const res = await imp.save();
                  if (res) onSaved?.(res.inserted);
                }}
                className="btn-primary-anim btn-shimmer inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold text-white shadow-md disabled:opacity-50 cursor-pointer"
              >
                {imp.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 text-emerald-300" />}
                Save {imp.readyCount} transaction{imp.readyCount === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

/** Separate opt-in for AI document reading (Groq only). */
export function DocumentReadingConsent({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { preferences, setPreferences } = useFinance();
  if (!open) return null;
  const signedIn = !!preferences.isAuthenticated;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="doc-consent-title" className="keel-card wp-pop w-full max-w-md bg-white p-6 shadow-2xl">
        <h2 id="doc-consent-title" className="flex items-center gap-2 text-sm font-bold text-[#0F172A]">
          <Sparkles className="h-4 w-4 text-sky-600" /> Let AI read documents?
        </h2>
        {signedIn ? (
          <div className="mt-3 space-y-2.5 text-xs leading-relaxed text-slate-700">
            <p>
              Your device already read the file. With this on, WealthPilot sends <strong>that text</strong> (store names, dates, amounts and item
              names as printed) to <strong>Groq</strong> in the United States, which turns it into rows for you to check.
            </p>
            <p>
              <strong>Removed first:</strong> card numbers, long account or reference numbers, emails and phone numbers. <strong>Never sent:</strong> the
              photo or file itself, your other transactions, your name or email. Gemini is never used for documents.
            </p>
            <p>Every amount the AI returns must appear in the text, or it is dropped. You still review and edit everything before saving.</p>
            <p className="text-[10px] font-mono text-slate-500">Document reading · separate opt-in · turn off in Settings → AI</p>
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-700">Sign in to use AI document reading. In demo mode, files are read on your device only.</p>
        )}
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 cursor-pointer">
            Not now
          </button>
          {signedIn && (
            <button
              type="button"
              autoFocus
              onClick={() => {
                const providers = new Set(preferences.isAiEnabled && preferences.aiProviders?.length ? preferences.aiProviders : ['groq']);
                providers.add('groq');
                providers.add('documents');
                setPreferences({ isAiEnabled: true, aiProviders: [...providers] });
                onClose();
              }}
              className="flex-1 rounded-xl bg-[#0F172A] py-2.5 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer"
            >
              Allow document reading
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
