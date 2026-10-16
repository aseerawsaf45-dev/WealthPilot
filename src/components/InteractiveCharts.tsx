'use client';

import React, { useState, useId } from 'react';
import { formatMoney } from '../lib/money';
import { TrendingUp, ArrowUpRight, ShieldCheck, Sparkles, HelpCircle } from 'lucide-react';

// ============================================================================
// 1. Financial Health Score Equalizer Histogram Chart
// ============================================================================
export function FinancialHealthEqualizerChart() {
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  // 70 fine equalizer bars representing rolling 70-day mathematical audit history
  const totalBars = 70;
  const bars = Array.from({ length: totalBars }, (_, i) => {
    const fraction = i / totalBars;
    let baseHeight = 25;
    let zone = 'Historical';
    let isEmerald = false;

    if (fraction < 0.25) {
      baseHeight = 20 + Math.sin(i * 0.8) * 12 + (i % 3) * 6;
      zone = 'Pre-Reconciled';
    } else if (fraction < 0.5) {
      baseHeight = 35 + Math.sin(i * 0.7) * 15 + (i % 2) * 8;
      zone = 'Stable Audit';
    } else if (fraction < 0.72) {
      baseHeight = 48 + Math.sin(i * 0.9) * 16 + (i % 4) * 6;
      zone = 'Institutional';
    } else {
      // Emerald highlight zone (Current multi-week audited surplus streak)
      baseHeight = 60 + Math.sin(i * 0.85) * 20 + (i % 3) * 10;
      if (i > 56) baseHeight = Math.min(96, baseHeight + 14);
      zone = i > 62 ? 'Prime Surplus' : 'Audited Growth';
      isEmerald = true;
    }

    return {
      index: i,
      height: Math.round(Math.min(96, Math.max(16, baseHeight))),
      isEmerald,
      zone,
      dayAgo: totalBars - i,
      score: Math.round(15 + fraction * 83),
    };
  });

  const activeBar = hoveredBarIndex !== null ? bars[hoveredBarIndex] : null;

  return (
    <div className="space-y-4">
      {/* 4 Health Pillars Sub-Score Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 select-none">
        <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/70">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Liquidity Ratio</span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-lg font-extrabold text-[#0F172A] font-money">96%</span>
            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">Optimal</span>
          </div>
        </div>
        <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/70">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Debt Coverage</span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-lg font-extrabold text-[#0F172A] font-money">98%</span>
            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">1.48% D/A</span>
          </div>
        </div>
        <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/70">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Savings Velocity</span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-lg font-extrabold text-[#0F172A] font-money">89%</span>
            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">74% Net</span>
          </div>
        </div>
        <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/70">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Audit Integrity</span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-lg font-extrabold text-emerald-800 font-money">100%</span>
            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">Reconciled</span>
          </div>
        </div>
      </div>

      {/* Interactive Bar Chart Area */}
      <div className="relative h-44 sm:h-48 w-full flex items-end justify-between gap-[2px] sm:gap-[3px] pt-6 pb-2 px-1 border-b border-slate-200/70 overflow-hidden">
        {/* Hover Tooltip */}
        {activeBar && (
          <div className="absolute top-1 left-1/2 -translate-x-1/2 z-20 pointer-events-none bg-[#0F172A] text-white px-3.5 py-1.5 rounded-full text-xs font-mono shadow-xl flex items-center gap-2">
            <span className={activeBar.isEmerald ? 'text-emerald-400 font-bold' : 'text-slate-200'}>
              T-{activeBar.dayAgo}d: {activeBar.zone} ({activeBar.score}% Health)
            </span>
            <span className="text-[10px] text-slate-400">• Minor Unit Audited</span>
          </div>
        )}

        {bars.map((b) => {
          const isHovered = hoveredBarIndex === b.index;
          return (
            <div
              key={b.index}
              onMouseEnter={() => setHoveredBarIndex(b.index)}
              onMouseLeave={() => setHoveredBarIndex(null)}
              className="flex-1 flex items-end h-full group cursor-pointer"
            >
              <div
                className={`w-full rounded-t-sm transition-all duration-200 ${
                  b.isEmerald
                    ? isHovered
                      ? 'bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.85)] scale-y-105'
                      : 'bg-emerald-500 hover:bg-emerald-400'
                    : isHovered
                    ? 'bg-slate-600 scale-y-105'
                    : 'bg-[#CBD5E1] hover:bg-[#94A3B8]'
                }`}
                style={{ height: `${b.height}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* Timeline Audit Markers */}
      <div className="flex justify-between items-center px-1 text-[11px] font-mono text-slate-500 select-none">
        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">
          T-60 Days
        </span>
        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">
          T-45 Days
        </span>
        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">
          T-30 Days
        </span>
        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">
          T-15 Days
        </span>
        <span className="px-3 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[10px] shadow-sm shadow-emerald-500/30 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span>Today (Live)</span>
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// 2. Capital Velocity & Savings Card (Authentic Wealth Intelligence)
// ============================================================================
export function CapitalVelocityCard() {
  return (
    <div className="keel-card p-6 h-full flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-xl transition-all duration-300">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Capital Velocity & Savings
          </span>
          <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-300">
            Top 5% Tier
          </span>
        </div>
        <p className="text-xs text-slate-600 font-medium leading-relaxed mb-3">
          Monthly net surplus converted directly into liquid savings and equity.
        </p>
        <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F172A] font-money flex items-baseline gap-2">
          <span>74.1%</span>
          <span className="text-xs font-sans text-emerald-600 font-bold">+8.65% MoM</span>
        </div>
      </div>

      {/* Multi-tier Capital Flow bar */}
      <div className="my-4 space-y-2">
        <div className="w-full h-11 bg-slate-100 rounded-xl p-1 flex items-center justify-between relative overflow-hidden">
          {/* Active Emerald Profit Gain Gradient Pill */}
          <div className="w-[74%] h-full rounded-lg bg-gradient-to-r from-emerald-500/20 via-emerald-400/30 to-emerald-500/40 border border-emerald-400/70 flex items-center justify-between px-3">
            <span className="text-[10px] font-bold text-emerald-950">Net Capital Saved</span>
            <span className="text-[10px] font-bold font-mono text-emerald-800 bg-white/95 px-2 py-0.5 rounded-full shadow-xs border border-emerald-200">
              +$4,338.77
            </span>
          </div>
          {/* Outflow balance */}
          <div className="w-[26%] h-full flex items-center justify-center text-[10px] font-mono font-semibold text-rose-700 bg-rose-50/70 rounded-r-lg border-l border-rose-200">
            -$1.5k Burn
          </div>
        </div>
      </div>

      {/* Legend Pills */}
      <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium pt-2 border-t border-slate-100">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" />
          <span className="font-semibold text-slate-800">Retained (74%)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
          <span>Invested (16%)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
          <span>Burn (10%)</span>
        </span>
      </div>
    </div>
  );
}
export const ConfidenceIndicatorCard = CapitalVelocityCard;

// ============================================================================
// 3. Tier-1 Liquidity Reserve Gauge Card (Dark Frosted Glassmorphism)
// ============================================================================
export function LiquidityRunwayGaugeCard() {
  const size = 160;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const arcLength = Math.PI * radius; // 180 degrees semicircular arc
  const activePercent = 82; // 82% of max 12-month runway capacity
  const strokeDashoffset = arcLength * (1 - activePercent / 100);

  return (
    <div className="keel-card-dark p-6 h-full flex flex-col justify-between relative overflow-hidden group hover:-translate-y-0.5 hover:shadow-2xl transition-all duration-300">
      {/* Ambient glow in corner */}
      <div className="absolute -top-12 -right-12 w-36 h-36 bg-sky-500/20 blur-3xl pointer-events-none rounded-full" />

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Tier-1 Liquidity Reserve
          </span>
          <span className="text-[10px] font-mono font-bold text-sky-400 bg-sky-950/80 px-2.5 py-0.5 rounded-full border border-sky-800/60">
            170% Funded
          </span>
        </div>
        <p className="text-xs text-slate-300 font-medium leading-relaxed mb-2">
          Liquid cash & deposits relative to 6-month resilience target.
        </p>
        <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-money flex items-baseline gap-2">
          <span>10.2 mo</span>
          <span className="text-xs font-sans text-sky-400 font-semibold">$54.6k Cash</span>
        </div>
      </div>

      {/* Semicircular Light Blue Arc Gauge */}
      <div className="my-2 flex items-center justify-center relative">
        <div className="w-40 h-24 overflow-hidden flex items-end justify-center relative">
          <svg viewBox={`0 0 ${size} ${size / 2 + 10}`} className="w-40 h-28">
            <defs>
              <linearGradient id="lightBlueArc" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#0284C7" />
                <stop offset="60%" stopColor="#0EA5E9" />
                <stop offset="100%" stopColor="#38BDF8" />
              </linearGradient>
            </defs>

            {/* Background Arc Track */}
            <path
              d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
              fill="transparent"
              stroke="rgba(255, 255, 255, 0.12)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />

            {/* Active Light Blue Glow Arc */}
            <path
              d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
              fill="transparent"
              stroke="url(#lightBlueArc)"
              strokeWidth={strokeWidth}
              strokeDasharray={arcLength}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
              style={{
                filter: 'drop-shadow(0 0 8px rgba(56, 189, 248, 0.5))',
              }}
            />
          </svg>
          <div className="absolute bottom-1 text-center">
            <span className="text-[11px] font-mono text-sky-300 font-bold block">10.2 / 6 mo</span>
          </div>
        </div>
      </div>

      {/* Legend Under Gauge */}
      <div className="flex items-center justify-between text-[10px] text-slate-300 font-mono pt-2 border-t border-white/[0.08]">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-sky-400" />
          <span className="text-white font-medium">Checking ($6.4k)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>HYSA ($48.2k)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-white/40" />
          <span>Zero Debt Drag</span>
        </span>
      </div>
    </div>
  );
}
export const DarkArcGaugeCard = LiquidityRunwayGaugeCard;

// ============================================================================
// 4. Market Trajectory & Net Worth Wave Chart (Bottom Right From Reference Image)
// ============================================================================
export function MarketTrajectoryWaveChart({
  currentNetWorthCents,
}: {
  currentNetWorthCents: number;
}) {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  // SVG wave geometry
  const width = 600;
  const height = 180;
  const nodes = [
    { x: 30, y: 120, label: 'May', val: 4780 },
    { x: 120, y: 130, label: 'Jun', val: 4850 },
    { x: 210, y: 125, label: 'Jul', val: 4920 },
    { x: 300, y: 110, label: 'Aug', val: 5010 },
    { x: 390, y: 85, label: 'Sep', val: 5120 },
    { x: 480, y: 105, label: 'Oct', val: 5021 },
    { x: 570, y: 90, label: 'Today', val: 5085 },
  ];

  // Generate upper and lower band paths
  const upperD = `M ${nodes[0].x} ${nodes[0].y - 25} C 80 ${nodes[0].y - 30}, 160 ${nodes[1].y - 20}, ${nodes[2].x} ${nodes[2].y - 30} C 250 ${nodes[2].y - 35}, 340 ${nodes[3].y - 35}, ${nodes[4].x} ${nodes[4].y - 30} C 430 ${nodes[4].y - 25}, 520 ${nodes[5].y - 25}, ${nodes[6].x} ${nodes[6].y - 20}`;
  const lowerD = `M ${nodes[0].x} ${nodes[0].y + 25} C 80 ${nodes[0].y + 30}, 160 ${nodes[1].y + 20}, ${nodes[2].x} ${nodes[2].y + 30} C 250 ${nodes[2].y + 35}, 340 ${nodes[3].y + 35}, ${nodes[4].x} ${nodes[4].y + 30} C 430 ${nodes[4].y + 25}, 520 ${nodes[5].y + 25}, ${nodes[6].x} ${nodes[6].y + 20}`;
  const centerD = `M ${nodes[0].x} ${nodes[0].y} C 80 ${nodes[0].y}, 160 ${nodes[1].y}, ${nodes[2].x} ${nodes[2].y} C 250 ${nodes[2].y}, 340 ${nodes[3].y}, ${nodes[4].x} ${nodes[4].y} C 430 ${nodes[4].y}, 520 ${nodes[5].y}, ${nodes[6].x} ${nodes[6].y}`;

  return (
    <div className="keel-card p-6 h-full flex flex-col justify-between">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider block mb-0.5">
            S&P 500 & Portfolio Trajectory
          </span>
          <div className="text-3xl font-bold tracking-tight text-[#0F172A] font-money flex items-center gap-2">
            <span>5,021.16</span>
            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-300 shadow-2xs">
              +8.65%
            </span>
          </div>
          <p className="text-xs text-neutral-600 mt-1 font-medium">
            Overall market sentiment and ledger performance.
          </p>
        </div>

        {/* Circular Action Button */}
        <button className="w-8 h-8 rounded-full border border-black/[0.1] flex items-center justify-center text-neutral-700 hover:text-emerald-600 hover:border-emerald-300 transition-colors shadow-2xs cursor-pointer">
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>

      {/* SVG Wave Chart with Vertical Dashed Nodes (Matching Reference Image) */}
      <div className="relative w-full h-36 my-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
          {/* Dashed vertical lines across nodes */}
          {nodes.map((n, i) => (
            <line
              key={i}
              x1={n.x}
              y1={n.y - 40}
              x2={n.x}
              y2={n.y + 40}
              stroke="rgba(0, 0, 0, 0.18)"
              strokeDasharray="2 3"
              strokeWidth="1.25"
            />
          ))}

          {/* Upper Envelope Line */}
          <path d={upperD} fill="none" stroke="rgba(0,0,0,0.22)" strokeWidth="1" strokeDasharray="3 3" />
          {/* Lower Envelope Line */}
          <path d={lowerD} fill="none" stroke="rgba(0,0,0,0.22)" strokeWidth="1" strokeDasharray="3 3" />

          {/* Center Main Trajectory Line */}
          <path d={centerD} fill="none" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" />

          {/* Key Black Dots at Nodes */}
          {nodes.map((n, i) => (
            <circle key={i} cx={n.x} cy={n.y} r={3.5} fill="#0F172A" />
          ))}

          {/* Highlight Green Profit Pill Marker (Matching Reference 8.65% Pill) */}
          <g transform="translate(440, 70)">
            <rect
              x="-24"
              y="-12"
              width="50"
              height="22"
              rx="11"
              fill="#10B981"
              filter="drop-shadow(0 2px 8px rgba(16, 185, 129, 0.45))"
            />
            <text
              x="1"
              y="3"
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="10"
              fontWeight="bold"
              fontFamily="monospace"
            >
              8.65%
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}

// ============================================================================
// 5. Asset Allocation & Liquidity Stacked Breakdown Chart
// ============================================================================
import type {
  FinancialAccount,
  DebtAccount,
  Transaction,
  SavingsGoal,
  BudgetCategory,
  BillSubscription,
} from '../types/finance';

interface AssetAllocationChartProps {
  accounts: FinancialAccount[];
  selectedType: string;
  onSelectType: (t: string) => void;
}

export function AssetAllocationChart({
  accounts,
  selectedType,
  onSelectType,
}: AssetAllocationChartProps) {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const categories = [
    { type: 'checking', label: 'Cash & Checking', color: '#0EA5E9' },
    { type: 'savings', label: 'High-Yield Savings', color: '#38BDF8' },
    { type: 'investment', label: 'Brokerage & Stocks', color: '#0284C7' },
    { type: 'credit', label: 'Credit Cards', color: '#F43F5E' },
    { type: 'loan', label: 'Loans & Mortgages', color: '#FB7185' },
  ];

  const categoryTotals = categories.map((cat) => {
    const accs = accounts.filter((a) => a.type === cat.type);
    const total = accs.reduce((sum, a) => sum + Math.abs(a.balanceCents), 0);
    return { ...cat, total, count: accs.length };
  });

  const grossAssetsCents = accounts
    .filter((a) => a.balanceCents > 0)
    .reduce((s, a) => s + a.balanceCents, 0);

  const grossLiabilitiesCents = accounts
    .filter((a) => a.balanceCents < 0)
    .reduce((s, a) => s + Math.abs(a.balanceCents), 0);

  const totalVolume = grossAssetsCents + grossLiabilitiesCents || 1;

  return (
    <div className="keel-card p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider block mb-0.5">
            Asset Distribution & Leverage
          </span>
          <h3 className="text-xl font-bold tracking-tight text-[#0F172A]">
            Capital Allocation Framework
          </h3>
          <p className="text-xs text-neutral-600 mt-0.5 font-medium">
            Real-time balance breakdown across deposit, investment, and debt accounts.
          </p>
        </div>

        {/* Quick Summary Badges: Assets (Green/Profit) & Liabilities (Red/Loss) */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-left">
            <span className="text-[10px] uppercase font-bold text-emerald-700 block tracking-wider">Gross Assets</span>
            <span className="text-sm font-bold text-emerald-900 font-money">+{formatMoney(grossAssetsCents)}</span>
          </div>
          <div className="px-3.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-left">
            <span className="text-[10px] uppercase font-bold text-rose-700 block tracking-wider">Liabilities</span>
            <span className="text-sm font-bold text-rose-900 font-money">-{formatMoney(grossLiabilitiesCents)}</span>
          </div>
        </div>
      </div>

      {/* Segmented Stacked Progress Bar */}
      <div className="space-y-2">
        <div className="h-6 w-full rounded-xl bg-neutral-100 p-1 flex gap-1 overflow-hidden">
          {categoryTotals.map((cat) => {
            if (cat.total === 0) return null;
            const pct = (cat.total / totalVolume) * 100;
            const isSelected = selectedType === cat.type.toUpperCase() || selectedType === 'ALL';
            const isHovered = hoveredCategory === cat.type;

            return (
              <button
                key={cat.type}
                type="button"
                onClick={() => onSelectType(selectedType === cat.type.toUpperCase() ? 'ALL' : cat.type.toUpperCase())}
                onMouseEnter={() => setHoveredCategory(cat.type)}
                onMouseLeave={() => setHoveredCategory(null)}
                style={{
                  width: `${Math.max(4, pct)}%`,
                  backgroundColor: cat.color,
                }}
                className={`h-full rounded-lg transition-all cursor-pointer relative group ${
                  isSelected ? 'opacity-100' : 'opacity-40'
                } ${isHovered ? 'scale-y-110 shadow-md ring-2 ring-sky-300' : ''}`}
                title={`${cat.label}: ${formatMoney(cat.total)} (${pct.toFixed(1)}%)`}
              />
            );
          })}
        </div>

        {/* Category Pill Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => onSelectType('ALL')}
            className={`btn-anim px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${
              selectedType === 'ALL'
                ? 'bg-[#0F172A] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All Accounts ({accounts.length})
          </button>
          {categoryTotals.map((cat) => {
            const isSelected = selectedType === cat.type.toUpperCase();
            return (
              <button
                key={cat.type}
                type="button"
                onClick={() => onSelectType(isSelected ? 'ALL' : cat.type.toUpperCase())}
                className={`btn-anim px-3.5 py-1.5 rounded-full text-xs font-medium cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-sky-500 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                <span>{cat.label}</span>
                <span className="text-[10px] opacity-80 font-mono">({cat.count})</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 6. Debt Payoff Trajectory Chart (Avalanche vs Snowball curves)
// ============================================================================
interface DebtPayoffTrajectoryChartProps {
  debts?: DebtAccount[];
  totalDebtCents?: number;
  snowballMonths: number;
  avalancheMonths: number;
  extraPaymentDollars: number;
  interestSavedCents: number;
}

export function DebtPayoffTrajectoryChart({
  debts,
  totalDebtCents,
  snowballMonths,
  avalancheMonths,
  extraPaymentDollars,
  interestSavedCents,
}: DebtPayoffTrajectoryChartProps) {
  const maxMonths = Math.max(snowballMonths, avalancheMonths, 12);
  const totalDebt = totalDebtCents ?? (debts ? debts.reduce((sum, d) => sum + d.balanceCents, 0) : 0);

  // Generate curve coordinates
  const width = 640;
  const height = 180;
  const padding = 30;

  // Coordinate mapper
  const getCoords = (months: number) => {
    const pts: { x: number; y: number }[] = [];
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      const m = frac * months;
      const x = padding + (m / maxMonths) * (width - padding * 2);
      // Exponential decay payoff curve
      const remainingBalanceRatio = Math.max(0, 1 - Math.pow(frac, 1.25));
      const y = height - padding - remainingBalanceRatio * (height - padding * 2);
      pts.push({ x, y });
    }
    return pts;
  };

  const avalanchePts = getCoords(avalancheMonths);
  const snowballPts = getCoords(snowballMonths);

  const ptsToPath = (pts: { x: number; y: number }[]) => {
    return pts.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, '');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider block mb-0.5">
            Algorithmic Payoff Simulator
          </span>
          <h4 className="text-lg font-bold tracking-tight text-[#0F172A]">
            Debt Freedom Trajectory Curves
          </h4>
        </div>

        {/* Highlight pill: Interest Saved (Green/Profit) */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-300">
            +{formatMoney(interestSavedCents)} Interest Saved
          </span>
          <span className="text-xs font-mono font-medium text-neutral-600">
            {Math.abs(snowballMonths - avalancheMonths)} Months Faster
          </span>
        </div>
      </div>

      {/* SVG Curve Canvas */}
      <div className="relative w-full h-44 bg-neutral-50/50 rounded-2xl border border-black/[0.05] p-3 overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
          {/* Subtle horizontal grid lines */}
          {[0.25, 0.5, 0.75].map((pct, i) => (
            <line
              key={i}
              x1={padding}
              y1={padding + pct * (height - padding * 2)}
              x2={width - padding}
              y2={padding + pct * (height - padding * 2)}
              stroke="rgba(0,0,0,0.06)"
              strokeDasharray="4 4"
            />
          ))}

          {/* Snowball Curve (Neutral Slate / Dashed) */}
          <path
            d={ptsToPath(snowballPts)}
            fill="none"
            stroke="#94A3B8"
            strokeWidth="2.5"
            strokeDasharray="4 4"
          />

          {/* Avalanche Curve (Vibrant Light Blue) */}
          <path
            d={ptsToPath(avalanchePts)}
            fill="none"
            stroke="#0EA5E9"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Freedom Endpoints */}
          {avalanchePts.length > 0 && (
            <g transform={`translate(${avalanchePts[avalanchePts.length - 1].x}, ${avalanchePts[avalanchePts.length - 1].y})`}>
              <circle r="5" fill="#0EA5E9" />
              <text x="0" y="-10" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#0EA5E9">
                {avalancheMonths} mo (Avalanche)
              </text>
            </g>
          )}

          {snowballPts.length > 0 && (
            <g transform={`translate(${snowballPts[snowballPts.length - 1].x}, ${snowballPts[snowballPts.length - 1].y})`}>
              <circle r="4" fill="#94A3B8" />
              <text x="0" y="18" textAnchor="middle" fontSize="9" fontWeight="medium" fill="#64748B">
                {snowballMonths} mo (Snowball)
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between text-xs text-neutral-500 pt-1">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1 rounded-full bg-sky-500" />
            <strong className="text-neutral-700">Avalanche Strategy</strong> (Optimizes APR)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1 rounded-full bg-neutral-400" />
            <span>Snowball Strategy (Smallest Balance)</span>
          </span>
        </div>
        <span className="text-[11px] font-mono text-neutral-400">
          With ${extraPaymentDollars}/mo extra accelerated payment
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// 7. Cash Flow Rhythm Histogram Chart
// ============================================================================
export function CashFlowRhythmChart({
  transactions,
  selectedDate,
  onSelectDate,
  currency = 'BDT',
}: {
  transactions: Transaction[];
  selectedDate?: string | null;
  onSelectDate?: (date: string) => void;
  currency?: string;
}) {
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  // Group last 14 days of activity
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const dateStr = d.toISOString().split('T')[0];
    const dayTxs = transactions.filter((t) => t.financialDate === dateStr);
    const income = dayTxs.filter((t) => t.amountCents > 0).reduce((s, t) => s + t.amountCents, 0);
    const expense = dayTxs.filter((t) => t.amountCents < 0).reduce((s, t) => s + Math.abs(t.amountCents), 0);
    return {
      date: dateStr,
      label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }),
      income,
      expense,
      count: dayTxs.length,
    };
  });

  const maxVal = Math.max(...days.map((d) => Math.max(d.income, d.expense)), 50000);

  return (
    <div className="keel-card p-6 sm:p-7 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
            Liquidity Velocity
          </span>
          <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#0F172A]">
            14-Day Cash Flow Rhythm
          </h3>
          <p className="text-xs text-slate-600 mt-0.5 font-medium">
            Dual-vector ledger visualization of inbound receipts vs. operational disbursements.
          </p>
        </div>

        {/* Legend: Profit (Green) vs Loss/Disbursements (Red) */}
        <div className="flex items-center gap-4 text-xs font-semibold">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shadow-xs" />
            <span className="text-emerald-800 font-bold">Inbound Deposits (Profit)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 shadow-xs" />
            <span className="text-rose-800 font-bold">Disbursements (Outflow)</span>
          </span>
        </div>
      </div>

      {/* Histogram Bar Arena */}
      <div className="h-44 sm:h-48 flex items-end justify-between gap-1.5 sm:gap-2.5 pt-6 pb-2 px-1 border-b border-slate-200/80 relative">
        {days.map((d) => {
          const isSelected = selectedDate === d.date;
          const isHovered = hoveredDay === d.date;
          const incomeHeight = (d.income / maxVal) * 100;
          const expenseHeight = (d.expense / maxVal) * 100;

          return (
            <div
              key={d.date}
              onClick={() => onSelectDate && onSelectDate(isSelected ? '' : d.date)}
              onMouseEnter={() => setHoveredDay(d.date)}
              onMouseLeave={() => setHoveredDay(null)}
              className="flex-1 flex flex-col items-center justify-end h-full group cursor-pointer relative"
            >
              {/* Tooltip on hover */}
              {isHovered && (
                <div className="absolute -top-14 left-1/2 -translate-x-1/2 z-30 pointer-events-none bg-[#0F172A] text-white px-3 py-1.5 rounded-xl text-[11px] font-mono shadow-2xl whitespace-nowrap border border-slate-700/80">
                  <div className="font-semibold text-slate-300">{d.label}</div>
                  <div className="text-emerald-400 font-bold font-money">+{formatMoney(d.income, currency)}</div>
                  <div className="text-rose-400 font-bold font-money">-{formatMoney(d.expense, currency)}</div>
                </div>
              )}

              {/* Inbound & Outbound Bars Side-by-Side: Green for Inflow/Profit, Red for Outflow */}
              <div className="w-full flex items-end justify-center gap-1 h-full">
                <div
                  style={{ height: `${Math.max(4, incomeHeight)}%` }}
                  className={`w-1/2 rounded-t-sm transition-all duration-200 ${
                    isSelected
                      ? 'bg-emerald-600 ring-2 ring-emerald-300 shadow-sm'
                      : 'bg-emerald-500 hover:bg-emerald-400'
                  }`}
                />
                <div
                  style={{ height: `${Math.max(4, expenseHeight)}%` }}
                  className={`w-1/2 rounded-t-sm transition-all duration-200 ${
                    isSelected
                      ? 'bg-rose-600 ring-2 ring-rose-300 shadow-sm'
                      : 'bg-rose-500/85 hover:bg-rose-500'
                  }`}
                />
              </div>

              {/* Day label */}
              <span className="text-[10px] font-mono font-medium text-neutral-500 mt-2 block">
                {d.date.slice(8)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// 8. Goal Trajectory & Horizon Acceleration Chart
// ============================================================================
export function GoalTrajectoryChart({ goals }: { goals: SavingsGoal[] }) {
  const totalTargetCents = goals.reduce((s, g) => s + g.targetCents, 0);
  const totalSavedCents = goals.reduce((s, g) => s + g.currentCents, 0);
  const overallPercent = totalTargetCents > 0 ? Math.round((totalSavedCents / totalTargetCents) * 100) : 0;

  return (
    <div className="keel-card p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">
            Capital Accumulation Horizon
          </span>
          <h3 className="text-xl font-bold tracking-tight text-[#0F172A]">
            Wealth Milestones & Target Velocity
          </h3>
          <p className="text-xs text-slate-600 font-medium mt-0.5">
            Aggregated target progress across all earmarked wealth reservoirs.
          </p>
        </div>

        {/* Global Progress Pill */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-2xl bg-sky-50 border border-sky-100 flex items-center gap-3">
            <span className="text-2xl font-bold font-money text-sky-700">{overallPercent}%</span>
            <div className="text-left text-xs">
              <span className="text-sky-900 font-bold block">{formatMoney(totalSavedCents)}</span>
              <span className="text-neutral-400 text-[11px]">of {formatMoney(totalTargetCents)} Target</span>
            </div>
          </div>
        </div>
      </div>

      {/* Segmented Goal Stacked Pill Progress */}
      <div className="space-y-4">
        <div className="h-4 w-full bg-neutral-100 rounded-full overflow-hidden p-0.5 flex gap-1">
          {goals.map((g, i) => {
            const weight = (g.currentCents / (totalSavedCents || 1)) * 100;
            const colors = ['#0EA5E9', '#38BDF8', '#0284C7', '#7DD3FC', '#BAE6FD'];
            return (
              <div
                key={g.id}
                style={{ width: `${Math.max(5, weight)}%`, backgroundColor: colors[i % colors.length] }}
                className="h-full rounded-full transition-all duration-300"
                title={`${g.name}: ${formatMoney(g.currentCents)}`}
              />
            );
          })}
        </div>

        {/* Goal Quick Ticker */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {goals.slice(0, 4).map((g) => {
            const pct = Math.min(100, Math.round((g.currentCents / (g.targetCents || 1)) * 100));
            return (
              <div key={g.id} className="p-3 rounded-xl bg-neutral-50 border border-black/[0.04] space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-800 truncate">{g.name}</span>
                  <span className="font-mono text-sky-600 font-bold">{pct}%</span>
                </div>
                <div className="text-[11px] text-neutral-500 font-money">
                  {formatMoney(g.currentCents)} / {formatMoney(g.targetCents)}
                </div>
                <div className="w-full h-1.5 bg-neutral-200 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-sky-500 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 9. Budget Pacing Gauge Chart
// ============================================================================
export function BudgetPacingGaugeChart({ budgets }: { budgets: BudgetCategory[] }) {
  const totalAllocatedCents = budgets.reduce((s, b) => s + b.allocatedCents, 0);
  const totalSpentCents = budgets.reduce((s, b) => s + b.spentCents, 0);
  const overallPercent = totalAllocatedCents > 0 ? Math.round((totalSpentCents / totalAllocatedCents) * 100) : 0;

  // Day of month elapsed fraction (e.g. 16th / 31)
  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthElapsedPercent = Math.round((dayOfMonth / daysInMonth) * 100);

  const isUnderPace = overallPercent <= monthElapsedPercent;

  return (
    <div className="keel-card p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider block mb-0.5">
            Burn Rate & Cadence
          </span>
          <h3 className="text-xl font-bold tracking-tight text-[#0F172A]">
            Monthly Budget Pacing Index
          </h3>
          <p className="text-xs text-neutral-600 mt-0.5 font-medium">
            Active burn rate normalized against month-to-date calendar progression.
          </p>
        </div>

        {/* Pacing Badge: Green for Under-Pace (Savings/Profit) vs Red for Over-Pace (Deficit/Loss) */}
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full border ${
              isUnderPace
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-rose-50 text-rose-800 border-rose-300'
            }`}
          >
            {isUnderPace ? 'Pacing Optimal: Under Target (Surplus)' : 'Pacing Alert: Accelerated Burn (Deficit)'}
          </span>
        </div>
      </div>

      {/* Dual Progress Comparison Bar */}
      <div className="space-y-3 bg-neutral-50 p-4 rounded-2xl border border-black/[0.04]">
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="font-semibold text-neutral-800">Budget Consumed ({overallPercent}%)</span>
            <span className="font-mono text-neutral-600 font-money">
              {formatMoney(totalSpentCents)} of {formatMoney(totalAllocatedCents)}
            </span>
          </div>
          <div className="w-full h-3 bg-neutral-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isUnderPace ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
              style={{ width: `${Math.min(100, overallPercent)}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1.5 text-neutral-600 font-medium">
            <span>Calendar Month Elapsed ({monthElapsedPercent}%)</span>
            <span className="font-mono text-[11px] font-semibold text-neutral-700">
              Day {dayOfMonth} of {daysInMonth}
            </span>
          </div>
          <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-neutral-500 rounded-full transition-all duration-500"
              style={{ width: `${monthElapsedPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 10. Bills Liquidity Drain Timeline Chart
// ============================================================================
export function BillsDrainTimelineChart({
  bills,
  checkingBalanceCents,
}: {
  bills: BillSubscription[];
  checkingBalanceCents: number;
}) {
  const totalBillsCents = bills.reduce((s, b) => s + b.amountCents, 0);

  // Generate 30 days projection
  const days = Array.from({ length: 30 }, (_, i) => {
    const day = i + 1;
    // Find bills due on this day
    const dayBills = bills.filter((b) => {
      const due = new Date(b.nextDueDate).getDate();
      return due === day;
    });
    const drain = dayBills.reduce((s, b) => s + b.amountCents, 0);
    return { day, drain, billCount: dayBills.length };
  });

  return (
    <div className="keel-card p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider block mb-0.5">
            Cash Outflow Projection
          </span>
          <h3 className="text-xl font-bold tracking-tight text-[#0F172A]">
            30-Day Liquidity Drain Timeline
          </h3>
          <p className="text-xs text-neutral-600 mt-0.5 font-medium">
            Forward schedule of scheduled recurring debits mapped against primary cash account.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-left">
            <span className="text-[10px] uppercase font-bold text-rose-700 block tracking-wider">Scheduled Debits (Loss)</span>
            <span className="text-sm font-bold text-rose-900 font-money">-{formatMoney(totalBillsCents)}</span>
          </div>
        </div>
      </div>

      {/* 30-day mini calendar matrix */}
      <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-15 gap-1.5 pt-2">
        {days.map((d) => {
          const hasBills = d.drain > 0;
          return (
            <div
              key={d.day}
              className={`p-2 rounded-xl border text-center transition-all ${
                hasBills
                  ? 'bg-rose-50/80 border-rose-200 text-rose-900 shadow-xs'
                  : 'bg-neutral-50/60 border-black/[0.04] text-neutral-400'
              }`}
            >
              <div className="text-[10px] font-mono font-medium">Day {d.day}</div>
              {hasBills ? (
                <div className="text-[11px] font-bold font-money text-rose-700 mt-0.5 truncate">
                  -${Math.round(d.drain / 100)}
                </div>
              ) : (
                <div className="text-[10px] text-neutral-400 mt-0.5">-</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
