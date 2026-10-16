'use client';

import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { FinancialAccount, AccountType } from '../types/finance';
import { formatMoney, dollarsToCents } from '../lib/money';
import { AssetAllocationChart } from './InteractiveCharts';
import {
  Wallet,
  Building,
  CreditCard,
  TrendingUp,
  Plus,
  Shield,
  CheckCircle,
  X,
  Filter,
} from 'lucide-react';

export function AccountsTab() {
  const { accounts, addAccount } = useFinance();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('ALL');

  // Add Account Form State
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [balance, setBalance] = useState('');
  const [accountMask, setAccountMask] = useState('•••• 1234');

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const baseCents = dollarsToCents(balance || '0');
    // Liabilities have negative balances
    const balanceCents = type === 'credit' || type === 'loan' ? -Math.abs(baseCents) : Math.abs(baseCents);

    addAccount({
      name: name.trim(),
      institution: institution.trim() || 'Manual Institution',
      type,
      currency: 'USD',
      balanceCents,
      accountNumberMask: accountMask.trim(),
      isManual: true,
      isIncludedInNetWorth: true,
    });

    setIsAddOpen(false);
    setName('');
    setInstitution('');
    setBalance('');
  };

  const getAccountIcon = (t: AccountType) => {
    switch (t) {
      case 'checking':
        return Building;
      case 'savings':
        return Wallet;
      case 'investment':
        return TrendingUp;
      case 'credit':
      case 'loan':
        return CreditCard;
      default:
        return Wallet;
    }
  };

  const filteredAccounts = accounts.filter((acc) => {
    if (selectedType === 'ALL') return true;
    if (selectedType === 'CHECKING') return acc.type === 'checking';
    if (selectedType === 'SAVINGS') return acc.type === 'savings';
    if (selectedType === 'INVESTMENT') return acc.type === 'investment';
    if (selectedType === 'CREDIT') return acc.type === 'credit';
    if (selectedType === 'LOAN') return acc.type === 'loan';
    return true;
  });

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0F172A] tracking-tight">Financial Accounts</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            {accounts.length} connected and manual repositories. Every balance traceable to exact minor-unit records.
          </p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="btn-primary-anim btn-shimmer flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0F172A] hover:bg-slate-800 text-white font-semibold text-xs transition-all shadow-md cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-sky-400" />
          <span>Add Account</span>
        </button>
      </div>

      {/* Interactive Asset Allocation & Liquidity Dashboard */}
      <AssetAllocationChart
        accounts={accounts}
        selectedType={selectedType}
        onSelectType={setSelectedType}
      />

      {/* Account Filter Badge if filtered */}
      {selectedType !== 'ALL' && (
        <div className="glass-pill flex items-center justify-between px-5 py-3 rounded-2xl bg-sky-50/80 border border-sky-200/80 text-xs">
          <span className="text-sky-900 flex items-center gap-2 font-medium">
            <Filter className="w-3.5 h-3.5 text-sky-600" />
            Filtered to <strong className="text-sky-950 uppercase font-mono font-bold">{selectedType}</strong> accounts ({filteredAccounts.length})
          </span>
          <button
            onClick={() => setSelectedType('ALL')}
            className="btn-anim text-sky-700 hover:text-sky-950 font-bold underline cursor-pointer text-xs"
          >
            Show All Accounts
          </button>
        </div>
      )}

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredAccounts.map((acc) => {
          const Icon = getAccountIcon(acc.type);
          const isNegative = acc.balanceCents < 0;

          return (
            <div key={acc.id} className="keel-card p-6 sm:p-7 flex flex-col justify-between h-full space-y-5 hover:-translate-y-0.5 hover:shadow-xl transition-all duration-300">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shadow-xs">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#0F172A]">{acc.name}</h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {acc.institution} • {acc.accountNumberMask}
                    </p>
                  </div>
                </div>

                <span className={`text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono font-bold ${
                  isNegative ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}>
                  {acc.type}
                </span>
              </div>

              <div className="pt-2">
                <p className="text-[11px] text-slate-500 mb-0.5 font-semibold">Reconciled Balance</p>
                <p className={`text-2xl sm:text-3xl font-bold font-money tracking-tight ${isNegative ? 'text-rose-600' : 'text-[#0F172A]'}`}>
                  {formatMoney(acc.balanceCents)}
                </p>
              </div>

              <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                  <CheckCircle className="w-3.5 h-3.5 text-sky-600" />
                  {acc.isManual ? 'Manual Ledger Entry' : 'Provider Synced'}
                </span>
                <span>As of {new Date(acc.lastSyncedAt).toLocaleDateString()}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Account Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-md">
          <div className="max-w-md w-full bg-white/95 backdrop-blur-2xl p-7 sm:p-8 rounded-3xl border border-white/90 shadow-2xl animate-in zoom-in-95 text-xs">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-5">
              <h3 className="text-base font-bold text-[#0F172A]">Add Financial Account</h3>
              <button onClick={() => setIsAddOpen(false)} className="btn-anim text-slate-400 hover:text-slate-700 p-1 rounded-full cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Account Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Primary High-Yield Savings"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Financial Institution</label>
                <input
                  type="text"
                  placeholder="e.g. Fidelity, Ally, Vanguard"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Account Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as AccountType)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  >
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                    <option value="investment">Investment</option>
                    <option value="credit">Credit Card</option>
                    <option value="loan">Loan</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Current Balance ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-money font-bold focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Masked Number</label>
                <input
                  type="text"
                  placeholder="•••• 1234"
                  value={accountMask}
                  onChange={(e) => setAccountMask(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="btn-anim px-4 py-2.5 rounded-full text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary-anim btn-shimmer px-6 py-2.5 rounded-full bg-[#0F172A] hover:bg-slate-800 text-white font-semibold shadow-md cursor-pointer"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
