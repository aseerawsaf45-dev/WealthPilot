'use client';

import React, { useState } from 'react';
import {
  Compass,
  ShieldCheck,
  Lock,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Receipt,
  Wallet,
  CheckCircle2,
  Sliders,
  DollarSign,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Download,
  Flame,
  Globe2,
  Tag,
  Zap,
  Layers,
  KeyRound,
  Eye,
  Check,
  X as XIcon,
} from 'lucide-react';

interface LandingPageProps {
  onOpenAuth: (mode?: 'signin' | 'signup') => void;
  onLaunchApp: () => void;
}

export function LandingPage({ onOpenAuth, onLaunchApp }: LandingPageProps) {
  // Interactive Runway Sizer Calculator State
  const [calcSavings, setCalcSavings] = useState(45000); // ৳ 45,000/mo
  const [calcBurn, setCalcBurn] = useState(35000); // ৳ 35,000/mo
  const [calcRate, setCalcRate] = useState(10); // 10% annual return
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [previewCurrency, setPreviewCurrency] = useState<'BDT' | 'USD'>('BDT');

  // Compute 5-year wealth projection: PMT * (((1 + r)^n - 1) / r)
  const monthlyRate = calcRate / 100 / 12;
  const months = 60; // 5 years
  const projectedFutureWealth = Math.round(
    calcSavings * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
  );
  const computedRunwayMonths = (calcSavings / Math.max(1000, calcBurn)).toFixed(1);

  const faqs = [
    {
      q: 'Where is my data stored, and who can see it?',
      a: 'When you sign in, your ledger is stored in an encrypted PostgreSQL database (Neon) and every request is checked against your own session, so no one else can read it. Uploaded receipts and statements are read on your device; the files themselves are never uploaded. AI is off until you turn it on, and even then it only sees labels, never your amounts.',
    },
    {
      q: 'What is the "Minor-Unit Integer Accounting" engine?',
      a: 'Most personal finance apps use 64-bit IEEE-754 binary floating point arithmetic (e.g. 0.1 + 0.2 = 0.30000000000000004), leading to penny drift over thousands of records. WealthPilot calculates every single transaction in integer minor units (cents/poisha), ensuring mathematically exact reconciliations down to the single integer unit.',
    },
    {
      q: 'Can I import and export my existing records without lock-in?',
      a: 'Yes. Drop in bank CSV or Excel exports, PDF statements or receipt photos: everything is read on your device and shown for review before saving, and every import can be undone. Export a formula-injection-safe CSV or a full JSON archive of all your data at any time.',
    },
    {
      q: 'Which currencies are supported?',
      a: 'All active ISO 4217 currencies (150+), each with its correct decimals (Japanese yen has none, Kuwaiti dinar has three). Every account keeps its own currency; totals and net worth are converted to your main currency at the daily market rate and labelled as estimates.',
    },
    {
      q: 'Is WealthPilot free to use?',
      a: 'WealthPilot offers a comprehensive free core ledger with on-device statement parsing, multi-currency accounting, and verified privacy. You do not need to connect bank logins or hand over banking credentials to third-party aggregators. Start immediately with verified demo data or fresh books.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-[#0F172A] selection:bg-sky-500/20 selection:text-sky-900 font-sans overflow-x-hidden">
      {/* =========================================================================
          TOP AMBIENT LIGHTING
          ========================================================================= */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[400px] bg-gradient-to-b from-sky-400/[0.12] via-blue-500/[0.04] to-transparent blur-[140px] pointer-events-none -z-10" />

      {/* =========================================================================
          FLOATING GLASS ISLAND NAVIGATION
          ========================================================================= */}
      <header className="sticky top-4 z-40 max-w-6xl mx-auto px-4 sm:px-6">
        <nav className="glass-nav rounded-2xl sm:rounded-full px-4 sm:px-6 py-3 flex items-center justify-between shadow-lg shadow-black/[0.03] border border-white/80 bg-white/85 backdrop-blur-2xl">
          {/* Brand Logo */}
          <div
            onClick={onLaunchApp}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform bg-white p-0.5 border border-slate-200/80">
              <img
                src="/favicon.png"
                alt="WealthPilot"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-[#0F172A]">
                WealthPilot
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 font-bold uppercase tracking-wider">
                v2026.1
              </span>
            </div>
          </div>

          {/* Center Links (Desktop) */}
          <div className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600">
            <a href="#features" className="hover:text-slate-900 transition-colors">
              Pillars
            </a>
            <a href="#calculator" className="hover:text-slate-900 transition-colors">
              Runway Sizer
            </a>
            <a href="#comparison" className="hover:text-slate-900 transition-colors">
              Comparison
            </a>
            <a href="#faq" className="hover:text-slate-900 transition-colors">
              FAQ
            </a>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onOpenAuth('signin')}
              className="px-3.5 py-1.5 rounded-full text-xs font-bold text-slate-700 hover:text-black hover:bg-slate-100/80 transition-all cursor-pointer"
            >
              Sign In
            </button>
            <button
              onClick={() => onOpenAuth('signup')}
              className="group px-4 py-2 rounded-full bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer"
            >
              <span>Get Started</span>
              <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                <ArrowRight className="w-2.5 h-2.5 text-sky-300" />
              </div>
            </button>
          </div>
        </nav>
      </header>

      {/* =========================================================================
          HERO SECTION
          ========================================================================= */}
      <section className="pt-20 sm:pt-28 pb-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto text-center">
        {/* Eyebrow Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-sky-50 border border-sky-200/90 shadow-2xs mb-6 select-none animate-in fade-in slide-in-from-bottom-2 duration-300">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-bold font-mono uppercase tracking-wider text-sky-900">
            Zero Telemetry • Minor-Unit Integer Precision
          </span>
        </div>

        {/* Hero Heading */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-[#0F172A] max-w-4xl mx-auto leading-[1.08]">
          Master your net worth. <br />
          <span className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Without giving up your privacy.
          </span>
        </h1>

        {/* Hero Subtitle */}
        <p className="text-base sm:text-xl text-slate-600 font-medium max-w-2xl mx-auto mt-6 leading-relaxed">
          Traditional budgeting apps leak your personal financial records and drift with floating-point errors. WealthPilot gives you exact integer accounting in 150+ currencies, AI insights on every page, and receipt and statement scanning that runs on your own device.
        </p>

        {/* Hero Dual CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mt-9">
          <button
            onClick={() => onOpenAuth('signup')}
            className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white text-sm font-bold shadow-lg shadow-sky-600/25 hover:shadow-sky-600/40 transition-all flex items-center justify-center gap-2.5 cursor-pointer group"
          >
            <span>Initialize Sovereign Ledger</span>
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform">
              <ArrowRight className="w-3 h-3 text-white" />
            </div>
          </button>

          <button
            onClick={onLaunchApp}
            className="w-full sm:w-auto px-7 py-3.5 rounded-full bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-800 text-sm font-bold shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Create a free account</span>
            <Sparkles className="w-4 h-4 text-sky-600" />
          </button>
        </div>

        {/* Hero Micro Guarantees */}
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 mt-8 text-xs font-semibold text-slate-500">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Encrypted, private by default</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>No bank logins requested</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Receipts read on your device</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>AI never sees amounts</span>
          </div>
        </div>

        {/* =========================================================================
            HERO MOCKUP BENTO (Hardware Double-Bezel Showcase)
            ========================================================================= */}
        <div className="mt-14 max-w-5xl mx-auto">
          {/* Outer Shell (Double-Bezel hardware tray) */}
          <div className="p-2 sm:p-3 rounded-3xl bg-slate-200/70 border border-slate-300/80 shadow-2xl ring-1 ring-black/5">
            {/* Inner Dashboard Preview Chassis */}
            <div className="bg-white rounded-2xl p-5 sm:p-8 shadow-xs border border-slate-100 text-left">
              {/* Window Header */}
              <div className="flex items-center justify-between pb-6 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                  <span className="ml-2 text-xs font-mono font-bold text-slate-400">
                    Example dashboard · sample numbers
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPreviewCurrency(previewCurrency === 'BDT' ? 'USD' : 'BDT')}
                    className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                  >
                    Currency: {previewCurrency === 'BDT' ? '৳ BDT' : '$ USD'}
                  </button>
                  <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    ENCLAVE SECURED
                  </span>
                </div>
              </div>

              {/* Mockup Dashboard Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-6">
                {/* Balance Card */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
                    Total Net Worth
                  </span>
                  <div className="text-3xl font-extrabold tracking-tight text-[#0F172A]">
                    {previewCurrency === 'BDT' ? '৳ 8,42,500' : '$14,250.00'}
                  </div>
                  <div className="text-xs font-bold text-emerald-700 flex items-center gap-1 pt-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>+৳ 48,200 (6.2%) this month</span>
                  </div>
                </div>

                {/* Cash Flow Velocity */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
                    Monthly Cash Inflow vs Burn
                  </span>
                  <div className="text-3xl font-extrabold tracking-tight text-sky-900">
                    {previewCurrency === 'BDT' ? '+৳ 52,000' : '+$4,500.00'}
                  </div>
                  <div className="text-xs font-semibold text-slate-600 pt-1">
                    Burn Pace: 68% safe runway threshold
                  </div>
                </div>

                {/* Runway Projection */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white space-y-1 shadow-md">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-sky-400">
                    Calculated Liquid Runway
                  </span>
                  <div className="text-3xl font-extrabold tracking-tight text-white">
                    14.2 Months
                  </div>
                  <div className="text-xs font-medium text-slate-300 pt-1">
                    Zero debt pressure • Optimal allocation
                  </div>
                </div>
              </div>

              {/* Mockup Action Footer */}
              <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>Integer Ledger Active • Zero float drift verified</span>
                </div>
                <button
                  onClick={onLaunchApp}
                  className="px-4 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span>Launch Live Interactivity</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          METRICS BAR (Institutional Proof)
          ========================================================================= */}
      <section className="py-12 bg-white border-y border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0F172A]">
              150+
            </div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">
              Currencies supported
            </div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-emerald-600">
              0.00%
            </div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">
              Float Rounding Drift
            </div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0F172A]">
              On-device
            </div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">
              Receipt &amp; statement reading
            </div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-sky-600">
              Opt-in
            </div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">
              AI that never sees your amounts
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          INTERACTIVE RUNWAY & WEALTH COMPOUNDING SIZER
          ========================================================================= */}
      <section id="calculator" className="py-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-800 text-xs font-bold mb-3">
            <Sliders className="w-3.5 h-3.5 text-sky-600" />
            Interactive Financial Freedom Sizer
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#0F172A]">
            Simulate your compounding velocity.
          </h2>
          <p className="text-sm sm:text-base text-slate-600 font-medium max-w-xl mx-auto mt-2">
            Move the sliders to project how disciplined minor-unit allocations accelerate your survival runway and 5-year liquid independence.
          </p>
        </div>

        {/* Calculator Chassis (Double Bezel) */}
        <div className="p-3 rounded-3xl bg-slate-200/80 border border-slate-300 shadow-xl">
          <div className="bg-white rounded-2xl p-6 sm:p-10 shadow-xs border border-slate-100">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              {/* Sliders Side */}
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Monthly Savings Rate
                    </label>
                    <span className="text-sm font-extrabold text-sky-700 font-mono">
                      ৳ {calcSavings.toLocaleString()}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={5000}
                    max={200000}
                    step={5000}
                    value={calcSavings}
                    onChange={(e) => setCalcSavings(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-medium mt-1">
                    <span>৳ 5,000</span>
                    <span>৳ 2,00,000</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Monthly Burn Rate (Expenses)
                    </label>
                    <span className="text-sm font-extrabold text-rose-600 font-mono">
                      ৳ {calcBurn.toLocaleString()}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10000}
                    max={150000}
                    step={5000}
                    value={calcBurn}
                    onChange={(e) => setCalcBurn(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-medium mt-1">
                    <span>৳ 10,000</span>
                    <span>৳ 1,50,000</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Expected Compounding Yield (Annual)
                    </label>
                    <span className="text-sm font-extrabold text-emerald-600 font-mono">
                      {calcRate}% APY
                    </span>
                  </div>
                  <input
                    type="range"
                    min={4}
                    max={20}
                    step={1}
                    value={calcRate}
                    onChange={(e) => setCalcRate(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-medium mt-1">
                    <span>Conservative 4%</span>
                    <span>High Velocity 20%</span>
                  </div>
                </div>
              </div>

              {/* Real-Time Projected Outputs */}
              <div className="bg-[#0F172A] rounded-2xl p-6 sm:p-8 text-white space-y-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-sky-400">
                    Projected 5-Year Sovereign Capital
                  </span>
                  <div className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mt-1 font-mono">
                    ৳ {projectedFutureWealth.toLocaleString()}
                  </div>
                  <p className="text-xs text-slate-400 mt-1 font-medium">
                    Calculated using strict integer monthly compounding intervals.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                      Runway Sizer
                    </span>
                    <div className="text-2xl font-bold text-emerald-400 mt-0.5">
                      {computedRunwayMonths}x
                    </div>
                    <span className="text-[11px] text-slate-400">Monthly burn covered</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                      Rule of 72 Doubling
                    </span>
                    <div className="text-2xl font-bold text-sky-400 mt-0.5">
                      {(72 / calcRate).toFixed(1)} Yrs
                    </div>
                    <span className="text-[11px] text-slate-400">Capital doubles</span>
                  </div>
                </div>

                <button
                  onClick={() => onOpenAuth('signup')}
                  className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Track This in Your Private Ledger</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          THE 6 BENTO PILLARS (Core Architectural Differentiators)
          ========================================================================= */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-800 text-xs font-bold mb-3">
            <Layers className="w-3.5 h-3.5 text-sky-600" />
            Architectural Excellence
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#0F172A]">
            Built like high-assurance financial infrastructure.
          </h2>
          <p className="text-sm sm:text-base text-slate-600 font-medium max-w-2xl mx-auto mt-2">
            Every layer is engineered to eliminate data leaks, floating-point drift, and dependency on third-party aggregators.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Minor Unit Math (Col Span 2) */}
          <div className="md:col-span-2 keel-card p-8 flex flex-col justify-between hover:shadow-lg transition-all">
            <div>
              <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600 mb-5 shadow-2xs">
                <DollarSign className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-[#0F172A] tracking-tight mb-2">
                Minor-Unit Integer Accounting Engine
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                Traditional software performs math using floating point floats, allowing fractional penny errors to corrupt your balance sheet. WealthPilot stores every account, transaction, split, and payoff milestone in integer minor units (poisha / cents), guaranteeing zero rounding loss across decades of financial history.
              </p>
            </div>
            <div className="mt-6 p-3 rounded-xl bg-slate-50 border border-slate-200/80 font-mono text-xs text-slate-700 flex items-center justify-between">
              <span>IEEE-754 Float: 0.1 + 0.2 = 0.30000000000000004</span>
              <span className="font-bold text-emerald-700">WealthPilot: 10 + 20 = 30¢ ✓</span>
            </div>
          </div>

          {/* Card 2: Zero Telemetry */}
          <div className="keel-card p-8 flex flex-col justify-between hover:shadow-lg transition-all">
            <div>
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-5 shadow-2xs">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-[#0F172A] tracking-tight mb-2">
                Private by design
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                Every query is scoped to your own account, no analytics trackers, and files you scan are read on your device. AI is opt-in and only ever sees labels like &ldquo;Dining spending&rdquo;, never the amounts.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-xs font-bold text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Tamper-evident audit log of every change</span>
            </div>
          </div>

          {/* Card 3: Verified Regional Perks */}
          <div className="keel-card p-8 flex flex-col justify-between hover:shadow-lg transition-all">
            <div>
              <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-5 shadow-2xs">
                <Tag className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-[#0F172A] tracking-tight mb-2">
                AI insights on every page
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                Unusual charges, recurring payments, a 30/60/90-day cash forecast, budget pacing and goal dates, all calculated from your own history and explained in plain language.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-xs font-bold text-slate-700">
              <Globe2 className="w-4 h-4 text-sky-600" />
              <span>Works without AI too: calculated answers</span>
            </div>
          </div>

          {/* Card 4: FinanceGuru Learning Section (Col Span 2) */}
          <div className="md:col-span-2 keel-card p-8 flex flex-col justify-between hover:shadow-lg transition-all">
            <div>
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mb-5 shadow-2xs">
                <GraduationCap className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-[#0F172A] tracking-tight mb-2">
                FinanceGuru: Interactive Literacy &amp; Streak XP
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                Master wealth building with FinanceGuru: bite-sized interactive case studies, live runway calculators, and practical scenario Q&amp;A. Earn XP, maintain your daily learning streak, and advance from Novice Capitalist to Sovereign Allocator.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-amber-600" />
                Daily Streaks
              </span>
              <span className="px-3 py-1 rounded-full bg-sky-50 text-sky-800 border border-sky-200 text-xs font-bold flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-sky-600" />
                XP Level Progression
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          COMPARISON MATRIX (WealthPilot vs Legacy Tools)
          ========================================================================= */}
      <section id="comparison" className="py-24 bg-white border-y border-slate-200/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0F172A]">
              Why discerning builders choose WealthPilot.
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-2">
              A transparent comparison against legacy personal finance software.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-4 px-4 font-bold text-slate-400 uppercase tracking-wider w-1/4">
                    Feature &amp; Safety Capability
                  </th>
                  <th className="py-4 px-4 font-extrabold text-sky-700 bg-sky-50/70 rounded-t-xl">
                    WealthPilot
                  </th>
                  <th className="py-4 px-4 font-bold text-slate-600">Pocket Clear</th>
                  <th className="py-4 px-4 font-bold text-slate-600">Copilot / Monarch</th>
                  <th className="py-4 px-4 font-bold text-slate-600">YNAB</th>
                  <th className="py-4 px-4 font-bold text-slate-600">Excel / Sheets</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                <tr>
                  <td className="py-3.5 px-4 font-bold text-slate-800">
                    Receipts &amp; statements read on your device
                  </td>
                  <td className="py-3.5 px-4 bg-sky-50/70 font-bold text-emerald-700">
                    ✓ Files never leave browser
                  </td>
                  <td className="py-3.5 px-4 text-emerald-600">✓ On-device parsing</td>
                  <td className="py-3.5 px-4 text-rose-500">✗ Cloud processing</td>
                  <td className="py-3.5 px-4 text-rose-500">✗ Cloud processing</td>
                  <td className="py-3.5 px-4 text-slate-400">Manual entry only</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-bold text-slate-800">
                    Discrete Minor-Unit Integer Math
                  </td>
                  <td className="py-3.5 px-4 bg-sky-50/70 font-bold text-emerald-700">
                    ✓ Zero float drift (BigInt cents)
                  </td>
                  <td className="py-3.5 px-4 text-rose-500">✗ Floating point decimals</td>
                  <td className="py-3.5 px-4 text-rose-500">✗ Floating point decimals</td>
                  <td className="py-3.5 px-4 text-rose-500">✗ Floating point decimals</td>
                  <td className="py-3.5 px-4 text-rose-500">✗ IEEE-754 float drift</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-bold text-slate-800">
                    No Bank Passwords or Aggregator Lock-in
                  </td>
                  <td className="py-3.5 px-4 bg-sky-50/70 font-bold text-emerald-700">
                    ✓ Never requested (bKash &amp; global)
                  </td>
                  <td className="py-3.5 px-4 text-emerald-600">✓ Aggregator-free (manual &amp; SMS)</td>
                  <td className="py-3.5 px-4 text-rose-500">✗ Aggregator-centric (Plaid/MX; US/CA)</td>
                  <td className="py-3.5 px-4 text-rose-500">✗ Aggregator-centric (Plaid/MX primary)</td>
                  <td className="py-3.5 px-4 text-emerald-600">✓ Manual entry</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-bold text-slate-800">
                    Formula-Injection Neutralized CSV
                  </td>
                  <td className="py-3.5 px-4 bg-sky-50/70 font-bold text-emerald-700">
                    ✓ Sanitized `=,+,-,@` prefixes
                  </td>
                  <td className="py-3.5 px-4 text-rose-500">✗ Paywalled export (Pro required)</td>
                  <td className="py-3.5 px-4 text-slate-400">Basic CSV (unshielded)</td>
                  <td className="py-3.5 px-4 text-slate-400">Basic CSV (unshielded)</td>
                  <td className="py-3.5 px-4 text-rose-500">✗ Vulnerable to DDE injection</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-bold text-slate-800">
                    FinanceGuru Interactive Academy &amp; Streaks
                  </td>
                  <td className="py-3.5 px-4 bg-sky-50/70 font-bold text-emerald-700">
                    ✓ Built-in XP &amp; Q&amp;A
                  </td>
                  <td className="py-3.5 px-4 text-slate-400">✗ None (expense logging only)</td>
                  <td className="py-3.5 px-4 text-slate-400">✗ None (dashboard only)</td>
                  <td className="py-3.5 px-4 text-slate-400">✗ Video/article content only</td>
                  <td className="py-3.5 px-4 text-slate-400">✗ None</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-bold text-slate-800">
                    Debt Payoff &amp; Investment Simulation
                  </td>
                  <td className="py-3.5 px-4 bg-sky-50/70 font-bold text-emerald-700 rounded-b-xl">
                    ✓ Snowball/Avalanche + World Bank rates
                  </td>
                  <td className="py-3.5 px-4 text-slate-400">✗ None (expense logging only)</td>
                  <td className="py-3.5 px-4 text-slate-400">✗ Net worth chart only</td>
                  <td className="py-3.5 px-4 text-slate-400">✗ Basic loan tracker</td>
                  <td className="py-3.5 px-4 text-slate-400">Manual complex modeling</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* =========================================================================
          HOW YOUR DATA AND AI ARE HANDLED (facts, not testimonials)
          ========================================================================= */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0F172A]">How your data and the AI are handled</h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-2">Exactly what happens, in plain words.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { t: 'Numbers come from WealthPilot', d: 'Every total, forecast and plan is calculated on our server from your ledger in exact integer units. The AI only words the answer; if it writes a number of its own, its wording is discarded.' },
            { t: 'AI sees labels, not amounts', d: 'With AI on, the provider receives your question and result names like “Dining spending”. Amounts, balances, account numbers, your name and email are never sent.' },
            { t: 'Scanning stays on your device', d: 'Receipt photos, PDFs and spreadsheets are read in your browser. Only if you allow document reading is the text (with card, account and phone numbers removed) sent to structure it, and you review every row.' },
          ].map((c) => (
            <div key={c.t} className="keel-card wp-lift p-6">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="mt-3 text-sm font-bold text-[#0F172A]">{c.t}</h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* =========================================================================
          FAQ ACCORDION
          ========================================================================= */}
      <section id="faq" className="py-20 px-4 sm:px-6 max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold tracking-tight text-[#0F172A]">
            Frequently Asked Questions
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Everything you need to know about WealthPilot security and operations.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-slate-200 bg-white p-5 transition-all shadow-2xs"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between text-left cursor-pointer"
                >
                  <span className="text-sm font-bold text-[#0F172A]">{faq.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-sky-600 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <p className="text-xs text-slate-600 font-medium mt-3 leading-relaxed animate-in fade-in duration-200">
                    {faq.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* =========================================================================
          HIGH-IMPACT BOTTOM CTA BANNER
          ========================================================================= */}
      <section className="py-20 px-4 sm:px-6 max-w-5xl mx-auto text-center">
        <div className="p-3 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-72 h-72 bg-sky-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

          <div className="py-12 px-6 sm:px-12 relative z-10 text-white space-y-6">
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
              Take command of your financial ledger today.
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-xl mx-auto leading-relaxed">
              Free core ledger. Receipts are read on your device, and AI never sees amounts. Pilot your net worth with mathematical sovereignty.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
              <button
                onClick={() => onOpenAuth('signup')}
                className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold transition-all shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Initialize Private Account</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onLaunchApp}
                className="w-full sm:w-auto px-7 py-3.5 rounded-full bg-white/10 hover:bg-white/15 text-white border border-white/20 text-xs font-bold transition-colors cursor-pointer"
              >
                Launch Sandbox Ledger
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          EXECUTIVE FOOTER
          ========================================================================= */}
      <footer className="border-t border-slate-200/80 bg-white py-12 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center p-0.5 bg-white border border-slate-200/80 shadow-2xs">
              <img src="/favicon.png" alt="WealthPilot" className="w-full h-full object-contain" />
            </div>
            <span className="font-extrabold text-[#0F172A]">WealthPilot</span>
            <span>• © 2026 Sovereign Ledger Architecture</span>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={() => onOpenAuth('signin')}
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              Sign In
            </button>
            <button
              onClick={() => onOpenAuth('signup')}
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              Sign Up
            </button>
            <button
              onClick={onLaunchApp}
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              Live Demo
            </button>
          </div>

          <div className="text-[11px] text-slate-400 text-center md:text-right">
            Personal finance &amp; calculation engine • Encrypted ledger • Zero tracking ads
          </div>
        </div>
      </footer>
    </div>
  );
}
