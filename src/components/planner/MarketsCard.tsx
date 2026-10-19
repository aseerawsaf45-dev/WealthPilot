'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { TrendingUp, Check } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { countryName } from '../../lib/countries';
import type { InstrumentStats, SuggestedMix, Risk } from '../../lib/planning/markets';
import { LineChart } from './LineChart';

interface MarketsResponse {
  stats: InstrumentStats[];
  mix: SuggestedMix;
  countryHistory: Array<{ year: string; pct: number }>;
  asOf: string | null;
  sources: string[];
}

const pct = (bps: number | null) => (bps === null ? '—' : `${bps >= 0 ? '+' : ''}${(bps / 100).toFixed(1)}%`);
const tone = (bps: number | null) => (bps === null ? 'text-slate-400' : bps >= 0 ? 'text-emerald-700' : 'text-rose-700');
const COLORS = ['#0284C7', '#10B981', '#F59E0B', '#8B5CF6', '#F43F5E', '#64748B'];

/** Real market history by region/asset (live prices) and a history-based mix for the plan's risk. */
export function MarketsCard({ country, risk, years, onUseReturn }: { country: string; risk: Risk; years: number; onUseReturn?: (bps: number) => void }) {
  const [state, setState] = useState<{ key: string; data: MarketsResponse | null; error: string | null }>({ key: '', data: null, error: null });
  const [used, setUsed] = useState(false);
  const key = `${country}:${risk}:${years}`;

  useEffect(() => {
    let live = true;
    api
      .get<MarketsResponse>(`/markets?country=${encodeURIComponent(country)}&risk=${risk}&years=${years}`)
      .then((data) => live && setState({ key, data, error: null }))
      .catch((e) => live && setState({ key, data: null, error: e instanceof ApiError ? e.message : 'Market data is unavailable right now.' }));
    return () => {
      live = false;
    };
  }, [country, risk, years, key]);

  const data = state.key === key ? state.data : null;
  const loading = state.key !== key;
  const chart = useMemo(() => {
    if (!data) return null;
    const chosen = data.mix.picks.map((p) => data.stats.find((s) => s.symbol === p.symbol)).filter((s): s is InstrumentStats => !!s && s.history.length > 1);
    const len = Math.min(...chosen.map((s) => s.history.length));
    if (!chosen.length || !Number.isFinite(len)) return null;
    // Growth of 100 invested 10 years ago (minor units of a notional 100.00).
    return {
      labels: chosen[0].history.slice(-len).map((p) => p.date.slice(0, 4)),
      series: chosen.map((s, i) => {
        const h = s.history.slice(-len);
        return { label: s.label, color: COLORS[i % COLORS.length], values: h.map((p) => Math.round((p.close / h[0].close) * 10_000)) };
      }),
    };
  }, [data]);

  return (
    <section className="keel-card p-5 sm:p-6" aria-label="Market history and suggestions">
      <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#0F172A]">
        <TrendingUp className="h-4 w-4 text-emerald-600" /> What history says: markets &amp; a suggested mix
      </h3>
      <p className="mt-0.5 text-[11px] text-slate-500">
        Real prices of broad index funds, updated every 15 minutes, and how each region and asset did over the last 10 years. Past returns don&apos;t guarantee future results.
      </p>

      {loading ? (
        <div className="mt-4 space-y-2" aria-busy="true">
          <div className="wp-skeleton h-24 w-full" />
          <div className="wp-skeleton h-40 w-full" />
        </div>
      ) : state.error || !data ? (
        <p className="mt-4 text-xs font-semibold text-slate-500">{state.error ?? 'Market data is unavailable right now.'}</p>
      ) : (
        <>
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-extrabold text-emerald-950">
                Suggested {risk} mix for {years} years · history-based return {pct(data.mix.expectedReturnBps)}/yr · worst past fall {pct(data.mix.worstDrawdownBps)}
              </p>
              {onUseReturn && data.mix.expectedReturnBps !== null && (
                <button
                  onClick={() => {
                    onUseReturn(data.mix.expectedReturnBps!);
                    setUsed(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-700 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-800 cursor-pointer"
                >
                  {used ? <Check className="h-3 w-3" /> : null} {used ? 'Using it' : 'Use this return in my plan'}
                </button>
              )}
            </div>
            <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {data.mix.picks.map((p) => (
                <li key={p.symbol} className="rounded-xl border border-emerald-200/70 bg-white/80 p-3">
                  <p className="flex items-baseline justify-between text-xs font-bold text-[#0F172A]">
                    <span>
                      {p.label} <span className="font-mono text-[10px] text-slate-400">{p.symbol}</span>
                    </span>
                    <span className="font-money text-emerald-800">{p.weightPct}%</span>
                  </p>
                  <ul className="mt-1 space-y-0.5 text-[10px] text-slate-600">
                    {p.reasons.map((r) => (
                      <li key={r}>· {r}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            <ul className="mt-2 space-y-0.5 text-[10px] text-emerald-900/80">
              {data.mix.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>

          {chart && (
            <div className="mt-5">
              <h4 className="text-xs font-bold text-slate-700">100 invested 10 years ago in each suggested fund</h4>
              <LineChart ariaLabel="Growth of 100 in each suggested fund" xLabels={chart.labels} series={chart.series} currency="USD" />
            </div>
          )}

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2">Region / asset</th>
                  <th className="px-3 py-2 text-right">Price</th>
                  <th className="px-3 py-2 text-right">1 year</th>
                  <th className="px-3 py-2 text-right">5 yrs /yr</th>
                  <th className="px-3 py-2 text-right">10 yrs /yr</th>
                  <th className="px-3 py-2 text-right">Ups &amp; downs</th>
                  <th className="px-3 py-2 text-right">Worst fall</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.stats.map((s) => (
                  <tr key={s.symbol} className={data.mix.picks.some((p) => p.symbol === s.symbol) ? 'bg-emerald-50/40' : ''}>
                    <td className="px-3 py-2 font-semibold text-[#0F172A]">
                      {s.label} <span className="font-mono text-[10px] text-slate-400">{s.symbol}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-money" title={s.lastTime ? `Quoted ${new Date(s.lastTime).toLocaleString()}` : undefined}>
                      {s.lastPrice?.toFixed(2) ?? '—'} <span className="text-[10px] text-slate-400">{s.currency}</span>
                    </td>
                    <td className={`px-3 py-2 text-right font-mono ${tone(s.return1yBps)}`}>{pct(s.return1yBps)}</td>
                    <td className={`px-3 py-2 text-right font-mono ${tone(s.return5yBps)}`}>{pct(s.return5yBps)}</td>
                    <td className={`px-3 py-2 text-right font-mono ${tone(s.return10yBps)}`}>{pct(s.return10yBps)}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-600">{s.volatilityBps === null ? '—' : `${(s.volatilityBps / 100).toFixed(0)}%`}</td>
                    <td className="px-3 py-2 text-right font-mono text-rose-700">{pct(s.maxDrawdownBps)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.countryHistory.length > 0 && (
            <div className="mt-5">
              <h4 className="text-xs font-bold text-slate-700">{countryName(country)}&apos;s own stock market, yearly change (World Bank)</h4>
              <div className="mt-2 flex items-end gap-1.5" role="img" aria-label={`Yearly stock market change in ${countryName(country)}`}>
                {data.countryHistory.map((y) => (
                  <div key={y.year} className="flex flex-1 flex-col items-center gap-1">
                    <span className={`text-[9px] font-mono font-bold ${y.pct >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{y.pct > 0 ? '+' : ''}{y.pct}%</span>
                    <div className={`wp-bar w-full rounded-t ${y.pct >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`} style={{ height: `${Math.max(4, Math.min(60, Math.abs(y.pct) * 1.6))}px` }} />
                    <span className="text-[9px] text-slate-400">{y.year}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="mt-4 text-[10px] text-slate-400">
            Sources: {data.sources.join(' · ')}{data.asOf ? ` · updated ${new Date(data.asOf).toLocaleTimeString()}` : ''}. Funds are examples of broad, low-cost index exposure, not a recommendation of a specific product; check what you can buy where you live.
          </p>
        </>
      )}
    </section>
  );
}
