'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Tag, TrendingUp, ExternalLink, Clock, Globe2, LocateFixed, Loader2, Info } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { api } from '../lib/api';
import { countryName, countryOptions } from '../lib/countries';
import { distanceKm, formatKm } from '../lib/geo';
import type { PartnerOffer as ClientOffer } from '../types/finance';

type Pos = { lat: number; lng: number };
const RELATIONSHIP = { partner: 'Partner', sponsor: 'Sponsored', advertiser: 'Ad' } as const;
const seenThisSession = new Set<string>();

const sendEvent = (id: string, type: 'view' | 'click') => {
  // Anonymous counter; never blocks the link or the page.
  void fetch(`/api/v1/offers/${encodeURIComponent(id)}/event`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type }), keepalive: true, credentials: 'same-origin' }).catch(() => {});
};

const withUtm = (url: string) => {
  try {
    const u = new URL(url);
    u.searchParams.set('utm_source', 'wealthpilot');
    return u.toString();
  } catch {
    return url;
  }
};

/**
 * Discounts and investment opportunities from organisations that partner with, sponsor or advertise
 * on WealthPilot, nearest first. The position stays in this browser; only the country goes to the server.
 */
export function NearbyOffers() {
  const { preferences } = useFinance();
  const fromSettings = preferences.region && preferences.region !== 'EU' ? preferences.region : '';
  const [picked, setCountry] = useState('');
  const country = fromSettings || picked;
  // Keyed by country, so a stale answer for another country is never shown.
  const [result, setResult] = useState<{ country: string; offers?: ClientOffer[]; error?: string } | null>(null);
  const current = result?.country === country ? result : null;
  const offers = current?.offers ?? null;
  const error = current?.error ?? null;
  const [pos, setPos] = useState<Pos | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [tab, setTab] = useState<'discount' | 'investment'>('discount');
  const countries = useMemo(() => countryOptions(), []);

  useEffect(() => {
    if (!country) return;
    let alive = true;
    api
      .get<ClientOffer[]>(`/offers?country=${country}`)
      .then((o) => alive && setResult({ country, offers: o }))
      .catch(() => alive && setResult({ country, error: 'Partner offers are unavailable right now.' }));
    return () => {
      alive = false;
    };
  }, [country]);

  const readPosition = () =>
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setLocError('Location is off. Offers are shown for your country instead.');
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60_000 }
    );

  const locate = () => {
    if (!('geolocation' in navigator)) return setLocError('Your browser does not share location.');
    setLocating(true);
    setLocError(null);
    readPosition();
  };

  // Already allowed in this browser → sort by distance without asking again (never prompts on its own).
  useEffect(() => {
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((s) => s.state === 'granted' && readPosition())
      .catch(() => {});
  }, []);

  const ranked = useMemo(() => {
    const list = (offers ?? []).map((o) => {
      const near = pos && o.locations.length ? o.locations.map((l) => ({ ...l, km: distanceKm(pos, l) })).sort((a, b) => a.km - b.km)[0] : null;
      return { o, near };
    });
    // Nearest first when we know where you are; online-only after; otherwise ending soonest.
    return list.sort((a, b) => (a.near && b.near ? a.near.km - b.near.km : a.near ? -1 : b.near ? 1 : a.o.validUntil.localeCompare(b.o.validUntil)));
  }, [offers, pos]);
  const shown = ranked.filter((r) => r.o.kind === tab);
  const counts = { discount: ranked.filter((r) => r.o.kind === 'discount').length, investment: ranked.filter((r) => r.o.kind === 'investment').length };

  return (
    <section className="keel-card p-6 sm:p-8" aria-label="Partner offers near you">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Partner offers</span>
          <h2 className="mt-1 text-xl sm:text-2xl font-extrabold text-[#0F172A] tracking-tight">Near you</h2>
          <p className="mt-1 max-w-2xl text-xs text-slate-600">
            Discounts and investment opportunities from organisations that partner with, sponsor or advertise on WealthPilot. We may be paid when you use them; each card says which.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!preferences.region || preferences.region === 'EU' ? (
            <select value={picked} onChange={(e) => setCountry(e.target.value)} aria-label="Country" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
              <option value="">Choose your country…</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
              <Globe2 className="h-3.5 w-3.5 text-slate-500" /> {countryName(country)}
            </span>
          )}
          <button onClick={locate} disabled={locating} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${pos ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-[#0F172A] text-white hover:bg-slate-800'}`}>
            {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}
            {pos ? 'Using your location' : 'Use my location'}
          </button>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-slate-400">{pos ? 'Your location stays on this device; only your country is used to fetch offers.' : locError ?? 'Turn on location to sort by distance. It stays on this device.'}</p>

      <div role="tablist" aria-label="Offer type" className="mt-5 flex gap-1.5">
        {(
          [
            ['discount', 'Discounts', Tag],
            ['investment', 'Investment opportunities', TrendingUp],
          ] as const
        ).map(([id, label, Icon]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${tab === id ? 'border-sky-300 bg-sky-50 text-sky-900' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
            <Icon className="h-3.5 w-3.5" /> {label}
            {offers && <span className="text-slate-400">{counts[id]}</span>}
          </button>
        ))}
      </div>

      {!country ? (
        <p className="mt-5 text-xs font-medium text-slate-500">Choose your country (or set it in Settings) to see partner offers.</p>
      ) : error ? (
        <p className="mt-5 text-xs font-medium text-slate-500">{error}</p>
      ) : !offers ? (
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="wp-skeleton h-44" />
          ))}
        </div>
      ) : !shown.length ? (
        <p className="mt-5 text-xs font-medium text-slate-500">
          No partner {tab === 'discount' ? 'discounts' : 'investment opportunities'} in {countryName(country)} yet.
        </p>
      ) : (
        <ul key={tab} className="wp-stagger mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map(({ o, near }) => (
            <OfferCard key={o.id} offer={o} near={near} />
          ))}
        </ul>
      )}
    </section>
  );
}

