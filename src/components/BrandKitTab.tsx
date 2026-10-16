'use client';

import React, { useState } from 'react';
import {
  Compass,
  Palette,
  Sparkles,
  ShieldCheck,
  Check,
  Copy,
  Layers,
  Type,
  Maximize2,
  Sliders,
  Eye,
  CheckCircle2,
} from 'lucide-react';

export function BrandKitTab() {
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const copyToClipboard = (token: string, value: string) => {
    navigator.clipboard?.writeText(value);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const colorTokens = [
    { name: 'Canvas Void', token: '--background', hex: '#080A0F', desc: 'Primary deep ink background for high contrast' },
    { name: 'Slate Surface', token: '--surface', hex: '#111422', desc: 'Inner card elevation and nested container base' },
    { name: 'Surface Border', token: '--surface-border', hex: 'rgba(255,255,255,0.08)', desc: '1px precision hairline borders' },
    { name: 'Emerald Precision', token: '--accent-emerald', hex: '#10B981', desc: 'Positive ledger flows, surpluses, and verified badges' },
    { name: 'Mint Luminescence', token: '--accent-mint', hex: '#34D399', desc: 'Secondary active highlights and gradient glow endpoints' },
    { name: 'Rose Debit', token: '--accent-rose', hex: '#F43F5E', desc: 'Outflows, liability alerts, and danger states' },
    { name: 'Amber Reserve', token: '--accent-amber', hex: '#F59E0B', desc: 'Budget pacing warnings and payment due alerts' },
    { name: 'Ice Foreground', token: '--foreground', hex: '#F8FAFC', desc: 'Primary typographic rendering with 100% legibility' },
  ];

  const typographyScales = [
    { role: 'Display Hero', font: 'Geist / Inter', size: '36px - 48px', weight: '600 SemiBold', sample: 'Financial clarity engineered with precision.' },
    { role: 'Section Headline', font: 'Geist / Inter', size: '20px - 24px', weight: '600 SemiBold', sample: 'Unified Cash Flow & Asset Allocation' },
    { role: 'Tabular Numerals', font: 'Geist Mono / Tabular', size: '16px - 32px', weight: '700 Bold', sample: ',290.45' },
    { role: 'Body Regular', font: 'Geist Sans', size: '13px - 14px', weight: '400 Normal', sample: 'Reconciled in real-time across 4 connected accounts.' },
    { role: 'Micro Meta', font: 'Geist Mono', size: '10px - 11px', weight: '500 Medium', sample: 'SHA-256 FINGERPRINT: 7e1e549a9b' },
  ];

  return (
    <div className="space-y-12 pb-20">
      {/* Hero */}
      <section className="max-w-6xl mx-auto pt-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-4">
          <Palette className="w-3.5 h-3.5" />
          Design System & Brand Philosophy
        </div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white leading-tight">
          WealthPilot Design Tokens & Identity System
        </h1>
        <p className="mt-2 text-white/50 text-base max-w-2xl">
          Engineered around the concept of mathematical calm: editorial typographic rhythm, double-bezel hardware surfaces, and strict tabular alignment.
        </p>
      </section>

      {/* Brand Identity & Monogram */}
      <section className="max-w-6xl mx-auto double-bezel">
        <div className="double-bezel-inner p-8 space-y-6">
          <div className="flex flex-col md:flex-row items-center gap-8 justify-between">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-[2px] shadow-2xl shadow-emerald-500/20 flex items-center justify-center">
                <div className="w-full h-full bg-[#08090F] rounded-[22px] flex items-center justify-center">
                  <Compass className="w-10 h-10 text-emerald-400 animate-pulse" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold tracking-tight text-white">WealthPilot</h2>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-mono font-semibold">
                    OFFICIAL BRANDMARK
                  </span>
                </div>
                <p className="text-xs text-white/50 mt-1 max-w-md">
                  The compass symbol represents steady navigational guidance through turbulent macro conditions and long-term compound asset accumulation.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-center">
                <span className="text-[10px] text-white/40 block uppercase font-mono">Contrast Ratio</span>
                <span className="text-sm font-bold text-emerald-400 font-mono">14.2:1 (AAA)</span>
              </div>
              <div className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-center">
                <span className="text-[10px] text-white/40 block uppercase font-mono">Color Space</span>
                <span className="text-sm font-bold text-teal-300 font-mono">sRGB / P3</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Palette Tokens */}
      <section className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            Color Foundation & Semantic Tokens
          </h3>
          <span className="text-xs text-white/40">Click card to copy token CSS</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {colorTokens.map((c) => (
            <div
              key={c.token}
              onClick={() => copyToClipboard(c.token, c.hex)}
              className="group cursor-pointer rounded-2xl bg-white/[0.02] border border-white/[0.07] p-4 hover:border-emerald-500/40 hover:bg-white/[0.04] transition-all"
            >
              <div
                className="w-full h-16 rounded-xl border border-white/10 mb-3 flex items-center justify-center"
                style={{ backgroundColor: c.hex }}
              >
                {copiedToken === c.token && (
                  <span className="text-xs font-bold text-black bg-white/90 px-2 py-0.5 rounded-full shadow flex items-center gap-1 animate-scaleUp">
                    <Check className="w-3 h-3" /> Copied
                  </span>
                )}
              </div>
              <h4 className="text-xs font-semibold text-white group-hover:text-emerald-400 transition-colors flex items-center justify-between">
                <span>{c.name}</span>
                <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-white/40" />
              </h4>
              <p className="text-[11px] font-mono text-emerald-400/80 mt-0.5">{c.hex}</p>
              <p className="text-[10px] text-white/40 mt-1.5 leading-snug">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Typography Hierarchy */}
      <section className="max-w-6xl mx-auto double-bezel">
        <div className="double-bezel-inner p-6 space-y-5">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Type className="w-5 h-5 text-emerald-400" />
            Editorial Typography Hierarchy
          </h3>

          <div className="divide-y divide-white/[0.06]">
            {typographyScales.map((t, idx) => (
              <div key={idx} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="w-48 shrink-0">
                  <span className="text-xs font-semibold text-white block">{t.role}</span>
                  <span className="text-[10px] text-white/40 font-mono block">{t.font} ? {t.size} ? {t.weight}</span>
                </div>
                <div className="flex-1 text-white/90 font-medium text-right md:text-left">
                  {t.sample}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architectural Principles */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-6xl mx-auto">
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <Sliders className="w-4 h-4" />
          </div>
          <h4 className="text-sm font-semibold text-white">Doppelrand Architecture</h4>
          <p className="text-xs text-white/50 leading-relaxed">
            Two-stage concentric nested bezels creating high tactile depth without gaudy neon glows or oversaturated skeuomorphism.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <h4 className="text-sm font-semibold text-white">Grounded Motion</h4>
          <p className="text-xs text-white/50 leading-relaxed">
            Micro-interactions use spring curves below 220ms, strictly disabled when prefers-reduced-motion is detected in the operating system.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <h4 className="text-sm font-semibold text-white">Deterministic Ledgers</h4>
          <p className="text-xs text-white/50 leading-relaxed">
            Minor-unit integer cents throughout the stack. No binary floating point inaccuracies ( .1 + 0.2 === 0.30000000000000004).
          </p>
        </div>
      </section>
    </div>
  );
}
