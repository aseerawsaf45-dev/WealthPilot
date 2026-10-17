'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';

interface AiConsentDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Plain-language AI notice (version ai-notice-v2, see CURRENT_AI_NOTICE in src/server/ai/privacy.ts).
 * Accepting records consent via POST /api/v1/user/ai-consent. Keep this text in sync with what
 * src/server/ai/orchestrator.ts actually sends (labels, not values), and bump the version when it changes.
 */
export function AiConsentDialog({ isOpen, onClose }: AiConsentDialogProps) {
  const { preferences, setPreferences } = useFinance();
  const [allowGemini, setAllowGemini] = useState(false);
  const hasRegion = !!preferences.region;

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-consent-title"
        className="w-full max-w-md keel-card bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="ai-consent-title" className="flex items-center gap-2 text-sm font-bold text-[#0F172A]">
            <Sparkles className="w-4 h-4 text-sky-600" />
            Turn on AI guidance?
          </h2>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-lg text-neutral-400 hover:text-black cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
          <p>
            With this on, WealthPilot sends <strong>your question</strong> and the <strong>names of the results it calculated</strong>{' '}
            (for example &ldquo;Dining spending&rdquo;, your goal and bill names, a verdict such as &ldquo;on track&rdquo;) to{' '}
            <strong>Groq</strong>, an AI provider in the United States, so it can write the answer and guidance.
          </p>
          <p>
            <strong>Never sent:</strong> any amounts, balances or dates, your individual transactions, merchant names, notes, account
            names or numbers, your name or your email. Card numbers, emails and phone numbers in your question are removed first.
          </p>
          <p>
            WealthPilot inserts every number itself. If the AI writes a number of its own, its wording is thrown away and you see the
            calculated answer instead.
          </p>

          <label className={`flex items-start gap-2 p-3 rounded-xl border ${hasRegion ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
            <input
              type="checkbox"
              checked={allowGemini && hasRegion}
              disabled={!hasRegion}
              onChange={(e) => setAllowGemini(e.target.checked)}
              className="mt-0.5 rounded text-sky-600 focus:ring-sky-500"
            />
            <span>
              <strong>Optional:</strong> also use <strong>Google Gemini</strong> as a backup when Groq is busy. Gemini&rsquo;s free tier
              may use what it receives to improve Google&rsquo;s products. Not available in the EU, UK, Switzerland or China.
              {!hasRegion && <em className="block mt-1 text-slate-500">Set your country in Settings first.</em>}
            </span>
          </label>

          <p>You can turn this off at any time in Settings. Turning it off stops all requests to AI providers immediately.</p>
          <p className="text-[10px] text-slate-500 font-mono">AI notice v2</p>
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-xs text-neutral-700 font-semibold transition-colors cursor-pointer"
          >
            Not now
          </button>
          <button
            autoFocus
            onClick={() => {
              setPreferences({ isAiEnabled: true, aiProviders: allowGemini && hasRegion ? ['groq', 'gemini'] : ['groq'] });
              onClose();
            }}
            className="flex-1 py-2.5 rounded-xl bg-[#0F172A] hover:bg-neutral-800 text-xs text-white font-bold transition-colors cursor-pointer"
          >
            Turn on AI guidance
          </button>
        </div>
      </div>
    </div>
  );
}
