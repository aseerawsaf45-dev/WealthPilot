'use client';

import React, { useMemo, useState } from 'react';
import { Plus, X, Loader2, ShieldAlert, Info, Wallet } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { useInsights } from '../../context/useInsights';
import { formatMoney, fromMinor, toMinor } from '../../lib/money';
import { countryOptions, countryName } from '../../lib/countries';
import { assumptions, projectInvestment, RISK, type RiskProfile } from '../../lib/planning/invest';
import { SCENARIOS, suggestedScenarios, type ScenarioId } from '../../lib/planning/scenarios';
import { freeCashFlow, consideredEmis } from '../../lib/planning/link';
import CurrencySelect from '../CurrencySelect';
import { RowActions } from '../RowActions';
import { CountryCard, useCountryMacro } from './CountryCard';
import { LineChart } from './LineChart';
import { MarketsCard } from './MarketsCard';
import { BanksCard } from './BanksCard';
import type { InvestmentPlan } from '../../types/finance';

const inputCls = 'w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500/20';

/** Investment plans by country: real economic data, risk profile, stress-tested against world events. */
export function InvestPanel() {
  const { investments, saveInvestmentPlan, deleteInvestmentPlan, preferences, debts, loanOffers } = useFinance();
  const { averages } = useInsights();
  const [editing, setEditing] = useState<InvestmentPlan | 'new' | null>(investments.length ? null : 'new');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const plan = investments.find((p) => p.id === (selectedId ?? investments[0]?.id)) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-xs font-medium text-slate-600">
          Plan an investment in any country. Returns start from that country&apos;s real interest rates and inflation (World Bank), are adjusted for political stability, and can be stress-tested against events like war, sanctions or a currency crash. Estimates, not advice.
        </p>
        <button onClick={() => setEditing('new')} className="btn-primary-anim btn-shimmer inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold text-white shadow-md cursor-pointer">
          <Plus className="h-3.5 w-3.5 text-sky-300" /> New plan
        </button>
      </div>

      {editing && (
        <PlanForm
          plan={editing === 'new' ? null : editing}
          defaults={{ country: preferences.region && preferences.region !== 'EU' ? preferences.region : 'US', currency: preferences.baseCurrency || 'USD' }}
          onClose={() => setEditing(null)}
          onSave={async (p, id) => {
            const saved = await saveInvestmentPlan(p, id);
            if (saved) {
              setEditing(null);
              setSelectedId(saved.id);
            }
          }}
        />
      )}

      {investments.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Your plans">
          {investments.map((p) => (
            <button key={p.id} role="tab" aria-selected={plan?.id === p.id} onClick={() => setSelectedId(p.id)} className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${plan?.id === p.id ? 'border-sky-300 bg-sky-50 text-sky-900' : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900'}`}>
              {p.name}
            </button>
          ))}
        </div>
      )}

      {plan && (
        <PlanView
          key={plan.id}
          plan={plan}
          free={freeCashFlow(averages.incomeCents, averages.expenseCents, debts, consideredEmis(loanOffers))}
          hasIncomeData={averages.monthsUsed > 0}
          onEdit={() => setEditing(plan)}
          onDelete={() => deleteInvestmentPlan(plan.id)}
          onToggleScenario={(id) => saveInvestmentPlan({ ...plan, scenarios: plan.scenarios.includes(id) ? plan.scenarios.filter((s) => s !== id) : [...plan.scenarios, id] }, plan.id)}
          onUseReturn={(bps) => saveInvestmentPlan({ ...plan, expectedReturnBps: bps }, plan.id)}
        />
      )}
    </div>
  );
}

