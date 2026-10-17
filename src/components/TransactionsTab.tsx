'use client';

import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Transaction, TransactionSplit } from '../types/finance';
import { formatMoney, dollarsToCents, centsToDollars, validateSplitPreservation } from '../lib/money';
import { exportTransactionsToCsv } from '../services/importService';
import { CashFlowRhythmChart } from './InteractiveCharts';
import {
  Search,
  Filter,
  Plus,
  Download,
  Split,
  ArrowRightLeft,
  Trash2,
  CheckCircle2,
  Clock,
  Tag,
  AlertTriangle,
  X,
  Pencil,
} from 'lucide-react';

export function TransactionsTab() {
  const {
    transactions,
    accounts,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  } = useFinance();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedAccount, setSelectedAccount] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [splitModalTx, setSplitModalTx] = useState<Transaction | null>(null);

  // New Transaction Form State
  const [formDate, setFormDate] = useState('2026-10-16');
  const [formMerchant, setFormMerchant] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formType, setFormType] = useState<'expense' | 'income'>('expense');
  const [formCategory, setFormCategory] = useState('General');
  const [formAccount, setFormAccount] = useState(accounts[0]?.id || '');
  const [formNotes, setFormNotes] = useState('');

  // Split Editor State
  const [workingSplits, setWorkingSplits] = useState<Array<{ id: string; category: string; amountDollars: string; note: string }>>([]);

  const categories = Array.from(new Set(transactions.map((t) => t.category))).sort();

  // Filter transactions
  const filteredTxs = transactions.filter((t) => {
    const matchesSearch =
      t.merchant.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.notes && t.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
      t.category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === 'ALL' || t.category === selectedCategory;
    const matchesAccount = selectedAccount === 'ALL' || t.accountId === selectedAccount;

    const matchesDate = !selectedDate || t.financialDate === selectedDate;
    return matchesSearch && matchesCategory && matchesAccount && matchesDate;
  });

  const totalInflowCents = filteredTxs.filter((t) => t.amountCents > 0).reduce((s, t) => s + t.amountCents, 0);
  const totalOutflowCents = filteredTxs.filter((t) => t.amountCents < 0).reduce((s, t) => s + Math.abs(t.amountCents), 0);
  const netFlowCents = totalInflowCents - totalOutflowCents;

  const openAdd = () => {
    setEditingId(null);
    setFormMerchant('');
    setFormAmount('');
    setFormType('expense');
    setFormCategory('General');
    setFormAccount(accounts[0]?.id || '');
    setFormNotes('');
    setIsAddOpen(true);
  };

  const openEdit = (t: Transaction) => {
    setEditingId(t.id);
    setFormDate(t.financialDate);
    setFormMerchant(t.merchant);
    setFormAmount((Math.abs(t.amountCents) / 100).toFixed(2));
    setFormType(t.amountCents < 0 ? 'expense' : 'income');
    setFormCategory(t.category);
    setFormAccount(t.accountId);
    setFormNotes(t.notes ?? '');
    setIsAddOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMerchant.trim() || !formAmount.trim()) return;

    const baseCents = dollarsToCents(formAmount);
    const amountCents = formType === 'expense' ? -Math.abs(baseCents) : Math.abs(baseCents);

    if (editingId) {
      await updateTransaction(editingId, {
        accountId: formAccount,
        financialDate: formDate,
        merchant: formMerchant.trim(),
        category: formCategory,
        amountCents,
        notes: formNotes.trim(),
      });
      setIsAddOpen(false);
      return;
    }

    addTransaction({
      accountId: formAccount,
      financialDate: formDate,
      merchant: formMerchant.trim(),
      normalizedMerchant: formMerchant.trim(),
      category: formCategory,
      amountCents,
      currency: 'USD',
      status: 'cleared',
      notes: formNotes.trim(),
      tags: [],
      isTransfer: false,
      source: 'manual',
    });

    setIsAddOpen(false);
    setFormMerchant('');
    setFormAmount('');
    setFormNotes('');
  };

  const handleOpenSplitModal = (tx: Transaction) => {
    setSplitModalTx(tx);
    if (tx.splits && tx.splits.length > 0) {
      setWorkingSplits(
        tx.splits.map((s) => ({
          id: s.id,
          category: s.category,
          amountDollars: centsToDollars(Math.abs(s.amountCents)).toFixed(2),
          note: s.note || '',
        }))
      );
    } else {
      // Default to 2 splits dividing 50/50
      const half = Math.abs(tx.amountCents) / 2;
      setWorkingSplits([
        { id: 'sp_1', category: tx.category, amountDollars: (half / 100).toFixed(2), note: 'Part 1' },
        { id: 'sp_2', category: 'General', amountDollars: ((Math.abs(tx.amountCents) - half) / 100).toFixed(2), note: 'Part 2' },
      ]);
    }
  };

  const handleSaveSplits = () => {
    if (!splitModalTx) return;

    // Convert working splits to cents
    const isNegative = splitModalTx.amountCents < 0;
    const splitsConverted: TransactionSplit[] = workingSplits.map((s, idx) => {
      const cents = dollarsToCents(s.amountDollars);
      return {
        id: s.id || `sp_${idx}`,
        category: s.category,
        amountCents: isNegative ? -Math.abs(cents) : Math.abs(cents),
        note: s.note,
      };
    });

    const check = validateSplitPreservation(splitModalTx.amountCents, splitsConverted);
    if (!check.isValid) {
      alert(`Split sum does not match transaction total! Discrepancy: ${formatMoney(check.differenceCents)}`);
      return;
    }

    updateTransaction(splitModalTx.id, { splits: splitsConverted });
    setSplitModalTx(null);
  };

  const handleExportCsv = () => {
    const csvContent = exportTransactionsToCsv(filteredTxs);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `wealthpilot_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight">Ledger & Transactions</h1>
          <p className="text-xs text-slate-600 font-medium mt-1">
            {filteredTxs.length} records matching active filters. Exact accounting integer arithmetic applied.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCsv}
            className="btn-glass-anim flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-bold text-slate-800 cursor-pointer shadow-xs"
          >
            <Download className="w-4 h-4 text-sky-600" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={openAdd}
            className="btn-primary-anim btn-shimmer flex items-center gap-2 px-6 py-2.5 rounded-full text-white font-bold text-xs cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4 text-sky-400" />
            <span>Record Transaction</span>
          </button>
        </div>
      </div>

      {/* Quick Profit / Loss Summary Strip (Generous Luxury Padding & Frosted Glass) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="keel-card p-5 sm:p-6 flex items-center justify-between bg-emerald-50/70 border-emerald-300/80 shadow-xs">
          <div>
            <span className="text-xs uppercase font-extrabold text-emerald-800 tracking-wider block mb-1">Total Inflow (Profit)</span>
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-800 font-money">+{formatMoney(totalInflowCents)}</span>
          </div>
          <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500/50 animate-pulse" />
        </div>
        <div className="keel-card p-5 sm:p-6 flex items-center justify-between bg-rose-50/70 border-rose-300/80 shadow-xs">
          <div>
            <span className="text-xs uppercase font-extrabold text-rose-800 tracking-wider block mb-1">Total Outflow (Expense)</span>
            <span className="text-2xl sm:text-3xl font-extrabold text-rose-800 font-money">-{formatMoney(totalOutflowCents)}</span>
          </div>
          <span className="w-3 h-3 rounded-full bg-rose-500 shadow-xs shadow-rose-500/50 animate-pulse" />
        </div>
        <div className={`keel-card p-5 sm:p-6 flex items-center justify-between shadow-xs ${
          netFlowCents >= 0 ? 'bg-emerald-50/70 border-emerald-300/80' : 'bg-rose-50/70 border-rose-300/80'
        }`}>
          <div>
            <span className="text-xs uppercase font-extrabold text-slate-700 tracking-wider block mb-1">Net Ledger Delta</span>
            <span className={`text-2xl sm:text-3xl font-extrabold font-money ${netFlowCents >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
              {netFlowCents >= 0 ? '+' : '-'}{formatMoney(Math.abs(netFlowCents))}
            </span>
          </div>
          <span className={`w-3 h-3 rounded-full ${netFlowCents >= 0 ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-rose-500 shadow-rose-500/50'} shadow-xs animate-pulse`} />
        </div>
      </div>

      {/* Interactive Cash Flow Rhythm Chart */}
      <CashFlowRhythmChart transactions={transactions} selectedDate={selectedDate} onSelectDate={setSelectedDate} />

      {/* Filter Bar */}
      <div className="keel-card p-4 sm:p-5 shadow-xs">
        <div className="flex flex-wrap items-center gap-3.5">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search merchant, notes, or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-[#0F172A] placeholder-slate-400 font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-neutral-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 rounded-xl bg-neutral-50 border border-black/[0.08] text-xs text-neutral-700 font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="px-3 py-2 rounded-xl bg-neutral-50 border border-black/[0.08] text-xs text-neutral-700 font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="ALL">All Accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="keel-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50/80 border-b border-black/[0.06] text-neutral-500 font-semibold">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Merchant / Description</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Account</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="wp-stagger divide-y divide-black/[0.05]">
              {filteredTxs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-400">
                    No records match the active query.
                  </td>
                </tr>
              ) : (
                filteredTxs.map((t) => {
                  const isIncome = t.amountCents > 0;
                  const account = accounts.find((a) => a.id === t.accountId);
                  const hasSplits = t.splits && t.splits.length > 0;

                  return (
                    <tr key={t.id} className="hover:bg-neutral-50 transition-colors group">
                      <td className="py-3 px-4 text-neutral-600 font-mono text-[11px] font-medium whitespace-nowrap">
                        {t.financialDate}
                      </td>
                      <td className="py-3 px-4 font-bold text-[#0F172A]">
                        <div className="flex items-center gap-2">
                          <span>{t.merchant}</span>
                          {t.isTransfer && (
                            <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200 font-mono font-medium">
                              <ArrowRightLeft className="w-2.5 h-2.5" />
                              Transfer
                            </span>
                          )}
                          {hasSplits && (
                            <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200 font-mono font-medium">
                              <Split className="w-2.5 h-2.5" />
                              {t.splits?.length} Splits
                            </span>
                          )}
                        </div>
                        {t.notes && <p className="text-[11px] text-neutral-500 font-normal mt-0.5">{t.notes}</p>}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-800 font-semibold text-[11px]">
                          {t.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-neutral-700 font-medium text-[11px] whitespace-nowrap">
                        {account ? account.name : 'Primary Account'}
                      </td>
                      <td className="py-3 px-4 text-right font-money font-bold text-xs whitespace-nowrap">
                        {isIncome ? (
                          <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-300 font-bold shadow-2xs">
                            +{formatMoney(t.amountCents)}
                          </span>
                        ) : (
                          <span className="text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-300 font-bold shadow-2xs">
                            -{formatMoney(Math.abs(t.amountCents))}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 opacity-80 group-hover:opacity-100">
                          <button
                            onClick={() => openEdit(t)}
                            title="Edit transaction"
                            aria-label={`Edit ${t.merchant}`}
                            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-black transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenSplitModal(t)}
                            title="Split transaction"
                            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-black transition-colors cursor-pointer"
                          >
                            <Split className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Delete "${t.merchant}"? This cannot be undone.`)) deleteTransaction(t.id);
                            }}
                            aria-label={`Delete ${t.merchant}`}
                            title="Delete transaction"
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-neutral-400 hover:text-rose-600 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Transaction Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="max-w-md w-full keel-card bg-white p-6 shadow-2xl animate-in zoom-in-95 border border-black/[0.08]">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] mb-4">
              <h3 className="text-base font-bold text-[#0F172A]">{editingId ? 'Edit Transaction' : 'Record Transaction'}</h3>
              <button onClick={() => setIsAddOpen(false)} className="text-slate-500 hover:text-black">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Financial Date</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Merchant / Description</label>
                <input
                  type="text"
                  placeholder="e.g. Trader Joe's or Acme Payroll"
                  value={formMerchant}
                  onChange={(e) => setFormMerchant(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Amount ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-money font-bold focus:outline-none focus:ring-1 focus:ring-sky-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Type</label>
                  <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setFormType('expense')}
                      className={`py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                        formType === 'expense' ? 'bg-rose-50 text-rose-800 border border-rose-300 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Expense (Loss)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormType('income')}
                      className={`py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                        formType === 'income' ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Income (Profit)
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Groceries"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Account</label>
                  <select
                    value={formAccount}
                    onChange={(e) => setFormAccount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="Add memo or itemized notes..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 rounded-full text-slate-600 hover:text-black font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-[#0F172A] hover:bg-neutral-800 text-white font-semibold shadow-md cursor-pointer"
                >
                  {editingId ? 'Save Changes' : 'Confirm & Post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Split Transaction Modal */}
      {splitModalTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="max-w-lg w-full keel-card bg-white p-6 shadow-2xl animate-in zoom-in-95 border border-black/[0.08] text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] mb-4">
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">Split Transaction</h3>
                <p className="text-[11px] text-slate-600 font-medium">
                  {splitModalTx.merchant} — Total: <span className="text-[#0F172A] font-money font-bold">{formatMoney(splitModalTx.amountCents)}</span>
                </p>
              </div>
              <button onClick={() => setSplitModalTx(null)} className="text-slate-500 hover:text-black">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Splits List */}
            <div className="space-y-3 mb-4">
              {workingSplits.map((split, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Category"
                    value={split.category}
                    onChange={(e) => {
                      const copy = [...workingSplits];
                      copy[idx].category = e.target.value;
                      setWorkingSplits(copy);
                    }}
                    className="w-1/3 px-2 py-1.5 rounded-lg bg-white border border-slate-200 text-[#0F172A] font-medium"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Amount ($)"
                    value={split.amountDollars}
                    onChange={(e) => {
                      const copy = [...workingSplits];
                      copy[idx].amountDollars = e.target.value;
                      setWorkingSplits(copy);
                    }}
                    className="w-1/4 px-2 py-1.5 rounded-lg bg-white border border-slate-200 text-[#0F172A] font-money font-bold"
                  />
                  <input
                    type="text"
                    placeholder="Note"
                    value={split.note}
                    onChange={(e) => {
                      const copy = [...workingSplits];
                      copy[idx].note = e.target.value;
                      setWorkingSplits(copy);
                    }}
                    className="flex-1 px-2 py-1.5 rounded-lg bg-white border border-slate-200 text-[#0F172A] font-medium"
                  />
                  {workingSplits.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setWorkingSplits(workingSplits.filter((_, i) => i !== idx))}
                      className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                setWorkingSplits([
                  ...workingSplits,
                  { id: `sp_${Date.now()}`, category: 'General', amountDollars: '0.00', note: '' },
                ])
              }
              className="text-xs text-sky-600 hover:text-sky-800 flex items-center gap-1 font-semibold mb-4 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add Another Split Line</span>
            </button>

            <div className="pt-3 border-t border-black/[0.06] flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-700">Accounting Rule:</p>
                <p className="text-[10px] text-slate-500 font-medium">
                  Split sums must equal the parent transaction exactly.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSplitModalTx(null)}
                  className="px-4 py-2 rounded-full text-slate-600 hover:text-black font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  onClick={handleSaveSplits}
                  className="px-5 py-2 rounded-full bg-[#0F172A] hover:bg-neutral-800 text-white font-semibold shadow-md cursor-pointer"
                >
                  Save Splits
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
