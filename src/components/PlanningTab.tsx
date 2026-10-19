'use client';

import React, { useState } from 'react';
import { PageInsights } from './PageInsights';
import { useFinance } from '../context/FinanceContext';
import { DebtAccount } from '../types/finance';
import { calculateDebtPayoffSchedule } from '../services/debtService';
import { formatMoney, displaySymbol, dollarsToCents, fromMinor, toMinor } from '../lib/money';
import { LineChart as PlannerChart } from './planner/LineChart';
import { RowActions } from './RowActions';
import { Sparkles, Plus, Sliders, X, AlertTriangle, CreditCard, Landmark, LineChart, Scale } from 'lucide-react';
import { LoansPanel } from './planner/LoansPanel';
import { InvestPanel } from './planner/InvestPanel';
import { CompareLinkPanel } from './planner/CompareLinkPanel';
import { addMonths } from '../lib/ml';
import { useToday } from '../lib/dates';

const SUB_TABS = [
  { id: 'debt', label: 'Debt', icon: CreditCard, blurb: 'Pay off what you owe, fastest or cheapest' },
  { id: 'loans', label: 'Loans', icon: Landmark, blurb: 'Compare offers before you borrow' },
  { id: 'invest', label: 'Invest', icon: LineChart, blurb: 'Plan by country, risk and world events' },
  { id: 'compare', label: 'Pay or invest?', icon: Scale, blurb: 'How your debts, loans and investments affect each other' },
] as const;
type SubTab = (typeof SUB_TABS)[number]['id'];

const CATEGORY_LABEL: Record<DebtAccount['category'], string> = {
  credit_card: 'Credit card',
  student_loan: 'Student loan',
  car_loan: 'Car loan',
  mortgage: 'Mortgage',
  personal_loan: 'Personal loan',
};

/** Debt & Wealth Planner: Debt · Loans · Invest · Pay or invest? (tab id stays "planning"). */
export function PlanningTab() {
  const [sub, setSub] = useState<SubTab>('debt');
  const active = SUB_TABS.find((t) => t.id === sub)!;
  return (
    <div className="space-y-8 sm:space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-[#0F172A] tracking-tight">Debt &amp; Wealth Planner</h1>
        <p className="text-xs text-slate-500 font-medium mt-1">{active.blurb}. Every number is calculated from your data; nothing changes until you save.</p>
      </div>

      <div role="tablist" aria-label="Planner sections" className="glass-segmented inline-flex flex-wrap gap-1 rounded-2xl p-1">
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={sub === t.id}
            onClick={() => setSub(t.id)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${sub === t.id ? 'bg-[#0F172A] text-white shadow-md' : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'}`}
          >
            <t.icon className={`h-3.5 w-3.5 ${sub === t.id ? 'text-sky-300' : 'text-slate-500'}`} />
            {t.label}
          </button>
        ))}
      </div>

      <PageInsights key={`insights-${sub}`} segment={sub === 'debt' || sub === 'compare' ? 'debts' : sub} scope={sub === 'debt' || sub === 'compare' ? 'planning' : sub} />

      <div key={`panel-${sub}`} className="wp-enter">
        {sub === 'debt' && <DebtPanel onOpenLoans={() => setSub('loans')} />}
        {sub === 'loans' && <LoansPanel />}
        {sub === 'invest' && <InvestPanel />}
        {sub === 'compare' && <CompareLinkPanel onOpen={setSub} />}
      </div>
    </div>
  );
}

