'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { executeCopilotQuery } from '../services/copilotService';
import { api } from '../lib/api';
import { formatFact } from '../lib/money';
import { AiConsentDialog } from './AiConsentDialog';
import { looksLikeCommand, parseScope, SEGMENTS } from '../lib/assistant';
import { ASSISTANT_OPS, type ActionProposal, type CopilotFact, type CopilotMessage } from '../types/finance';
import {
  Sparkles,
  Send,
  ShieldAlert,
  CheckCircle2,
  Trash2,
  Lock,
  Compass,
  ArrowRight,
  AlertTriangle,
  Check,
  X,
} from 'lucide-react';

interface ServerAnswer {
  answer: string;
  insights: { title: string; description: string }[];
  suggested_actions: { label: string; action: string }[];
  facts: CopilotFact[];
  limitations: string[];
  source: 'rules' | 'llm:groq';
  proposals?: ActionProposal[];
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


interface CopilotTabProps {
  onNavigate?: (tab: string) => void;
  onOpenQuickAdd?: () => void;
  /** Floating assistant panel: no page header or starter grid; fills its container. */
  compact?: boolean;
}

export function CopilotTab({ onNavigate, onOpenQuickAdd, compact = false }: CopilotTabProps) {
  const finance = useFinance();
  const {
    accounts,
    transactions,
    budgets,
    goals,
    debts,
    preferences,
    copilotHistory,
    addCopilotMessage,
    updateCopilotMessage,
    clearCopilotHistory,
    setPreferences,
  } = useFinance();

  const [inputQuery, setInputQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [runningKey, setRunningKey] = useState<string | null>(null);
  const [menuIndex, setMenuIndex] = useState(0);
  // "/" at the start of the input opens the segment menu, filtered by what follows it.
  const slashQuery = /^\/[a-z]*$/i.test(inputQuery) ? inputQuery.slice(1).toLowerCase() : null;
  const segmentOptions = slashQuery === null ? [] : SEGMENTS.filter((seg) => seg.id.startsWith(slashQuery));
  const pickSegment = (id: string) => {
    setInputQuery(`/${id} `);
    setMenuIndex(0);
  };
  const threadEnd = useRef<HTMLDivElement>(null);
  // Braces matter: newer Chrome's scrollIntoView returns a Promise, and an effect must return nothing or a cleanup.
  useEffect(() => {
    threadEnd.current?.scrollIntoView({ block: 'end' });
  }, [copilotHistory.length, isProcessing]);
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
    const { scope, text: question } = parseScope(text);

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
        const res = await api.post<ServerAnswer>('/ai/copilot', { message: question, ...(scope && { scope }) });
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
          proposals: res.proposals,
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

    // 2b. Demo mode (signed out): local deterministic engine over the demo data (read-only).
    setTimeout(() => {
      const seg = scope && SEGMENTS.find((x) => x.id === scope);
      if (seg && !question) {
        addCopilotMessage({ id: messageId('copilot'), sender: 'assistant', timestamp: new Date().toISOString(), content: `Things I can do in ${seg.label} once you sign in: ${seg.examples.map((e) => `"${e}"`).join(', ')}.` });
        setIsProcessing(false);
        return;
      }
      if (looksLikeCommand(question)) {
        addCopilotMessage({ id: messageId('copilot'), sender: 'assistant', timestamp: new Date().toISOString(), content: 'Sign in to let the assistant make changes. In demo mode I can answer questions about the sample data.' });
        setIsProcessing(false);
        return;
      }
      const response = executeCopilotQuery(question, {
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

  /** Runs one proposal through the same FinanceContext action the app's own buttons use. Returns an error message, if any. */
  const execute = async (p: ActionProposal): Promise<string | undefined> => {
    if (!(ASSISTANT_OPS as readonly string[]).includes(p.op)) return 'Unknown action.';
    let error: string | undefined;
    try {
      if (p.op === 'navigate') onNavigate?.(String(p.args[0]));
      else if (p.op === 'openQuickAdd') onOpenQuickAdd?.();
      else {
        const res: unknown = await (finance[p.op] as (...a: unknown[]) => unknown)(...p.args);
        // Actions report failure as false, { success: false, conflict } or { error }; the rest show the app's error toast.
        if (res === false) error = 'That change could not be saved.';
        else if (res && typeof res === 'object') {
          const r = res as { success?: boolean; conflict?: string; error?: string };
          if (r.error) error = r.error;
          else if (r.success === false) error = r.conflict ?? 'That change could not be saved.';
        }
        if (!error && p.op === 'planGoal') onNavigate?.('goals');
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'That change could not be saved.';
    }
    return error;
  };
  const setStep = (msgId: string, index: number, patch: Partial<ActionProposal>) =>
    updateCopilotMessage(msgId, (m) => ({ proposals: m.proposals?.map((q, j) => (j === index ? { ...q, ...patch } : q)) }));
  /** Runs the given steps in order; stops at the first failure and leaves the rest pending. */
  const runSteps = async (msg: CopilotMessage, indices: number[]) => {
    if (runningKey) return;
    for (const i of indices) {
      const p = msg.proposals?.[i];
      if (!p || p.status) continue;
      setRunningKey(`${msg.id}:${i}`);
      const error = await execute(p);
      setStep(msg.id, i, { status: error ? 'failed' : 'done', error });
      if (error) break;
    }
    setRunningKey(null);
  };

  return (
    <div className={compact ? 'flex h-full min-h-0 flex-col gap-3' : 'space-y-6 max-w-4xl mx-auto'}>
      {/* Header */}
      {!compact && (
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
      )}

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
      {!compact && (
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
      )}

      {/* Conversation Thread */}
      <div className={compact ? 'flex-1 min-h-0 space-y-4 overflow-y-auto pr-1' : 'keel-card p-6 space-y-5 min-h-[420px] max-h-[600px] overflow-y-auto'}>
        {compact && copilotHistory.length <= 1 && (
          <div className="space-y-2 text-xs text-slate-600">
            <p className="font-semibold text-slate-800">Ask for advice, or tell me what to change.</p>
            <div className="flex flex-wrap gap-1.5">
              {['How much did I spend this month?', 'add $12 coffee and open transactions', 'set dining budget to $300', '/goals', 'Compare debt payoff options'].map((q) => (
                <button key={q} onClick={() => handleSend(q)} className="px-2.5 py-1 rounded-full bg-white hover:bg-sky-50 border border-slate-200 text-[11px] font-medium cursor-pointer">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
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

                {/* Prepared changes: nothing is saved until Confirm */}
                {!isUser && msg.proposals && msg.proposals.length > 1 && (() => {
                  const pending = msg.proposals.flatMap((q, j) => (q.status ? [] : [j]));
                  const hasDelete = pending.some((j) => msg.proposals![j].destructive);
                  return (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sky-50 border border-sky-200 px-3 py-2">
                      <span className="font-bold text-sky-950">Plan · {msg.proposals.length} steps</span>
                      {pending.length > 0 && (
                        <button
                          onClick={() => runSteps(msg, pending)}
                          disabled={!!runningKey}
                          className={`px-3 py-1.5 rounded-full text-[11px] font-bold text-white cursor-pointer disabled:opacity-50 ${hasDelete ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[#0F172A] hover:bg-neutral-800'}`}
                        >
                          {runningKey?.startsWith(`${msg.id}:`) ? 'Running…' : `Run all ${pending.length}${hasDelete ? ' (includes a delete)' : ''}`}
                        </button>
                      )}
                    </div>
                  );
                })()}
                {!isUser && msg.proposals && msg.proposals.length > 0 && (
                  <ol className="space-y-2" aria-label="Changes to confirm">
                    {msg.proposals.map((p, i) => {
                      const running = runningKey === `${msg.id}:${i}`;
                      return (
                        <li key={i} className={`wp-pop rounded-xl border p-3 bg-white ${p.destructive && !p.status ? 'border-rose-300' : 'border-slate-200'}`}>
                          <p className={`flex items-start gap-1.5 font-semibold ${p.destructive ? 'text-rose-900' : 'text-slate-900'}`}>
                            {msg.proposals!.length > 1 && <span className="shrink-0 font-mono text-slate-400">{i + 1}.</span>}
                            {p.destructive && <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px text-rose-600" aria-label="Cannot be undone" />}
                            {p.summary}
                          </p>
                          {!p.status ? (
                            <div className="mt-2 flex gap-2">
                              <button
                                onClick={() => runSteps(msg, [i])}
                                disabled={!!runningKey}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold text-white cursor-pointer disabled:opacity-50 ${p.destructive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[#0F172A] hover:bg-neutral-800'}`}
                              >
                                <Check className="w-3 h-3" />
                                {running ? 'Saving…' : p.destructive ? 'Confirm delete' : 'Confirm'}
                              </button>
                              <button
                                onClick={() => setStep(msg.id, i, { status: 'cancelled' })}
                                disabled={running}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                              >
                                <X className="w-3 h-3" />
                                {msg.proposals!.length > 1 ? 'Skip' : 'Cancel'}
                              </button>
                            </div>
                          ) : (
                            <p role="status" className={`mt-1.5 text-[11px] font-semibold ${p.status === 'done' ? 'text-emerald-700' : p.status === 'failed' ? 'text-rose-700' : 'text-slate-500'}`}>
                              {p.status === 'done' ? '✓ Done' : p.status === 'failed' ? `Not saved: ${p.error}` : msg.proposals!.length > 1 ? 'Skipped' : 'Cancelled'}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}

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
        <div ref={threadEnd} />
      </div>

      {/* Query Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="relative"
      >
        {segmentOptions.length > 0 && (
          <ul
            id="wp-segment-menu"
            role="listbox"
            aria-label="Pick what you need help with"
            className="wp-pop absolute bottom-full left-0 mb-2 w-64 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl z-10"
          >
            {segmentOptions.map((seg, i) => (
              <li key={seg.id} role="option" aria-selected={i === menuIndex}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickSegment(seg.id)}
                  className={`w-full rounded-xl px-3 py-2 text-left text-xs cursor-pointer ${i === menuIndex ? 'bg-sky-50 text-sky-900' : 'text-slate-700 hover:bg-slate-50'}`}
                >
                  <span className="font-mono font-semibold">/{seg.id}</span>
                  <span className="block text-[10px] text-slate-500 truncate">{seg.examples[0]}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          type="text"
          placeholder={compact ? 'Ask, say what to change, or type / for a section…' : 'Ask Copilot a question, tell it what to change, or type / to pick a section...'}
          value={inputQuery}
          onChange={(e) => {
            setInputQuery(e.target.value);
            setMenuIndex(0);
          }}
          onKeyDown={(e) => {
            if (!segmentOptions.length) return;
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              setMenuIndex((i) => (i + (e.key === 'ArrowDown' ? 1 : segmentOptions.length - 1)) % segmentOptions.length);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault();
              pickSegment(segmentOptions[Math.min(menuIndex, segmentOptions.length - 1)].id);
            } else if (e.key === 'Escape') {
              e.stopPropagation(); // closes the menu, not the assistant panel
              setInputQuery('');
            }
          }}
          role="combobox"
          aria-expanded={segmentOptions.length > 0}
          aria-controls="wp-segment-menu"
          aria-autocomplete="list"
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

      <AiConsentDialog isOpen={consentOpen} onClose={() => setConsentOpen(false)} />

      {/* AI Disclaimer */}
      <p className={`text-center text-slate-500 font-medium ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
        WealthPilot Copilot is a personal productivity assistant, not a licensed CPA, tax specialist, or investment adviser. Always confirm financial decisions with qualified professionals.
      </p>
    </div>
  );
}
