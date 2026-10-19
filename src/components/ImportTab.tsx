'use client';

import React, { useState } from 'react';
import { ShieldCheck, Sparkles, Download, ScanLine, FileSpreadsheet, FileText } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { PageInsights } from './PageInsights';
import { useDocumentImport } from './import/useDocumentImport';
import { DocumentDropzone, ImportReview, DocumentReadingConsent } from './import/ImportReview';

/**
 * Import page: drop photos of receipts, PDF statements, CSV or Excel exports. Files are read on this
 * device; the rows are shown for review and editing; nothing is saved until "Save".
 */
export function ImportTab() {
  const { accounts, preferences } = useFinance();
  const imp = useDocumentImport();
  const [consentOpen, setConsentOpen] = useState(false);

  const downloadTemplate = () => {
    const csv = 'Date,Description,Amount,Category,Notes\n';
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wealthpilot-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 pb-24 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0F172A] tracking-tight">Import & scan</h1>
          <p className="text-xs text-slate-500 font-medium mt-1 max-w-2xl">
            Add many transactions at once from a receipt photo, a bank statement PDF, or a CSV/Excel export. You check and edit every row before it is saved, and you can undo an import.
          </p>
        </div>
        <button onClick={downloadTemplate} className="btn-glass-anim inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold text-slate-800 cursor-pointer shadow-xs self-start sm:self-auto">
          <Download className="w-4 h-4 text-sky-600" /> CSV template
        </button>
      </div>

      <PageInsights segment="import" />

      {accounts.length === 0 ? (
        <p className="keel-card p-6 text-sm font-semibold text-slate-700">Create an account first (Accounts tab); imports are saved into an account.</p>
      ) : (
        <>
          <DocumentDropzone imp={imp} />
          <ImportReview imp={imp} onAskConsent={() => setConsentOpen(true)} />
        </>
      )}

      <section className="wp-stagger grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="keel-card p-5">
          <ScanLine className="w-5 h-5 text-sky-600" />
          <h3 className="mt-2 text-sm font-bold text-[#0F172A]">Receipts & screenshots</h3>
          <p className="mt-1 text-xs text-slate-600 leading-relaxed">Text is read on your device (OCR). WealthPilot finds the store, date and total, and lists the items in the note.</p>
        </div>
        <div className="keel-card p-5">
          <FileText className="w-5 h-5 text-indigo-600" />
          <h3 className="mt-2 text-sm font-bold text-[#0F172A]">PDF statements</h3>
          <p className="mt-1 text-xs text-slate-600 leading-relaxed">Each dated line becomes a row; running balances are ignored. Scanned PDFs are read with OCR, page by page.</p>
        </div>
        <div className="keel-card p-5">
          <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
          <h3 className="mt-2 text-sm font-bold text-[#0F172A]">CSV & Excel</h3>
          <p className="mt-1 text-xs text-slate-600 leading-relaxed">Columns are detected from the header (date, description, amount or debit/credit, currency). Day/month order is worked out from the dates.</p>
        </div>
      </section>

      <p className="flex items-start gap-2 text-[11px] text-slate-500 font-medium">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
        Files never leave this device. {preferences.isAuthenticated ? (
          <>
            Optional <Sparkles className="inline w-3 h-3 text-indigo-500" /> <strong>Improve with AI</strong> sends only the text read from a file, with card, account and phone numbers removed, and only after you allow it.
          </>
        ) : (
          'Sign in to save imports to your account.'
        )}{' '}
        Duplicates of transactions you already have are flagged before saving and skipped by the server.
      </p>

      <DocumentReadingConsent open={consentOpen} onClose={() => setConsentOpen(false)} />
    </div>
  );
}
