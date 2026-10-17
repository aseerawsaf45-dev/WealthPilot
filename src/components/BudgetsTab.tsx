'use client';

import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { BudgetCategory } from '../types/finance';
import { formatMoney, dollarsToCents, calculateBudgetPace } from '../lib/money';
import { BudgetPacingGaugeChart } from './InteractiveCharts';
import { RowActions } from './RowActions';
import {
  PieChart,
  Plus,
  ArrowUpRight,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  X,
} from 'lucide-react';

export function BudgetsTab() {
  const { budgets, addBudget, updateBudget, deleteBudget } = useFinance();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [category, setCategory] = useState('');
  const [allocated, setAllocated] = useState('');
  const [rollover, setRollover] = useState(false);

  const openAdd = () => {
    setEditingId(null);
    setCategory('');
    setAllocated('');
    setRollover(false);
    setIsAddOpen(true);
  };

  const openEdit = (b: BudgetCategory) => {
    setEditingId(b.id);
    setCategory(b.category);
    setAllocated((b.allocatedCents / 100).toString());
    setRollover(b.rolloverEnabled);
    setIsAddOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category.trim() || !allocated.trim()) return;

    if (editingId) {
      await updateBudget(editingId, { allocatedCents: dollarsToCents(allocated), rolloverEnabled: rollover });
      setIsAddOpen(false);
      return;
    }

    addBudget({
      category: category.trim(),
      allocatedCents: dollarsToCents(allocated),
      spentCents: 0,
      period: 'monthly',
      rolloverEnabled: rollover,
      rolloverCents: 0,
      alertThresholdPercent: 85,
    });

    setIsAddOpen(false);
    setCategory('');
    setAllocated('');
  };

  const totalAllocated = budgets.reduce((s, b) => s + b.allocatedCents, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spentCents, 0);

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0F172A] tracking-tight">Category Budgets</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Total Allocated: <span className="font-money font-bold text-[#0F172A]">{formatMoney(totalAllocated)}</span> • Spent: <span className="font-money font-bold text-rose-700">{formatMoney(totalSpent)}</span>
          </p>
        </div>

        <button
          onClick={openAdd}
          className="btn-primary-anim btn-shimmer flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0F172A] hover:bg-slate-800 text-white font-semibold text-xs transition-all shadow-md cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-sky-400" />
          <span>Add Budget Plan</span>
        </button>
      </div>

      {/* Interactive Month Pacing & Runway Benchmark Gauge */}
      <BudgetPacingGaugeChart budgets={budgets} />

      {/* Budgets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {budgets.map((b) => {
          const pace = calculateBudgetPace(b.spentCents, b.allocatedCents);
          const remainingCents = b.allocatedCents - b.spentCents;
          const percentUsed = Math.min(100, pace.percentUsed);

          return (
            <div key={b.id} className="keel-card p-6 sm:p-7 space-y-5 hover:-translate-y-0.5 hover:shadow-xl transition-all duration-300">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-sm text-[#0F172A]">{b.category}</h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {b.period === 'monthly' ? 'Monthly Allocation' : 'Custom Period'}
                    {b.rolloverEnabled && ' • Rollover Active'}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                <span
                  className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${
                    pace.paceStatus === 'over'
                      ? 'bg-rose-50 text-rose-700 border-rose-300'
                      : pace.paceStatus === 'under'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-slate-100 text-slate-800 border-slate-300'
                  }`}
                >
                  {pace.paceStatus === 'over'
                    ? 'Deficit / Over Budget'
                    : pace.paceStatus === 'under'
                    ? 'Surplus / Under Budget'
                    : 'On Track'}
                </span>
                <RowActions label={`${b.category} budget`} onEdit={() => openEdit(b)} onDelete={() => deleteBudget(b.id)} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-slate-600">
                    Spent: <span className="font-money font-bold text-rose-700">{formatMoney(b.spentCents)}</span>
                  </span>
                  <span className="text-slate-600">
                    Budget: <span className="font-money font-bold text-[#0F172A]">{formatMoney(b.allocatedCents)}</span>
                  </span>
                </div>

                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      percentUsed >= 100
                        ? 'bg-rose-500'
                        : percentUsed >= 80
                        ? 'bg-amber-400'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${percentUsed}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1 font-medium">
                  <span>{pace.percentUsed}% exhausted</span>
                  <span>
                    Remaining: <span className={`font-money font-bold ${remainingCents >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatMoney(remainingCents)}</span>
                  </span>
                </div>
              </div>

              <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>Projected End: <span className="font-money font-semibold text-slate-800">{formatMoney(pace.projectedEndCents)}</span></span>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 hover:text-slate-900 font-medium">
                  <input
                    type="checkbox"
                    checked={b.rolloverEnabled}
                    onChange={(e) => updateBudget(b.id, { rolloverEnabled: e.target.checked })}
                    className="rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                  />
                  <span>Rollover</span>
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Budget Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-md">
          <div className="max-w-md w-full bg-white/95 backdrop-blur-2xl p-7 sm:p-8 rounded-3xl border border-white/90 shadow-2xl animate-in zoom-in-95 text-xs">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-5">
              <h3 className="text-base font-bold text-[#0F172A]">{editingId ? 'Edit Budget Allocation' : 'Create Budget Allocation'}</h3>
              <button onClick={() => setIsAddOpen(false)} className="btn-anim text-slate-400 hover:text-slate-700 p-1 rounded-full cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Category Name</label>
                <input
                  type="text"
                  placeholder="e.g. Travel, Dining, Streaming"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={!!editingId}
                  title={editingId ? 'The category of an existing budget cannot be changed' : undefined}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Monthly Planned Limit ($)</label>
                <input
                  type="number"
                  step="1"
                  placeholder="500"
                  value={allocated}
                  onChange={(e) => setAllocated(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-money font-bold focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  required
                />
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="rollover"
                  checked={rollover}
                  onChange={(e) => setRollover(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                />
                <label htmlFor="rollover" className="text-slate-600 font-medium cursor-pointer">
                  Enable unused surplus rollover into next month
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
                  Save Allocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