function PlanView({ plan, free, hasIncomeData, onEdit, onDelete, onToggleScenario, onUseReturn }: { plan: InvestmentPlan; free: number; hasIncomeData: boolean; onEdit: () => void; onDelete: () => void; onToggleScenario: (id: ScenarioId) => void; onUseReturn: (bps: number) => void }) {
  const { macro, loading } = useCountryMacro(plan.country);
  const a = useMemo(() => assumptions(macro, plan.riskProfile, plan.expectedReturnBps), [macro, plan.riskProfile, plan.expectedReturnBps]);
  const scenarios = plan.scenarios as ScenarioId[];
  const base = useMemo(() => projectInvestment({ initialCents: plan.initialCents, monthlyCents: plan.monthlyCents, months: plan.horizonMonths, a, taxBps: plan.taxBps, risk: plan.riskProfile }), [plan, a]);
  const stressed = useMemo(
    () => (scenarios.length ? projectInvestment({ initialCents: plan.initialCents, monthlyCents: plan.monthlyCents, months: plan.horizonMonths, a, taxBps: plan.taxBps, risk: plan.riskProfile, scenarios }) : null),
    [plan, a, scenarios]
  );
  const shown = stressed ?? base;
  const suggested = suggestedScenarios(macro ? { politicalStability: macro.politicalStability?.value, depreciationPctPerYear: macro.depreciationPctPerYear?.value, inflationPct: macro.inflationPct?.value } : null);
  const money = (c: number) => formatMoney(c, plan.currency);
  const years = Math.round((plan.horizonMonths / 12) * 10) / 10;

  return (
    <div className="space-y-6">
      <section className="keel-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold text-[#0F172A]">{plan.name}</h3>
            <p className="text-[11px] font-medium text-slate-500">
              {countryName(plan.country)} · {RISK[plan.riskProfile].label} ({RISK[plan.riskProfile].description}) · {money(plan.initialCents)} now + {money(plan.monthlyCents)}/month for {years} years
            </p>
          </div>
          <RowActions label={plan.name} onEdit={onEdit} onDelete={onDelete} />
        </div>

        <div className="wp-stagger mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="You put in" value={money(shown.final.contributedCents)} />
          <Stat label={`Likely value in ${years}y`} value={money(shown.final.medianCents)} tone="text-sky-800" sub={`${money(shown.final.lowCents)} – ${money(shown.final.highCents)}`} />
          <Stat label="In today's money" value={money(shown.final.realCents)} sub={`after ${(a.inflationBps / 100).toFixed(1)}%/yr inflation`} />
          <Stat label="After tax on gains" value={money(shown.afterTaxCents)} sub={plan.taxBps ? `${plan.taxBps / 100}% tax` : 'no tax set'} />
        </div>

        <div className="mt-5">
          <LineChart
            ariaLabel="Projected value by year"
            currency={plan.currency}
            xLabels={shown.points.map((p) => `Y${Math.ceil(p.month / 12)}`)}
            band={{ low: shown.points.map((p) => p.lowCents), high: shown.points.map((p) => p.highCents), color: '#0EA5E9', label: 'Likely range (P10–P90)' }}
            series={[
              { label: stressed ? 'Expected (with stress test)' : 'Expected', color: '#0284C7', values: shown.points.map((p) => p.medianCents) },
              ...(stressed ? [{ label: 'Without events', color: '#94A3B8', dashed: true, values: base.points.map((p) => p.medianCents) }] : []),
              { label: 'In today’s money', color: '#10B981', dashed: true, values: shown.points.map((p) => p.realCents) },
              { label: 'Put in', color: '#CBD5E1', dashed: true, values: shown.points.map((p) => p.contributedCents) },
            ]}
          />
        </div>

        <details className="mt-3 text-[11px] text-slate-600">
          <summary className="cursor-pointer font-bold text-slate-700">
            <Info className="mr-1 inline h-3.5 w-3.5 text-sky-600" />
            How this is calculated: {(a.returnBps / 100).toFixed(1)}% expected yearly return, {(a.volBps / 100).toFixed(0)}% volatility
            {loading && ' (loading country data…)'}
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {a.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
            <li>The range assumes returns vary like a lognormal distribution with that volatility; real markets can do worse.</li>
            {a.depreciationBps !== 0 && <li>The currency has lost about {(a.depreciationBps / 100).toFixed(1)}% a year against the US dollar; in dollar terms the median would be {money(shown.final.usdTermsCents)}.</li>}
          </ul>
        </details>
      </section>

      <section className="keel-card p-5 sm:p-6" aria-label="Stress test">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#0F172A]">
          <ShieldAlert className="h-4 w-4 text-amber-600" /> Stress test: world events
        </h3>
        <p className="mt-1 text-[11px] text-slate-600">
          Pick events to test. Each applies a fixed, documented shock (sized like past episodes such as 2008, 2020 and the 2022 energy shock), scaled to how risky the plan is. These are &ldquo;what if&rdquo; tests, not predictions.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SCENARIOS.map((s) => {
            const on = scenarios.includes(s.id);
            return (
              <button key={s.id} type="button" onClick={() => onToggleScenario(s.id)} aria-pressed={on} className={`rounded-2xl border p-3 text-left transition-all cursor-pointer ${on ? 'border-amber-300 bg-amber-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                <span className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#0F172A]">{s.label}</span>
                  {suggested.includes(s.id) && !on && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[9px] font-bold text-sky-700">Suggested for {plan.country}</span>}
                  {on && <span className="rounded-full bg-amber-200/70 px-2 py-0.5 text-[9px] font-bold text-amber-900">On</span>}
                </span>
                <span className="mt-0.5 block text-[11px] text-slate-600">{s.description}</span>
                <span className="mt-1 block text-[10px] font-mono text-slate-400">
                  market {s.shockPct}% · inflation {s.inflationAddBps >= 0 ? '+' : ''}
                  {s.inflationAddBps / 100}pts · currency −{s.depreciationAddBps / 100}%/yr for {s.months} mo
                </span>
              </button>
            );
          })}
        </div>
        {stressed && (
          <p className="wp-pop mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
            With these events the plan is about {Math.abs(stressed.stressLossPct ?? 0)}% lower after the first year, and ends near {money(stressed.final.medianCents)} instead of {money(base.final.medianCents)} ({money(base.final.medianCents - stressed.final.medianCents)} less).
          </p>
        )}
      </section>

      <section className="keel-card p-5" aria-label="Can you fund it">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#0F172A]">
          <Wallet className="h-4 w-4 text-emerald-600" /> Can you fund {money(plan.monthlyCents)} a month?
        </h3>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
          {!hasIncomeData
            ? 'Not enough income and spending history yet to check this.'
            : free <= 0
              ? `After your average spending, debt minimums and the loans you're considering, nothing is left over each month (${formatMoney(free)}). Investing would mean borrowing or using savings.`
              : plan.monthlyCents > free
                ? `About ${formatMoney(free)} is left over each month after spending, debt minimums and loans you're considering, less than this plan needs. Lower the amount or cut spending first.`
                : `Yes: about ${formatMoney(free)} is left over each month after spending, debt minimums and the loans you're considering.`}
        </p>
      </section>

      <MarketsCard country={plan.country} risk={plan.riskProfile} years={Math.max(1, Math.round(plan.horizonMonths / 12))} onUseReturn={onUseReturn} />

      <CountryCard country={plan.country} />

      <BanksCard country={plan.country} purpose="deposit" />
    </div>
  );
}

const Stat = ({ label, value, sub, tone = 'text-[#0F172A]' }: { label: string; value: string; sub?: string; tone?: string }) => (
  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3">
    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
    <p className={`mt-0.5 font-money text-base font-extrabold ${tone}`}>{value}</p>
    {sub && <p className="text-[10px] text-slate-500">{sub}</p>}
  </div>
);

function PlanForm({ plan, defaults, onClose, onSave }: { plan: InvestmentPlan | null; defaults: { country: string; currency: string }; onClose: () => void; onSave: (p: Omit<InvestmentPlan, 'id' | 'updatedAt'>, id?: string) => Promise<void> }) {
  const [name, setName] = useState(plan?.name ?? '');
  const [country, setCountry] = useState(plan?.country ?? defaults.country);
  const [currency, setCurrency] = useState(plan?.currency ?? defaults.currency);
  const [risk, setRisk] = useState<RiskProfile>(plan?.riskProfile ?? 'balanced');
  const [years, setYears] = useState(plan ? String(Math.round(plan.horizonMonths / 12)) : '10');
  const [initial, setInitial] = useState(plan ? fromMinor(plan.initialCents, plan.currency) : '');
  const [monthly, setMonthly] = useState(plan ? fromMinor(plan.monthlyCents, plan.currency) : '');
  const [ret, setRet] = useState(plan?.expectedReturnBps != null ? String(plan.expectedReturnBps / 100) : '');
  const [tax, setTax] = useState(plan ? String(plan.taxBps / 100) : '0');
  const [saving, setSaving] = useState(false);
  const countries = useMemo(() => countryOptions(), []);

  return (
    <form
      className="keel-card wp-pop space-y-4 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        await onSave(
          {
            name: name.trim(),
            country,
            currency,
            initialCents: toMinor(initial || '0', currency),
            monthlyCents: toMinor(monthly || '0', currency),
            horizonMonths: Math.min(600, Math.max(1, Math.round((parseFloat(years) || 1) * 12))),
            riskProfile: risk,
            expectedReturnBps: ret.trim() === '' ? null : Math.round(parseFloat(ret) * 100),
            taxBps: Math.round((parseFloat(tax) || 0) * 100),
            scenarios: plan?.scenarios ?? [],
          },
          plan?.id
        );
        setSaving(false);
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-[#0F172A]">{plan ? 'Edit plan' : 'New investment plan'}</h3>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <label className="text-[11px] font-semibold text-slate-700 sm:col-span-2">
          Name
          <input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Retirement, Kids' education" className={`${inputCls} mt-1`} />
        </label>
        <label className="text-[11px] font-semibold text-slate-700">
          Invest in (country)
          <select value={country} onChange={(e) => setCountry(e.target.value)} className={`${inputCls} mt-1`}>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="text-[11px] font-semibold text-slate-700">
          Currency
          <CurrencySelect value={currency} onChange={setCurrency} compact className="mt-1" ariaLabel="Plan currency" />
        </div>
        <label className="text-[11px] font-semibold text-slate-700">
          Start with
          <input inputMode="decimal" value={initial} onChange={(e) => setInitial(e.target.value)} placeholder="0" className={`${inputCls} mt-1 font-money`} />
        </label>
        <label className="text-[11px] font-semibold text-slate-700">
          Add each month
          <input inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="0" className={`${inputCls} mt-1 font-money`} />
        </label>
        <label className="text-[11px] font-semibold text-slate-700">
          For (years)
          <input required type="number" min={1} max={50} value={years} onChange={(e) => setYears(e.target.value)} className={`${inputCls} mt-1 font-money`} />
        </label>
        <label className="text-[11px] font-semibold text-slate-700">
          Tax on gains (%)
          <input type="number" min={0} max={100} step="0.1" value={tax} onChange={(e) => setTax(e.target.value)} className={`${inputCls} mt-1 font-money`} />
        </label>
      </div>
      <fieldset>
        <legend className="text-[11px] font-semibold text-slate-700">Risk</legend>
        <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(Object.keys(RISK) as RiskProfile[]).map((r) => (
            <label key={r} className={`cursor-pointer rounded-xl border p-3 text-xs ${risk === r ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white'}`}>
              <input type="radio" name="risk" value={r} checked={risk === r} onChange={() => setRisk(r)} className="sr-only" />
              <span className="font-bold text-[#0F172A]">{RISK[r].label}</span>
              <span className="block text-[11px] text-slate-500">{RISK[r].description}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-[11px] font-semibold text-slate-700">
        Expected yearly return (%), optional: leave empty to use {countryName(country)}&apos;s data
        <input type="number" step="0.1" min={-50} max={50} value={ret} onChange={(e) => setRet(e.target.value)} className={`${inputCls} mt-1 font-money sm:w-48`} />
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn-primary-anim inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold text-white disabled:opacity-60 cursor-pointer">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save plan
        </button>
      </div>
    </form>
  );
}
