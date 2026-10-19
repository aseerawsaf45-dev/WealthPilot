'use client';

import React, { useMemo, useState } from 'react';
import { Plus, X, Check, Loader2, Landmark, Trophy, AlertTriangle } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { useInsights } from '../../context/useInsights';
import { formatMoney, fromMinor, toMinor, displaySymbol } from '../../lib/money';
import { countryOptions, countryName } from '../../lib/countries';
import { amortize, affordability, compareOffers, prepaymentSavings } from '../../lib/planning/loans';
import { RowActions } from '../RowActions';
import { CountryCard, useCountryMacro } from './CountryCard';
import { LineChart } from './LineChart';
import { BanksCard } from './BanksCard';
import { useToday } from '../../lib/dates';
import type { LoanOffer } from '../../types/finance';

const PURPOSES: Array<{ id: LoanOffer['purpose']; label: string }> = [
  { id: 'personal', label: 'Personal' },
  { id: 'car', label: 'Car' },
  { id: 'home', label: 'Home' },
  { id: 'education', label: 'Education' },
  { id: 'business', label: 'Business' },
];

const BAND = {
  healthy: { label: 'Healthy', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', bar: 'bg-emerald-500' },
  stretched: { label: 'Stretched', cls: 'bg-amber-50 text-amber-800 border-amber-200', bar: 'bg-amber-500' },
  risky: { label: 'Risky', cls: 'bg-rose-50 text-rose-800 border-rose-200', bar: 'bg-rose-500' },
  unknown: { label: 'No income data', cls: 'bg-slate-50 text-slate-600 border-slate-200', bar: 'bg-slate-400' },
} as const;

const inputCls = 'w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500/20';

/** Compare loan offers, check affordability and prepayments, and turn the chosen one into a debt. */
export function LoansPanel() {
  const { loanOffers, saveLoanOffer, deleteLoanOffer, takeLoan, debts, preferences } = useFinance();
  const { averages } = useInsights();
  const today = useToday();
  const [editing, setEditing] = useState<LoanOffer | 'new' | null>(loanOffers.length ? null : 'new');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [extra, setExtra] = useState(0);
  const [taking, setTaking] = useState<string | null>(null);
  const [dueDay, setDueDay] = useState(() => String(Math.min(28, Number(today.slice(8, 10)) || 1)));
  const [busy, setBusy] = useState(false);
  const [draftLender, setDraftLender] = useState<string | null>(null);

  const considering = loanOffers.filter((o) => o.status === 'considering');
  const compared = useMemo(() => compareOffers(considering), [considering]);
  const selected = loanOffers.find((o) => o.id === (selectedId ?? compared[0]?.id)) ?? null;
  const minimums = debts.reduce((s, d) => s + d.minimumPaymentCents, 0);
  const country = selected?.country || preferences.region || 'US';
  const { macro, loading: macroLoading } = useCountryMacro(country);
  const label = (o: { name: string; lender: string }) => `${o.name} (${o.lender})`;

  const schedule = selected ? amortize(selected.principalCents, selected.aprBps, selected.termMonths) : null;
  const afford = selected && schedule ? affordability(schedule.emiCents, minimums, averages.incomeCents) : null;
  const prepay = selected && extra > 0 ? prepaymentSavings(selected.principalCents, selected.aprBps, selected.termMonths, toMinor(extra)) : null;
  const benchmark = macro?.lendingRatePct;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-medium text-slate-600 max-w-2xl">
          Add the offers you&apos;re considering. WealthPilot compares their real cost (interest + fees), checks what you can afford from your actual income, and when you decide, turns the loan into a debt in your Debt plan.
        </p>
        <button onClick={() => setEditing('new')} className="btn-primary-anim btn-shimmer inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold text-white shadow-md cursor-pointer">
          <Plus className="h-3.5 w-3.5 text-sky-300" /> Add loan offer
        </button>
      </div>

      <BanksCard
        country={country}
        purpose="loan"
        onPick={(name) => {
          setDraftLender(name);
          setEditing('new');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {editing && <OfferForm key={editing === 'new' ? `new-${draftLender ?? ''}` : editing.id} offer={editing === 'new' ? null : editing} draftLender={editing === 'new' ? draftLender : null} defaultCountry={selected?.country || preferences.region || null} onClose={() => { setEditing(null); setDraftLender(null); }} onSave={async (o, id) => {
        const saved = await saveLoanOffer(o, id);
        if (saved) {
          setEditing(null);
          setDraftLender(null);
          setSelectedId(saved.id);
        }
      }} />}

      {compared.length > 0 && (
        <section className="keel-card overflow-hidden" aria-label="Compare offers">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Offer</th>
                  <th className="px-3 py-3 text-right">Amount</th>
                  <th className="px-3 py-3 text-right">APR</th>
                  <th className="px-3 py-3 text-right">Term</th>
                  <th className="px-3 py-3 text-right">Monthly</th>
                  <th className="px-3 py-3 text-right">Interest + fees</th>
                  <th className="px-3 py-3 text-right" title="Includes upfront fees">Real APR</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {compared.map((o, i) => (
                  <tr key={o.id} onClick={() => setSelectedId(o.id!)} className={`cursor-pointer transition-colors ${selected?.id === o.id ? 'bg-sky-50/70' : 'hover:bg-slate-50'}`}>
                    <td className="px-4 py-3">
                      <p className="flex items-center gap-1.5 font-bold text-[#0F172A]">
                        {i === 0 && compared.length > 1 && <Trophy className="h-3.5 w-3.5 text-amber-500" aria-label="Cheapest" />}
                        {o.name}
                      </p>
                      <p className="text-[11px] text-slate-500">{o.lender}</p>
                    </td>
                    <td className="px-3 py-3 text-right font-money font-bold">{formatMoney(o.principalCents)}</td>
                    <td className="px-3 py-3 text-right font-mono">{(o.aprBps / 100).toFixed(2)}%</td>
                    <td className="px-3 py-3 text-right font-mono">{o.termMonths} mo</td>
                    <td className="px-3 py-3 text-right font-money font-bold">{formatMoney(o.emiCents)}</td>
                    <td className="px-3 py-3 text-right font-money text-rose-700">{formatMoney(o.totalCostCents)}</td>
                    <td className="px-3 py-3 text-right font-mono">{(o.effectiveAprBps / 100).toFixed(2)}%</td>
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <RowActions label={o.name} onEdit={() => setEditing(loanOffers.find((x) => x.id === o.id)!)} onDelete={() => deleteLoanOffer(o.id!)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {compared.length > 1 && (
            <p className="border-t border-slate-100 px-4 py-2.5 text-[11px] font-semibold text-slate-600">
              <Trophy className="mr-1 inline h-3.5 w-3.5 text-amber-500" />
              {label(compared[0])} is cheapest: {formatMoney(compared[compared.length - 1].totalCostCents - compared[0].totalCostCents)} less in interest and fees than {label(compared[compared.length - 1])}.
            </p>
          )}
        </section>
      )}

      {selected && schedule && selected.status === 'considering' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <section className="keel-card p-5 lg:col-span-3" aria-label="Repayment schedule">
            <h3 className="text-sm font-extrabold text-[#0F172A]">{label(selected)}: what you&apos;d owe over time</h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {formatMoney(schedule.emiCents)} a month for {selected.termMonths} months · total interest {formatMoney(schedule.totalInterestCents)}
              {selected.feeCents > 0 && ` + ${formatMoney(selected.feeCents)} fees`}
            </p>
            <div className="mt-3">
              <LineChart
                ariaLabel="Loan balance by month"
                xLabels={schedule.schedule.map((r) => `M${r.month}`)}
                series={[
                  { label: 'Balance', color: '#0EA5E9', values: schedule.schedule.map((r) => r.balanceCents) },
                  { label: 'Interest paid so far', color: '#F43F5E', dashed: true, values: schedule.schedule.reduce<number[]>((acc, r) => [...acc, (acc.at(-1) ?? 0) + r.interestCents], []) },
                ]}
              />
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <label htmlFor="prepay" className="text-xs font-bold text-slate-700">
                Pay extra each month: <span className="font-money text-sky-800">{formatMoney(toMinor(extra))}</span>
              </label>
              <input id="prepay" type="range" min={0} max={Math.max(10, Math.round(Number(fromMinor(schedule.emiCents))))} step={Math.max(1, Math.round(Number(fromMinor(schedule.emiCents)) / 40))} value={extra} onChange={(e) => setExtra(Number(e.target.value))} className="mt-2 w-full accent-sky-500 cursor-pointer" />
              <p className="mt-1 text-[11px] font-semibold text-slate-600">
                {prepay ? (
                  <>
                    Done <strong>{prepay.monthsSaved} months</strong> sooner and saves <strong className="text-emerald-700">{formatMoney(prepay.interestSavedCents)}</strong> interest.
                  </>
                ) : (
                  'Slide to see what paying a little extra saves.'
                )}
              </p>
            </div>
          </section>

          <div className="space-y-6 lg:col-span-2">
            <section className="keel-card p-5" aria-label="Affordability">
              <h3 className="text-sm font-extrabold text-[#0F172A]">Can you afford it?</h3>
              {afford && (
                <>
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="font-money text-2xl font-extrabold text-[#0F172A]">{afford.dtiPct === null ? '—' : `${afford.dtiPct}%`}</span>
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${BAND[afford.band].cls}`}>{BAND[afford.band].label}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className={`wp-bar h-full rounded-full ${BAND[afford.band].bar}`} style={{ width: `${Math.min(100, afford.dtiPct ?? 0)}%` }} />
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
                    Debt payments of {formatMoney(schedule.emiCents + minimums)}/month ({formatMoney(minimums)} existing + this loan) against your average income of {formatMoney(averages.incomeCents)}.
                    Up to 36% is healthy, above 43% most lenders see as risky.
                  </p>
                </>
              )}
            </section>

            <section className="keel-card p-5" aria-label="Rate check">
              <h3 className="text-sm font-extrabold text-[#0F172A]">Is the rate fair?</h3>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
                {macroLoading ? (
                  'Loading the country’s average lending rate…'
                ) : benchmark ? (
                  <>
                    Average bank lending rate in {countryName(country)}: <strong>{benchmark.value.toFixed(2)}%</strong> ({benchmark.year}). This offer is{' '}
                    <strong className={selected.aprBps / 100 > benchmark.value + 3 ? 'text-rose-700' : 'text-emerald-700'}>
                      {(selected.aprBps / 100 - benchmark.value).toFixed(2)} points {selected.aprBps / 100 >= benchmark.value ? 'above' : 'below'}
                    </strong>{' '}
                    it. Personal and card loans usually cost more than this average.
                  </>
                ) : (
                  `No published lending rate for ${countryName(country)}; compare offers against each other.`
                )}
              </p>
            </section>

            <section className="keel-card p-5" aria-label="Take this loan">
              <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#0F172A]">
                <Landmark className="h-4 w-4 text-sky-600" /> Decided?
              </h3>
              {taking === selected.id ? (
                <div className="wp-pop mt-3 space-y-2">
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Payment due on day
                    <input type="number" min={1} max={28} value={dueDay} onChange={(e) => setDueDay(e.target.value)} className={`${inputCls} mt-1`} />
                  </label>
                  <p className="text-[11px] text-slate-600">
                    Adds &ldquo;{selected.name}&rdquo; to your debts with {formatMoney(schedule.emiCents)}/month at {(selected.aprBps / 100).toFixed(2)}%.
                  </p>
                  <div className="flex gap-2">
                    <button
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        await takeLoan(selected.id, Math.min(28, Math.max(1, parseInt(dueDay, 10) || 1)));
                        setBusy(false);
                        setTaking(null);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60 cursor-pointer"
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Yes, add to my debts
                    </button>
                    <button onClick={() => setTaking(null)} className="rounded-full px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {afford?.band === 'risky' && (
                    <p className="mt-2 flex items-start gap-1.5 text-[11px] font-semibold text-rose-700">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> This would put more than 43% of your income into debt payments.
                    </p>
                  )}
                  <button onClick={() => setTaking(selected.id)} className="mt-3 rounded-full bg-[#0F172A] px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer">
                    I took this loan
                  </button>
                </>
              )}
            </section>
          </div>
        </div>
      )}

      {loanOffers.some((o) => o.status === 'taken') && (
        <section className="keel-card p-5" aria-label="Taken loans">
          <h3 className="text-sm font-extrabold text-[#0F172A]">Loans you took</h3>
          <ul className="mt-2 divide-y divide-slate-100 text-xs">
            {loanOffers
              .filter((o) => o.status === 'taken')
              .map((o) => (
                <li key={o.id} className="flex items-center justify-between py-2">
                  <span className="font-semibold">
                    {o.name} · {o.lender}
                  </span>
                  <span className="text-slate-500">In your Debt plan{debts.some((d) => d.id === o.debtId) ? '' : ' (debt since removed)'}</span>
                </li>
              ))}
          </ul>
        </section>
      )}

      <CountryCard country={country} compact />
    </div>
  );
}

function OfferForm({ offer, draftLender, defaultCountry, onClose, onSave }: { offer: LoanOffer | null; draftLender?: string | null; defaultCountry: string | null; onClose: () => void; onSave: (o: Omit<LoanOffer, 'id' | 'updatedAt' | 'status' | 'debtId'>, id?: string) => Promise<void> }) {
  const [name, setName] = useState(offer?.name ?? '');
  const [lender, setLender] = useState(offer?.lender ?? draftLender ?? '');
  const [amount, setAmount] = useState(offer ? fromMinor(offer.principalCents) : '');
  const [apr, setApr] = useState(offer ? String(offer.aprBps / 100) : '');
  const [term, setTerm] = useState(offer ? String(offer.termMonths) : '36');
  const [fee, setFee] = useState(offer ? fromMinor(offer.feeCents) : '');
  const [purpose, setPurpose] = useState<LoanOffer['purpose']>(offer?.purpose ?? 'personal');
  const [country, setCountry] = useState(offer?.country ?? defaultCountry ?? '');
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
            lender: lender.trim(),
            principalCents: toMinor(amount),
            aprBps: Math.round((parseFloat(apr) || 0) * 100),
            termMonths: Math.max(1, parseInt(term, 10) || 1),
            feeCents: toMinor(fee || '0'),
            purpose,
            country: country || null,
          },
          offer?.id
        );
        setSaving(false);
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-[#0F172A]">{offer ? 'Edit loan offer' : 'New loan offer'}</h3>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <label className="text-[11px] font-semibold text-slate-700 sm:col-span-2">
          Name
          <input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Car loan" className={`${inputCls} mt-1`} />
        </label>
        <label className="text-[11px] font-semibold text-slate-700 sm:col-span-2">
          Lender
          <input required maxLength={80} value={lender} onChange={(e) => setLender(e.target.value)} placeholder="e.g. City Bank" className={`${inputCls} mt-1`} />
        </label>
        <label className="text-[11px] font-semibold text-slate-700">
          Amount ({displaySymbol()})
          <input required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputCls} mt-1 font-money`} />
        </label>
        <label className="text-[11px] font-semibold text-slate-700">
          Interest APR (%)
          <input required type="number" min={0} max={100} step="0.01" value={apr} onChange={(e) => setApr(e.target.value)} className={`${inputCls} mt-1 font-money`} />
        </label>
        <label className="text-[11px] font-semibold text-slate-700">
          Term (months)
          <input required type="number" min={1} max={480} value={term} onChange={(e) => setTerm(e.target.value)} className={`${inputCls} mt-1 font-money`} />
        </label>
        <label className="text-[11px] font-semibold text-slate-700">
          Upfront fees ({displaySymbol()})
          <input inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0" className={`${inputCls} mt-1 font-money`} />
        </label>
        <label className="text-[11px] font-semibold text-slate-700 sm:col-span-2">
          Purpose
          <select value={purpose} onChange={(e) => setPurpose(e.target.value as LoanOffer['purpose'])} className={`${inputCls} mt-1`}>
            {PURPOSES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] font-semibold text-slate-700 sm:col-span-2">
          Country (for the rate check)
          <select value={country} onChange={(e) => setCountry(e.target.value)} className={`${inputCls} mt-1`}>
            <option value="">Not set</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn-primary-anim inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold text-white disabled:opacity-60 cursor-pointer">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save offer
        </button>
      </div>
    </form>
  );
}
