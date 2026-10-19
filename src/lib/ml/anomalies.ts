/**
 * ML-03 — Unusual spending. Modified z-score per category: z = 0.6745·(x − median) / MAD, flagged when z > 3.5
 * (Iglewicz & Hoaglin). When MAD is 0 (identical amounts) a row is unusual at ≥ 2× the median.
 * A category needs ≥ 8 earlier expenses spanning ≥ 60 days before anything is flagged.
 */

import { addDays, daysBetween, expenseParts, median, medianExact, type MlTx } from './util';

export interface Anomaly {
  id?: string;
  merchant: string;
  category: string;
  financialDate: string;
  amountCents: number; // positive
  typicalCents: number; // category median
  /** How many times the usual amount (one decimal). */
  multiple: number;
  zScore: number | null; // null when the MAD fallback was used
}

const MIN_ROWS = 8;
const MIN_SPAN_DAYS = 60;

export function detectAnomalies(txs: MlTx[], today: string, lookbackDays = 30): Anomaly[] {
  const since = addDays(today, -lookbackDays);
  const byCat = new Map<string, { t: MlTx; cents: number }[]>();
  for (const t of txs) {
    if (t.financialDate > today) continue;
    for (const p of expenseParts(t)) {
      const list = byCat.get(p.category) ?? [];
      list.push({ t, cents: p.cents });
      byCat.set(p.category, list);
    }
  }

  const out: Anomaly[] = [];
  for (const [category, rows] of byCat) {
    const history = rows.filter((r) => r.t.financialDate < since);
    if (history.length < MIN_ROWS) continue;
    const dates = history.map((r) => r.t.financialDate).sort();
    if (daysBetween(dates[0], dates[dates.length - 1]) < MIN_SPAN_DAYS) continue;

    const amounts = history.map((r) => r.cents);
    const med = medianExact(amounts);
    const mad = medianExact(amounts.map((a) => Math.abs(a - med)));
    for (const r of rows) {
      if (r.t.financialDate < since || r.cents <= med) continue;
      let z: number | null = null;
      let flagged: boolean;
      if (mad > 0) {
        z = (0.6745 * (r.cents - med)) / mad;
        flagged = z > 3.5;
      } else {
        flagged = r.cents >= 2 * med;
      }
      if (!flagged) continue;
      out.push({
        id: r.t.id,
        merchant: r.t.merchant,
        category,
        financialDate: r.t.financialDate,
        amountCents: r.cents,
        typicalCents: median(amounts),
        multiple: med ? Math.round((r.cents * 10) / med) / 10 : 0,
        zScore: z === null ? null : Math.round(z * 10) / 10,
      });
    }
  }
  return out.sort((a, b) => b.multiple - a.multiple);
}
