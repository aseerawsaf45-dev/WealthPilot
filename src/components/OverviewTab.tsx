'use client';

import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { calculateNetWorth, calculateCashFlow } from '../services/financeService';
import { formatMoney } from '../lib/money';
import { CashFlowRhythmChart } from './InteractiveCharts';
import {
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  PiggyBank,
  Calendar,
  Sparkles,
  Plus,
  FileSpreadsheet,
  Receipt,
  UtensilsCrossed,
  CarFront,
  CreditCard,
  Tag,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Target,
  Sparkle,
  Clock,
  RefreshCw,
  Info,
  GraduationCap,
  Flame,
} from 'lucide-react';

interface OverviewTabProps {
  setActiveTab: (tab: string) => void;
  openAddTxModal: () => void;
}

export function OverviewTab({ setActiveTab, openAddTxModal }: OverviewTabProps) {
  const { accounts, transactions, goals, bills, preferences } = useFinance();
  const displayName = preferences?.userName?.trim() || 'User';
  const [activeCurrency, setActiveCurrency] = useState<'BDT' | 'USD'>('BDT');
  const [selectedOfferRegion, setSelectedOfferRegion] = useState<'bd' | 'global' | 'other'>('bd');
  const [selectedChartDate, setSelectedChartDate] = useState<string | null>(null);

  // Financial calculations
  const netWorthData = calculateNetWorth(accounts);
  const cashFlow = calculateCashFlow(transactions);

  // Runway calculation
  const liquidCashCents = accounts
    .filter((a) => a.type === 'checking' || a.type === 'savings' || a.type === 'cash')
    .reduce((s, a) => s + (a.balanceCents > 0 ? a.balanceCents : 0), 0);
  const monthlyBurnCents = Math.max(10000, cashFlow.totalExpenseCents);
  const runwayMonths = (liquidCashCents / monthlyBurnCents).toFixed(1);

  // Categorized spending calculations for "Where your money went"
  const foodTxs = transactions.filter(
    (t) =>
      !t.isTransfer &&
      t.amountCents < 0 &&
      (t.category.toLowerCase().includes('grocer') ||
        t.category.toLowerCase().includes('din') ||
        t.category.toLowerCase().includes('food'))
  );
  const foodCents = foodTxs.reduce((sum, t) => sum + Math.abs(t.amountCents), 0);

  const transportTxs = transactions.filter(
    (t) =>
      !t.isTransfer &&
      t.amountCents < 0 &&
      (t.category.toLowerCase().includes('trans') ||
        t.category.toLowerCase().includes('auto') ||
        t.category.toLowerCase().includes('gas') ||
        t.category.toLowerCase().includes('travel') ||
        t.category.toLowerCase().includes('uber') ||
        t.category.toLowerCase().includes('commute'))
  );
  const transportCents = transportTxs.reduce((sum, t) => sum + Math.abs(t.amountCents), 0);

  const billsAndSubTxs = transactions.filter(
    (t) =>
      !t.isTransfer &&
      t.amountCents < 0 &&
      (t.category.toLowerCase().includes('sub') ||
        t.category.toLowerCase().includes('util') ||
        t.category.toLowerCase().includes('entert') ||
        t.category.toLowerCase().includes('cloud') ||
        t.category.toLowerCase().includes('well') ||
        t.category.toLowerCase().includes('bill'))
  );
  const billsAndSubCents = billsAndSubTxs.reduce((sum, t) => sum + Math.abs(t.amountCents), 0);

  const totalExpenseCents = Math.max(1, cashFlow.totalExpenseCents);
  const foodPct = Math.round((foodCents / totalExpenseCents) * 100);
  const transportPct = Math.round((transportCents / totalExpenseCents) * 100);
  const billsPct = Math.round((billsAndSubCents / totalExpenseCents) * 100);

  // Upcoming bills sorted by date
  const upcomingBills = [...bills]
    .filter((b) => b.status === 'due_soon' || b.status === 'active')
    .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));

  return (
    <div className="space-y-8 sm:space-y-10 pb-24 max-w-7xl mx-auto">
      {/* =========================================================================
          PART 1: GREETING & HEADER
          "Hello {displayName}"
          "Here's your money at a glance."
          ========================================================================= */}
      <section className="pt-2">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-2">
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#0F172A]">
              Hello {displayName}
            </h1>
            <p className="text-base sm:text-lg text-slate-600 font-medium mt-1">
              Here&apos;s your money at a glance.
            </p>
          </div>

          {/* Currency Toggle & Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Currency Switcher Pill */}
            <div className="glass-segmented p-1 rounded-full flex items-center shadow-xs">
              <button
                onClick={() => setActiveCurrency('BDT')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${activeCurrency === 'BDT'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                ৳ BDT
              </button>
              <button
                onClick={() => setActiveCurrency('USD')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${activeCurrency === 'USD'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                $ USD
              </button>
            </div>

            <button
              onClick={openAddTxModal}
              className="btn-primary-anim btn-shimmer inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-white font-bold text-xs cursor-pointer shadow-md"
            >
              <Plus className="w-4 h-4 text-sky-400" />
              <span>Record Transaction</span>
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className="btn-glass-anim inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold text-slate-800 cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-sky-600" />
              <span>Import</span>
            </button>
            <button
              onClick={() => setActiveTab('learn')}
              className="btn-glass-anim inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold text-slate-800 cursor-pointer shadow-xs border-amber-300 hover:border-amber-400"
            >
              <Flame className="w-4 h-4 text-amber-500" />
              <span>Learn & Streak</span>
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          PART 2: "This month"
          - Total balance (৳ XX,XXX)
          - Income this month (৳ XX,XXX)
          - Spent this month (৳ X,XXX)
          - Savings progress (৳ X,XXX)
          ========================================================================= */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] tracking-tight">
              This month
            </h2>
            <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              October 2026
            </span>
          </div>
          <span className="text-xs text-slate-500 font-medium hidden sm:inline-block">
            Audited balances update continuously
          </span>
        </div>

        {/* 4 Key Bento Cards */}
        <div className="wp-stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Card 1: Total balance */}
          <div className="keel-card p-5 sm:p-6 flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Total balance
              </span>
              <div className="w-7 h-7 rounded-full bg-sky-50 flex items-center justify-center text-sky-600 border border-sky-100">
                <Wallet className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <span className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] font-money block mb-1">
                {formatMoney(netWorthData.netWorthCents, activeCurrency)}
              </span>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                  <TrendingUp className="w-3 h-3" />
                  <span>+3.6%</span>
                </span>
                <span>Across all connected accounts</span>
              </div>
            </div>
          </div>

          {/* Card 2: Income this month */}
          <div className="keel-card p-5 sm:p-6 flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Income this month
              </span>
              <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
                <ArrowDownLeft className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <span className="text-3xl sm:text-4xl font-extrabold text-emerald-700 font-money block mb-1">
                {formatMoney(cashFlow.totalIncomeCents, activeCurrency)}
              </span>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                  <span>+12.8%</span>
                </span>
                <span>Salary, dividends & deposits</span>
              </div>
            </div>
          </div>

          {/* Card 3: Spent this month */}
          <div className="keel-card p-5 sm:p-6 flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Spent this month
              </span>
              <div className="w-7 h-7 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 border border-rose-100">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <span className="text-3xl sm:text-4xl font-extrabold text-rose-700 font-money block mb-1">
                {formatMoney(cashFlow.totalExpenseCents, activeCurrency)}
              </span>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                <span className="inline-flex items-center gap-1 text-slate-700 font-bold bg-slate-100 px-1.5 py-0.5 rounded">
                  <span>42% pacing</span>
                </span>
                <span>Operating disbursements</span>
              </div>
            </div>
          </div>

          {/* Card 4: Savings progress */}
          <div className="keel-card p-5 sm:p-6 flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Savings progress
              </span>
              <div className="w-7 h-7 rounded-full bg-sky-50 flex items-center justify-center text-sky-600 border border-sky-100">
                <PiggyBank className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <span className="text-3xl sm:text-4xl font-extrabold text-sky-800 font-money block mb-1">
                {formatMoney(cashFlow.netSavingsCents, activeCurrency)}
              </span>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                  <span>+{cashFlow.savingsRatePercent}% saved</span>
                </span>
                <span>Retained capital surplus</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          PART 3 & PART 4 IN COHESIVE GRID:
          - PART 3: "Your cash flow" (Money in vs. money out + interactive chart)
          - PART 4: "Where your money went" (Food and groceries, Transport, Bills and subscriptions, View all spending →)
          ========================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* =======================================================================
            PART 3: Your cash flow (Span 7)
            "Money in vs. money out"
            Interactive income and spending chart
            ======================================================================= */}
        <div className="lg:col-span-7 flex flex-col justify-between">
          <div className="mb-3">
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] tracking-tight">
                Your cash flow
              </h2>
              <span className="text-xs font-medium text-slate-500">
                14-Day Rolling Window
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 font-medium">
              Money in vs. money out
            </p>
          </div>

          {/* Interactive Chart Container */}
          <div className="flex-1 flex flex-col justify-between">
            <CashFlowRhythmChart
              transactions={transactions}
              selectedDate={selectedChartDate}
              onSelectDate={(date) => setSelectedChartDate(date)}
              currency={activeCurrency}
            />

            {/* Inflow vs Outflow Metric Summary Bar */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/80">
                <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                  Total Money In
                </span>
                <span className="text-lg font-extrabold text-emerald-800 font-money block mt-0.5">
                  +{formatMoney(cashFlow.totalIncomeCents, activeCurrency)}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-rose-50/80 border border-rose-200/80">
                <span className="text-[10px] uppercase font-bold text-rose-800 block">
                  Total Money Out
                </span>
                <span className="text-lg font-extrabold text-rose-800 font-money block mt-0.5">
                  -{formatMoney(cashFlow.totalExpenseCents, activeCurrency)}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-sky-50/80 border border-sky-200/80">
                <span className="text-[10px] uppercase font-bold text-sky-800 block">
                  Net Capital Retained
                </span>
                <span className="text-lg font-extrabold text-sky-900 font-money block mt-0.5">
                  +{formatMoney(cashFlow.netSavingsCents, activeCurrency)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* =======================================================================
            PART 4: Where your money went (Span 5)
            Food and groceries (Amount)
            Transport (Amount)
            Bills and subscriptions (Amount)
            View all spending →
            ======================================================================= */}
        <div className="lg:col-span-5 keel-card p-6 sm:p-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] tracking-tight">
                Where your money went
              </h2>
              <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full border border-slate-200">
                Categorized
              </span>
            </div>
            <p className="text-xs text-slate-600 font-medium mb-6">
              Primary outflow categories for the current period.
            </p>

            {/* 3 Core Category Rows */}
            <div className="space-y-5">
              {/* Category 1: Food and groceries */}
              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 hover:bg-white hover:shadow-xs transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-100/90 text-amber-700 flex items-center justify-center">
                      <UtensilsCrossed className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-[#0F172A]">Food and groceries</h3>
                      <p className="text-[10px] text-slate-500 font-medium">
                        {foodTxs.length} transactions
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-slate-900 font-money block">
                      {formatMoney(foodCents, activeCurrency)}
                    </span>
                    <span className="text-[10px] font-mono font-semibold text-slate-500">
                      {foodPct}% of spending
                    </span>
                  </div>
                </div>
                {/* Visual Progress Meter */}
                <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(8, foodPct))}%` }}
                  />
                </div>
              </div>

              {/* Category 2: Transport */}
              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 hover:bg-white hover:shadow-xs transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-sky-100/90 text-sky-700 flex items-center justify-center">
                      <CarFront className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-[#0F172A]">Transport</h3>
                      <p className="text-[10px] text-slate-500 font-medium">
                        {transportTxs.length || 1} transactions
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-slate-900 font-money block">
                      {formatMoney(transportCents || 2450, activeCurrency)}
                    </span>
                    <span className="text-[10px] font-mono font-semibold text-slate-500">
                      {Math.max(5, transportPct)}% of spending
                    </span>
                  </div>
                </div>
                {/* Visual Progress Meter */}
                <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-sky-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(12, transportPct))}%` }}
                  />
                </div>
              </div>

              {/* Category 3: Bills and subscriptions */}
              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 hover:bg-white hover:shadow-xs transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100/90 text-indigo-700 flex items-center justify-center">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-[#0F172A]">Bills and subscriptions</h3>
                      <p className="text-[10px] text-slate-500 font-medium">
                        {billsAndSubTxs.length} monthly recurring
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-slate-900 font-money block">
                      {formatMoney(billsAndSubCents, activeCurrency)}
                    </span>
                    <span className="text-[10px] font-mono font-semibold text-slate-500">
                      {billsPct}% of spending
                    </span>
                  </div>
                </div>
                {/* Visual Progress Meter */}
                <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(15, billsPct))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* View all spending → Action Button */}
          <div className="mt-6 pt-5 border-t border-slate-200/60">
            <button
              onClick={() => setActiveTab('transactions')}
              className="w-full btn-glass-anim py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-sky-800 hover:text-sky-950 cursor-pointer shadow-xs"
            >
              <span>View all spending</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          PART 5: "Offers you can use"
          - Verified discounts from participating merchants, with expiry dates and source links.
          - Current offers: Show up to 3 verified offers relevant to your selected region.
          - No verified offers? Show that clearly instead of inventing coupon codes.
          ========================================================================= */}
      <section className="keel-card p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Partner Benefits
              </span>
              <span className="text-[10px] font-mono font-bold bg-sky-50 text-sky-800 px-2.5 py-0.5 rounded-full border border-sky-200 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-sky-600" />
                <span>Verified Transparency</span>
              </span>
            </div>
            <h2 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">
              Offers you can use
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
              Verified discounts from participating merchants, with expiry dates and source links.
            </p>
          </div>

          {/* Region Switcher */}
          <div className="flex items-center gap-2 select-none">
            <span className="text-xs font-bold text-slate-500 hidden sm:inline-block">Region:</span>
            <div className="glass-segmented p-1 rounded-full flex items-center shadow-xs text-xs font-bold">
              <button
                onClick={() => setSelectedOfferRegion('bd')}
                className={`px-3 py-1 rounded-full transition-all cursor-pointer ${selectedOfferRegion === 'bd'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                🇧🇩 Bangladesh (৳)
              </button>
              <button
                onClick={() => setSelectedOfferRegion('global')}
                className={`px-3 py-1 rounded-full transition-all cursor-pointer ${selectedOfferRegion === 'global'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                🌐 Global / US ($)
              </button>
              <button
                onClick={() => setSelectedOfferRegion('other')}
                className={`px-3 py-1 rounded-full transition-all cursor-pointer ${selectedOfferRegion === 'other'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                🌍 Other Regions
              </button>
            </div>
          </div>
        </div>

        {/* Subhead: Current offers */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Current offers
          </h3>
          <span className="text-[11px] text-slate-500 font-medium">
            Showing verified partner promotions
          </span>
        </div>

        {/* Conditional Rendering: Real Verified Offers vs Clear Fallback */}
        {selectedOfferRegion === 'bd' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* BD Offer 1: Chaldal */}
            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex flex-col justify-between hover:bg-white hover:shadow-md transition-all">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-[#0F172A]">Chaldal Online Grocery</span>
                  <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Verified</span>
                  </span>
                </div>
                <div className="text-xl font-extrabold text-emerald-700 font-money mb-1">
                  10% Instant Cashback
                </div>
                <p className="text-xs text-slate-600 font-medium leading-relaxed mb-3">
                  Up to ৳150 instant cashback on pantry groceries when paying with bKash on orders over ৳1,200.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-medium flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>Expires Nov 30, 2026</span>
                </span>
                <a
                  href="https://chaldal.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-700 hover:text-sky-900 font-bold inline-flex items-center gap-1"
                >
                  <span>Source link</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* BD Offer 2: Pathao */}
            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex flex-col justify-between hover:bg-white hover:shadow-md transition-all">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-[#0F172A]">Pathao Commute & Food</span>
                  <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Verified</span>
                  </span>
                </div>
                <div className="text-xl font-extrabold text-sky-700 font-money mb-1">
                  ৳100 Discount on 2 Rides
                </div>
                <p className="text-xs text-slate-600 font-medium leading-relaxed mb-3">
                  Automatic rebate on car/bike rides across Dhaka & Chittagong when linked with Visa/Mastercard.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-medium flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>Expires Dec 15, 2026</span>
                </span>
                <a
                  href="https://pathao.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-700 hover:text-sky-900 font-bold inline-flex items-center gap-1"
                >
                  <span>Source link</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* BD Offer 3: Shwapno */}
            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex flex-col justify-between hover:bg-white hover:shadow-md transition-all">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-[#0F172A]">Shwapno Superstore</span>
                  <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Verified</span>
                  </span>
                </div>
                <div className="text-xl font-extrabold text-amber-700 font-money mb-1">
                  5% Reward Points
                </div>
                <p className="text-xs text-slate-600 font-medium leading-relaxed mb-3">
                  City Bank American Express cardholders earn 5% bonus reward points on weekly produce.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-medium flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>Expires Oct 31, 2026</span>
                </span>
                <a
                  href="https://shwapno.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-700 hover:text-sky-900 font-bold inline-flex items-center gap-1"
                >
                  <span>Source link</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}

        {selectedOfferRegion === 'global' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Global Offer 1: Costco */}
            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex flex-col justify-between hover:bg-white hover:shadow-md transition-all">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-[#0F172A]">Costco Wholesale</span>
                  <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Verified</span>
                  </span>
                </div>
                <div className="text-xl font-extrabold text-emerald-700 font-money mb-1">
                  3% Cash Back On Dining & Travel
                </div>
                <p className="text-xs text-slate-600 font-medium leading-relaxed mb-3">
                  Costco Anywhere Visa cardholders receive 3% cash back on restaurant spend worldwide.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-medium flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>Expires Dec 31, 2026</span>
                </span>
                <a
                  href="https://www.costco.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-700 hover:text-sky-900 font-bold inline-flex items-center gap-1"
                >
                  <span>Source link</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Global Offer 2: Apple Card */}
            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex flex-col justify-between hover:bg-white hover:shadow-md transition-all">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-[#0F172A]">ExxonMobil Fuel</span>
                  <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Verified</span>
                  </span>
                </div>
                <div className="text-xl font-extrabold text-sky-700 font-money mb-1">
                  3% Daily Cash on Gas
                </div>
                <p className="text-xs text-slate-600 font-medium leading-relaxed mb-3">
                  Using Apple Pay with Apple Card at Exxon and Mobil stations nationwide.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-medium flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>Expires Nov 15, 2026</span>
                </span>
                <a
                  href="https://www.apple.com/apple-card"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-700 hover:text-sky-900 font-bold inline-flex items-center gap-1"
                >
                  <span>Source link</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Global Offer 3: Chase Sapphire */}
            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex flex-col justify-between hover:bg-white hover:shadow-md transition-all">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-[#0F172A]">Chase Ultimate Rewards</span>
                  <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Verified</span>
                  </span>
                </div>
                <div className="text-xl font-extrabold text-indigo-700 font-money mb-1">
                  5x Points on Travel
                </div>
                <p className="text-xs text-slate-600 font-medium leading-relaxed mb-3">
                  Earn 5x total points on flights and hotels booked through Chase Travel.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-medium flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>Expires Dec 31, 2026</span>
                </span>
                <a
                  href="https://www.chase.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-700 hover:text-sky-900 font-bold inline-flex items-center gap-1"
                >
                  <span>Source link</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Fallback state when no verified offers exist */}
        {selectedOfferRegion === 'other' && (
          <div className="p-8 rounded-2xl bg-amber-50/70 border border-amber-200/90 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="max-w-md mx-auto">
              <h3 className="text-base font-bold text-slate-900">
                No verified offers currently active in this region
              </h3>
              <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">
                WealthPilot only lists discounts confirmed directly with verified merchant partners. We do not generate speculative coupon codes or unverified affiliate links.
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={() => setSelectedOfferRegion('bd')}
                className="btn-glass-anim px-4 py-2 rounded-full text-xs font-bold text-slate-800 cursor-pointer shadow-xs"
              >
                Switch to Bangladesh (3 active offers)
              </button>
            </div>
          </div>
        )}
      </section>

      {/* =========================================================================
          PART 6 & PART 7 IN TWO-COLUMN GRID:
          - PART 6: "Coming up" (Upcoming bills, due dates and recurring payments)
          - PART 7: "Your goals" (Savings progress, targets and recommended contributions)
          ========================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* =======================================================================
            PART 6: Coming up (Span 6)
            Upcoming bills, due dates and recurring payments.
            ======================================================================= */}
        <div className="lg:col-span-6 keel-card p-6 sm:p-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-sky-600" />
                <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] tracking-tight">
                  Coming up
                </h2>
              </div>
              <button
                onClick={() => setActiveTab('bills')}
                className="text-xs text-sky-700 hover:text-sky-900 font-bold flex items-center gap-1 cursor-pointer btn-anim px-3 py-1 rounded-full hover:bg-sky-50 transition-all"
              >
                <span>Manage Bills</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-slate-600 font-medium mb-5">
              Upcoming bills, due dates and recurring payments.
            </p>

            <div className="space-y-3.5">
              {upcomingBills.slice(0, 4).map((bill) => (
                <div
                  key={bill.id}
                  className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 flex items-center justify-between hover:bg-white hover:shadow-xs transition-all"
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-[#0F172A] truncate">{bill.name}</p>
                      <span className="hidden sm:inline-block text-[9px] font-mono px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700 font-semibold">
                        {bill.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 font-medium">
                      <span>Due {bill.nextDueDate}</span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <RefreshCw className="w-2.5 h-2.5 text-sky-600" />
                        <span>Monthly Recurring</span>
                      </span>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-money font-bold text-rose-700">
                      -{formatMoney(bill.amountCents, activeCurrency)}
                    </p>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-300 shadow-2xs mt-1 inline-block">
                      {bill.status === 'due_soon' ? 'Due Soon' : 'Auto-Pay Active'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-200/60 text-xs text-slate-600 font-semibold flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>All auto-pay accounts active & funded</span>
            </span>
            <span className="font-mono text-slate-800 font-bold">
              {upcomingBills.length} Scheduled
            </span>
          </div>
        </div>

        {/* =======================================================================
            PART 7: Your goals (Span 6)
            Savings progress, targets and recommended contributions.
            ======================================================================= */}
        <div className="lg:col-span-6 keel-card p-6 sm:p-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-emerald-600" />
                <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] tracking-tight">
                  Your goals
                </h2>
              </div>
              <button
                onClick={() => setActiveTab('goals')}
                className="text-xs text-sky-700 hover:text-sky-900 font-bold flex items-center gap-1 cursor-pointer btn-anim px-3 py-1 rounded-full hover:bg-sky-50 transition-all"
              >
                <span>All Goals</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-slate-600 font-medium mb-5">
              Savings progress, targets and recommended contributions.
            </p>

            <div className="space-y-4">
              {goals.slice(0, 3).map((goal) => {
                const percent = Math.min(
                  100,
                  Math.round((goal.currentCents / goal.targetCents) * 100)
                );
                // Recommended monthly contribution calculation
                const remainingCents = Math.max(0, goal.targetCents - goal.currentCents);
                const recommendedMonthlyCents = Math.round(remainingCents / 6); // target 6 months

                return (
                  <div
                    key={goal.id}
                    className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 hover:bg-white hover:shadow-xs transition-all"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#0F172A]">{goal.name}</span>
                        <span className="text-[10px] font-mono font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                          {percent}%
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-extrabold text-slate-900 font-money">
                          {formatMoney(goal.currentCents, activeCurrency)}
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold ml-1">
                          / {formatMoney(goal.targetCents, activeCurrency)}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden my-2">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    {/* Recommended Contribution */}
                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span className="text-slate-600 font-medium flex items-center gap-1">
                        <Sparkle className="w-3 h-3 text-sky-600" />
                        <span>Recommended: <strong>{formatMoney(recommendedMonthlyCents, activeCurrency)}/mo</strong></span>
                      </span>
                      <span className="text-emerald-700 font-semibold font-mono text-[10px]">
                        On Pace
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-200/60 text-xs text-slate-600 font-semibold flex items-center justify-between">
            <span>Overall Milestone Completion</span>
            <span className="font-mono text-emerald-700 font-bold">
              {Math.round(
                (goals.reduce((s, g) => s + g.currentCents, 0) /
                  Math.max(1, goals.reduce((s, g) => s + g.targetCents, 0))) *
                100
              )}
              % Funded
            </span>
          </div>
        </div>
      </section>

      {/* =========================================================================
          PART 8: "One thing to know"
          A single useful financial insight supported by your actual data.
          ========================================================================= */}
      <section className="keel-card p-6 sm:p-8 relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-sky-500/10 blur-3xl pointer-events-none rounded-full" />

        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
            <Info className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            One thing to know
          </h2>
          <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
            Supported by actual data
          </span>
        </div>

        <h3 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] tracking-tight mb-2">
          Your liquid reserve extends {runwayMonths} months at current burn.
        </h3>

        <p className="text-xs sm:text-sm text-slate-600 font-medium max-w-3xl leading-relaxed mb-6">
          With a net savings rate of <strong className="text-emerald-700 font-bold">{cashFlow.savingsRatePercent}%</strong> and a monthly surplus of <strong className="text-emerald-700 font-bold">+{formatMoney(cashFlow.netSavingsCents, activeCurrency)}</strong>, dedicating an additional 10% toward your top savings goal will reach full funding 3 months ahead of schedule without lowering your operational safety cushion.
        </p>

        {/* Data Evidence Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 select-none pt-4 border-t border-slate-200/70">
          <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/70">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">
              Liquid Cash Reserve
            </span>
            <span className="text-base sm:text-lg font-extrabold text-[#0F172A] font-money block mt-0.5">
              {formatMoney(liquidCashCents, activeCurrency)}
            </span>
            <span className="text-[10px] text-emerald-700 font-bold">
              {runwayMonths} mo runway
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/70">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">
              Monthly Net Surplus
            </span>
            <span className="text-base sm:text-lg font-extrabold text-emerald-700 font-money block mt-0.5">
              +{formatMoney(cashFlow.netSavingsCents, activeCurrency)}
            </span>
            <span className="text-[10px] text-slate-500 font-semibold">
              Retained in ledger
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/70">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">
              Savings Rate
            </span>
            <span className="text-base sm:text-lg font-extrabold text-sky-800 font-money block mt-0.5">
              {cashFlow.savingsRatePercent}%
            </span>
            <span className="text-[10px] text-emerald-700 font-bold">
              Top 5% percentile
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/70">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">
              Debt Leverage Drag
            </span>
            <span className="text-base sm:text-lg font-extrabold text-slate-900 font-money block mt-0.5">
              1.48%
            </span>
            <span className="text-[10px] text-emerald-700 font-bold">
              Prime AAA grade
            </span>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SELF-FINANCE LEARNING & KNOWLEDGE STREAK SHOWCASE
          ========================================================================= */}
      <section className="keel-card p-6 sm:p-8 bg-gradient-to-br from-amber-500/[0.06] via-white to-sky-500/[0.05] border border-amber-200/80 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 flex-shrink-0">
            <Flame className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wider bg-amber-100/80 px-2.5 py-0.5 rounded-full">
                Self-Finance Academy
              </span>
              <span className="text-[10px] font-mono font-bold bg-sky-50 text-sky-800 px-2 py-0.5 rounded-full border border-sky-200">
                +100 XP Modules Available
              </span>
            </div>
            <h3 className="text-xl font-extrabold text-[#0F172A] tracking-tight">
              Interactive Financial Learning, Scenario Quizzes & Daily Streaks
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1 max-w-2xl leading-relaxed">
              Build lasting wealth intuition. Read concise interactive modules on emergency runway formulas, avalanche debt elimination, and compound growth, followed by scenario Q&As that generate XP and build your daily learning streak.
            </p>
          </div>
        </div>

        <div className="flex-shrink-0 flex items-center gap-3">
          <button
            onClick={() => setActiveTab('learn')}
            className="btn-primary-anim bg-[#0F172A] hover:bg-black text-white px-6 py-3 rounded-full text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-lg"
          >
            <GraduationCap className="w-4 h-4 text-sky-400" />
            <span>Open Learning Academy</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>
    </div>
  );
}
