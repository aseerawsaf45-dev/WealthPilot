'use client';

import React from 'react';
import {
  Compass,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  TrendingUp,
  Wallet,
  Receipt,
  Layers,
  Palette,
  Type,
  Maximize2,
} from 'lucide-react';

export function BrandTab() {
  const colorTokens = [
    {
      name: 'Canvas Background',
      token: '--background',
      hex: '#08090F',
      desc: 'Deep ink black creating zero-distraction focus',
      border: 'border-white/10',
    },
    {
      name: 'Elevated Surface',
      token: '--surface',
      hex: '#0E111C',
      desc: 'Subtle slate obsidian for cards and widgets',
      border: 'border-white/10',
    },
    {
      name: 'Accent Emerald',
      token: '--accent-emerald',
      hex: '#10B981',
      desc: 'Primary growth, cleared state, and verified fact',
      border: 'border-emerald-500/30',
    },
    {
      name: 'Mint Glow',
      token: '--accent-mint',
      hex: '#34D399',
      desc: 'Hover highlights and active microinteractions',
      border: 'border-emerald-400/30',
    },
    {
      name: 'Foreground Pristine',
      token: '--foreground',
      hex: '#F8FAFC',
      desc: 'High contrast text achieving WCAG 2.2 AAA',
      border: 'border-white/20',
    },
    {
      name: 'Subdued Muted',
      token: '--text-muted',
      hex: '#64748B',
      desc: 'Secondary labels, audit timestamps, and masks',
      border: 'border-white/10',
    },
  ];

  const designPrinciples = [
    {
      title: 'Trust Before Delight',
      desc: 'Financial applications demand provable accuracy. Calculations never use binary floating-point math; all monetary sums are evaluated in strict integer minor-units (cents).',
      badge: 'Architecture',
    },
    {
      title: 'Calm Editorial Restraint',
      desc: 'Banning casino/crypto neon gradients, manipulative push-notifications, and guilt-inducing budget warnings. The interface acts as a serene, focused cockpit for wealth.',
      badge: 'Visual Taste',
    },
    {
      title: 'Hardware Double-Bezel Architecture',
      desc: 'Cards utilize precision milled double borders (Doppelrand) with subtle inner glows to establish tactile depth without heavy dropshadow clutter.',
      badge: 'Component Craft',
    },
    {
      title: 'Grounded AI with Provable Provenance',
      desc: 'Every copilot insight is backed by verified transaction citations, date range scoping, and explicit certainty levels. Never generating hallucinated returns.',
      badge: 'AI Safety',
    },
  ];

  return (
    <div className="space-y-12 pb-20 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-3">
          <Palette className="w-3.5 h-3.5" />
          WealthPilot Design System & Brand Identity
        </div>
        <h1 className="text-3xl font-semibold text-white tracking-tight">Brand Identity & Design Tokens</h1>
        <p className="text-sm text-white/50 mt-1 max-w-2xl">
          The visual and mathematical design tokens powering WealthPilot. Built for precision, calm reassurance, and high-trust financial clarity.
        </p>
      </div>

      {/* Brand Logomark & Concept */}
      <section className="double-bezel">
        <div className="double-bezel-inner p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-[1.5px] flex items-center justify-center shadow-2xl shadow-emerald-500/20">
                <div className="w-full h-full bg-[#08090F] rounded-[14px] flex items-center justify-center">
                  <Compass className="w-8 h-8 text-emerald-400" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold tracking-tight text-white">WealthPilot</h2>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
                    Core Mark
                  </span>
                </div>
                <p className="text-xs text-white/60 mt-1">The Financial Navigator for Intentional Living</p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white/70">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Engineered with Zero Floating-Point Float Drift</span>
            </div>
          </div>
        </div>
      </section>

      {/* Core Principles */}
      <section>
        <h2 className="text-lg font-semibold text-white tracking-tight mb-4 flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <span>Foundational Product Principles</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {designPrinciples.map((p, idx) => (
            <div key={idx} className="double-bezel">
              <div className="double-bezel-inner p-6 h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                      {p.badge}
                    </span>
                    <span className="text-xs font-mono text-white/30">0{idx + 1}</span>
                  </div>
                  <h3 className="text-base font-semibold text-white mt-1 mb-2">{p.title}</h3>
                  <p className="text-xs text-white/60 leading-relaxed">{p.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Color System Tokens */}
      <section>
        <h2 className="text-lg font-semibold text-white tracking-tight mb-4 flex items-center gap-2">
          <Palette className="w-4 h-4 text-emerald-400" />
          <span>Color Calibration & Semantic Roles</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {colorTokens.map((c) => (
            <div key={c.token} className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`w-9 h-9 rounded-xl border ${c.border} shadow-inner`}
                    style={{ backgroundColor: c.hex }}
                  />
                  <span className="font-mono text-xs text-white/80">{c.hex}</span>
                </div>
                <h3 className="text-xs font-semibold text-white">{c.name}</h3>
                <code className="text-[10px] font-mono text-emerald-400 block mt-0.5">{c.token}</code>
              </div>
              <p className="text-[11px] text-white/40 mt-3 pt-3 border-t border-white/[0.04]">
                {c.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Typographic System & Tabular Money */}
      <section className="double-bezel">
        <div className="double-bezel-inner p-8">
          <div className="flex items-center gap-2 mb-6">
            <Type className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white tracking-tight">Typographic Precision System</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <span className="text-xs font-mono text-white/40 uppercase tracking-wider">UI Sans: Geist Sans</span>
              <div className="space-y-2">
                <p className="text-2xl font-bold text-white tracking-tight">Financial Health Workspace</p>
                <p className="text-base text-white/80">Every dollar accounted for. No guesses, no dark patterns.</p>
                <p className="text-xs text-white/50">
                  Optimized for dense financial interfaces, high readability across mobile and desktop.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <span className="text-xs font-mono text-white/40 uppercase tracking-wider">Money Monospace: Geist Mono</span>
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-white/60">Salary Deposit:</span>
                  <span className="text-emerald-400 font-semibold font-money">+$4,850.00</span>
                </div>
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-white/60">Apartment Lease:</span>
                  <span className="text-white font-semibold font-money">-$1,850.00</span>
                </div>
                <div className="flex justify-between items-center text-xs font-mono pt-2 border-t border-white/[0.06]">
                  <span className="text-white/80 font-medium">Net Discretionary:</span>
                  <span className="text-emerald-400 font-bold font-money">+$3,000.00</span>
                </div>
              </div>
              <p className="text-[11px] text-white/40">
                Monospaced numerals prevent horizontal jitter during live balance transitions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Component Gallery Showcase */}
      <section>
        <h2 className="text-lg font-semibold text-white tracking-tight mb-4 flex items-center gap-2">
          <Maximize2 className="w-4 h-4 text-emerald-400" />
          <span>Interactive Component Anatomy</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Nested Island Button Pattern */}
          <div className="double-bezel">
            <div className="double-bezel-inner p-6">
              <h3 className="text-sm font-semibold text-white mb-2">Nested Island Buttons</h3>
              <p className="text-xs text-white/50 mb-6">
                Hover triggers micro-spring translation on the trailing circular badge.
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <button className="btn-island flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs transition-all shadow-md shadow-emerald-500/20 cursor-pointer">
                  <span>Primary Island Action</span>
                  <div className="btn-island-icon w-5 h-5 rounded-full bg-black/15 flex items-center justify-center">
                    <ArrowRight className="w-3 h-3 text-black" />
                  </div>
                </button>

                <button className="btn-island flex items-center gap-2 px-4 py-2 bg-white/[0.06] hover:bg-white/[0.1] text-white font-medium text-xs border border-white/[0.08] transition-all cursor-pointer">
                  <span>Subtle Island Action</span>
                  <div className="btn-island-icon w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Tabular Money Cards */}
          <div className="double-bezel">
            <div className="double-bezel-inner p-6">
              <h3 className="text-sm font-semibold text-white mb-2">Mathematical Ledger Tiles</h3>
              <p className="text-xs text-white/50 mb-6">
                Clear sign conventions: Emerald indicates incoming liquidity; neutral white indicates obligations.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <span className="text-[10px] text-white/40 block">Liquid Assets</span>
                  <span className="font-money font-semibold text-emerald-400 text-sm">$32,150.00</span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <span className="text-[10px] text-white/40 block">Liabilities</span>
                  <span className="font-money font-semibold text-white/80 text-sm">-$5,420.00</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
