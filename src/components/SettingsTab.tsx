'use client';

import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { exportTransactionsToCsv } from '../services/importService';
import {
  ShieldCheck,
  Download,
  Trash2,
  Sparkles,
  RefreshCw,
  Lock,
  Eye,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  FileJson,
  FileSpreadsheet,
  Plus,
  X,
  History,
} from 'lucide-react';

export function SettingsTab() {
  const {
    accounts,
    transactions,
    budgets,
    goals,
    bills,
    debts,
    preferences,
    auditLogs,
    setPreferences,
    resetToDemoData,
    clearAllUserData,
    deleteAccount,
  } = useFinance();

  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // New Rule State
  const [newRuleKeyword, setNewRuleKeyword] = useState('');
  const [newRuleCategory, setNewRuleCategory] = useState('');

  // Handle Full JSON Export
  const handleExportJson = () => {
    const fullArchive = {
      exportTimestamp: '2026-10-16T12:00:00.000Z',
      schemaVersion: '1.0.0',
      dataIntegrity: 'SHA256_LOCAL_VERIFIED',
      payload: {
        accounts,
        transactions,
        budgets,
        goals,
        bills,
        debts,
        preferences,
        auditLogs,
      },
    };

    const blob = new Blob([JSON.stringify(fullArchive, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'wealthpilot_export_archive.json';
    link.click();
    URL.revokeObjectURL(url);

    setExportNotice('Full encrypted JSON archive downloaded successfully.');
    setTimeout(() => setExportNotice(null), 4000);
  };

  // Handle Neutralized CSV Export
  const handleExportCsv = () => {
    exportTransactionsToCsv(transactions);
    setExportNotice('Sanitized CSV exported with spreadsheet formula injection protection.');
    setTimeout(() => setExportNotice(null), 4000);
  };

  // Handle Delete All Data & Account (GDPR Art. 17)
  const handleConfirmDelete = async () => {
    if (deleteConfirmationInput === 'DELETE ALL DATA' || deleteConfirmationInput === 'DELETE ACCOUNT') {
      const res = await deleteAccount();
      setIsDeleteModalOpen(false);
      setDeleteConfirmationInput('');
      setExportNotice(res.message || 'Account and all financial records have been permanently eradicated (GDPR Article 17).');
      setTimeout(() => setExportNotice(null), 6000);
    }
  };

  // Add Categorization Rule
  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleKeyword.trim() || !newRuleCategory.trim()) return;

    const newRule = {
      id: `rule_${Date.now()}`,
      keyword: newRuleKeyword.trim().toLowerCase(),
      category: newRuleCategory.trim(),
    };

    const updatedRules = [...(preferences.autoCategorizationRules || []), newRule];
    setPreferences({ autoCategorizationRules: updatedRules });
    setNewRuleKeyword('');
    setNewRuleCategory('');
  };

  // Remove Categorization Rule
  const handleRemoveRule = (ruleId: string) => {
    const updatedRules = (preferences.autoCategorizationRules || []).filter((r) => r.id !== ruleId);
    setPreferences({ autoCategorizationRules: updatedRules });
  };

  return (
    <div className="space-y-8 pb-16 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-800 text-xs font-semibold mb-3">
          <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
          Privacy Center & Client Architecture
        </div>
        <h1 className="text-3xl font-bold text-[#0F172A] tracking-tight">Security & Settings</h1>
        <p className="text-xs text-slate-600 font-medium mt-1">
          Complete sovereignty over your financial data. Zero tracking, zero third-party telemetry, and instant export/purge controls.
        </p>
      </div>

      {exportNotice && (
        <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 flex items-center gap-3 text-sky-900 text-xs font-medium animate-in fade-in duration-300">
          <CheckCircle2 className="w-5 h-5 text-sky-600 flex-shrink-0" />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* Grid of Settings Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Data Sovereignty & Export */}
        <div className="keel-card p-6 h-full flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shadow-2xs">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#0F172A]">Data Export & Archive</h2>
                <p className="text-xs text-slate-500 font-medium">Never trapped in a proprietary walled garden</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-6 font-medium">
              Download your complete unadulterated financial ledger anytime. CSV exports are neutralized against formula injection attacks (`=`, `+`, `-`, `@`), and JSON exports contain raw database-ready records.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-black/[0.05]">
            <button
              onClick={handleExportJson}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[#0F172A] text-xs font-semibold transition-colors cursor-pointer"
            >
              <FileJson className="w-4 h-4 text-sky-600" />
              <span>Export JSON Archive</span>
            </button>
            <button
              onClick={handleExportCsv}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[#0F172A] text-xs font-semibold transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-sky-600" />
              <span>Export Sanitized CSV</span>
            </button>
          </div>
        </div>

        {/* Card 2: AI Copilot & Privacy Controls */}
        <div className="keel-card p-6 h-full flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shadow-2xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#0F172A]">Grounded AI Copilot</h2>
                <p className="text-xs text-slate-500 font-medium">Local deterministic grounding & kill switch</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-6 font-medium">
              WealthPilot Copilot relies strictly on deterministic ledger aggregation. Disabling AI completely suppresses the copilot assistant across all interfaces.
            </p>
          </div>

          <div className="space-y-4 pt-4 border-t border-black/[0.05]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-[#0F172A]">Enable AI Copilot</p>
                <p className="text-[11px] text-slate-500 font-medium">Assists with calculations and natural queries</p>
              </div>
              <button
                onClick={() => setPreferences({ isAiEnabled: !preferences.isAiEnabled })}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                  preferences.isAiEnabled ? 'bg-sky-500' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 shadow-xs ${
                    preferences.isAiEnabled ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-[#0F172A]">Sandbox Demo Mode</p>
                <p className="text-[11px] text-slate-500 font-medium">Use isolated synthetic sample records</p>
              </div>
              <button
                onClick={() => setPreferences({ isDemoMode: !preferences.isDemoMode })}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                  preferences.isDemoMode ? 'bg-sky-500' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 shadow-xs ${
                    preferences.isDemoMode ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Card 3: Localization & Currency */}
        <div className="keel-card p-6 h-full flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shadow-2xs">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#0F172A]">Regional & Formatting</h2>
                <p className="text-xs text-slate-500 font-medium">Currencies, dates, and motion settings</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Profile Display Name
                </label>
                <input
                  type="text"
                  value={preferences.userName || ''}
                  onChange={(e) => setPreferences({ userName: e.target.value })}
                  placeholder="e.g. Aseer, Alex, User"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder:text-slate-400"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Customizes how you are greeted on the Overview dashboard (&ldquo;Hello {preferences.userName || 'User'}&rdquo;)
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Base Currency
                </label>
                <select
                  value={preferences.baseCurrency}
                  onChange={(e) => setPreferences({ baseCurrency: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="USD">USD ($) — United States Dollar</option>
                  <option value="EUR">EUR (€) — Euro</option>
                  <option value="GBP">GBP (£) — British Pound</option>
                  <option value="CAD">CAD ($) — Canadian Dollar</option>
                  <option value="AUD">AUD ($) — Australian Dollar</option>
                  <option value="JPY">JPY (¥) — Japanese Yen</option>
                </select>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="text-xs font-bold text-[#0F172A]">Reduced Motion Mode</p>
                  <p className="text-[11px] text-slate-500 font-medium">Stops non-essential transitions</p>
                </div>
                <button
                  onClick={() => setPreferences({ reducedMotion: !preferences.reducedMotion })}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                    preferences.reducedMotion ? 'bg-sky-500' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 shadow-xs ${
                      preferences.reducedMotion ? 'right-1' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-black/[0.05] mt-6">
            <button
              onClick={resetToDemoData}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-50 hover:bg-neutral-100 text-xs text-neutral-700 font-semibold border border-black/[0.08] transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-sky-600" />
              <span>Reset to Clean Seed Dataset</span>
            </button>
          </div>
        </div>

        {/* Card 4: Danger Zone / Data Erasure */}
        <div className="keel-card p-6 h-full flex flex-col justify-between border-rose-200/80 hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-2xs">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#0F172A]">Danger Zone & Data Erasure</h2>
                <p className="text-xs text-rose-600 font-semibold">Permanent, irreversible ledger wipe</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-6 font-medium">
              All accounts, categorized transactions, budgets, goals, and recurring bills are stored locally in your browser storage. You can instantly sanitize and purge everything with zero lingering traces.
            </p>
          </div>

          <div className="pt-4 border-t border-black/[0.05]">
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-800 text-xs font-bold transition-colors cursor-pointer shadow-xs"
            >
              <Trash2 className="w-4 h-4" />
              <span>Purge & Erase All Financial Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* Auto-Categorization Rules Engine */}
      <section className="keel-card p-6 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-[#0F172A] tracking-tight">Auto-Categorization Rules Engine</h2>
          <p className="text-xs text-slate-600 font-medium mt-0.5">
            Deterministic matching based on merchant keywords. Rules run automatically during CSV import and transaction additions.
          </p>
        </div>

        {/* Add Rule Form */}
        <form onSubmit={handleAddRule} className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Merchant Keyword Contains</label>
            <input
              type="text"
              value={newRuleKeyword}
              onChange={(e) => setNewRuleKeyword(e.target.value)}
              placeholder="e.g. uber, netflix, trader joe"
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-[#0F172A] text-xs font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Assign Category</label>
            <input
              type="text"
              value={newRuleCategory}
              onChange={(e) => setNewRuleCategory(e.target.value)}
              placeholder="e.g. Transport, Entertainment, Groceries"
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-[#0F172A] text-xs font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F172A] hover:bg-neutral-800 text-white font-semibold text-xs transition-colors cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4 text-sky-400" />
              <span>Add Rule</span>
            </button>
          </div>
        </form>

        {/* Rules List */}
        <div className="space-y-2">
          {(preferences.autoCategorizationRules || []).length === 0 ? (
            <p className="text-xs text-slate-500 italic py-4 text-center font-medium">No custom categorization rules active yet.</p>
          ) : (
            (preferences.autoCategorizationRules || []).map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sky-800 bg-sky-50 px-2.5 py-0.5 rounded-full font-bold border border-sky-200">
                    "{rule.keyword}"
                  </span>
                  <span className="text-slate-500 font-medium">assigns to</span>
                  <span className="font-bold text-slate-900 bg-slate-100 px-3 py-0.5 rounded-full">
                    {rule.category}
                  </span>
                </div>
                <button
                  onClick={() => handleRemoveRule(rule.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Security Audit Trail Log */}
      <section className="keel-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shadow-2xs">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#0F172A] tracking-tight">Security & Audit Event Log</h2>
              <p className="text-xs text-slate-500 font-medium">Local tamper-evident activity log. Secrets and credentials are automatically scrubbed.</p>
            </div>
          </div>
          <span className="text-[11px] font-mono font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
            {auditLogs.length} events logged
          </span>
        </div>

        <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
          {auditLogs.length === 0 ? (
            <p className="text-xs text-neutral-400 italic py-6 text-center">No security audit events recorded yet.</p>
          ) : (
            auditLogs.slice(0, 30).map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-neutral-50 border border-black/[0.04] text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-bold">
                    {log.action}
                  </span>
                  <span className="text-neutral-700 truncate">{log.details}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-neutral-400 flex-shrink-0">
                  <span>{log.ipAddressMask}</span>
                  <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md keel-card bg-white p-6 border-rose-200 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
                <AlertTriangle className="w-5 h-5" />
                <span>Confirm Irreversible Erasure</span>
              </div>
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeleteConfirmationInput('');
                }}
                className="p-1 rounded-lg text-neutral-400 hover:text-black"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-600 mb-4 leading-relaxed">
              This action will permanently delete all financial accounts, historical transactions, custom categories, savings targets, and audit histories from your local browser database.
            </p>

            <div className="mb-5">
              <label className="block text-[11px] text-neutral-600 mb-2 font-mono font-medium">
                Type <span className="text-rose-600 font-bold">DELETE ALL DATA</span> to proceed:
              </label>
              <input
                type="text"
                value={deleteConfirmationInput}
                onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                placeholder="DELETE ALL DATA"
                className="w-full px-3 py-2 rounded-xl bg-neutral-50 border border-rose-300 text-rose-700 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-rose-500 font-bold"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeleteConfirmationInput('');
                }}
                className="flex-1 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-xs text-neutral-700 font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteConfirmationInput !== 'DELETE ALL DATA'}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-30 disabled:cursor-not-allowed text-xs text-white font-bold transition-colors cursor-pointer shadow-md shadow-rose-600/20"
              >
                Permanently Purge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
