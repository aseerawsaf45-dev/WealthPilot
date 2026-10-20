'use client';

import React, { useMemo, useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useInsights } from '../context/useInsights';
import { calculateNetWorth } from '../services/financeService';
import { formatMoney } from '../lib/money';
import { currencyName } from '../lib/currency';
import { monthLabel } from '../lib/dates';
import { convertMinor } from '../lib/fx';
import { emitUi } from '../lib/uiBus';
import { CashFlowRhythmChart } from './InteractiveCharts';
import { PageInsights } from './PageInsights';
import { NearbyOffers } from './NearbyOffers';
import { VERDICT_STYLE } from './GoalPlanDialog';
import { AnimatedNumber } from './motion/AnimatedNumber';
import {
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  PiggyBank,
  Calendar,
  Plus,
  FileSpreadsheet,
  Receipt,
  UtensilsCrossed,
  CarFront,
  ShoppingBag,
  HeartPulse,
  Home,
  Zap,
  Tag,
  CheckCircle2,
  ArrowRight,
  Target,
  RefreshCw,
  GraduationCap,
  Flame,
  LineChart,
  AlertTriangle,
  Globe,
} from 'lucide-react';

interface OverviewTabProps {
  setActiveTab: (tab: string) => void;
  openAddTxModal: () => void;
}

const FREQ_LABEL = { weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', annual: 'Yearly' } as const;

function categoryIcon(category: string): React.ElementType {
  const c = category.toLowerCase();
  if (/(groc|din|food|restaurant|cafe|coffee)/.test(c)) return UtensilsCrossed;
  if (/(transport|auto|gas|fuel|travel|uber|commute|car)/.test(c)) return CarFront;
  if (/(shop|cloth|amazon|retail)/.test(c)) return ShoppingBag;
  if (/(health|medical|pharm|well|gym)/.test(c)) return HeartPulse;
  if (/(rent|hous|mortgage|home)/.test(c)) return Home;
  if (/(util|electric|water|internet|phone)/.test(c)) return Zap;
  if (/(sub|bill|stream|cloud)/.test(c)) return Receipt;
  return Tag;
}

const BAR_COLORS = ['bg-sky-500', 'bg-amber-500', 'bg-indigo-500', 'bg-emerald-500', 'bg-rose-400'];

/** "+12.5%" pill; `goodWhenUp` decides the colour. */
function Delta({ pct, goodWhenUp, suffix = 'vs last month' }: { pct: number | null; goodWhenUp: boolean; suffix?: string }) {
  if (pct === null) return <span className="text-[11px] text-slate-500 font-medium">No data for last month yet</span>;
  const up = pct >= 0;
  const good = up === goodWhenUp;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
      <span className={`inline-flex items-center gap-1 font-bold px-1.5 py-0.5 rounded ${good ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'}`}>
        <Icon className="w-3 h-3" />
        {up ? '+' : ''}
        {pct}%
      </span>
      <span>{suffix}</span>
    </span>
  );
}

