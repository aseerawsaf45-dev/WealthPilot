'use client';

import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { parseCsvRaw, processCsvData, CsvPreview, ColumnMapping } from '../services/importService';
import { formatMoney } from '../lib/money';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

export function ImportTab() {
  const { accounts, transactions, commitImportedTransactions, rollbackImportBatch } = useFinance();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [rawText, setRawText] = useState('');
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [selectedAccount, setSelectedAccount] = useState(accounts[0]?.id || '');

  // Mapping state
  const [dateCol, setDateCol] = useState(0);
  const [merchantCol, setMerchantCol] = useState(1);
  const [amountCol, setAmountCol] = useState(2);
  const [categoryCol, setCategoryCol] = useState<number | undefined>(3);

  // Validation output
  const [processedResult, setProcessedResult] = useState<{
    validRows: any[];
    invalidRows: any[];
    duplicateCount: number;
  } | null>(null);

  const [lastBatchId, setLastBatchId] = useState<string | null>(null);

  const sampleCsvData = `Date,Description,Amount,Category
2026-10-10,Starbucks Coffee,-5.75,Dining
2026-10-11,Target Store Restock,-84.20,Household
2026-10-12,Freelance Consulting Deposit,1250.00,Income
2026-10-13,Chevron Gas Station,-45.00,Transport`;

  const handleLoadSample = () => {
    setRawText(sampleCsvData);
    const parsed = parseCsvRaw(sampleCsvData);
    setPreview(parsed);
    setStep(2);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setRawText(text);
      const parsed = parseCsvRaw(text);
      setPreview(parsed);
      setStep(2);
    };
    reader.readAsText(file);
  };

  const handleProcessValidation = () => {
    if (!preview) return;

    const mapping: ColumnMapping = {
      dateCol,
      merchantCol,
      amountCol,
      categoryCol,
    };

    const res = processCsvData(rawText, mapping, transactions, selectedAccount, 'user_pilot');
    setProcessedResult(res);
    setStep(3);
  };

  const handleCommit = () => {
    if (!processedResult) return;

    const toCommit = processedResult.validRows.map((r) => ({
      accountId: selectedAccount,
      financialDate: r.financialDate,
      merchant: r.merchant,
      normalizedMerchant: r.merchant,
      category: r.category || 'General',
      amountCents: r.amountCents,
      currency: 'USD',
      status: 'cleared' as const,
      notes: r.notes || 'Imported via CSV',
      tags: ['csv_import'],
      isTransfer: false,
      source: 'csv_import' as const,
    }));

    commitImportedTransactions(toCommit);
    setLastBatchId(`tx_import_${Date.now()}`);
    setStep(4);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#0F172A] tracking-tight">Statement & CSV Import Wizard</h1>
        <p className="text-xs text-slate-600 font-medium mt-1">
          Preview columns, validate amounts, detect duplicate charges, and commit safely with one-click rollback.
        </p>
      </div>

      {/* Stepper Progress */}
      <div className="grid grid-cols-4 gap-2 text-xs font-semibold">
        {[
          { num: 1, label: 'Upload File' },
          { num: 2, label: 'Map Columns' },
          { num: 3, label: 'Validate & Review' },
          { num: 4, label: 'Complete' },
        ].map((s) => (
          <div
            key={s.num}
            className={`p-3 rounded-2xl border text-center transition-colors ${
              step === s.num
                ? 'bg-sky-50 text-sky-800 border-sky-200 shadow-2xs'
                : step > s.num
                ? 'bg-white text-[#0F172A] border-slate-200'
                : 'bg-slate-100/60 text-slate-400 border-transparent'
            }`}
          >
            <span className="font-mono text-sky-700">{s.num}.</span> {s.label}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="keel-card p-10 text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center mx-auto shadow-2xs">
            <Upload className="w-8 h-8" />
          </div>

          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-bold text-[#0F172A]">Upload Bank Statement CSV</h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed font-medium">
              Supports Chase, Bank of America, Wells Fargo, Amex, Apple Card, or custom CSV ledger exports.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
            <label className="px-6 py-2.5 rounded-full bg-[#0F172A] hover:bg-neutral-800 text-white font-semibold text-xs cursor-pointer shadow-md transition-colors">
              <span>Select Local CSV File</span>
              <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} className="hidden" />
            </label>

            <button
              onClick={handleLoadSample}
              className="px-5 py-2.5 rounded-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold cursor-pointer shadow-xs transition-colors"
            >
              Load Sample Test CSV
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Column Mapping */}
      {step === 2 && preview && (
        <div className="keel-card p-6 space-y-5 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/[0.06]">
            <div>
              <h3 className="text-base font-bold text-[#0F172A]">Configure Column Mapping</h3>
              <p className="text-slate-500 font-medium mt-0.5">
                Detected {preview.headers.length} columns across {preview.rowCount} rows using delimiter &apos;{preview.delimiter}&apos;.
              </p>
            </div>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-semibold"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  Target: {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Field Map Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Date Column</label>
              <select
                value={dateCol}
                onChange={(e) => setDateCol(parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                {preview.headers.map((h, i) => (
                  <option key={i} value={i}>{h} (Col {i + 1})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Merchant / Description</label>
              <select
                value={merchantCol}
                onChange={(e) => setMerchantCol(parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                {preview.headers.map((h, i) => (
                  <option key={i} value={i}>{h} (Col {i + 1})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Amount Column</label>
              <select
                value={amountCol}
                onChange={(e) => setAmountCol(parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                {preview.headers.map((h, i) => (
                  <option key={i} value={i}>{h} (Col {i + 1})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Category Column (Optional)</label>
              <select
                value={categoryCol ?? ''}
                onChange={(e) => setCategoryCol(e.target.value !== '' ? parseInt(e.target.value) : undefined)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="">Auto-Categorize</option>
                {preview.headers.map((h, i) => (
                  <option key={i} value={i}>{h} (Col {i + 1})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Preview Raw Table */}
          <div className="pt-2">
            <p className="text-slate-600 mb-2 font-semibold">First few sample rows:</p>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-100 text-slate-700 font-bold">
                  <tr>
                    {preview.headers.map((h, i) => (
                      <th key={i} className="p-2.5 border-b border-slate-200">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, rIdx) => (
                    <tr key={rIdx} className="border-b border-slate-100">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="p-2.5 text-[#0F172A] font-medium">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-4 flex justify-between border-t border-black/[0.06]">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 rounded-full text-slate-600 hover:text-black font-semibold cursor-pointer"
            >
              Back
            </button>
            <button
              onClick={handleProcessValidation}
              className="px-5 py-2.5 rounded-full bg-[#0F172A] hover:bg-neutral-800 text-white font-semibold flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <span>Run Validation</span>
              <ArrowRight className="w-3.5 h-3.5 text-sky-400" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Validation & Duplicate Review */}
      {step === 3 && processedResult && (
        <div className="keel-card p-6 space-y-5 text-xs">
          <h3 className="text-base font-bold text-[#0F172A]">Validation & Audit Results</h3>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
              <p className="text-2xl font-bold font-money text-emerald-800">{processedResult.validRows.length}</p>
              <p className="text-emerald-900 text-[11px] font-bold mt-0.5">Valid Entries</p>
            </div>
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-center">
              <p className="text-2xl font-bold font-money text-amber-800">{processedResult.duplicateCount}</p>
              <p className="text-amber-900 text-[11px] font-bold mt-0.5">Duplicate Matches</p>
            </div>
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-center">
              <p className="text-2xl font-bold font-money text-rose-800">{processedResult.invalidRows.length}</p>
              <p className="text-rose-900 text-[11px] font-bold mt-0.5">Invalid Rows</p>
            </div>
          </div>

          {/* Valid items preview */}
          <div>
            <p className="text-slate-600 mb-2 font-semibold">Ready to append to ledger:</p>
            <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-xl border border-slate-200 p-2 bg-slate-50">
              {processedResult.validRows.map((r, i) => (
                <div key={i} className="flex justify-between items-center text-[11px] p-2 rounded-lg bg-white border border-slate-200 shadow-2xs">
                  <span className="text-slate-500 font-mono font-medium">{r.financialDate}</span>
                  <span className="text-[#0F172A] font-bold">{r.merchant}</span>
                  <span className="text-slate-600 font-medium">{r.category}</span>
                  <span
                    className={`font-money font-bold ${
                      r.amountCents >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {r.amountCents >= 0 ? `+${formatMoney(r.amountCents)}` : `-${formatMoney(Math.abs(r.amountCents))}`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 flex justify-between border-t border-black/[0.06]">
            <button onClick={() => setStep(2)} className="px-4 py-2 rounded-full text-slate-600 hover:text-black font-semibold cursor-pointer">
              Back to Mapping
            </button>
            <button
              onClick={handleCommit}
              className="px-5 py-2.5 rounded-full bg-[#0F172A] hover:bg-neutral-800 text-white font-semibold flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <span>Commit {processedResult.validRows.length} Transactions</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Complete & Rollback */}
      {step === 4 && (
        <div className="keel-card p-10 text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center mx-auto shadow-2xs">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-[#0F172A]">Import Successfully Committed</h3>
            <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">
              Your transactions have been added to the primary ledger and balances updated automatically.
            </p>
          </div>

          <div className="pt-3 flex items-center justify-center gap-3">
            <button
              onClick={() => setStep(1)}
              className="px-5 py-2.5 rounded-full bg-[#0F172A] hover:bg-neutral-800 text-white font-semibold text-xs shadow-md transition-colors cursor-pointer"
            >
              Import Another Statement
            </button>
            {lastBatchId && (
              <button
                onClick={() => {
                  rollbackImportBatch(lastBatchId);
                  alert('Import batch has been safely rolled back.');
                  setStep(1);
                }}
                className="px-5 py-2.5 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Rollback This Import Batch</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
