'use client';

import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { BillSubscription } from '../types/finance';
import { formatMoney, dollarsToCents } from '../lib/money';
import { BillsDrainTimelineChart } from './InteractiveCharts';
import { RowActions } from './RowActions';
import {
  CalendarDays,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
} from 'lucide-react';

export function BillsTab() {
  const { bills, accounts, addBill, updateBill, deleteBill, payBill } = useFinance();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  // Form
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<'weekly' | 'monthly' | 'quarterly' | 'annual'>('monthly');
  const [nextDueDate, setNextDueDate] = useState('');
  const [category, setCategory] = useState('Utilities');
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [isAutoPay, setIsAutoPay] = useState(true);

  const openAdd = () => {
    setEditingId(null);
    setName('');
    setAmount('');
    setFrequency('monthly');
    setNextDueDate('');
    setCategory('Utilities');
    setAccountId(accounts[0]?.id || '');
    setIsAutoPay(true);
    setIsAddOpen(true);
  };

  const openEdit = (bill: BillSubscription) => {
    setEditingId(bill.id);
    setName(bill.name);
    setAmount((bill.amountCents / 100).toString());
    setFrequency(bill.frequency);
    setNextDueDate(bill.nextDueDate);
    setCategory(bill.category);
    setAccountId(bill.accountId);
    setIsAutoPay(bill.isAutoPay);
    setIsAddOpen(true);
  };

  const handlePay = async (bill: BillSubscription) => {
    setPayingId(bill.id); // disables the button so a double click can't send twice (the server also refuses repeats)
    await payBill(bill.id);
    setPayingId(null);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !amount.trim() || !nextDueDate) return;

    if (editingId) {
      const saved = await updateBill(editingId, {
        name: name.trim(),
        amountCents: dollarsToCents(amount),
        frequency,
        nextDueDate,
        category,
        accountId,
        isAutoPay,
      });
      if (saved) setIsAddOpen(false);
      return;
    }

    addBill({
      name: name.trim(),
      amountCents: dollarsToCents(amount),
      frequency,
      nextDueDate,
      category,
      accountId,
      isAutoPay,
      status: 'active',
      confidence: 'confirmed',
    });

    setIsAddOpen(false);
    setName('');
    setAmount('');
    setNextDueDate('');
  };

  const totalMonthlyBillsCents = bills
    .filter((b) => b.frequency === 'monthly')
    .reduce((s, b) => s + b.amountCents, 0);

  const checkingAcc = accounts.find((a) => a.type === 'checking');
  const checkingBalanceCents = checkingAcc ? checkingAcc.balanceCents : 642050;

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0F172A] tracking-tight">Recurring Commitments & Bills</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Total Monthly Fixed Outflow (Loss): <span className="font-money text-rose-700 font-bold">-{formatMoney(totalMonthlyBillsCents)}</span>
          </p>
        </div>

        <button
          onClick={openAdd}
          className="btn-primary-anim btn-shimmer flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0F172A] hover:bg-slate-800 text-white font-semibold text-xs transition-all shadow-md cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-sky-400" />
          <span>Add Recurring Item</span>
        </button>
      </div>

      {/* Interactive 30-Day Liquidity Drain Timeline Chart */}
      <BillsDrainTimelineChart bills={bills} checkingBalanceCents={checkingBalanceCents} />

      {/* Bills Timeline Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bills.map((bill) => {
          const account = accounts.find((a) => a.id === bill.accountId);

          return (
            <div key={bill.id} className="keel-card p-6 sm:p-7 flex flex-col justify-between h-full space-y-5 hover:-translate-y-0.5 hover:shadow-xl transition-all duration-300">
              <div>
                <div className="flex items-start justify-between mb-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shadow-xs">
                      <CalendarDays className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-[#0F172A]">{bill.name}</h3>
                      <p className="text-[11px] text-slate-500 font-medium">{bill.category}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                  <span
                    className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider border ${
                      bill.status === 'due_soon'
                        ? 'bg-rose-50 text-rose-700 border-rose-300'
                        : bill.status === 'overdue'
                        ? 'bg-rose-100 text-rose-800 border-rose-400'
                        : 'bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                  >
                    {bill.status.replace('_', ' ')}
                  </span>
                  <RowActions label={bill.name} onEdit={() => openEdit(bill)} onDelete={() => deleteBill(bill.id)} />
                  </div>
                </div>

                <div className="pt-1">
                  <p className="text-[11px] text-slate-500 mb-0.5 font-semibold">Scheduled Outflow (Drain)</p>
                  <p className="text-2xl sm:text-3xl font-bold text-rose-700 font-money tracking-tight">
                    -{formatMoney(bill.amountCents)}
                  </p>
                </div>
              </div>

              <div className="pt-3.5 border-t border-slate-100 space-y-2.5 text-[11px] text-slate-600 font-medium">
                <div className="flex items-center justify-between">
                  <span>Frequency</span>
                  <span className="capitalize font-bold text-[#0F172A]">{bill.frequency}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Next Due</span>
                  <span className="font-mono text-rose-700 font-bold">{bill.nextDueDate}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Payment Account</span>
                  <span className="text-slate-800 truncate max-w-[150px] font-semibold">
                    {account ? `${account.name} (${account.accountNumberMask})` : 'Manual Remit'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                  <span>Auto-Debit Status</span>
                  <span className={`font-bold ${bill.isAutoPay ? 'text-sky-700' : 'text-slate-500'}`}>
                    {bill.isAutoPay ? 'Active Auto-Pay' : 'Manual Authorization'}
                  </span>
                </div>
                <button
                  onClick={() => handlePay(bill)}
                  disabled={payingId === bill.id || bill.status === 'paused'}
                  className="w-full mt-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  title={account ? 'Records the payment as an expense and moves to the next due date' : 'Moves to the next due date (no payment account to record the expense in)'}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {payingId === bill.id ? 'Saving…' : `Mark ${bill.nextDueDate} as paid`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Bill Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-md">
          <div className="max-w-md w-full bg-white/95 backdrop-blur-2xl p-7 sm:p-8 rounded-3xl border border-white/90 shadow-2xl animate-in zoom-in-95 text-xs">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-5">
              <h3 className="text-base font-bold text-[#0F172A]">{editingId ? 'Edit Recurring Obligation' : 'Add Recurring Obligation'}</h3>
              <button onClick={() => setIsAddOpen(false)} className="btn-anim text-slate-400 hover:text-slate-700 p-1 rounded-full cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Service / Payee Name</label>
                <input
                  type="text"
                  placeholder="e.g. Fiber Internet, Health Insurance"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="79.99"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-money font-bold focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Frequency</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as 'weekly' | 'monthly' | 'quarterly' | 'annual')}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Next Due Date</label>
                  <input
                    type="date"
                    value={nextDueDate}
                    onChange={(e) => setNextDueDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Category</label>
                  <input
                    type="text"
                    placeholder="Utilities, Housing"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="autopay"
                  checked={isAutoPay}
                  onChange={(e) => setIsAutoPay(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                />
                <label htmlFor="autopay" className="text-slate-600 font-medium cursor-pointer">
                  Enrolled in direct merchant Auto-Pay
                </label>
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
                  {editingId ? 'Save Changes' : 'Save Commitment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
