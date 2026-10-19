'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { currencyOptions, currencyName, currencySymbol } from '../lib/currency';

interface Props {
  value: string;
  onChange: (code: string) => void;
  id?: string;
  className?: string;
  /** Compact trigger for tight rows (shows only the code). */
  compact?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}

/** Searchable picker for every ISO 4217 currency (popular ones first). */
export default function CurrencySelect({ value, onChange, id, className = '', compact, disabled, ariaLabel = 'Currency' }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const options = useMemo(() => currencyOptions(), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.code.toLowerCase().includes(q) || o.name.toLowerCase().includes(q) || o.symbol.toLowerCase() === q);
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    searchRef.current?.focus();
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (code: string) => {
    onChange(code);
    setOpen(false);
    setQuery('');
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[active]) choose(filtered[active].code);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => {
          setActive(0);
          setOpen((o) => !o);
        }}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-60 cursor-pointer transition-colors hover:border-slate-300"
      >
        <span className="truncate">
          <span className="font-mono">{value}</span>
          {!compact && (
            <span className="text-slate-500 font-medium">
              {' '}
              ({currencySymbol(value)}) — {currencyName(value)}
            </span>
          )}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full min-w-[260px] rounded-xl bg-white border border-slate-200 shadow-xl shadow-slate-900/10 overflow-hidden wp-pop">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKey}
              placeholder="Search 150+ currencies (code or name)"
              aria-label="Search currencies"
              className="w-full bg-transparent text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
          <ul ref={listRef} role="listbox" aria-label={ariaLabel} className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && <li className="px-3 py-3 text-xs text-slate-500">No currency matches “{query}”.</li>}
            {filtered.map((o, i) => (
              <li
                key={o.code}
                data-index={i}
                role="option"
                aria-selected={o.code === value}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(o.code);
                }}
                className={`flex items-center gap-2.5 px-3 py-1.5 text-xs cursor-pointer ${i === active ? 'bg-sky-50' : ''}`}
              >
                <span className="w-9 font-mono font-bold text-slate-800">{o.code}</span>
                <span className="w-8 text-slate-500 truncate">{o.symbol}</span>
                <span className="flex-1 truncate text-slate-700">{o.name}</span>
                {o.code === value && <Check className="w-3.5 h-3.5 text-sky-600" />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
