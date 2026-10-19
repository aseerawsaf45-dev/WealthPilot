'use client';

import React, { useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { CopilotTab } from './CopilotTab';
import type { SegmentId } from '../lib/assistant';

interface AssistantPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (tab: string) => void;
  onOpenQuickAdd: () => void;
  /** Opens the same chat as the full Copilot page. */
  onExpand: () => void;
  /** The tab it was opened from; questions are focused on it by default. */
  pageScope?: SegmentId;
  prefill?: { text: string; nonce: number };
}

/** Floating WealthPilot Assistant: the copilot chat, available on every tab. Changes still need Confirm. */
export function AssistantPanel({ open, onOpenChange, onNavigate, onOpenQuickAdd, onExpand, pageScope, prefill }: AssistantPanelProps) {
  const panel = useRef<HTMLDivElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);

  // Esc closes; Tab stays inside the panel while it is open; focus returns to the launcher on close.
  useEffect(() => {
    if (!open) return;
    const el = panel.current;
    el?.querySelector<HTMLTextAreaElement>('textarea')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
      if (e.key !== 'Tab' || !el) return;
      const items = [...el.querySelectorAll<HTMLElement>('button:not([disabled]), textarea:not([disabled]), [href]')];
      if (!items.length) return;
      const [first, last] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const opener = launcher.current;
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, [open, onOpenChange]);

  return (
    <>
      {/* No .btn-anim here: its `position: relative` would override `fixed` and drop the button below the footer. */}
      <button
        ref={launcher}
        onClick={() => onOpenChange(true)}
        aria-label="Open WealthPilot Assistant"
        title="Ask WealthPilot (press /)"
        className={`group fixed bottom-24 right-4 z-40 flex h-14 items-center gap-2 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 pl-4 pr-4 text-white shadow-xl shadow-indigo-500/30 ring-4 ring-white/70 transition-all duration-300 hover:pr-5 hover:shadow-2xl hover:shadow-indigo-500/40 focus-visible:outline-none focus-visible:ring-sky-300 sm:bottom-6 sm:right-6 cursor-pointer ${
          open ? 'pointer-events-none scale-90 opacity-0' : 'scale-100 opacity-100'
        }`}
      >
        <Sparkles className="h-6 w-6 shrink-0" />
        <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold transition-all duration-300 group-hover:max-w-40 group-focus-visible:max-w-40">
          Ask WealthPilot
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end">
          <div className="absolute inset-0 bg-slate-950/25 backdrop-blur-[2px]" onClick={() => onOpenChange(false)} aria-hidden="true" />
          <div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label="WealthPilot Assistant"
            className="wp-pop relative flex h-[88dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:m-3 sm:h-auto sm:w-[520px] sm:rounded-3xl"
          >
            <CopilotTab
              compact
              onNavigate={onNavigate}
              onOpenQuickAdd={onOpenQuickAdd}
              onClose={() => onOpenChange(false)}
              onExpand={onExpand}
              pageScope={pageScope}
              prefill={prefill}
            />
          </div>
        </div>
      )}
    </>
  );
}
