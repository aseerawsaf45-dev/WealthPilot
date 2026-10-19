'use client';

import React, { useEffect, useState } from 'react';
import { Building2, Newspaper, Sparkles, Loader2, AlertTriangle, ExternalLink, Plus, Globe2 } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { api, ApiError } from '../../lib/api';
import { countryName } from '../../lib/countries';
import type { BankPick } from '../../lib/planning/banks';

interface BanksResponse {
  picks: BankPick[];
  newsCount: number;
  benchmark: { value: number; year: string } | null;
  banksAsOf: string | null;
  newsAsOf: string | null;
  sources: string[];
}

const TABS = [
  { id: 'worth', label: 'Worth comparing' },
  { id: 'local', label: 'Local' },
  { id: 'international', label: 'International' },
  { id: 'caution', label: 'Caution' },
] as const;
type Tab = (typeof TABS)[number]['id'];

const dateLabel = (d: string) => {
  const t = Date.parse(`${d}T00:00:00Z`);
  return Number.isNaN(t) ? d : new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

/** Banks in a country from public data (Wikidata + recent news), with reasons and an optional AI brief. */
export function BanksCard({ country, purpose, onPick }: { country: string; purpose: 'loan' | 'deposit'; onPick?: (bankName: string) => void }) {
  const { preferences } = useFinance();
  const [state, setState] = useState<{ key: string; data: BanksResponse | null; error: string | null }>({ key: '', data: null, error: null });
  const [tab, setTab] = useState<Tab>('worth');
  const [brief, setBrief] = useState<{ key: string; items: Array<{ bank: string; text: string; source: string }>; loading: boolean; error: string | null }>({ key: '', items: [], loading: false, error: null });
  const key = `${country}:${purpose}`;

  useEffect(() => {
    let live = true;
    api
      .get<BanksResponse>(`/banks?country=${encodeURIComponent(country)}&purpose=${purpose}`)
      .then((data) => live && setState({ key, data, error: null }))
      .catch((e) => live && setState({ key, data: null, error: e instanceof ApiError ? e.message : 'Bank data is unavailable right now.' }));
    return () => {
      live = false;
    };
  }, [country, purpose, key]);

  const loading = state.key !== key;
  const data = loading ? null : state.data;
  const picks = (data?.picks ?? []).filter((p) =>
    tab === 'worth' ? p.group === 'worth' : tab === 'caution' ? p.group === 'caution' : p.bank.kind === tab
  );
  const briefFor = (name: string) => (brief.key === key ? brief.items.find((b) => b.bank === name) : undefined);

  const askBrief = async () => {
    setBrief({ key, items: [], loading: true, error: null });
    try {
      const r = await api.post<{ briefs: Array<{ bank: string; text: string; source: string }> }>('/ai/bank-brief', { country, purpose });
      setBrief({ key, items: r.briefs, loading: false, error: r.briefs.length ? null : 'No recent news to summarise.' });
    } catch (e) {
      setBrief({ key, items: [], loading: false, error: e instanceof ApiError ? e.message : 'AI brief unavailable.' });
    }
  };

  return (
    <section className="keel-card p-5 sm:p-6" aria-label={`Banks in ${countryName(country)}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#0F172A]">
            <Building2 className="h-4 w-4 text-sky-600" /> {purpose === 'loan' ? 'Banks to compare for a loan' : 'Banks for savings & deposits'} in {countryName(country)}
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            From public data: which banks operate there, how well-known they are, and what the news said in the last 30 days. We don&apos;t know each bank&apos;s current rate: ask them for a quote.
          </p>
        </div>
        {preferences.isAiEnabled && data && data.newsCount > 0 && (
          <button onClick={askBrief} disabled={brief.loading} className="btn-anim inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-sky-500 to-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm disabled:opacity-60 cursor-pointer">
            {brief.loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} AI news brief
          </button>
        )}
      </div>

      {data?.benchmark && (
        <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-[11px] font-semibold text-slate-700">
          Average bank {purpose === 'loan' ? 'lending' : 'deposit'} rate in {countryName(country)}: <strong>{data.benchmark.value.toFixed(2)}%</strong> ({data.benchmark.year}, World Bank). Use it to judge the quotes you get.
        </p>
      )}

      <div role="tablist" aria-label="Bank groups" className="mt-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-colors cursor-pointer ${tab === t.id ? 'border-sky-300 bg-sky-50 text-sky-900' : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900'}`}>
            {t.label}
            {data && <span className="ml-1 text-slate-400">{(data.picks ?? []).filter((p) => (t.id === 'worth' ? p.group === 'worth' : t.id === 'caution' ? p.group === 'caution' : p.bank.kind === t.id)).length}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-4 space-y-2" aria-busy="true">
          <div className="wp-skeleton h-14 w-full" />
          <div className="wp-skeleton h-14 w-full" />
        </div>
      ) : state.error ? (
        <p className="mt-4 text-xs font-semibold text-slate-500">{state.error}</p>
      ) : picks.length === 0 ? (
        <p className="mt-4 text-xs font-medium text-slate-500">{tab === 'caution' ? 'No bank had worrying news recently.' : tab === 'international' ? 'No local arm of an international bank is listed here, and none appeared in recent local news.' : 'No banks found for this country in public data.'}</p>
      ) : (
        <ul className="wp-stagger mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {picks.map((p) => {
            const b = briefFor(p.bank.name);
            return (
              <li key={p.bank.id} className={`rounded-2xl border p-4 ${p.group === 'caution' ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-extrabold text-[#0F172A]">
                      {p.group === 'caution' && <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
                      {p.bank.name}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
                      <span className={`rounded-full px-2 py-0.5 ${p.bank.kind === 'local' ? 'bg-emerald-50 text-emerald-800' : 'bg-indigo-50 text-indigo-800'}`}>
                        {p.bank.kind === 'local' ? 'Local' : <><Globe2 className="mr-0.5 inline h-2.5 w-2.5" />International · {p.bank.hq}</>}
                      </span>
                      {p.articles.length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                          <Newspaper className="h-2.5 w-2.5" /> {p.articles.length} in the news
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {p.bank.website && (
                      <a href={p.bank.website} target="_blank" rel="noopener noreferrer nofollow" aria-label={`${p.bank.name} website`} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {onPick && (
                      <button onClick={() => onPick(p.bank.name)} className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-2.5 py-1 text-[10px] font-bold text-slate-700 hover:border-slate-400 cursor-pointer">
                        <Plus className="h-3 w-3" /> Add offer
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-600">{b ? <><Sparkles className="mr-1 inline h-3 w-3 text-indigo-500" />{b.text}</> : p.reasons.join(' · ')}</p>
                {p.articles.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {p.articles.slice(0, 3).map((a) => (
                      <li key={a.url} className="text-[11px] leading-snug">
                        <a href={a.url} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-sky-800 hover:underline">
                          {a.title}
                        </a>
                        <span className="text-slate-400"> · {a.domain} · {dateLabel(a.date)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {brief.error && brief.key === key && <p className="mt-2 text-[11px] font-semibold text-slate-500">{brief.error}</p>}
      {data && (
        <p className="mt-3 text-[10px] text-slate-400">
          Sources: {data.sources.join(' · ')}. {data.newsCount === 0 ? 'News is unavailable right now or there was none in the last 30 days. ' : ''}
          Headlines are shown as published; this is not a recommendation to use any bank.
        </p>
      )}
    </section>
  );
}
