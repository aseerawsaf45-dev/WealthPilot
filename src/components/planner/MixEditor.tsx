'use client';

import React, { useMemo, useState } from 'react';
import { PieChart, Pencil, Plus, Trash2, Loader2, Scale } from 'lucide-react';
import { UNIVERSE, mixStats } from '../../lib/planning/markets';
import type { InvestmentPlan } from '../../types/finance';
import { useMarkets } from './useMarkets';
import { pct } from './MarketsCard';

type Item = { symbol: string; label: string; weightPct: number };
const COLORS = ['bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500', 'bg-rose-500', 'bg-slate-500', 'bg-teal-500', 'bg-orange-500', 'bg-indigo-500', 'bg-lime-500'];

/** The plan's chosen fund mix: shown as a bar with live history stats, editable (weights must total 100%). */
export function MixEditor({ plan, onSave }: { plan: InvestmentPlan; onSave: (allocation: Item[] | null, mixName: string | null, returnBps: number | null) => Promise<void> }) {
  const years = Math.max(1, Math.round(plan.horizonMonths / 12));
  const { data } = useMarkets(plan.country, plan.riskProfile, years, plan.scenarios.length > 0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Item[]>([]);
  const [saving, setSaving] = useState(false);
  const items = useMemo(() => (editing ? draft : plan.allocation ?? []), [editing, draft, plan.allocation]);
  const stats = useMemo(() => (data ? mixStats(items, data.stats) : null), [data, items]);
  const total = draft.reduce((s, x) => s + (Number.isFinite(x.weightPct) ? x.weightPct : 0), 0);
  const unused = UNIVERSE.filter((u) => !draft.some((d) => d.symbol === u.symbol));

  const start = () => {
    setDraft((plan.allocation ?? []).map((a) => ({ ...a })));
    setEditing(true);
  };
  const balance = () => {
    // Scale weights so they add up to exactly 100 (largest remainders).
    const t = draft.reduce((s, x) => s + x.weightPct, 0);
    if (!t) return;
    const raw = draft.map((d) => (d.weightPct * 100) / t);
    const out = raw.map(Math.floor);
    let left = 100 - out.reduce((s, x) => s + x, 0);
    raw.map((r, i) => [r - out[i], i] as const).sort((a, b) => b[0] - a[0]).forEach(([, i]) => {
      if (left-- > 0) out[i]++;
    });
    setDraft(draft.map((d, i) => ({ ...d, weightPct: out[i] })));
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4" aria-label="Your investment mix">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-xs font-extrabold text-[#0F172A]">
          <PieChart className="h-4 w-4 text-sky-600" /> Your mix{plan.mixName ? `: ${plan.mixName}${editing ? '' : ''}` : ''}
        </h4>
        {!editing && (
          <button onClick={start} className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-bold text-slate-700 hover:border-slate-400 cursor-pointer">
            <Pencil className="h-3 w-3" /> {plan.allocation ? 'Edit mix' : 'Build my own'}
          </button>
        )}
      </div>

      {!editing && !plan.allocation && <p className="mt-2 text-[11px] text-slate-500">No mix yet: pick one of the suggested mixes below, build your own, or ask the copilot (“apply the growth mix to {plan.name}”).</p>}

      {items.length > 0 && (
        <>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-200" aria-hidden>
            {items.map((a, i) => (
              <div key={a.symbol} className={`${COLORS[i % COLORS.length]} transition-all duration-500`} style={{ width: `${Math.max(0, a.weightPct)}%` }} title={`${a.label} ${a.weightPct}%`} />
            ))}
          </div>
          {stats && (
            <p className="mt-2 text-[11px] font-semibold text-slate-700">
              History-based return {pct(stats.expectedReturnBps)}/yr · ups &amp; downs {stats.volatilityBps === null ? '—' : `${(stats.volatilityBps / 100).toFixed(0)}%`} · worst past fall {pct(stats.worstDrawdownBps)}
              {!editing && plan.expectedReturnBps !== null && stats.expectedReturnBps !== null && plan.expectedReturnBps !== stats.expectedReturnBps && <span className="ml-1 text-slate-500">(plan uses your own {(plan.expectedReturnBps / 100).toFixed(1)}%)</span>}
            </p>
          )}
        </>
      )}

      {!editing && items.length > 0 && (
        <ul className="mt-2 grid grid-cols-1 gap-1 text-[11px] sm:grid-cols-2">
          {items.map((a, i) => (
            <li key={a.symbol} className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-sm ${COLORS[i % COLORS.length]}`} />
              <span className="flex-1 text-slate-700">{a.label}</span>
              <span className="font-mono font-bold text-slate-900">{a.weightPct}%</span>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <div className="mt-3 space-y-2">
          {draft.map((a, i) => (
            <div key={a.symbol} className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${COLORS[i % COLORS.length]}`} />
              <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-700">
                {a.label} <span className="font-mono text-[10px] text-slate-400">{a.symbol}</span>
              </span>
              <input
                type="number"
                min={0}
                max={100}
                aria-label={`Weight of ${a.label} (%)`}
                value={Number.isFinite(a.weightPct) ? a.weightPct : ''}
                onChange={(e) => setDraft(draft.map((d) => (d.symbol === a.symbol ? { ...d, weightPct: Math.max(0, Math.min(100, Math.round(Number(e.target.value)))) } : d)))}
                className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right font-mono text-xs font-bold"
              />
              <span className="text-[11px] text-slate-500">%</span>
              <button aria-label={`Remove ${a.label}`} onClick={() => setDraft(draft.filter((d) => d.symbol !== a.symbol))} className="rounded-full p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {unused.length > 0 && draft.length < 10 && (
            <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
              <Plus className="h-3.5 w-3.5" />
              <select
                value=""
                onChange={(e) => {
                  const u = UNIVERSE.find((x) => x.symbol === e.target.value);
                  if (u) setDraft([...draft, { symbol: u.symbol, label: u.label, weightPct: 0 }]);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px]"
                aria-label="Add a fund"
              >
                <option value="">Add a fund…</option>
                {unused.map((u) => (
                  <option key={u.symbol} value={u.symbol}>
                    {u.label} ({u.symbol})
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className={`text-[11px] font-bold ${total === 100 ? 'text-emerald-700' : 'text-rose-700'}`}>
              Total {total}% {total !== 100 && `(${total < 100 ? 'add' : 'remove'} ${Math.abs(100 - total)}%)`}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {total !== 100 && total > 0 && (
                <button onClick={balance} className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-bold text-slate-700 cursor-pointer">
                  <Scale className="h-3 w-3" /> Balance to 100%
                </button>
              )}
              <button onClick={() => setEditing(false)} className="rounded-full px-3 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 cursor-pointer">
                Cancel
              </button>
              {plan.allocation && (
                <button
                  onClick={async () => {
                    setSaving(true);
                    await onSave(null, null, null);
                    setSaving(false);
                    setEditing(false);
                  }}
                  className="rounded-full px-3 py-1 text-[11px] font-bold text-rose-700 hover:text-rose-900 cursor-pointer"
                >
                  Remove mix
                </button>
              )}
              <button
                disabled={total !== 100 || saving || !draft.length}
                onClick={async () => {
                  setSaving(true);
                  const kept = draft.filter((d) => d.weightPct > 0);
                  const s = data ? mixStats(kept, data.stats) : null;
                  const renamed = plan.mixName && !plan.mixName.endsWith('(edited)') ? `${plan.mixName} (edited)` : plan.mixName ?? 'My own mix';
                  await onSave(kept, renamed, s?.expectedReturnBps ?? null);
                  setSaving(false);
                  setEditing(false);
                }}
                className="inline-flex items-center gap-1 rounded-full bg-[#0F172A] px-3 py-1 text-[11px] font-bold text-white disabled:opacity-40 cursor-pointer"
              >
                {saving && <Loader2 className="h-3 w-3 animate-spin" />} Save mix
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
