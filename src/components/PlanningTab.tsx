'use client';

import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { DebtAccount } from '../types/finance';
import { calculateDebtPayoffSchedule } from '../services/debtService';
import { formatMoney, dollarsToCents } from '../lib/money';
import { DebtPayoffTrajectoryChart } from './InteractiveCharts';
import {
  TrendingDown,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  Plus,
  Sliders,
  DollarSign,
  HelpCircle,
  X,
} from 'lucide-react';

export function PlanningTab() {
  const { debts, addDebt } = useFinance();
  const [extraPaymentDollars, setExtraPaymentDollars] = useState(250);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // New Debt Form
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [apr, setApr] = useState('');
  const [minPayment, setMinPayment] = useState('');
  const [category, setCategory] = useState<'credit_card' | 'student_loan' | 'car_loan' | 'mortgage' | 'personal_loan'>('credit_card');

  const extraPaymentCents = extraPaymentDollars * 100;
  const snowballSchedule = calculateDebtPayoffSchedule(debts, extraPaymentCents, 'snowball');
  const avalancheSchedule = calculateDebtPayoffSchedule(debts, extraPaymentCents, 'avalanche');

  const interestSavedCents = Math.max(0, snowballSchedule.totalInterestPaidCents - avalancheSchedule.totalInterestPaidCents);
  const totalDebtCents = debts.reduce((s, d) => s + d.balanceCents, 0);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !balance.trim()) return;

    addDebt({
      name: name.trim(),
      balanceCents: dollarsToCents(balance),
      aprPercent: parseFloat(apr) || 0,
      minimumPaymentCents: dollarsToCents(minPayment || '25'),
      dueDateDay: 15,
      category,
    });

    setIsAddOpen(false);
    setName('');
    setBalance('');
    setApr('');
    setMinPayment('');
  };

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0F172A] tracking-tight">Debt Payoff Engine</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Compare Snowball vs. Avalanche strategies with month-by-month deterministic amortization.
          </p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="btn-primary-anim btn-shimmer flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0F172A] hover:bg-slate-800 text-white font-semibold text-xs transition-all shadow-md cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-sky-400" />
          <span>Add Liability</span>
        </button>
      </div>

      {/* Interactive Extra Payment Slider */}
      <div className="keel-card p-6 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shadow-xs">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#0F172A]">Monthly Extra Principal Accelerator</h2>
              <p className="text-[11px] text-slate-500 font-medium">Accelerate amortization by adding surplus capital</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm bg-sky-50/80 px-4 py-1.5 rounded-full border border-sky-200">
            <span className="text-sky-800 font-medium text-xs">Extra Principal:</span>
            <span className="font-money font-bold text-sky-900 text-base">
              ${extraPaymentDollars.toLocaleString()}
            </span>
          </div>
        </div>

        <input
          type="range"
          min="0"
          max="2000"
          step="25"
          value={extraPaymentDollars}
          onChange={(e) => setExtraPaymentDollars(parseInt(e.target.value) || 0)}
          className="w-full accent-sky-500 cursor-pointer h-2 bg-slate-200 rounded-lg"
        />

        <div className="flex justify-between text-[10px] sm:text-[11px] text-slate-500 font-mono font-medium">
          <span>$0 (Baseline)</span>
          <span className="hidden sm:inline">+$500/mo</span>
          <span className="hidden sm:inline">+$1,000/mo</span>
          <span className="font-bold text-sky-700">+$2,000/mo (Max Turbo)</span>
        </div>

        {/* Interactive Amortization Trajectory Chart */}
        <div className="pt-4 border-t border-slate-100">
          <DebtPayoffTrajectoryChart
            totalDebtCents={totalDebtCents}
            snowballMonths={snowballSchedule.totalMonths}
            avalancheMonths={avalancheSchedule.totalMonths}
            extraPaymentDollars={extraPaymentDollars}
            interestSavedCents={interestSavedCents}
          />
        </div>
      </div>

      {/* Strategy Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strategy 1: Snowball */}
        <div className="keel-card p-6 sm:p-7 space-y-5 h-full flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-xl transition-all duration-300">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">Snowball Strategy</h3>
                <p className="text-[11px] text-slate-500 font-medium">Prioritizes lowest balance first</p>
              </div>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono font-bold">
                Behavioral Momentum
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 py-4 border-y border-black/[0.06] text-xs">
              <div>
                <p className="text-neutral-500 font-medium">Debt-Free In</p>
                <p className="text-2xl font-bold font-money text-[#0F172A] mt-0.5">
                  {snowballSchedule.totalMonths} Months
                </p>
              </div>
              <div>
                <p className="text-neutral-500 font-medium">Total Interest Paid (Loss)</p>
                <p className="text-2xl font-bold font-money text-rose-700 mt-0.5">
                  -{formatMoney(snowballSchedule.totalInterestPaidCents)}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <p className="text-[11px] font-bold text-neutral-700">Payoff Sequence:</p>
              <div className="space-y-1.5">
                {snowballSchedule.debtOrder.map((d, idx) => (
                  <div
                    key={d.id}
                    className="p-2.5 rounded-xl bg-neutral-50 border border-black/[0.05] flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-neutral-200 text-neutral-800 font-mono text-[10px] font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-[#0F172A] font-bold">{d.name}</span>
                    </div>
                    <span className="text-[11px] font-money text-neutral-600 font-semibold">
                      Month {d.payoffMonth}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="text-[11px] text-neutral-500 leading-relaxed pt-2 font-medium">
            Best for users seeking early psychological wins by knocking out smaller accounts rapidly.
          </p>
        </div>

        {/* Strategy 2: Avalanche */}
        <div className="keel-card p-6 sm:p-7 space-y-5 h-full flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-xl transition-all duration-300 border-emerald-200/80 ring-1 ring-emerald-200/50">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">Avalanche Strategy</h3>
                <p className="text-[11px] text-slate-500 font-medium">Prioritizes highest APR first</p>
              </div>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-mono font-bold border border-emerald-300">
                Mathematically Optimal
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-100 text-xs">
              <div>
                <p className="text-slate-500 font-medium">Debt-Free In</p>
                <p className="text-2xl font-bold font-money text-[#0F172A] mt-0.5">
                  {avalancheSchedule.totalMonths} Months
                </p>
              </div>
              <div>
                <p className="text-slate-500 font-medium">Total Interest Paid (Loss)</p>
                <p className="text-2xl font-bold font-money text-rose-700 mt-0.5">
                  -{formatMoney(avalancheSchedule.totalInterestPaidCents)}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <p className="text-[11px] font-bold text-slate-700">Payoff Sequence:</p>
              <div className="space-y-1.5">
                {avalancheSchedule.debtOrder.map((d, idx) => (
                  <div
                    key={d.id}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-[#0F172A] font-bold">{d.name}</span>
                    </div>
                    <span className="text-[11px] font-money text-slate-600 font-semibold">
                      Month {d.payoffMonth}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 shrink-0 text-emerald-600" />
            <span className="font-semibold">
              Saves <strong className="font-money font-bold text-emerald-800">+{formatMoney(interestSavedCents)}</strong> in interest compared to Snowball.
            </span>
          </div>
        </div>
      </div>

      {/* Add Debt Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-md">
          <div className="max-w-md w-full bg-white/95 backdrop-blur-2xl p-7 sm:p-8 rounded-3xl border border-white/90 shadow-2xl animate-in zoom-in-95 text-xs">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-5">
              <h3 className="text-base font-bold text-[#0F172A]">Add Debt Liability</h3>
              <button onClick={() => setIsAddOpen(false)} className="btn-anim text-slate-400 hover:text-slate-700 p-1 rounded-full cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Debt Name</label>
                <input
                  type="text"
                  placeholder="e.g. Chase Slate Card or Auto Loan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Remaining Balance ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="3500.00"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-money font-bold focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Interest APR (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="18.9"
                    value={apr}
                    onChange={(e) => setApr(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-money font-bold focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Monthly Minimum Payment ($)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="75.00"
                  value={minPayment}
                  onChange={(e) => setMinPayment(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-money font-bold focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  required
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
                  Add Liability
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