function DebtPanel({ onOpenLoans }: { onOpenLoans: () => void }) {
  const { debts, addDebt, updateDebt, deleteDebt } = useFinance();
  const today = useToday();
  // Extra monthly payment in major units of the base currency; the slider scales with your minimum payments.
  const minimumsCents = debts.reduce((sum, d) => sum + d.minimumPaymentCents, 0);
  const sliderMax = Math.max(100, Math.round(Number(fromMinor(minimumsCents * 2)) / 10) * 10 || 2000);
  const [extraPaymentDollars, setExtraPaymentDollars] = useState(() => Math.round(sliderMax / 8));
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New Debt Form
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [apr, setApr] = useState('');
  const [minPayment, setMinPayment] = useState('');
  const [category, setCategory] = useState<'credit_card' | 'student_loan' | 'car_loan' | 'mortgage' | 'personal_loan'>('credit_card');
  const [dueDay, setDueDay] = useState('15');

  const extraPaymentCents = dollarsToCents(extraPaymentDollars);
  const snowballSchedule = calculateDebtPayoffSchedule(debts, extraPaymentCents, 'snowball');
  const avalancheSchedule = calculateDebtPayoffSchedule(debts, extraPaymentCents, 'avalanche');
  const minimumOnly = calculateDebtPayoffSchedule(debts, 0, 'avalanche');

  const interestSavedCents = Math.max(0, snowballSchedule.totalInterestPaidCents - avalancheSchedule.totalInterestPaidCents);
  const extraSavesCents = Math.max(0, minimumOnly.totalInterestPaidCents - avalancheSchedule.totalInterestPaidCents);
  const totalDebtCents = debts.reduce((s, d) => s + d.balanceCents, 0);
  // Badges from the results, not fixed text.
  const cheaper = avalancheSchedule.totalInterestPaidCents <= snowballSchedule.totalInterestPaidCents ? 'avalanche' : 'snowball';
  const firstWin = (s: typeof snowballSchedule) => Math.min(...s.debtOrder.map((d) => d.payoffMonth), Infinity);
  const quickerWin = firstWin(snowballSchedule) <= firstWin(avalancheSchedule) ? 'snowball' : 'avalanche';
  const badge = (s: 'snowball' | 'avalanche') => [cheaper === s && 'Lowest interest', quickerWin === s && 'Fastest first win'].filter(Boolean).join(' · ');
  const debtFreeDate = avalancheSchedule.totalMonths ? addMonths(today, avalancheSchedule.totalMonths).slice(0, 7) : null;
  // Debts whose minimum payment doesn't even cover the monthly interest.
  const underwater = debts.filter((d) => d.balanceCents > 0 && d.minimumPaymentCents <= Math.round((d.balanceCents * d.aprPercent) / 1200));

  const openAdd = () => {
    setEditingId(null);
    setName('');
    setBalance('');
    setApr('');
    setMinPayment('');
    setCategory('credit_card');
    setDueDay('15');
    setIsAddOpen(true);
  };

  const openEdit = (d: DebtAccount) => {
    setEditingId(d.id);
    setName(d.name);
    setBalance(fromMinor(d.balanceCents));
    setApr(d.aprPercent.toString());
    setMinPayment(fromMinor(d.minimumPaymentCents));
    setCategory(d.category);
    setDueDay(String(d.dueDateDay));
    setIsAddOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !balance.trim()) return;

    if (editingId) {
      await updateDebt(editingId, {
        name: name.trim(),
        balanceCents: dollarsToCents(balance),
        aprPercent: parseFloat(apr) || 0,
        minimumPaymentCents: dollarsToCents(minPayment || '0'),
        dueDateDay: Math.min(31, Math.max(1, parseInt(dueDay, 10) || 1)),
        category,
      });
      setIsAddOpen(false);
      return;
    }

    addDebt({
      name: name.trim(),
      balanceCents: dollarsToCents(balance),
      aprPercent: parseFloat(apr) || 0,
      minimumPaymentCents: dollarsToCents(minPayment || '0'),
      dueDateDay: Math.min(31, Math.max(1, parseInt(dueDay, 10) || 1)),
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3 text-xs font-semibold text-slate-600">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">Total owed <strong className="font-money text-rose-700">{formatMoney(totalDebtCents)}</strong></span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">Minimums <strong className="font-money text-slate-900">{formatMoney(minimumsCents)}/mo</strong></span>
          {debtFreeDate && !avalancheSchedule.neverPaysOff && <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-800">Debt-free by <strong>{debtFreeDate}</strong></span>}
        </div>
        <div className="flex gap-2">
          <button onClick={onOpenLoans} className="btn-glass-anim inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold text-slate-800 cursor-pointer">
            Refinance with a loan
          </button>
          <button
            onClick={openAdd}
            className="btn-primary-anim btn-shimmer flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0F172A] hover:bg-slate-800 text-white font-semibold text-xs transition-all shadow-md cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-sky-400" />
            <span>Add debt</span>
          </button>
        </div>
      </div>

      {underwater.length > 0 && (
        <p role="alert" className="wp-pop flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {underwater.map((d) => d.name).join(', ')}: the minimum payment doesn&apos;t cover the monthly interest, so the balance never goes down without extra payments.
            {avalancheSchedule.neverPaysOff && ' At the current extra amount, your debts are not paid off within 30 years.'}
          </span>
        </p>
      )}

      {/* Interactive Extra Payment Slider */}
      <div className="keel-card p-6 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shadow-xs">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#0F172A]">Extra payment each month</h2>
              <p className="text-[11px] text-slate-500 font-medium">{extraPaymentCents > 0 ? <>Saves <strong className="text-emerald-700">{formatMoney(extraSavesCents)}</strong> interest and {Math.max(0, minimumOnly.totalMonths - avalancheSchedule.totalMonths)} months vs paying only minimums</> : 'Slide to see what extra payments save'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm bg-sky-50/80 px-4 py-1.5 rounded-full border border-sky-200">
            <span className="text-sky-800 font-medium text-xs">Extra Principal:</span>
            <span className="font-money font-bold text-sky-900 text-base">
              {formatMoney(extraPaymentCents)}
            </span>
          </div>
        </div>

        <input
          type="range"
          min="0"
          max={sliderMax}
          step={Math.max(1, Math.round(sliderMax / 80))}
          value={extraPaymentDollars}
          onChange={(e) => setExtraPaymentDollars(parseInt(e.target.value) || 0)}
          className="w-full accent-sky-500 cursor-pointer h-2 bg-slate-200 rounded-lg"
        />

        <div className="flex justify-between text-[10px] sm:text-[11px] text-slate-500 font-mono font-medium">
          <span>Minimums only</span>
          <span className="hidden sm:inline">+{formatMoney(toMinor(Math.round(sliderMax / 4)))}/mo</span>
          <span className="hidden sm:inline">+{formatMoney(toMinor(Math.round(sliderMax / 2)))}/mo</span>
          <span className="font-bold text-sky-700">+{formatMoney(toMinor(sliderMax))}/mo</span>
        </div>

        {/* Interactive Amortization Trajectory Chart */}
        <div className="pt-4 border-t border-slate-100">
          {debts.length > 0 ? (
            <>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-[#0F172A]">Total debt over time</h3>
                {interestSavedCents > 0 && (
                  <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">Avalanche saves {formatMoney(interestSavedCents)} vs Snowball</span>
                )}
              </div>
              <PlannerChart
                ariaLabel="Total debt by month for each strategy"
                xLabels={((extraPaymentCents > 0 ? minimumOnly : snowballSchedule).balanceByMonth ?? []).map((_, i) => `M${i}`)}
                series={[
                  { label: `Avalanche (${avalancheSchedule.totalMonths} mo)`, color: '#0EA5E9', values: avalancheSchedule.balanceByMonth ?? [] },
                  { label: `Snowball (${snowballSchedule.totalMonths} mo)`, color: '#94A3B8', dashed: true, values: snowballSchedule.balanceByMonth ?? [] },
                  ...(extraPaymentCents > 0 ? [{ label: `Minimums only (${minimumOnly.totalMonths} mo)`, color: '#F43F5E', dashed: true, values: minimumOnly.balanceByMonth ?? [] }] : []),
                ]}
              />
            </>
          ) : (
            <p className="text-xs text-slate-500">Add a debt to see its payoff curve.</p>
          )}
        </div>
      </div>

      {/* Liabilities list (edit / delete) */}
      <div className="keel-card p-6 sm:p-7">
        <h2 className="text-sm font-bold text-[#0F172A] mb-3">Your Liabilities</h2>
        {debts.length === 0 ? (
          <p className="text-xs text-slate-500 font-medium">No debts recorded. Add one, or take a loan from the Loans tab, to compare payoff strategies.</p>
        ) : (
          <ul className="wp-stagger divide-y divide-slate-100">
            {debts.map((d) => (
              <li key={d.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-bold text-[#0F172A]">{d.name}</p>
                  <p className="text-[11px] text-slate-500 font-medium">{CATEGORY_LABEL[d.category] ?? d.category} · due day {d.dueDateDay}</p>
                </div>
                <div className="flex items-center gap-4 font-medium text-slate-600">
                  <span>
                    Balance <span className="font-money font-bold text-rose-700">{formatMoney(d.balanceCents)}</span>
                  </span>
                  <span>APR <span className="font-mono font-bold text-slate-900">{d.aprPercent}%</span></span>
                  <span>
                    Min <span className="font-money font-bold text-slate-900">{formatMoney(d.minimumPaymentCents)}</span>
                  </span>
                  <RowActions label={d.name} onEdit={() => openEdit(d)} onDelete={() => deleteDebt(d.id)} />
                </div>
              </li>
            ))}
          </ul>
        )}
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
              {badge('snowball') && (
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-mono font-bold border border-emerald-300">{badge('snowball')}</span>
              )}
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
            Pays the smallest balance first: you clear whole debts sooner, which keeps many people motivated.
          </p>
        </div>

        {/* Strategy 2: Avalanche */}
        <div className={`keel-card p-6 sm:p-7 space-y-5 h-full flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-xl transition-all duration-300 ${cheaper === 'avalanche' ? 'border-emerald-200/80 ring-1 ring-emerald-200/50' : ''}`}>
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">Avalanche Strategy</h3>
                <p className="text-[11px] text-slate-500 font-medium">Prioritizes highest APR first</p>
              </div>
              {badge('avalanche') && (
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-mono font-bold border border-emerald-300">{badge('avalanche')}</span>
              )}
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
              {interestSavedCents > 0 ? <>Saves <strong className="font-money font-bold text-emerald-800">{formatMoney(interestSavedCents)}</strong> in interest compared to Snowball.</> : 'Both strategies cost the same interest for these debts.'}
            </span>
          </div>
        </div>
      </div>

      {/* Add Debt Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-md">
          <div className="max-w-md w-full bg-white/95 backdrop-blur-2xl p-7 sm:p-8 rounded-3xl border border-white/90 shadow-2xl animate-in zoom-in-95 text-xs">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-5">
              <h3 className="text-base font-bold text-[#0F172A]">{editingId ? 'Edit debt' : 'Add debt'}</h3>
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
                  <label className="block text-slate-700 font-semibold mb-1">Remaining Balance ({displaySymbol()})</label>
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

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="debt-cat" className="block text-slate-700 font-semibold mb-1">Type</label>
                  <select id="debt-cat" value={category} onChange={(e) => setCategory(e.target.value as DebtAccount['category'])} className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/20">
                    {Object.entries(CATEGORY_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="debt-due" className="block text-slate-700 font-semibold mb-1">Due day of month</label>
                  <input id="debt-due" type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-money font-bold focus:outline-none focus:ring-2 focus:ring-sky-500/20" required />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Monthly Minimum Payment ({displaySymbol()})</label>
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
                  {editingId ? 'Save changes' : 'Add debt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
