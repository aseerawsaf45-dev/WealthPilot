'use client';

import React, { useState } from 'react';
import { PageInsights } from './PageInsights';
import { useInsights } from '../context/useInsights';
import { useFinance } from '../context/FinanceContext';
import { SavingsGoal } from '../types/finance';
import { formatMoney, displaySymbol, dollarsToCents, fromMinor } from '../lib/money';
import { GoalTrajectoryChart } from './InteractiveCharts';
import { RowActions } from './RowActions';
import { GoalPlanDialog, VERDICT_STYLE, planHeadline } from './GoalPlanDialog';
import { planStaleReason, daysAgo } from '../lib/goalPlan';
import {
  Target,
  Plus,
  Calendar,
  Sparkles,
  TrendingUp,
  PauseCircle,
  PlayCircle,
  PiggyBank,
  X,
} from 'lucide-react';

export function GoalsTab() {
  const { goals, addGoal, updateGoal, deleteGoal, contributeToGoal } = useFinance();
  const insightReport = useInsights();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [planGoalId, setPlanGoalId] = useState<string | null>(null);

  // Add Goal Form State
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('');
  const [deadline, setDeadline] = useState('');
  const [category, setCategory] = useState('Safety Net');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('high');

  const openAdd = () => {
    setEditingId(null);
    setName('');
    setTarget('');
    setCurrent('');
    setDeadline('');
    setIsAddOpen(true);
  };

  const openEdit = (g: SavingsGoal) => {
    setEditingId(g.id);
    setName(g.name);
    setTarget(fromMinor(g.targetCents));
    setCurrent(fromMinor(g.currentCents));
    setDeadline(g.targetDate ?? '');
    setCategory(g.category);
    setPriority(g.priority);
    setIsAddOpen(true);
  };

  const handleAddMoney = async (g: SavingsGoal) => {
    const input = window.prompt(`Amount to add to "${g.name}" (use a minus sign to withdraw):`, '');
    if (!input?.trim()) return;
    const cents = dollarsToCents(input);
    if (!cents) return;
    await contributeToGoal(g.id, cents);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !target.trim()) return;

    if (editingId) {
      await updateGoal(editingId, {
        name: name.trim(),
        targetCents: dollarsToCents(target),
        currentCents: dollarsToCents(current || '0'),
        // null clears the deadline on the server (the client type only models string | undefined)
        targetDate: (deadline || null) as unknown as string | undefined,
        category,
        priority,
      });
      setIsAddOpen(false);
      return;
    }

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
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#0F172A] hover:bg-neutral-800 text-white font-semibold text-xs transition-all shadow-md cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-sky-400" />
          <span>Create Goal</span>
        </button>
      </div>

      <PageInsights segment="goals" />

      {/* Interactive Savings Horizon & Goal Acceleration Chart */}
      <GoalTrajectoryChart goals={goals} />

      {/* Goals Grid */}
      <div className="wp-stagger grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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

                  <div className="flex items-center gap-1">
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
                  <RowActions label={g.name} onEdit={() => openEdit(g)} onDelete={() => deleteGoal(g.id)} />
                  </div>
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
                  onClick={() => handleAddMoney(g)}
                  className="hover:text-black font-medium transition-colors cursor-pointer flex items-center gap-1 text-emerald-700"
                >
                  <PiggyBank className="w-3.5 h-3.5" />
                  <span className="font-semibold">Add money</span>
                </button>
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
              {g.plan ? (
                // Saved AI plan summary: click to reopen without recalculating.
                <button
                  onClick={() => setPlanGoalId(g.id)}
                  aria-label={`View AI plan for ${g.name}`}
                  className="w-full text-left p-3 rounded-xl bg-gradient-to-br from-sky-50 to-white hover:from-sky-100 border border-sky-200 transition-colors cursor-pointer"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${VERDICT_STYLE[g.plan.verdict].pill}`}>
                      <Sparkles className="w-3 h-3" />
                      {VERDICT_STYLE[g.plan.verdict].label}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {planStaleReason(g, undefined, insightReport.averages) ? (
                        <span className="text-amber-700 font-bold">Out of date</span>
                      ) : (
                        g.planUpdatedAt && `Saved ${daysAgo(g.planUpdatedAt)}`
                      )}
                    </span>
                  </span>
                  <span className="block mt-1.5 text-xs font-bold text-slate-900">{planHeadline(g.plan)}</span>
                  <span className="block mt-0.5 text-[11px] font-semibold text-sky-700">
                    {(() => {
                      const ways = (g.plan.contingencies ?? []).filter((c) => c.feasible && c.action.kind !== 'none').length;
                      return ways ? `${ways} way${ways === 1 ? '' : 's'} to make it reachable →` : 'View plan →';
                    })()}
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => setPlanGoalId(g.id)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 text-xs font-bold transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Plan with AI: can I reach this in time?
                </button>
              )}
            </div>
          );
        })}
      </div>

      {planGoalId && <GoalPlanDialog goalId={planGoalId} onClose={() => setPlanGoalId(null)} />}

      {/* Add Goal Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="max-w-md w-full keel-card bg-white p-6 shadow-2xl animate-in zoom-in-95 border border-black/[0.08] text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] mb-4">
              <h3 className="text-base font-bold text-[#0F172A]">{editingId ? 'Edit Savings Goal' : 'Define Savings Goal'}</h3>
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
                  <label className="block text-slate-700 font-semibold mb-1">Target Amount ({displaySymbol()})</label>
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
                  <label className="block text-slate-700 font-semibold mb-1">Initial Seed ({displaySymbol()})</label>
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
                  {editingId ? 'Save Changes' : 'Save Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
