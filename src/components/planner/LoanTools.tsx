'use client';

import React, { useMemo, useState } from 'react';
import { Calculator, Wallet, BookOpen, Save, ShieldCheck } from 'lucide-react';
import { formatMoney, toMinor, displaySymbol } from '../../lib/money';
import { countryName } from '../../lib/countries';
import { amortize, borrowCapacity } from '../../lib/planning/loans';
import { LOAN_TYPES, loanType, type LoanPurpose } from '../../lib/planning/loanTypes';
import { LineChart } from './LineChart';
import type { LoanOffer } from '../../types/finance';

export type OfferDraft = { principalCents: number; aprBps: number; termMonths: number; purpose: LoanOffer['purpose'] };

const inputCls = 'w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500/20';

/**
 * Works before any offer is saved: a live loan calculator, how much the user can borrow from their
 * real income, and a plain guide to each loan type. The rate starts at the country's average.
 */
export function LoanTools({ country, benchmarkPct, incomeCents, minimumsCents, onSaveAsOffer }: { country: string; benchmarkPct: number | null | undefined; incomeCents: number; minimumsCents: number; onSaveAsOffer: (d: OfferDraft) => void }) {
  const [purpose, setPurpose] = useState<LoanPurpose>('personal');
  const [amount, setAmount] = useState('10000');
  const [apr, setApr] = useState<string | null>(null); // null = follow the country average
  const [term, setTerm] = useState(36);
  const aprPct = apr === null ? benchmarkPct ?? 10 : parseFloat(apr) || 0;
  const aprBps = Math.round(aprPct * 100);
  const principal = toMinor(amount || '0');

  const plan = useMemo(() => (principal > 0 ? amortize(principal, aprBps, term) : null), [principal, aprBps, term]);
  const cap = borrowCapacity(incomeCents, minimumsCents, aprBps, term);
  const type = loanType(purpose);
  // Yearly points keep long schedules readable.
  const points = plan ? plan.schedule.filter((r, i, a) => r.month % 12 === 0 || i === a.length - 1) : [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <section className="keel-card p-5 lg:col-span-3" aria-label="Loan calculator">
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#0F172A]">
            <Calculator className="h-4 w-4 text-sky-600" /> Loan calculator
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500">Try an amount, rate and term. Nothing is saved until you choose to.</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="col-span-2 text-[11px] font-semibold text-slate-700 sm:col-span-1">
              Purpose
              <select value={purpose} onChange={(e) => setPurpose(e.target.value as LoanPurpose)} className={`${inputCls} mt-1`}>
                {LOAN_TYPES.map((t) => (
                  <option key={t.purpose} value={t.purpose}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] font-semibold text-slate-700">
              Amount ({displaySymbol()})
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputCls} mt-1 font-money`} />
            </label>
            <label className="text-[11px] font-semibold text-slate-700">
              Rate (APR %)
              <input type="number" min={0} max={100} step="0.01" value={apr ?? String(aprPct)} onChange={(e) => setApr(e.target.value)} className={`${inputCls} mt-1 font-money`} />
            </label>
            <label className="col-span-2 text-[11px] font-semibold text-slate-700 sm:col-span-1">
              Term: <span className="font-money">{term} months</span> ({(term / 12).toFixed(term % 12 ? 1 : 0)} yrs)
              <input type="range" min={6} max={360} step={6} value={term} onChange={(e) => setTerm(Number(e.target.value))} className="mt-3 w-full accent-sky-500 cursor-pointer" aria-label="Term in months" />
            </label>
          </div>
          <p className="mt-2 text-[10px] text-slate-500">
            {apr === null ? (benchmarkPct != null ? `Rate starts at ${countryName(country)}'s average bank lending rate (World Bank). Use the rate a bank quotes you.` : 'No average rate is published for this country; 10% is a placeholder. Use the rate a bank quotes you.') : (
              <button onClick={() => setApr(null)} className="font-bold text-sky-700 hover:underline cursor-pointer">
                Reset to the country average
              </button>
            )}
          </p>

          {plan ? (
            <>
              <div className="wp-stagger mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-sky-800">Monthly</p>
                  <p className="mt-1 font-money text-base font-extrabold text-[#0F172A]">{formatMoney(plan.emiCents)}</p>
                </div>
                <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-800">Total interest</p>
                  <p className="mt-1 font-money text-base font-extrabold text-[#0F172A]">{formatMoney(plan.totalInterestCents)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Total paid</p>
                  <p className="mt-1 font-money text-base font-extrabold text-[#0F172A]">{formatMoney(plan.totalPaidCents)}</p>
                </div>
              </div>
              {points.length > 1 && (
                <div className="mt-4">
                  <LineChart
                    ariaLabel="Loan balance by year"
                    height={170}
                    xLabels={points.map((r) => `Y${Math.ceil(r.month / 12)}`)}
                    series={[{ label: 'Balance left', color: '#0EA5E9', values: points.map((r) => r.balanceCents) }]}
                  />
                </div>
              )}
              <div className="mt-4 flex justify-end">
                <button onClick={() => onSaveAsOffer({ principalCents: principal, aprBps, termMonths: term, purpose })} className="inline-flex items-center gap-1.5 rounded-full bg-[#0F172A] px-4 py-2 text-[11px] font-bold text-white hover:bg-slate-800 cursor-pointer">
                  <Save className="h-3.5 w-3.5" /> Save as a loan offer to compare
                </button>
              </div>
            </>
          ) : (
            <p className="mt-4 text-xs text-slate-500">Enter an amount to see the monthly payment.</p>
          )}
        </section>

        <section className="keel-card p-5 lg:col-span-2" aria-label="How much can I borrow">
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#0F172A]">
            <Wallet className="h-4 w-4 text-emerald-600" /> How much can I borrow?
          </h3>
          {cap ? (
            <>
              <p className="mt-0.5 text-[11px] text-slate-500">
                From your average monthly income of {formatMoney(incomeCents)}, minus {formatMoney(minimumsCents)} you already pay on debts, at {aprPct}% for {term} months.
              </p>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                  <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                    <ShieldCheck className="h-3 w-3" /> Comfortable (debt payments up to 36% of income)
                  </p>
                  <p className="mt-1 font-money text-xl font-extrabold text-emerald-900">{formatMoney(cap.safePrincipalCents)}</p>
                  <p className="text-[11px] text-emerald-900/80">{formatMoney(cap.safeEmiCents)} a month</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Most lenders&apos; limit (43%)</p>
                  <p className="mt-1 font-money text-lg font-extrabold text-amber-900">{formatMoney(cap.maxPrincipalCents)}</p>
                  <p className="text-[11px] text-amber-900/80">{formatMoney(cap.maxEmiCents)} a month · leaves little room for surprises</p>
                </div>
                {plan && (
                  <p className={`text-[11px] font-bold ${plan.emiCents <= cap.safeEmiCents ? 'text-emerald-700' : plan.emiCents <= cap.maxEmiCents ? 'text-amber-700' : 'text-rose-700'}`}>
                    The loan in the calculator is {plan.emiCents <= cap.safeEmiCents ? 'within the comfortable range.' : plan.emiCents <= cap.maxEmiCents ? 'above the comfortable range but within most lenders’ limit.' : 'above what most lenders accept for your income.'}
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="mt-3 text-xs text-slate-500">Add or import a few months of income transactions and this shows how much you can safely borrow.</p>
          )}
        </section>
      </div>

      <section className="keel-card p-5" aria-label="Loan types guide">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#0F172A]">
          <BookOpen className="h-4 w-4 text-violet-600" /> Loan types in {countryName(country)}
        </h3>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {benchmarkPct != null ? `Average bank lending rate: ${benchmarkPct}% (World Bank). Secured loans are usually below it, personal loans often above.` : 'No published average rate for this country.'} Banks set their own rates; ask several for a quote.
        </p>
        <div role="tablist" aria-label="Loan types" className="mt-3 flex flex-wrap gap-1.5">
          {LOAN_TYPES.map((t) => (
            <button key={t.purpose} role="tab" aria-selected={t.purpose === purpose} onClick={() => setPurpose(t.purpose)} className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-colors cursor-pointer ${t.purpose === purpose ? 'border-violet-300 bg-violet-50 text-violet-900' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div key={purpose} className="wp-fade-swap mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="md:col-span-3">
            <p className="text-xs font-semibold text-slate-700">{type.summary}</p>
            <p className="mt-1 text-[11px] text-slate-500">
              {type.secured} · usually {type.termMonths.min}–{type.termMonths.max} months
              <button onClick={() => setTerm(type.termMonths.typical)} className="ml-2 font-bold text-sky-700 hover:underline cursor-pointer">
                Use {type.termMonths.typical} months in the calculator
              </button>
            </p>
          </div>
          {[
            ['What gets you a lower rate', type.lowersRate],
            ['Documents to have ready', type.documents],
            ['Questions to ask the bank', type.ask],
          ].map(([title, items]) => (
            <div key={title as string} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
              <p className="text-[11px] font-extrabold text-[#0F172A]">{title as string}</p>
              <ul className="mt-1.5 space-y-1 text-[11px] text-slate-600">
                {(items as string[]).map((x) => (
                  <li key={x}>· {x}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
