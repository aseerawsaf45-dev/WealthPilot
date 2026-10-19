'use client';

import React, { useEffect, useState } from 'react';
import { Globe2, Loader2 } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { countryName } from '../../lib/countries';
import type { CountryMacroData, MacroPoint } from '../../lib/planning/invest';

/** World Bank data for a country; `loading` while the first fetch runs. */
export function useCountryMacro(country: string | null | undefined) {
  const { getCountryMacro } = useFinance();
  const [state, setState] = useState<{ country: string | null; data: CountryMacroData | null }>({ country: null, data: null });
  useEffect(() => {
    if (!country) return;
    let live = true;
    getCountryMacro(country).then((data) => live && setState({ country, data }));
    return () => {
      live = false;
    };
  }, [country, getCountryMacro]);
  const loading = !!country && state.country !== country;
  return { macro: loading ? null : state.data, loading };
}

function stabilityLabel(v: number) {
  if (v >= 1) return { text: 'Very stable', cls: 'text-emerald-700' };
  if (v >= 0) return { text: 'Stable', cls: 'text-emerald-700' };
  if (v >= -1) return { text: 'Some instability', cls: 'text-amber-700' };
  return { text: 'Unstable', cls: 'text-rose-700' };
}

const Row = ({ label, p, suffix = '%', hint }: { label: string; p: MacroPoint | null; suffix?: string; hint?: string }) => (
  <div className="rounded-xl border border-slate-200/80 bg-white/70 p-2.5" title={hint}>
    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
    <p className="mt-0.5 font-money text-sm font-extrabold text-[#0F172A]">{p ? `${p.value.toFixed(1)}${suffix}` : '—'}</p>
    <p className="text-[10px] text-slate-400">{p ? p.year : 'not published'}</p>
  </div>
);

/** Country economic picture: inflation, rates, growth, political stability, currency trend. */
export function CountryCard({ country, compact = false }: { country: string; compact?: boolean }) {
  const { macro, loading } = useCountryMacro(country);
  const ps = macro?.politicalStability?.value;
  const st = ps !== undefined ? stabilityLabel(ps) : null;
  return (
    <section className="keel-card p-5" aria-label={`Economic data for ${countryName(country)}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#0F172A]">
          <Globe2 className="h-4 w-4 text-sky-600" /> {countryName(country)}
        </h3>
        {loading ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading World Bank data…
          </span>
        ) : (
          <span className="text-[10px] font-semibold text-slate-400">{macro ? macro.source : 'No data available: using labelled assumptions'}</span>
        )}
      </div>
      {macro && (
        <>
          <div className={`mt-3 grid gap-2 ${compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
            <Row label="Inflation" p={macro.inflationPct} hint="Consumer prices, annual %" />
            <Row label="Deposit rate" p={macro.depositRatePct} />
            <Row label="Lending rate" p={macro.lendingRatePct} />
            {!compact && <Row label="Real interest" p={macro.realRatePct} hint="Lending rate adjusted for inflation" />}
            <Row label="GDP growth" p={macro.gdpGrowthPct} />
            {!compact && <Row label="Currency vs USD" p={macro.depreciationPctPerYear} suffix="%/yr lost" hint="Average yearly loss of value against the US dollar" />}
          </div>
          {st && (
            <p className="mt-3 text-[11px] font-semibold text-slate-600">
              Political stability index <strong className={st.cls}>{ps!.toFixed(2)} · {st.text}</strong>{' '}
              <span className="text-slate-400">(World Bank WGI, −2.5 to +2.5, {macro.politicalStability!.year})</span>
            </p>
          )}
        </>
      )}
    </section>
  );
}
