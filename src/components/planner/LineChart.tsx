'use client';

import React, { useState } from 'react';
import { formatCompactMoney } from '../../lib/money';

export interface Series {
  label: string;
  color: string;
  values: number[];
  dashed?: boolean;
}

/** Small responsive SVG line chart with an optional shaded range band and hover read-out. */
export function LineChart({ series, band, xLabels, height = 200, ariaLabel, currency }: { series: Series[]; band?: { low: number[]; high: number[]; color: string; label: string }; xLabels: string[]; height?: number; ariaLabel: string; currency?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 640;
  const pad = { l: 56, r: 12, t: 12, b: 26 };
  const all = [...series.flatMap((s) => s.values), ...(band ? [...band.low, ...band.high] : [])];
  const n = Math.max(1, ...series.map((s) => s.values.length)) - 1;
  if (!all.length) return null;
  const max = Math.max(...all, 0);
  const min = Math.min(...all, 0);
  const span = max - min || 1;
  const x = (i: number) => pad.l + (n ? (i / n) * (width - pad.l - pad.r) : 0);
  const y = (v: number) => pad.t + (1 - (v - min) / span) * (height - pad.t - pad.b);
  const path = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const bandPath = band ? `${path(band.high)} ${band.low.map((v, i) => `L${x(band.low.length - 1 - i).toFixed(1)} ${y(band.low[band.low.length - 1 - i]).toFixed(1)}`).join(' ')} Z` : '';
  const ticks = [max, (max + min) / 2, min];
  const step = Math.max(1, Math.ceil(xLabels.length / 8));

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={ariaLabel} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="rgba(15,23,42,0.07)" strokeDasharray="4 4" />
            <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill="#94A3B8">
              {formatCompactMoney(Math.round(t), currency)}
            </text>
          </g>
        ))}
        {min < 0 && <line x1={pad.l} x2={width - pad.r} y1={y(0)} y2={y(0)} stroke="#CBD5E1" />}
        {band && <path d={bandPath} fill={band.color} opacity={0.18} className="wp-fade-swap" />}
        {series.map((s) => (
          <path key={s.label} d={path(s.values)} fill="none" stroke={s.color} strokeWidth={s.dashed ? 2 : 2.75} strokeDasharray={s.dashed ? '5 5' : undefined} strokeLinecap="round" pathLength={s.dashed ? undefined : 1} className={s.dashed ? undefined : 'wp-draw'} />
        ))}
        {xLabels.map((l, i) =>
          i % step === 0 || i === xLabels.length - 1 ? (
            <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize="9" fill="#94A3B8">
              {l}
            </text>
          ) : null
        )}
        {xLabels.map((_, i) => (
          <rect key={`h${i}`} x={x(i) - (width / Math.max(1, n)) / 2} y={0} width={width / Math.max(1, n)} height={height} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={height - pad.b} stroke="#94A3B8" strokeDasharray="3 3" />}
      </svg>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-600">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-1 w-4 rounded-full" style={{ background: s.color }} />
            {s.label}
            {hover !== null && s.values[hover] !== undefined && <strong className="font-money text-slate-900">{formatCompactMoney(s.values[hover], currency)}</strong>}
          </span>
        ))}
        {band && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-4 rounded" style={{ background: band.color, opacity: 0.3 }} />
            {band.label}
          </span>
        )}
        {hover !== null && <span className="text-slate-400">{xLabels[hover]}</span>}
      </div>
    </div>
  );
}
