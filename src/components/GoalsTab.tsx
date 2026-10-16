'use client';

import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { SavingsGoal } from '../types/finance';
import { formatMoney, dollarsToCents } from '../lib/money';
import { GoalTrajectoryChart } from './InteractiveCharts';
import {
  Target,
  Plus,
  Calendar,
  Sparkles,
  TrendingUp,
  PauseCircle,
  PlayCircle,
  X,
} from 'lucide-react';

export function GoalsTab() {
  const { goals, addGoal, updateGoal } = useFinance();
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Add Goal Form State
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('');
  const [deadline, setDeadline] = useState('');
  const [category, setCategory] = useState('Safety Net');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('high');

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !target.trim()) return;

    addGoal({
      name: name.trim(),
      targetCents: dollarsToCents(target),
      currentCents: dollarsToCents(current || '0'),
      targetDate: deadline || undefined,
      category,
      priority,
      isPaused: false,
    });

    setIsAddOpen(false);
    setName('');
    setTarget('');
    setCurrent('');
    setDeadline('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0F172A] tracking-tight">Savings Horizons & Goals</h1>
          <p className="text-xs text-neutral-600 font-medium mt-1">
            Transparent projections with explicit assumptions. Traceable capital allocation reservoirs.
          </p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#0F172A] hover:bg-neutral-800 text-white font-semibold text-xs transition-all shadow-md cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-sky-400" />
          <span>Create Goal</span>
        </button>
      </div>

      {/* Interactive Savings Horizon & Goal Acceleration Chart */}
      <GoalTrajectoryChart goals={goals} />

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {goals.map((g) => {
          const percent = Math.min(100, Math.round((g.currentCents / g.targetCents) * 100));
          const remainingCents = Math.max(0, g.targetCents - g.currentCents);

          return (
            <div key={g.id} className="keel-card p-5 flex flex-col justify-between h-full space-y-4 hover:shadow-md transition-shadow">
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shadow-2xs">
                      <Target className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-[#0F172A]">{g.name}</h3>
                      <p className="text-[11px] text-neutral-500 font-medium">{g.category}</p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider border ${
                      g.priority === 'high'
                        ? 'bg-rose-50 text-rose-700 border-rose-300'
                        : g.priority === 'medium'
                        ? 'bg-sky-50 text-sky-800 border-sky-200'
                        : 'bg-neutral-100 text-neutral-700 border-neutral-300'
                    }`}
                  >
                    {g.priority}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-money text-emerald-800 font-bold">{formatMoney(g.currentCents)}</span>
                    <span className="text-neutral-600 font-money text-[11px] font-semibold">Target: {formatMoney(g.targetCents)}</span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-neutral-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700"
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-600 pt-1 font-medium">
                    <span className="font-mono text-emerald-700 font-bold">{percent}% funded</span>
                    <span>Remaining: <span className="font-money text-slate-900 font-bold">{formatMoney(remainingCents)}</span></span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-black/[0.05] flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  {g.targetDate ? `By ${g.targetDate}` : 'Flexible horizon'}
                </span>
                <button
                  onClick={() => updateGoal(g.id, { isPaused: !g.isPaused })}
                  className="hover:text-black font-medium transition-colors cursor-pointer flex items-center gap-1"
                >
                  {g.isPaused ? (
                    <>
                      <PlayCircle className="w-3.5 h-3.5 text-sky-600" />
                      <span className="text-sky-700 font-semibold">Resume</span>
                    </>
                  ) : (
                    <>
                      <PauseCircle className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Pause</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Goal Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="max-w-md w-full keel-card bg-white p-6 shadow-2xl animate-in zoom-in-95 border border-black/[0.08] text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] mb-4">
              <h3 className="text-base font-bold text-[#0F172A]">Define Savings Goal</h3>
              <button onClick={() => setIsAddOpen(false)} className="text-slate-500 hover:text-black">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3.5">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Goal Title</label>
                <input
                  type="text"
                  placeholder="e.g. 6-Month Emergency Buffer"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Target Amount ($)</label>
                  <input
                    type="number"
                    step="10"
                    placeholder="5000"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-money font-bold focus:outline-none focus:ring-1 focus:ring-sky-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Initial Seed ($)</label>
                  <input
                    type="number"
                    step="10"
                    placeholder="1000"
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-money font-bold focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Target Date (Optional)</label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-black/[0.06] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 rounded-full text-slate-600 hover:text-black font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-[#0F172A] hover:bg-neutral-800 text-white font-semibold shadow-md cursor-pointer"
                >
                  Save Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
