'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import type { InstrumentStats, SuggestedMix, Risk } from '../../lib/planning/markets';

export interface MarketsResponse {
  stats: InstrumentStats[];
  mixes: SuggestedMix[];
  countryHistory: Array<{ year: string; pct: number }>;
  asOf: string | null;
  sources: string[];
}

// Session cache: the server already caches for 15 minutes; this avoids refetching on every re-render/tab switch.
const cache = new Map<string, { at: number; data: MarketsResponse }>();

/** Market history + the five suggested mixes for a country, risk and horizon. */
export function useMarkets(country: string, risk: Risk, years: number, stressed = false) {
  const key = `${country}:${risk}:${years}:${stressed ? 1 : 0}`;
  const [state, setState] = useState<{ key: string; data: MarketsResponse | null; error: string | null }>(() => {
    const hit = cache.get(key);
    return hit ? { key, data: hit.data, error: null } : { key: '', data: null, error: null };
  });

  useEffect(() => {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < 10 * 60_000) {
      const t = setTimeout(() => setState({ key, data: hit.data, error: null }), 0);
      return () => clearTimeout(t);
    }
    let live = true;
    api
      .get<MarketsResponse>(`/markets?country=${encodeURIComponent(country)}&risk=${risk}&years=${years}${stressed ? '&stressed=1' : ''}`)
      .then((data) => {
        cache.set(key, { at: Date.now(), data });
        if (live) setState({ key, data, error: null });
      })
      .catch((e) => live && setState({ key, data: null, error: e instanceof ApiError ? e.message : 'Market data is unavailable right now.' }));
    return () => {
      live = false;
    };
  }, [key, country, risk, years, stressed]);

  return { data: state.key === key ? state.data : null, loading: state.key !== key, error: state.key === key ? state.error : null };
}
