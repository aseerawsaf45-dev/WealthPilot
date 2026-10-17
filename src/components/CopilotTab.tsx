'use client';

import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { executeCopilotQuery } from '../services/copilotService';
import { api } from '../lib/api';
import { formatMoney } from '../lib/money';
import { AiConsentDialog } from './AiConsentDialog';
import type { CopilotFact, CopilotMessage } from '../types/finance';
import {
  Sparkles,
  Send,
  ShieldAlert,
  CheckCircle2,
  Trash2,
  Lock,
  Compass,
  ArrowRight,
} from 'lucide-react';

interface ServerAnswer {
  answer: string;
  insights: { title: string; description: string }[];
  suggested_actions: { label: string; action: string }[];
  facts: CopilotFact[];
  limitations: string[];
  source: 'rules' | 'llm:groq';
}

// Server action ids -> app tabs. Unknown ids are ignored (the model never controls navigation targets).
const ACTION_TABS: Record<string, string> = {
  open_transactions: 'transactions',
  open_budgets: 'budgets',
  open_goals: 'goals',
  open_bills: 'bills',
  open_category_report: 'overview',
  open_settings_privacy: 'settings',
};

// Module-level so the React compiler doesn't treat it as an impure call during render.
const messageId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

function formatFact(f: CopilotFact): string {
  switch (f.unit) {
    case 'cents':
      return formatMoney(Number(f.value), f.currency);
    case 'pct':
      return `${f.value}%`;
    case 'days':
      return `${f.value} days`;
    case 'months':
      return Number(f.value) === 1 ? '1 month' : `${f.value} months`;
    default:
      return String(f.value);
  }
}

