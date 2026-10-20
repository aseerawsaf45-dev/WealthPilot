'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Plus, Loader2, Trash2, Pencil, Download, MapPin, X, CheckCircle2 } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { api } from '../lib/api';
import { countryOptions, countryName } from '../lib/countries';
import { useToday } from '../lib/dates';
import type { PartnerOffer } from '../types/finance';

type Partner = { id: string; name: string; website: string | null; relationship: 'partner' | 'sponsor' | 'advertiser'; contractEnds: string | null };
type Stat = { offerId: string; views: number; clicks: number };
type Loc = { label: string; lat: string; lng: string };

const inputCls = 'w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500/20';
const RELATIONSHIPS = [
  ['partner', 'Partner'],
  ['sponsor', 'Sponsor'],
  ['advertiser', 'Advertiser'],
] as const;

/** Admins (ADMIN_EMAILS) manage partner organisations and their offers, and read anonymous stats. */
export function AdminTab() {
  const { isAdmin } = useFinance();
  const today = useToday();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [offers, setOffers] = useState<PartnerOffer[] | null>(null);
  const [stats, setStats] = useState<{ since: string; rows: Stat[] } | null>(null);
  const [editing, setEditing] = useState<PartnerOffer | 'new' | null>(null);
  const [addingPartner, setAddingPartner] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, o, s] = await Promise.all([api.get<Partner[]>('/admin/partners'), api.get<PartnerOffer[]>('/admin/offers'), api.get<{ since: string; rows: Stat[] }>('/admin/offers/stats')]);
      setPartners(p);
      setOffers(o);
      setStats(s);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load admin data.');
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    void Promise.all([api.get<Partner[]>('/admin/partners'), api.get<PartnerOffer[]>('/admin/offers'), api.get<{ since: string; rows: Stat[] }>('/admin/offers/stats')])
      .then(([p, o, s]) => {
        if (!alive) return;
        setPartners(p);
        setOffers(o);
        setStats(s);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Could not load admin data.'));
    return () => {
      alive = false;
    };
  }, [isAdmin]);

  if (!isAdmin) return <p className="keel-card p-6 text-sm text-slate-600">This page is for WealthPilot admins.</p>;

  const statFor = (id: string) => stats?.rows.find((r) => r.offerId === id) ?? { views: 0, clicks: 0 };
  const downloadCsv = () => {
    const rows = [['offer', 'partner', 'country', 'kind', 'views', 'clicks', 'ctr_pct'], ...(offers ?? []).map((o) => {
      const s = statFor(o.id);
      return [o.title, o.partner.name, o.country, o.kind, s.views, s.clicks, s.views ? ((s.clicks * 100) / s.views).toFixed(1) : '0'];
    })];
    // Cells starting with = + - @ are prefixed so spreadsheets don't run them as formulas.
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `partner-offer-stats-${stats?.since ?? 'last-30-days'}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-[#0F172A]">
            <ShieldCheck className="h-6 w-6 text-sky-600" /> Partner offers admin
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-slate-600">Organisations with a partnership, sponsorship or ad deal, and the offers users see near them. Offers show only while live, within their dates and verified in the last 90 days.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setAddingPartner(true)} className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 cursor-pointer">
            <Plus className="h-3.5 w-3.5" /> Partner
          </button>
          <button disabled={!partners.length} onClick={() => setEditing('new')} className="inline-flex items-center gap-1.5 rounded-full bg-[#0F172A] px-4 py-2 text-xs font-bold text-white disabled:opacity-40 cursor-pointer">
            <Plus className="h-3.5 w-3.5" /> Offer
          </button>
        </div>
      </header>
      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">{error}</p>}

      {addingPartner && (
        <PartnerForm
          onClose={() => setAddingPartner(false)}
          onSaved={async () => {
            setAddingPartner(false);
            await load();
          }}
        />
      )}
      {editing && (
        <OfferForm
          key={editing === 'new' ? 'new' : editing.id}
          offer={editing === 'new' ? null : editing}
          partners={partners}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}

      <section className="keel-card overflow-hidden" aria-label="Offers">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-extrabold text-[#0F172A]">Offers {offers && <span className="text-slate-400">({offers.length})</span>}</h2>
          <button onClick={downloadCsv} disabled={!offers?.length} className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 disabled:opacity-40 cursor-pointer">
            <Download className="h-3.5 w-3.5" /> Stats CSV (last 30 days)
          </button>
        </div>
        {!offers ? (
          <div className="p-5">
            <div className="wp-skeleton h-24" />
          </div>
        ) : !offers.length ? (
          <p className="p-5 text-xs text-slate-500">No offers yet. Add a partner, then an offer.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-2">Offer</th>
                  <th className="px-3 py-2">Country</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Ends</th>
                  <th className="px-3 py-2">Verified</th>
                  <th className="px-3 py-2 text-right">Views</th>
                  <th className="px-3 py-2 text-right">Clicks</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {offers.map((o) => {
                  const s = statFor(o.id);
                  const verifiedDays = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(o.lastVerifiedAt.slice(0, 10) + "T00:00:00Z")) / 86_400_000);
                  return (
                    <tr key={o.id}>
                      <td className="px-4 py-2">
                        <p className="font-bold text-[#0F172A]">{o.title}</p>
                        <p className="text-[10px] text-slate-500">
                          {o.partner.name} · {o.partner.relationship} · {o.kind}
                          {o.isSample && ' · sample'} · {o.locations.length ? `${o.locations.length} location(s)` : 'online'}
                        </p>
                      </td>
                      <td className="px-3 py-2">{o.country}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${o.status === 'live' ? 'bg-emerald-50 text-emerald-800' : o.status === 'paused' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{o.status}</span>
                      </td>
                      <td className="px-3 py-2 font-mono">{o.validUntil}</td>
                      <td className={`px-3 py-2 ${verifiedDays > 90 ? 'font-bold text-rose-700' : 'text-slate-600'}`}>{verifiedDays > 10_000 ? 'never' : `${verifiedDays}d ago`}</td>
                      <td className="px-3 py-2 text-right font-mono">{s.views}</td>
                      <td className="px-3 py-2 text-right font-mono">{s.clicks}</td>
                      <td className="px-3 py-2 text-right">
                        <button aria-label={`Edit ${o.title}`} onClick={() => setEditing(o)} className="rounded-full p-1 text-slate-500 hover:bg-slate-100 cursor-pointer">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          aria-label={`Delete ${o.title}`}
                          onClick={async () => {
                            if (!window.confirm(`Delete "${o.title}"? Its stats are deleted too.`)) return;
                            await api.del(`/admin/offers/${encodeURIComponent(o.id)}`);
                            await load();
                          }}
                          className="rounded-full p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="keel-card p-5" aria-label="Partners">
        <h2 className="text-sm font-extrabold text-[#0F172A]">Partners ({partners.length})</h2>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {partners.map((p) => (
            <li key={p.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs">
              <p className="font-bold text-[#0F172A]">{p.name}</p>
              <p className="text-[10px] text-slate-500">
                {p.relationship}
                {p.contractEnds && ` · contract ends ${p.contractEnds.slice(0, 10)}`}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function PartnerForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [relationship, setRelationship] = useState<Partner['relationship']>('partner');
  const [contractEnds, setContractEnds] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="keel-card wp-pop grid grid-cols-1 gap-3 p-5 sm:grid-cols-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api.post('/admin/partners', { name, website: website || null, relationship, contractEnds: contractEnds || null });
          await onSaved();
        } catch (x) {
          setErr(x instanceof Error ? x.message : 'Could not save.');
        }
        setBusy(false);
      }}
    >
      <label className="text-[11px] font-semibold text-slate-700">
        Name
        <input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className={`${inputCls} mt-1`} />
      </label>
      <label className="text-[11px] font-semibold text-slate-700">
        Website (https)
        <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" className={`${inputCls} mt-1`} />
      </label>
      <label className="text-[11px] font-semibold text-slate-700">
        Deal type
        <select value={relationship} onChange={(e) => setRelationship(e.target.value as Partner['relationship'])} className={`${inputCls} mt-1`}>
          {RELATIONSHIPS.map(([id, l]) => (
            <option key={id} value={id}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className="text-[11px] font-semibold text-slate-700">
        Contract ends
        <input type="date" value={contractEnds} onChange={(e) => setContractEnds(e.target.value)} className={`${inputCls} mt-1`} />
      </label>
      {err && <p className="text-xs font-semibold text-rose-700 sm:col-span-4">{err}</p>}
      <div className="flex justify-end gap-2 sm:col-span-4">
        <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-xs font-bold text-slate-600 cursor-pointer">
          Cancel
        </button>
        <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 rounded-full bg-[#0F172A] px-4 py-2 text-xs font-bold text-white disabled:opacity-50 cursor-pointer">
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save partner
        </button>
      </div>
    </form>
  );
}

function OfferForm({ offer, partners, onClose, onSaved }: { offer: PartnerOffer | null; partners: Partner[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const today = useToday();
  const countries = useMemo(() => countryOptions(), []);
  const [f, setF] = useState({
    partnerId: offer?.partnerId ?? partners[0]?.id ?? '',
    kind: offer?.kind ?? ('discount' as PartnerOffer['kind']),
    title: offer?.title ?? '',
    description: offer?.description ?? '',
    discountPct: offer?.discountBps ? String(offer.discountBps / 100) : '',
    country: offer?.country ?? 'BD',
    termsUrl: offer?.termsUrl ?? '',
    actionUrl: offer?.actionUrl ?? '',
    validFrom: offer?.validFrom ?? today,
    validUntil: offer?.validUntil ?? '',
    isSample: offer?.isSample ?? false,
    status: offer?.status ?? ('draft' as PartnerOffer['status']),
  });
  const [locs, setLocs] = useState<Loc[]>(offer?.locations.map((l) => ({ label: l.label, lat: String(l.lat), lng: String(l.lng) })) ?? []);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });

  const hereAsLocation = () =>
    navigator.geolocation?.getCurrentPosition((p) => setLocs([...locs, { label: 'Branch', lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) }]));

  return (
    <form
      className="keel-card wp-pop space-y-4 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        const body = {
          partnerId: f.partnerId,
          kind: f.kind,
          title: f.title,
          description: f.description,
          discountBps: f.kind === 'discount' && f.discountPct ? Math.round(parseFloat(f.discountPct) * 100) : null,
          country: f.country,
          termsUrl: f.termsUrl,
          actionUrl: f.actionUrl || null,
          validFrom: f.validFrom,
          validUntil: f.validUntil,
          verified,
          isSample: f.isSample,
          status: f.status,
          locations: locs.filter((l) => l.lat && l.lng).map((l) => ({ label: l.label || 'Branch', lat: Number(l.lat), lng: Number(l.lng) })),
        };
        try {
          if (offer) await api.put(`/admin/offers/${encodeURIComponent(offer.id)}`, body);
          else await api.post('/admin/offers', body);
          await onSaved();
        } catch (x) {
          setErr(x instanceof Error ? x.message : 'Could not save.');
        }
        setBusy(false);
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-[#0F172A]">{offer ? 'Edit offer' : 'New offer'}</h3>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <label className="text-[11px] font-semibold text-slate-700">
          Partner
          <select value={f.partnerId} onChange={(e) => set('partnerId', e.target.value)} className={`${inputCls} mt-1`}>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.relationship})
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] font-semibold text-slate-700">
          Type
          <select value={f.kind} onChange={(e) => set('kind', e.target.value as PartnerOffer['kind'])} className={`${inputCls} mt-1`}>
            <option value="discount">Discount</option>
            <option value="investment">Investment opportunity</option>
          </select>
        </label>
        <label className="text-[11px] font-semibold text-slate-700">
          Country
          <select value={f.country} onChange={(e) => set('country', e.target.value)} className={`${inputCls} mt-1`}>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] font-semibold text-slate-700">
          Status
          <select value={f.status} onChange={(e) => set('status', e.target.value as PartnerOffer['status'])} className={`${inputCls} mt-1`}>
            <option value="draft">Draft</option>
            <option value="live">Live</option>
            <option value="paused">Paused</option>
          </select>
        </label>
        <label className="text-[11px] font-semibold text-slate-700 sm:col-span-3">
          Title
          <input required maxLength={80} value={f.title} onChange={(e) => set('title', e.target.value)} className={`${inputCls} mt-1`} />
        </label>
        <label className="text-[11px] font-semibold text-slate-700">
          Discount %
          <input type="number" min={0.01} max={100} step="0.01" disabled={f.kind !== 'discount'} value={f.discountPct} onChange={(e) => set('discountPct', e.target.value)} className={`${inputCls} mt-1`} />
        </label>
        <label className="text-[11px] font-semibold text-slate-700 sm:col-span-4">
          Description
          <textarea maxLength={300} rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} className={`${inputCls} mt-1`} />
        </label>
        <label className="text-[11px] font-semibold text-slate-700 sm:col-span-2">
          Terms link (https, required)
          <input required type="url" value={f.termsUrl} onChange={(e) => set('termsUrl', e.target.value)} placeholder="https://" className={`${inputCls} mt-1`} />
        </label>
        <label className="text-[11px] font-semibold text-slate-700 sm:col-span-2">
          Offer link (https)
          <input type="url" value={f.actionUrl} onChange={(e) => set('actionUrl', e.target.value)} placeholder="https://" className={`${inputCls} mt-1`} />
        </label>
        <label className="text-[11px] font-semibold text-slate-700">
          Starts
          <input required type="date" value={f.validFrom} onChange={(e) => set('validFrom', e.target.value)} className={`${inputCls} mt-1`} />
        </label>
        <label className="text-[11px] font-semibold text-slate-700">
          Ends
          <input required type="date" value={f.validUntil} onChange={(e) => set('validUntil', e.target.value)} className={`${inputCls} mt-1`} />
        </label>
        <label className="flex items-center gap-2 pt-5 text-[11px] font-semibold text-slate-700">
          <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} /> I checked this offer today
        </label>
        <label className="flex items-center gap-2 pt-5 text-[11px] font-semibold text-slate-700">
          <input type="checkbox" checked={f.isSample} onChange={(e) => set('isSample', e.target.checked)} /> Sample (not a real deal)
        </label>
      </div>
      {offer && <p className="flex items-center gap-1 text-[10px] text-slate-500"><CheckCircle2 className="h-3 w-3" /> Last verified {offer.lastVerifiedAt.slice(0, 10)}. Live offers need a check in the last 90 days.</p>}

      <div>
        <p className="text-[11px] font-bold text-slate-700">Locations (leave empty for online-only)</p>
        <div className="mt-2 space-y-2">
          {locs.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_7rem_7rem_auto] gap-2">
              <input aria-label="Location name" value={l.label} onChange={(e) => setLocs(locs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="e.g. Gulshan branch" className={inputCls} />
              <input
                aria-label="Latitude"
                value={l.lat}
                onChange={(e) => {
                  // Pasting "23.79, 90.41" fills both.
                  const m = e.target.value.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
                  setLocs(locs.map((x, j) => (j === i ? (m ? { ...x, lat: m[1], lng: m[2] } : { ...x, lat: e.target.value }) : x)));
                }}
                placeholder="lat"
                className={`${inputCls} font-mono`}
              />
              <input aria-label="Longitude" value={l.lng} onChange={(e) => setLocs(locs.map((x, j) => (j === i ? { ...x, lng: e.target.value } : x)))} placeholder="lng" className={`${inputCls} font-mono`} />
              <button type="button" aria-label="Remove location" onClick={() => setLocs(locs.filter((_, j) => j !== i))} className="rounded-full p-1 text-slate-400 hover:text-rose-600 cursor-pointer">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-3">
          <button type="button" onClick={() => setLocs([...locs, { label: '', lat: '', lng: '' }])} disabled={locs.length >= 20} className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 cursor-pointer">
            <Plus className="h-3 w-3" /> Add location
          </button>
          <button type="button" onClick={hereAsLocation} className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 cursor-pointer">
            <MapPin className="h-3 w-3" /> Use my current location
          </button>
        </div>
      </div>

      {err && <p className="text-xs font-semibold text-rose-700">{err}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-xs font-bold text-slate-600 cursor-pointer">
          Cancel
        </button>
        <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 rounded-full bg-[#0F172A] px-5 py-2 text-xs font-bold text-white disabled:opacity-50 cursor-pointer">
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save offer
        </button>
      </div>
      <p className="text-[10px] text-slate-400">Users see it in {countryName(f.country)} only while it is live, between its dates, and verified in the last 90 days.</p>
    </form>
  );
}
