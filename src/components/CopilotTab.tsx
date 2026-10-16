'use client';

import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { executeCopilotQuery } from '../services/copilotService';
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

export function CopilotTab() {
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
  } = useFinance();

  const [inputQuery, setInputQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const samplePrompts = [
    'Summarize my spending this month',
    'Why is dining my second highest expense?',
    'Scan ledger for duplicate charges',
    'Compare debt payoff options',
    'How is my emergency fund goal progressing?',
  ];

  const handleSend = (queryToSend?: string) => {
    const text = queryToSend || inputQuery;
    if (!text.trim() || isProcessing) return;

    // 1. Append user message
    const userMsg = {
      id: `user_${Date.now()}`,
      sender: 'user' as const,
      timestamp: new Date().toISOString(),
      content: text.trim(),
    };
    addCopilotMessage(userMsg);
    setInputQuery('');
    setIsProcessing(true);

    // 2. Execute deterministic grounded query
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
              preferences.isAiEnabled
                ? 'bg-sky-50 text-sky-800 border-sky-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}>
              {preferences.isAiEnabled ? 'Grounded Engine Active' : 'Offline Mode'}
            </span>
          </div>
          <p className="text-xs text-slate-600 font-medium mt-1">
            Answers are calculated strictly via deterministic ledger code. Never hallucinating balances or returns.
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

      {/* Kill Switch Warning if disabled */}
      {!preferences.isAiEnabled && (
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
          disabled={!preferences.isAiEnabled || isProcessing}
          className="w-full pl-5 pr-28 py-3.5 rounded-full bg-white border border-slate-200 text-xs text-[#0F172A] placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50 font-medium"
        />
        <button
          type="submit"
          disabled={!inputQuery.trim() || !preferences.isAiEnabled || isProcessing}
          className="absolute right-2 top-2 bottom-2 px-5 bg-[#0F172A] hover:bg-neutral-800 text-white font-semibold text-xs rounded-full flex items-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer shadow-xs"
        >
          <span>Query</span>
          <Send className="w-3 h-3 text-sky-400" />
        </button>
      </form>

      {/* AI Disclaimer */}
      <p className="text-[11px] text-center text-slate-500 font-medium">
        WealthPilot Copilot is a personal productivity assistant, not a licensed CPA, tax specialist, or investment adviser. Always confirm financial decisions with qualified professionals.
      </p>
    </div>
  );
}
