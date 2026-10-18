'use client';

import React, { useEffect, useRef } from 'react';
import { Sparkles, X } from 'lucide-react';
import { CopilotTab } from './CopilotTab';

interface AssistantPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (tab: string) => void;
  onOpenQuickAdd: () => void;
}

/** Floating WealthPilot Assistant: the copilot chat, available on every tab. Changes still need Confirm. */
export function AssistantPanel({ open, onOpenChange, onNavigate, onOpenQuickAdd }: AssistantPanelProps) {
  const panel = useRef<HTMLDivElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);

  // Esc closes; Tab stays inside the panel while it is open; focus returns to the launcher on close.
  useEffect(() => {
    if (!open) return;
    const el = panel.current;
    el?.querySelector<HTMLInputElement>('input')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
      if (e.key !== 'Tab' || !el) return;
      const items = [...el.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [href]')];
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
      <button
        ref={launcher}
        onClick={() => onOpenChange(true)}
        aria-label="Open WealthPilot Assistant"
        title="Assistant (press /)"
        className="wp-pop fixed bottom-24 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center gap-2 rounded-full bg-[#0F172A] pl-3.5 pr-4 py-3 text-xs font-bold text-white shadow-xl hover:bg-neutral-800 cursor-pointer btn-anim"
      >
        <Sparkles className="h-4 w-4 text-sky-400" />
        <span className="hidden sm:inline">Assistant</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end">
          <div className="absolute inset-0 bg-slate-950/30 backdrop-blur-[2px]" onClick={() => onOpenChange(false)} aria-hidden="true" />
          <div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label="WealthPilot Assistant"
            className="wp-pop relative flex h-[85vh] w-full flex-col rounded-t-3xl border border-slate-200 bg-[#F8FAFC] shadow-2xl sm:h-auto sm:max-w-md sm:rounded-none sm:rounded-l-3xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-sky-100 bg-sky-50">
                  <Sparkles className="h-4 w-4 text-sky-600" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-[#0F172A]">WealthPilot Assistant</h2>
                  <p className="text-[10px] font-medium text-slate-500">Advice from your data · changes only after you confirm</p>
                </div>
              </div>
              <button onClick={() => onOpenChange(false)} aria-label="Close assistant" className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-black cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 p-4">
              <CopilotTab compact onNavigate={onNavigate} onOpenQuickAdd={onOpenQuickAdd} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