function OfferCard({ offer: o, near }: { offer: ClientOffer; near: { label: string; km: number } | null }) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || seenThisSession.has(o.id) || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !seenThisSession.has(o.id)) {
          seenThisSession.add(o.id);
          sendEvent(o.id, 'view');
          obs.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [o.id]);

  const until = new Date(`${o.validUntil}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return (
    <li ref={ref} className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50/50 p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold text-[#0F172A]">{o.partner.name}</p>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${o.partner.relationship === 'partner' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>{RELATIONSHIP[o.partner.relationship]}</span>
      </div>
      {o.isSample && <span className="mt-2 self-start rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">Sample: not a real partner</span>}
      <p className="mt-3 text-base font-extrabold text-[#0F172A] leading-snug">
        {o.discountBps ? <span className="text-emerald-700">{o.discountBps % 100 ? (o.discountBps / 100).toFixed(1) : o.discountBps / 100}% off · </span> : null}
        {o.title}
      </p>
      <p className="mt-1 text-xs text-slate-600">{o.description}</p>
      {o.kind === 'investment' && (
        <p className="mt-2 flex items-start gap-1 rounded-lg bg-amber-50 px-2 py-1.5 text-[10px] font-semibold text-amber-900">
          <Info className="mt-px h-3 w-3 shrink-0" /> Sponsored, not financial advice. Check the provider is licensed and read the terms; investments can lose value.
        </p>
      )}
      <div className="mt-auto pt-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-200/70 pt-3 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            {near ? <MapPin className="h-3 w-3 text-sky-600" /> : <Globe2 className="h-3 w-3" />}
            {near ? `${formatKm(near.km)} · ${near.label}` : o.locations.length ? `${o.locations.length} location${o.locations.length > 1 ? 's' : ''}` : 'Online'}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> Until {until}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <a href={o.termsUrl} target="_blank" rel="noopener noreferrer sponsored" className="text-[11px] font-semibold text-slate-600 hover:underline">
            Terms
          </a>
          {o.actionUrl && (
            <a href={withUtm(o.actionUrl)} target="_blank" rel="noopener noreferrer sponsored" onClick={() => sendEvent(o.id, 'click')} className="inline-flex items-center gap-1 rounded-full bg-[#0F172A] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800">
              {o.kind === 'investment' ? 'Learn more' : 'Get offer'} <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </li>
  );
}