export function OverviewTab({ setActiveTab, openAddTxModal }: OverviewTabProps) {
  const { accounts, transactions, goals, bills, preferences, fx } = useFinance();
  const report = useInsights();
  const [selectedChartDate, setSelectedChartDate] = useState<string | null>(null);
  const currency = preferences.baseCurrency || 'USD';
  const money = (c: number) => formatMoney(c, currency);
  const displayName = preferences?.userName?.trim() || 'there';

  const nw = useMemo(() => calculateNetWorth(accounts, { base: currency, fx }), [accounts, currency, fx]);
  const { month, pace, forecast, goalEtas, averages } = report;
  const cur = month.current;
  const savingsRate = cur.incomeCents > 0 ? Math.round((cur.netCents * 100) / cur.incomeCents) : null;
  const topCats = cur.byCategory.slice(0, 5);
  const catTotal = Math.max(1, cur.expenseCents);

  // Bills in the next 30 days (converted amounts are already in the base currency).
  const upcoming = [...bills].filter((b) => b.status !== 'paused').sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));
  const in30 = (() => {
    const d = new Date(`${report.today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 30);
    return d.toISOString().slice(0, 10);
  })();
  const dueSoonCents = upcoming.filter((b) => b.nextDueDate <= in30).reduce((s, b) => s + b.amountCents, 0);
  const liquidCents = accounts
    .filter((a) => ['checking', 'savings', 'cash'].includes(a.type) && a.balanceCents > 0)
    .reduce((s, a) => s + (convertMinor(a.balanceCents, a.currency, currency, fx) ?? 0), 0);
  const notAutoPaid = upcoming.filter((b) => !b.isAutoPay && b.nextDueDate <= in30).length;

  const learn = preferences.learn;
  const p30 = forecast.points[0];

  return (
    <div className="space-y-8 sm:space-y-10 pb-24 max-w-7xl mx-auto">
      {/* Greeting */}
      <section className="pt-2">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-2">
          <div>
            <h1 className="wp-title-reveal text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#0F172A]">Hello {displayName}</h1>
            <p className="text-base sm:text-lg text-slate-600 font-medium mt-1">Here&apos;s your money at a glance.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setActiveTab('settings')}
              title="Change your main currency in Settings"
              className="glass-segmented inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-bold text-slate-700 cursor-pointer hover:text-slate-950 transition-colors"
            >
              <Globe className="w-3.5 h-3.5 text-sky-600" />
              <span className="font-mono">{currency}</span>
              <span className="hidden sm:inline text-slate-500 font-medium">{currencyName(currency)}</span>
            </button>
            <button onClick={openAddTxModal} className="btn-primary-anim btn-shimmer inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-white font-bold text-xs cursor-pointer shadow-md">
              <Plus className="w-4 h-4 text-sky-400" />
              <span>Record Transaction</span>
            </button>
            <button onClick={() => setActiveTab('import')} className="btn-glass-anim inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold text-slate-800 cursor-pointer shadow-xs">
              <FileSpreadsheet className="w-4 h-4 text-sky-600" />
              <span>Import or scan</span>
            </button>
          </div>
        </div>
      </section>

      <PageInsights segment="overview" />

      {/* This month */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] tracking-tight">This month</h2>
            <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">{monthLabel(report.today)}</span>
          </div>
          <span className="text-xs text-slate-500 font-medium hidden sm:inline-block">{month.elapsedPct}% of the month gone · compared with the same days last month</span>
        </div>

        <div className="wp-stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <div className="keel-card wp-lift p-5 sm:p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Net worth</span>
              <div className="w-7 h-7 rounded-full bg-sky-50 flex items-center justify-center text-sky-600 border border-sky-100">
                <Wallet className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <AnimatedNumber value={nw.netWorthCents} format={money} className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] font-money block mb-1" />
              <span className="text-[11px] text-slate-500 font-medium">
                {nw.converted ? 'Includes other currencies at today’s rate (estimate)' : `Across ${accounts.filter((a) => a.isIncludedInNetWorth).length} accounts`}
                {nw.missingCurrencies.length > 0 && ` · ${nw.missingCurrencies.join(', ')} not included (no rate)`}
              </span>
            </div>
          </div>

          <div className="keel-card wp-lift p-5 sm:p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Income</span>
              <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
                <ArrowDownLeft className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <AnimatedNumber value={cur.incomeCents} format={money} className="text-3xl sm:text-4xl font-extrabold text-emerald-700 font-money block mb-1" />
              <Delta pct={month.incomeChangePct} goodWhenUp />
            </div>
          </div>

          <div className="keel-card wp-lift p-5 sm:p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Spent</span>
              <div className="w-7 h-7 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 border border-rose-100">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <AnimatedNumber value={cur.expenseCents} format={money} className="text-3xl sm:text-4xl font-extrabold text-rose-700 font-money block mb-1" />
              {pace.allocatedCents > 0 ? (
                <span className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                  <span className={`inline-flex font-bold px-1.5 py-0.5 rounded ${pace.status === 'over' ? 'bg-rose-50 text-rose-700' : pace.status === 'under' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{pace.usedPct}% of budgets</span>
                  <span>{pace.status === 'over' ? 'ahead of pace' : pace.status === 'under' ? 'under pace' : 'on pace'}</span>
                </span>
              ) : (
                <Delta pct={month.expenseChangePct} goodWhenUp={false} />
              )}
            </div>
          </div>

          <div className="keel-card wp-lift p-5 sm:p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Saved</span>
              <div className="w-7 h-7 rounded-full bg-sky-50 flex items-center justify-center text-sky-600 border border-sky-100">
                <PiggyBank className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <AnimatedNumber value={cur.netCents} format={money} className={`text-3xl sm:text-4xl font-extrabold font-money block mb-1 ${cur.netCents >= 0 ? 'text-sky-800' : 'text-rose-700'}`} />
              <span className="text-[11px] text-slate-500 font-medium">
                {savingsRate === null ? 'No income recorded this month yet' : `${savingsRate}% of income kept`}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Cash flow + where it went */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-between">
          <div className="mb-3">
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] tracking-tight">Your cash flow</h2>
              <span className="text-xs font-medium text-slate-500">Last 14 days</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 font-medium">Money in vs. money out, day by day. Tap a day to see it.</p>
          </div>
          <div className="flex-1 flex flex-col justify-between">
            <CashFlowRhythmChart transactions={transactions} selectedDate={selectedChartDate} onSelectDate={setSelectedChartDate} currency={currency} />
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/80">
                <span className="text-[10px] uppercase font-bold text-emerald-800 block">In this month</span>
                <span className="text-lg font-extrabold text-emerald-800 font-money block mt-0.5">+{money(cur.incomeCents)}</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-rose-50/80 border border-rose-200/80">
                <span className="text-[10px] uppercase font-bold text-rose-800 block">Out this month</span>
                <span className="text-lg font-extrabold text-rose-800 font-money block mt-0.5">-{money(cur.expenseCents)}</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-sky-50/80 border border-sky-200/80">
                <span className="text-[10px] uppercase font-bold text-sky-800 block">Average month</span>
                <span className="text-lg font-extrabold text-sky-900 font-money block mt-0.5">{averages.monthsUsed ? money(averages.incomeCents - averages.expenseCents) : '—'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 keel-card p-6 sm:p-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] tracking-tight">Where your money went</h2>
              <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full border border-slate-200">{monthLabel(report.today)}</span>
            </div>
            <p className="text-xs text-slate-600 font-medium mb-5">Your top spending categories this month.</p>
            {topCats.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center">
                <p className="text-xs font-semibold text-slate-600">No spending recorded this month yet.</p>
                <button onClick={openAddTxModal} className="btn-anim mt-3 text-xs font-bold text-sky-700 hover:text-sky-900 cursor-pointer">
                  Record a transaction →
                </button>
              </div>
            ) : (
              <div className="wp-stagger space-y-3">
                {topCats.map((c, i) => {
                  const Icon = categoryIcon(c.category);
                  const share = Math.round((c.cents * 100) / catTotal);
                  const before = month.previousToDate.byCategory.find((p) => p.category === c.category)?.cents ?? 0;
                  return (
                    <button
                      key={c.category}
                      onClick={() => emitUi({ type: 'filter-transactions', query: c.category })}
                      className="w-full text-left p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/70 hover:bg-white hover:shadow-xs transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-xs font-bold text-[#0F172A] truncate">{c.category}</h3>
                            <p className="text-[10px] text-slate-500 font-medium">
                              {c.count} transaction{c.count === 1 ? '' : 's'}
                              {before > 0 && c.cents !== before && ` ·${c.cents >= before ? '+' : '−'}${money(Math.abs(c.cents - before))} vs last month`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-extrabold text-slate-900 font-money block">{money(c.cents)}</span>
                          <span className="text-[10px] font-mono font-semibold text-slate-500">{share}%</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden">
                        <div className={`wp-bar ${BAR_COLORS[i % BAR_COLORS.length]} h-full rounded-full`} style={{ width: `${Math.max(3, share)}%` }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="mt-5 pt-4 border-t border-slate-200/60">
            <button onClick={() => setActiveTab('transactions')} className="w-full btn-glass-anim py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-sky-800 hover:text-sky-950 cursor-pointer shadow-xs">
              <span>View all spending</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Forecast */}
      <section className="keel-card p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-sky-500/10 blur-3xl pointer-events-none rounded-full" />
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <LineChart className="w-5 h-5 text-sky-600" />
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] tracking-tight">Cash forecast</h2>
            <span className="text-[10px] font-mono font-bold bg-sky-50 text-sky-800 px-2 py-0.5 rounded-full border border-sky-200">Estimate</span>
          </div>
          {report.runwayMonths !== null && (
            <span className="text-xs font-semibold text-slate-600">
              Cash covers <strong className="text-slate-900">{report.runwayMonths} months</strong> of average spending
            </span>
          )}
        </div>
        {forecast.minDataMet ? (
          <>
            {forecast.shortfallDate && (
              <p className="mb-4 inline-flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-bold text-rose-800">
                <AlertTriangle className="w-4 h-4" /> At the usual pace, checking + savings may dip below zero around {forecast.shortfallDate}.
              </p>
            )}
            <div className="wp-stagger grid grid-cols-1 sm:grid-cols-3 gap-4">
              {forecast.points.map((p) => {
                const span = Math.max(1, p.highCents - p.lowCents);
                const pos = Math.min(100, Math.max(0, ((p.expectedCents - p.lowCents) * 100) / span));
                return (
                  <div key={p.days} className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">In {p.days} days · {p.date}</span>
                    <span className={`text-xl font-extrabold font-money block mt-1 ${p.expectedCents < 0 ? 'text-rose-700' : 'text-[#0F172A]'}`}>{money(p.expectedCents)}</span>
                    <div className="relative mt-3 h-2 rounded-full bg-gradient-to-r from-rose-200 via-sky-200 to-emerald-200" aria-hidden>
                      <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-sky-600 shadow" style={{ left: `${pos}%` }} />
                    </div>
                    <div className="mt-1.5 flex justify-between text-[10px] font-semibold text-slate-500">
                      <span>{money(p.lowCents)}</span>
                      <span>{money(p.highCents)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-[11px] text-slate-500 font-medium" title={forecast.assumptions.join(' ')}>
              {p30 && `Next 30 days: ${money(p30.incomeCents)} expected in, ${money(p30.billsCents)} bills and recurring payments, about ${money(p30.everydayCents)} everyday spending. `}
              {forecast.method}
            </p>
          </>
        ) : (
          <p className="text-xs text-slate-600 font-medium">
            A forecast needs about 60 days of transactions (you have {forecast.historyDays}). Import a bank statement to get one now.
            <button onClick={() => setActiveTab('import')} className="btn-anim ml-2 font-bold text-sky-700 hover:text-sky-900 cursor-pointer">
              Import →
            </button>
          </p>
        )}
      </section>

      {/* Coming up + goals */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-6 keel-card p-6 sm:p-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-sky-600" />
                <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] tracking-tight">Coming up</h2>
              </div>
              <button onClick={() => setActiveTab('bills')} className="text-xs text-sky-700 hover:text-sky-900 font-bold flex items-center gap-1 cursor-pointer btn-anim px-3 py-1 rounded-full hover:bg-sky-50 transition-all">
                <span>Manage Bills</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-slate-600 font-medium mb-5">Bills and recurring payments, soonest first.</p>
            {upcoming.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-xs font-semibold text-slate-600">No bills yet. Recurring payments the app detects will be suggested above.</p>
            ) : (
              <div className="wp-stagger space-y-3">
                {upcoming.slice(0, 4).map((bill) => (
                  <div key={bill.id} className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 flex items-center justify-between hover:bg-white hover:shadow-xs transition-all">
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-[#0F172A] truncate">{bill.name}</p>
                        <span className="hidden sm:inline-block text-[9px] font-mono px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700 font-semibold">{bill.category}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 font-medium">
                        <span>Due {bill.nextDueDate}</span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 text-slate-600">
                          <RefreshCw className="w-2.5 h-2.5 text-sky-600" />
                          {FREQ_LABEL[bill.frequency]}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-money font-bold text-rose-700">-{money(bill.amountCents)}</p>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full border mt-1 inline-block ${
                          bill.status === 'overdue' ? 'bg-rose-50 text-rose-700 border-rose-300' : bill.status === 'due_soon' ? 'bg-amber-50 text-amber-800 border-amber-300' : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        {bill.status === 'overdue' ? 'Overdue' : bill.status === 'due_soon' ? 'Due soon' : bill.isAutoPay ? 'Auto-pay' : 'Pay manually'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-5 pt-4 border-t border-slate-200/60 text-xs text-slate-600 font-semibold flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5">
              {dueSoonCents <= liquidCents ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
              <span>
                {money(dueSoonCents)} due in 30 days{dueSoonCents > liquidCents ? ` — more than your ${money(liquidCents)} cash` : ''}
                {notAutoPaid ? ` · ${notAutoPaid} to pay by hand` : ''}
              </span>
            </span>
            <span className="font-mono text-slate-800 font-bold shrink-0">{upcoming.length} total</span>
          </div>
        </div>

        <div className="lg:col-span-6 keel-card p-6 sm:p-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-emerald-600" />
                <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] tracking-tight">Your goals</h2>
              </div>
              <button onClick={() => setActiveTab('goals')} className="text-xs text-sky-700 hover:text-sky-900 font-bold flex items-center gap-1 cursor-pointer btn-anim px-3 py-1 rounded-full hover:bg-sky-50 transition-all">
                <span>All Goals</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-slate-600 font-medium mb-5">Progress and when each goal is likely done at your current pace.</p>
            {goals.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-xs font-semibold text-slate-600">No goals yet. Ask the assistant: “I want to save for a trip by June”.</p>
            ) : (
              <div className="wp-stagger space-y-3.5">
                {goals.slice(0, 3).map((goal) => {
                  const percent = goal.targetCents ? Math.min(100, Math.round((goal.currentCents * 100) / goal.targetCents)) : 0;
                  const eta = goalEtas.find((e) => e.id === goal.id || e.name === goal.name);
                  const verdict = goal.plan?.verdict;
                  return (
                    <div key={goal.id} className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 hover:bg-white hover:shadow-xs transition-all">
                      <div className="flex items-center justify-between mb-1.5 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold text-[#0F172A] truncate">{goal.name}</span>
                          <span className="text-[10px] font-mono font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">{percent}%</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-extrabold text-slate-900 font-money">{money(goal.currentCents)}</span>
                          <span className="text-[10px] text-slate-500 font-semibold ml-1">/ {money(goal.targetCents)}</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden my-2">
                        <div className="wp-bar bg-emerald-500 h-full rounded-full" style={{ width: `${percent}%` }} />
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[11px] pt-1">
                        <span className="text-slate-600 font-medium truncate">
                          {goal.isPaused
                            ? 'Paused'
                            : percent >= 100
                              ? 'Reached 🎉'
                              : eta && !eta.enoughHistory
                                ? 'Not enough history yet for an estimate'
                                : eta?.eta.earliestDate && eta.eta.latestDate
                                ? `Likely done ${eta.eta.earliestDate.slice(0, 7)} – ${eta.eta.latestDate.slice(0, 7)}`
                                : eta && eta.eta.months === null
                                  ? 'No saving room at the moment'
                                  : goal.targetDate
                                    ? `Target ${goal.targetDate}`
                                    : 'No deadline'}
                        </span>
                        {verdict ? (
                          <span className={`shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-bold ${VERDICT_STYLE[verdict].pill}`}>{VERDICT_STYLE[verdict].label}</span>
                        ) : eta?.onPace !== null && eta?.onPace !== undefined ? (
                          <span className={`shrink-0 font-semibold font-mono text-[10px] ${eta.onPace ? 'text-emerald-700' : 'text-amber-700'}`}>{eta.onPace ? 'On pace' : 'Behind'}</span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {goals.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-200/60 text-xs text-slate-600 font-semibold flex items-center justify-between">
              <span>Overall progress</span>
              <span className="font-mono text-emerald-700 font-bold">
                {Math.round((goals.reduce((s, g) => s + g.currentCents, 0) * 100) / Math.max(1, goals.reduce((s, g) => s + g.targetCents, 0)))}% funded
              </span>
            </div>
          )}
        </div>
      </section>

      <NearbyOffers />

      {/* Learn */}
      <section className="keel-card p-6 sm:p-8 bg-gradient-to-br from-amber-500/[0.06] via-white to-sky-500/[0.05] border border-amber-200/80 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 flex-shrink-0">
            <Flame className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wider bg-amber-100/80 px-2.5 py-0.5 rounded-full">FinanceGuru</span>
              <span className="text-[10px] font-mono font-bold bg-sky-50 text-sky-800 px-2 py-0.5 rounded-full border border-sky-200">
                {learn ? `${learn.xp} XP · ${learn.streak}-day streak · ${learn.completed.length} done` : 'Start your first module'}
              </span>
            </div>
            <h3 className="text-xl font-extrabold text-[#0F172A] tracking-tight">Short lessons with quizzes, matched to your money</h3>
            <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1 max-w-2xl leading-relaxed">
              Emergency funds, paying off debt, compound growth: a few minutes each, with a recommendation based on your own numbers.
            </p>
          </div>
        </div>
        <button onClick={() => setActiveTab('learn')} className="btn-primary-anim bg-[#0F172A] hover:bg-black text-white px-6 py-3 rounded-full text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-lg shrink-0">
          <GraduationCap className="w-4 h-4 text-sky-400" />
          <span>Open FinanceGuru</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </section>
    </div>
  );
}