export function CopilotTab({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const {
    accounts,
    transactions,
    budgets,
    goals,
    debts,
    preferences,
    copilotHistory,
    addCopilotMessage,
    clearCopilotHistory,
    setPreferences,
  } = useFinance();

  const [inputQuery, setInputQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const isSignedIn = preferences.isAuthenticated === true;
  // Signed in, the server answers with calculations even when AI wording is off.
  const canAsk = isSignedIn || preferences.isAiEnabled;

  const samplePrompts = [
    'Summarize my spending this month',
    'Why is dining my second highest expense?',
    'Scan ledger for duplicate charges',
    'Compare debt payoff options',
    'How is my emergency fund goal progressing?',
  ];

  const handleSend = async (queryToSend?: string) => {
    const text = queryToSend || inputQuery;
    if (!text.trim() || isProcessing || !canAsk) return;

    // 1. Append user message
    const userMsg = {
      id: messageId('user'),
      sender: 'user' as const,
      timestamp: new Date().toISOString(),
      content: text.trim(),
    };
    addCopilotMessage(userMsg);
    setInputQuery('');
    setIsProcessing(true);

    if (isSignedIn) {
      // 2a. Server copilot: numbers are calculated server-side from your saved data.
      let reply: CopilotMessage;
      try {
        const res = await api.post<ServerAnswer>('/ai/copilot', { message: text.trim() });
        reply = {
          id: messageId('copilot'),
          sender: 'assistant',
          timestamp: new Date().toISOString(),
          content: res.answer,
          facts: res.facts,
          limitations: res.limitations,
          source: res.source,
          insights: res.insights,
          suggestedActions: res.suggested_actions,
        };
      } catch (e) {
        reply = {
          id: messageId('copilot'),
          sender: 'assistant',
          timestamp: new Date().toISOString(),
          content: e instanceof Error ? e.message : 'The copilot is unavailable right now.',
        };
      }
      addCopilotMessage(reply);
      setIsProcessing(false);
      return;
    }

    // 2b. Demo mode (signed out): local deterministic engine over the demo data.
    setTimeout(() => {
      const response = executeCopilotQuery(text, {
        accounts,
        transactions,
        budgets,
        goals,
        debts,
        isAiEnabled: preferences.isAiEnabled,
      });

      addCopilotMessage(response);
      setIsProcessing(false);
    }, 400);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-[#0F172A] tracking-tight">AI Financial Copilot</h1>
            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono font-semibold border ${
              canAsk
                ? 'bg-sky-50 text-sky-800 border-sky-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}>
              {isSignedIn ? (preferences.isAiEnabled ? 'AI Wording On' : 'Calculated Answers') : preferences.isAiEnabled ? 'Demo Engine' : 'Offline Mode'}
            </span>
          </div>
          <p className="text-xs text-slate-600 font-medium mt-1">
            Every number is calculated by WealthPilot from your ledger. The AI, when on, only words the answer.
          </p>
        </div>

        <button
          onClick={clearCopilotHistory}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-slate-50 text-xs text-slate-700 hover:text-black border border-black/[0.08] transition-colors cursor-pointer shadow-2xs font-semibold"
        >
          <Trash2 className="w-3.5 h-3.5 text-slate-400" />
          <span>Clear History</span>
        </button>
      </div>

      {/* Signed in with AI wording off: calculated answers still work */}
      {isSignedIn && !preferences.isAiEnabled && (
        <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 flex flex-wrap items-start justify-between gap-3 text-xs text-sky-900">
          <div className="flex items-start gap-3">
            <Lock className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sky-950">AI wording is off</p>
              <p className="text-sky-800 leading-relaxed mt-0.5">
                Answers are calculated by WealthPilot and nothing is sent to an AI provider.
              </p>
            </div>
          </div>
          <button
            onClick={() => setConsentOpen(true)}
            className="px-3.5 py-1.5 rounded-full bg-[#0F172A] hover:bg-neutral-800 text-white font-semibold cursor-pointer"
          >
            Turn on AI wording
          </button>
        </div>
      )}

      {/* Demo mode kill switch */}
      {!isSignedIn && !preferences.isAiEnabled && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs text-amber-900">
          <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-950">Privacy Mode Activated</p>
            <p className="text-amber-800 leading-relaxed mt-0.5">
              AI Copilot query processing is disabled in your Privacy Settings. WealthPilot is functioning in 100% offline local ledger mode. You can re-enable this anytime in Privacy & Settings.
            </p>
          </div>
        </div>
      )}

      {/* Suggested Starters */}
      <div className="space-y-2">
        <p className="text-[11px] text-neutral-400 uppercase tracking-wider font-semibold">Suggested Grounded Inquiries:</p>
        <div className="flex flex-wrap gap-2">
          {samplePrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleSend(prompt)}
              className="px-3.5 py-1.5 rounded-full bg-white hover:bg-sky-50 hover:text-sky-800 hover:border-sky-300 border border-black/[0.08] text-xs text-neutral-700 font-medium transition-colors cursor-pointer shadow-2xs"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation Thread */}
      <div className="keel-card p-6 space-y-5 min-h-[420px] max-h-[600px] overflow-y-auto">
        {copilotHistory.map((msg) => {
          const isUser = msg.sender === 'user';

          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center shrink-0 shadow-2xs">
                  <Sparkles className="w-4 h-4 text-sky-600" />
                </div>
              )}

              <div
                className={`max-w-xl rounded-2xl p-4 text-xs leading-relaxed space-y-2.5 ${
                  isUser
                    ? 'bg-[#0F172A] text-white font-medium shadow-sm'
                    : 'bg-slate-50 border border-slate-200 text-[#0F172A]'
                }`}
              >
                <p>{msg.content}</p>

                {/* Server answer: insights, facts (the only source of numbers), limitations, actions */}
                {!isUser && msg.insights && msg.insights.length > 0 && (
                  <ul className="space-y-1">
                    {msg.insights.map((ins) => (
                      <li key={ins.title}>
                        <span className="font-semibold">{ins.title}:</span> {ins.description}
                      </li>
                    ))}
                  </ul>
                )}
                {!isUser && msg.facts && msg.facts.length > 0 && (
                  <ul aria-label="Calculated facts" className="flex flex-wrap gap-1.5">
                    {msg.facts.slice(0, 8).map((f) => (
                      <li key={f.id} className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-[10px] text-slate-700">
                        {f.label}: <span className="font-mono font-semibold">{formatFact(f)}</span>
                        {f.kind === 'estimate' && <span className="text-amber-700"> (estimate)</span>}
                      </li>
                    ))}
                    {msg.facts.length > 8 && <li className="text-[10px] text-slate-500 self-center">+{msg.facts.length - 8} more</li>}
                  </ul>
                )}
                {!isUser && msg.limitations && msg.limitations.length > 0 && (
                  <ul className="text-[10px] text-amber-800 space-y-0.5">
                    {msg.limitations.map((l) => (
                      <li key={l}>Note: {l}</li>
                    ))}
                  </ul>
                )}
                {!isUser && msg.suggestedActions && msg.suggestedActions.length > 0 && onNavigate && (
                  <div className="flex flex-wrap gap-2">
                    {msg.suggestedActions
                      .filter((a) => ACTION_TABS[a.action])
                      .map((a) => (
                        <button
                          key={a.action}
                          onClick={() => onNavigate(ACTION_TABS[a.action])}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white hover:bg-sky-50 border border-sky-200 text-[10px] font-semibold text-sky-800 cursor-pointer"
                        >
                          {a.label}
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      ))}
                  </div>
                )}
                {!isUser && msg.source && (
                  <p className="pt-2 border-t border-slate-200 flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                    <CheckCircle2 className="w-3 h-3 text-sky-600" />
                    {msg.source === 'llm:groq'
                      ? 'Worded by AI (Groq) · every number calculated by WealthPilot'
                      : 'Calculated by WealthPilot · no AI involved'}
                  </p>
                )}

                {/* Evidence Citation Chip */}
                {msg.evidence && !isUser && (
                  <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-2 text-[10px] text-slate-500 font-medium">
                    <span className="flex items-center gap-1 text-sky-700 font-semibold">
                      <CheckCircle2 className="w-3 h-3 text-sky-600" />
                      <span>Evidence: {msg.evidence.scope}</span>
                    </span>
                    <span>•</span>
                    <span>Scope: {msg.evidence.transactionCount} records</span>
                    <span>•</span>
                    <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700 font-mono font-semibold">
                      {msg.evidence.confidence === 'verified_fact' ? 'Verified Fact' : 'Estimate'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isProcessing && (
          <div className="flex gap-3 justify-start items-center text-xs text-slate-600 font-medium">
            <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center animate-spin">
              <Compass className="w-4 h-4 text-sky-600" />
            </div>
            <span>Reconciling records and evaluating deterministic calculations...</span>
          </div>
        )}
      </div>

      {/* Query Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="relative"
      >
        <input
          type="text"
          placeholder="Ask Copilot a question about your finances..."
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          disabled={!canAsk || isProcessing}
          aria-label="Ask the copilot a question"
          maxLength={500}
          className="w-full pl-5 pr-28 py-3.5 rounded-full bg-white border border-slate-200 text-xs text-[#0F172A] placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50 font-medium"
        />
        <button
          type="submit"
          disabled={!inputQuery.trim() || !canAsk || isProcessing}
          className="absolute right-2 top-2 bottom-2 px-5 bg-[#0F172A] hover:bg-neutral-800 text-white font-semibold text-xs rounded-full flex items-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer shadow-xs"
        >
          <span>Query</span>
          <Send className="w-3 h-3 text-sky-400" />
        </button>
      </form>

      <AiConsentDialog isOpen={consentOpen} onClose={() => setConsentOpen(false)} onAccept={() => setPreferences({ isAiEnabled: true })} />

      {/* AI Disclaimer */}
      <p className="text-[11px] text-center text-slate-500 font-medium">
        WealthPilot Copilot is a personal productivity assistant, not a licensed CPA, tax specialist, or investment adviser. Always confirm financial decisions with qualified professionals.
      </p>
    </div>
  );
}
