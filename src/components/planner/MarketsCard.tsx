'use client';

import React, { useMemo, useState } from 'react';
import { TrendingUp, Check, Loader2, Star } from 'lucide-react';
import { countryName } from '../../lib/countries';
import type { InstrumentStats, SuggestedMix, Risk } from '../../lib/planning/markets';
import { LineChart } from './LineChart';
import { useMarkets } from './useMarkets';

export const pct = (bps: number | null) => (bps === null ? '—' : `${bps >= 0 ? '+' : ''}${(bps / 100).toFixed(1)}%`);
const tone = (bps: number | null) => (bps === null ? 'text-slate-400' : bps >= 0 ? 'text-emerald-700' : 'text-rose-700');
const COLORS = ['#0284C7', '#10B981', '#F59E0B', '#8B5CF6', '#F43F5E', '#64748B'];

const sameMix = (mix: SuggestedMix, allocation: Array<{ symbol: string; weightPct: number }> | null) =>
  !!allocation && allocation.length === mix.picks.length && mix.picks.every((p) => allocation.some((a) => a.symbol === p.symbol && a.weightPct === p.weightPct));

/** Real market history by region/asset (live prices) and five history-based mixes to choose from. */
export function MarketsCard({
  country,
  risk,
  years,
  stressed,
  allocation,
  onApply,
}: {
  country: string;
  risk: Risk;
  years: number;
  stressed: boolean;
  allocation: Array<{ symbol: string; weightPct: number }> | null;
  onApply?: (mix: SuggestedMix) => Promise<void>;
}) {
  const { data, loading, error } = useMarkets(country, risk, years, stressed);
  const [chosen, setChosen] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const mixes = data?.mixes ?? [];
  const mix = mixes.find((m) => m.id === chosen) ?? mixes.find((m) => sameMix(m, allocation)) ?? mixes.find((m) => m.suggested) ?? mixes[0];

  const chart = useMemo(() => {
    if (!data || !mix) return null;
    const funds = mix.picks.map((p) => data.stats.find((s) => s.symbol === p.symbol)).filter((s): s is InstrumentStats => !!s && s.history.length > 1);
    const len = Math.min(...funds.map((s) => s.history.length));
    if (!funds.length || !Number.isFinite(len)) return null;
    return {
      labels: funds[0].history.slice(-len).map((p) => p.date.slice(0, 4)),
      series: funds.map((s, i) => {
        const h = s.history.slice(-len);
        return { label: s.label, color: COLORS[i % COLORS.length], values: h.map((p) => Math.round((p.close / h[0].close) * 10_000)) };
      }),
    };
  }, [data, mix]);

  return (
    <section className="keel-card p-5 sm:p-6" aria-label="Market history and suggestions">
      <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#0F172A]">
        <TrendingUp className="h-4 w-4 text-emerald-600" /> What history says: markets &amp; mixes to choose from
      </h3>
      <p className="mt-0.5 text-[11px] text-slate-500">
        Five ways to invest a {risk} plan over {years} years, built from how real index funds did over the last 10 years. Prices update every 15 minutes. Past returns don&apos;t guarantee future results.
      </p>

      {loading ? (
        <div className="mt-4 space-y-2" aria-busy="true">
          <div className="wp-skeleton h-12 w-full" />
          <div className="wp-skeleton h-40 w-full" />
        </div>
      ) : error || !data || !mix ? (
        <p className="mt-4 text-xs font-semibold text-slate-500">{error ?? 'Market data is unavailable right now.'}</p>
      ) : (
        <>
          <div role="tablist" aria-label="Suggested mixes" className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {mixes.map((m) => {
              const active = m.id === mix.id;
              const inPlan = sameMix(m, allocation);
              return (
                <button key={m.id} role="tab" aria-selected={active} onClick={() => setChosen(m.id)} className={`rounded-2xl border p-3 text-left transition-all cursor-pointer ${active ? 'border-emerald-300 bg-emerald-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                  <span className="flex items-center justify-between gap-1">
                    <span className="text-xs font-extrabold text-[#0F172A]">{m.name}</span>
                    {inPlan ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-label="In your plan" /> : m.suggested ? <Star className="h-3.5 w-3.5 text-amber-500" aria-label="Suggested" /> : null}
                  </span>
                  <span className={`mt-1 block font-mono text-sm font-bold ${tone(m.expectedReturnBps)}`}>{pct(m.expectedReturnBps)}/yr</span>
                  <span className="block text-[10px] text-slate-500">worst fall {pct(m.worstDrawdownBps)} · {m.picks.length} funds</span>
                </button>
              );
            })}
          </div>

          <div className="wp-fade-swap mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4" key={mix.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-extrabold text-emerald-950">
                  {mix.name}
                  {mix.suggested && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">Suggested for this plan</span>}
                </p>
                <p className="mt-0.5 text-[11px] text-emerald-900/80">{mix.summary}</p>
                <p className="mt-1 text-[11px] font-semibold text-emerald-950">
                  History-based return {pct(mix.expectedReturnBps)}/yr · ups &amp; downs {mix.volatilityBps === null ? '—' : `${(mix.volatilityBps / 100).toFixed(0)}%`} · worst past fall {pct(mix.worstDrawdownBps)}
                </p>
              </div>
              {onApply &&
                (sameMix(mix, allocation) ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-700 px-3 py-1.5 text-[11px] font-bold text-white">
                    <Check className="h-3 w-3" /> In your plan
                  </span>
                ) : (
                  <button
                    disabled={applying}
                    onClick={async () => {
                      setApplying(true);
                      await onApply(mix);
                      setApplying(false);
                    }}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-700 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-800 disabled:opacity-60 cursor-pointer"
                  >
                    {applying && <Loader2 className="h-3 w-3 animate-spin" />} Apply this mix to my plan
                  </button>
                ))}
            </div>
            <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {mix.picks.map((p) => (
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
              {mix.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>

          {chart && (
            <div className="mt-5">
              <h4 className="text-xs font-bold text-slate-700">100 invested 10 years ago in each fund of “{mix.name}”</h4>
              <LineChart ariaLabel={`Growth of 100 in each fund of ${mix.name}`} xLabels={chart.labels} series={chart.series} currency="USD" />
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
                  <tr key={s.symbol} className={mix.picks.some((p) => p.symbol === s.symbol) ? 'bg-emerald-50/40' : ''}>
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
                    <span className={`text-[9px] font-mono font-bold ${y.pct >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {y.pct > 0 ? '+' : ''}
                      {y.pct}%
                    </span>
                    <div className={`wp-bar w-full rounded-t ${y.pct >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`} style={{ height: `${Math.max(4, Math.min(60, Math.abs(y.pct) * 1.6))}px` }} />
                    <span className="text-[9px] text-slate-400">{y.year}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="mt-4 text-[10px] text-slate-400">
            Sources: {data.sources.join(' · ')}
            {data.asOf ? ` · updated ${new Date(data.asOf).toLocaleTimeString()}` : ''}. Funds are examples of broad, low-cost index exposure, not a recommendation of a specific product; check what you can buy where you live.
          </p>
        </>
      )}
    </section>
  );
}
