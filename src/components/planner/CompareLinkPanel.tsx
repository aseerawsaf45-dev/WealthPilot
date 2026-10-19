'use client';

import React, { useMemo, useState } from 'react';
import { Scale, ArrowRight, CreditCard, LineChart as LineIcon, Landmark } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { useInsights } from '../../context/useInsights';
import { formatMoney, fromMinor, toMinor } from '../../lib/money';
import { convertMinor } from '../../lib/fx';
import { assumptions } from '../../lib/planning/invest';
import { payDebtOrInvest, netWorthPaths, freeCashFlow, consideredEmis } from '../../lib/planning/link';
import { useCountryMacro } from './CountryCard';
import { LineChart } from './LineChart';

/** "Should this month's spare money pay down debt or be invested?", using your real debts and plans. */
export function CompareLinkPanel({ onOpen }: { onOpen: (tab: 'debt' | 'loans' | 'invest') => void }) {
  const { debts, investments, loanOffers, preferences, fx } = useFinance();
  const { averages } = useInsights();
  const base = preferences.baseCurrency || 'USD';
  const [planId, setPlanId] = useState<string>(investments[0]?.id ?? '');
  const plan = investments.find((p) => p.id === planId) ?? null;
  const country = plan?.country ?? (preferences.region && preferences.region !== 'EU' ? preferences.region : 'US');
  const { macro } = useCountryMacro(country);
  const a = useMemo(() => assumptions(macro, plan?.riskProfile ?? 'balanced', plan?.expectedReturnBps), [macro, plan]);
  const considering = loanOffers.filter((o) => o.status === 'considering');
  const free = freeCashFlow(averages.incomeCents, averages.expenseCents, debts, consideredEmis(considering));
  const planMonthlyBase = plan ? convertMinor(plan.monthlyCents, plan.currency, base, fx) : null;
  const suggested = Math.max(0, planMonthlyBase ?? Math.round(Math.max(0, free) / 2));
  const [amountText, setAmountText] = useState(() => fromMinor(suggested));
  const monthly = Math.max(0, toMinor(amountText || '0'));
  const years = plan ? Math.max(1, Math.round(plan.horizonMonths / 12)) : 10;

  const result = useMemo(() => payDebtOrInvest(debts, monthly, a.returnBps, plan?.taxBps ?? 0), [debts, monthly, a.returnBps, plan]);
  const paths = useMemo(() => netWorthPaths(debts, monthly, Math.round(a.returnBps * (1 - (plan?.taxBps ?? 0) / 10_000)), years * 12), [debts, monthly, a.returnBps, plan, years]);
  const last = paths.at(-1);
  const money = (c: number) => formatMoney(c, base);

  return (
    <div className="space-y-6">
      <section className="keel-card p-5 sm:p-6">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#0F172A]">
          <Scale className="h-4 w-4 text-sky-600" /> Pay off debt or invest?
        </h3>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-[11px] font-semibold text-slate-700">
            Money to put to work each month
            <input inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} className="mt-1 block w-40 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-money text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-500/20" />
          </label>
          <label className="text-[11px] font-semibold text-slate-700">
            Compare with
            <select value={planId} onChange={(e) => setPlanId(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold focus:outline-none">
              <option value="">A balanced investment in {country}</option>
              {investments.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <p className="text-[11px] text-slate-500">
            Free each month now: <strong className={free > 0 ? 'text-emerald-700' : 'text-rose-700'}>{money(free)}</strong> (after spending, minimums and loans you&apos;re considering)
          </p>
        </div>

        <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50/70 p-4 text-sm leading-relaxed text-sky-950" aria-live="polite">
          {result.recommendation === 'no_debt' && <p>You have no debts, so the money can go straight into investing. Expected return after tax: <strong>{(result.afterTaxReturnBps / 100).toFixed(1)}%</strong> a year.</p>}
          {result.recommendation === 'invest' && (
            <p>
              Every debt costs less than the investment is expected to earn after tax (<strong>{(result.afterTaxReturnBps / 100).toFixed(1)}%</strong>), so investing is likely better, while you keep paying the minimums.
            </p>
          )}
          {(result.recommendation === 'pay_debt' || result.recommendation === 'split') && (
            <p>
              Pay off <strong>{result.payFirst.map((d) => `${d.name} (${(d.aprBps / 100).toFixed(1)}%)`).join(', ')}</strong> first: it costs more than the investment&apos;s expected {(result.afterTaxReturnBps / 100).toFixed(1)}% after tax. Putting {money(monthly)} a month toward it saves <strong>{money(result.interestSavedCents)}</strong> in interest and clears it {result.monthsSooner} months sooner; investing the same money for that time would gain only about {money(result.investGainCents)}.
              {result.recommendation === 'split' && <> Keep paying just the minimum on {result.investFirst.map((d) => d.name).join(', ')} (cheaper than investing).</>}
            </p>
          )}
        </div>

        {debts.length > 0 && last && (
          <div className="mt-5">
            <h4 className="text-xs font-bold text-slate-700">Net worth from this money over {years} years</h4>
            <LineChart
              ariaLabel="Net worth: debt first vs invest now"
              currency={base}
              xLabels={paths.map((p) => `Y${Math.ceil(p.month / 12)}`)}
              series={[
                { label: 'Pay debt first, then invest', color: '#10B981', values: paths.map((p) => p.debtFirstCents) },
                { label: 'Invest now, minimums only', color: '#0EA5E9', values: paths.map((p) => p.investCents) },
              ]}
            />
            <p className="mt-1 text-[11px] font-semibold text-slate-600">
              After {years} years: {last.debtFirstCents >= last.investCents ? 'paying debt first' : 'investing now'} ends {money(Math.abs(last.debtFirstCents - last.investCents))} ahead. Investments minus remaining debt; same total paid in both.
            </p>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <LinkCard icon={CreditCard} title="Debts" text={`${debts.length} debt${debts.length === 1 ? '' : 's'} · ${money(debts.reduce((s, d) => s + d.balanceCents, 0))} owed`} cta="Open Debt plan" onClick={() => onOpen('debt')} />
        <LinkCard icon={Landmark} title="Loans" text={`${considering.length} offer${considering.length === 1 ? '' : 's'} being considered; taking one adds it to your debts`} cta="Compare loans" onClick={() => onOpen('loans')} />
        <LinkCard icon={LineIcon} title="Invest" text={`${investments.length} plan${investments.length === 1 ? '' : 's'}; funding is checked against your free cash flow`} cta="Open plans" onClick={() => onOpen('invest')} />
      </div>
    </div>
  );
}

const LinkCard = ({ icon: Icon, title, text, cta, onClick }: { icon: React.ElementType; title: string; text: string; cta: string; onClick: () => void }) => (
  <button type="button" onClick={onClick} className="keel-card wp-lift p-5 text-left cursor-pointer">
    <Icon className="h-5 w-5 text-sky-600" />
    <h4 className="mt-2 text-sm font-bold text-[#0F172A]">{title}</h4>
    <p className="mt-1 text-[11px] text-slate-600">{text}</p>
    <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-sky-700">
      {cta} <ArrowRight className="h-3 w-3" />
    </span>
  </button>
);
