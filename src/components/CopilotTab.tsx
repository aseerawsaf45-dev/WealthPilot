'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { executeCopilotQuery } from '../services/copilotService';
import { api } from '../lib/api';
import { formatFact } from '../lib/money';
import { AiConsentDialog } from './AiConsentDialog';
import { useDocumentImport } from './import/useDocumentImport';
import { DocumentDropzone, ImportReview, DocumentReadingConsent } from './import/ImportReview';
import { ACCEPT } from '../lib/extract/browser';
import { looksLikeCommand, parseScope, SEGMENTS, type SegmentId } from '../lib/assistant';
import type { ChatSummary } from '../context/useChatHistory';
import { ASSISTANT_OPS, type ActionProposal, type CopilotFact, type CopilotMessage } from '../types/finance';
import {
  Sparkles,
  ArrowUp,
  CheckCircle2,
  Trash2,
  ArrowRight,
  AlertTriangle,
  Check,
  X,
  SquarePen,
  PanelLeft,
  Maximize2,
  MessageSquare,
  History,
  PiggyBank,
  ReceiptText,
  Target,
  Wallet,
  Paperclip,
  X as CloseIcon,
} from 'lucide-react';

interface ServerAnswer {
  answer: string;
  insights: { title: string; description: string }[];
  suggested_actions: { label: string; action: string }[];
  facts: CopilotFact[];
  limitations: string[];
  source: 'rules' | 'llm:groq';
  proposals?: ActionProposal[];
  needsReply?: boolean;
  quickReplies?: string[];
  pending?: CopilotMessage['pending'];
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

const STARTERS = [
  { icon: Wallet, title: 'Where did my money go?', prompt: 'How much did I spend this month?' },
  { icon: Target, title: 'Plan a new goal', prompt: 'I want to create a goal called New Car for $15,000 by 2027-10-01' },
  { icon: ReceiptText, title: 'Bills coming up', prompt: 'What bills are due soon?' },
  { icon: PiggyBank, title: 'Record and organise', prompt: 'add $12 coffee and open transactions' },
];

// Module-level so the React compiler doesn't treat it as an impure call during render.
const messageId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

/** Groups chats like Claude's sidebar: Today, Yesterday, Previous 7 days, Older. */
function groupChats(chats: ChatSummary[], now: number) {
  const day = 86_400_000;
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  const groups: { label: string; items: ChatSummary[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Previous 7 days', items: [] },
    { label: 'Older', items: [] },
  ];
  for (const c of chats) {
    const t = new Date(c.updatedAt).getTime();
    groups[t >= startOfToday ? 0 : t >= startOfToday - day ? 1 : t >= startOfToday - 7 * day ? 2 : 3].items.push(c);
  }
  return groups.filter((g) => g.items.length);
}

interface CopilotTabProps {
  onNavigate?: (tab: string) => void;
  onOpenQuickAdd?: () => void;
  /** Floating assistant panel: fills its container and shows close / full-page buttons. */
  compact?: boolean;
  onClose?: () => void;
  onExpand?: () => void;
  /** The page the floating assistant was opened from: questions without "/segment" are answered for it. */
  pageScope?: SegmentId;
  /** Sent once when `nonce` changes (e.g. "Ask about this page" → "/goals"). */
  prefill?: { text: string; nonce: number };
}

export function CopilotTab({ onNavigate, onOpenQuickAdd, compact = false, onClose, onExpand, pageScope, prefill }: CopilotTabProps) {
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
    setPreferences,
    chats,
    activeChatId,
    newChat,
    openChat,
    deleteChat,
    deleteAllChats,
  } = finance;

  const [inputQuery, setInputQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [runningKey, setRunningKey] = useState<string | null>(null);
  const [menuIndex, setMenuIndex] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(!compact);
  const [now] = useState(() => Date.now());
  const [usePageScope, setUsePageScope] = useState(true);
  // Attachments: receipts, statements, spreadsheets → read on this device → reviewed in a sheet → saved.
  const docs = useDocumentImport();
  const [importOpen, setImportOpen] = useState(false);
  const [docConsentOpen, setDocConsentOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const attach = (files: FileList | File[]) => {
    if (!Array.from(files).length) return;
    setImportOpen(true);
    void docs.addFiles(files);
  };
  const pageLabel = pageScope ? SEGMENTS.find((x) => x.id === pageScope)?.label : undefined;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const threadEnd = useRef<HTMLDivElement>(null);
  const createdIds = useRef(new Map<string, string>()); // message id -> id of the record its plan created (for '$prev' steps)

  // "/" at the start of the input opens the section menu, filtered by what follows it.
  const slashQuery = /^\/[a-z]*$/i.test(inputQuery) ? inputQuery.slice(1).toLowerCase() : null;
  const segmentOptions = slashQuery === null ? [] : SEGMENTS.filter((seg) => seg.id.startsWith(slashQuery));
  const pickSegment = (id: string) => {
    setInputQuery(`/${id} `);
    setMenuIndex(0);
    inputRef.current?.focus();
  };

  // Braces matter: newer Chrome's scrollIntoView returns a Promise, and an effect must return nothing or a cleanup.
  useEffect(() => {
    threadEnd.current?.scrollIntoView({ block: 'end' });
  }, [copilotHistory.length, isProcessing]);

  // The textarea grows with its content (up to ~6 lines).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [inputQuery]);

  const isSignedIn = preferences.isAuthenticated === true;
  // Signed in, the server answers with calculations even when AI wording is off.
  const canAsk = isSignedIn || preferences.isAiEnabled;
  const conversation = copilotHistory.filter((m) => m.id !== 'init_welcome'); // the demo greeting is replaced by the empty state
  const isEmpty = conversation.length === 0; // an assistant-only message (e.g. an import result) also ends the empty state
  const activeTitle = chats.find((c) => c.id === activeChatId)?.title ?? 'New chat';

  const reply = (content: string) => addCopilotMessage({ id: messageId('copilot'), sender: 'assistant', timestamp: new Date().toISOString(), content });

  const handleSend = async (queryToSend?: string) => {
    const text = (queryToSend ?? inputQuery).trim();
    if (!text || isProcessing || !canAsk) return;
    const parsed = parseScope(text);
    const question = parsed.text;
    const scope = parsed.scope ?? (usePageScope ? pageScope : undefined);
    // Recent turns let a follow-up ("maybe $30") finish the earlier request.
    const history = copilotHistory
      .filter((m) => m.content && m.id !== 'init_welcome')
      .slice(-6)
      .map((m) => ({ role: m.sender, content: m.content.slice(0, 1200) }));
    const last = copilotHistory.at(-1);
    const followUp = !!last?.clarificationNeeded;
    const pending = followUp ? last?.pending : undefined;

    addCopilotMessage({ id: messageId('user'), sender: 'user', timestamp: new Date().toISOString(), content: text });
    setInputQuery('');
    setIsProcessing(true);

    if (isSignedIn) {
      // Server copilot: numbers are calculated server-side from your saved data.
      try {
        const res = await api.post<ServerAnswer>('/ai/copilot', { message: question, history, followUp, ...(pending && { pending }), ...(scope && { scope }) });
        addCopilotMessage({
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
          clarificationNeeded: res.needsReply,
          quickReplies: res.quickReplies,
          pending: res.pending,
        });
      } catch (e) {
        reply(e instanceof Error ? e.message : 'The assistant is unavailable right now.');
      }
      setIsProcessing(false);
      return;
    }

    // Demo mode (signed out): local deterministic engine over the demo data (read-only).
    setTimeout(() => {
      const seg = scope && SEGMENTS.find((x) => x.id === scope);
      if (seg && !question) reply(`Things I can do in ${seg.label} once you sign in: ${seg.examples.map((e) => `"${e}"`).join(', ')}.`);
      else if (looksLikeCommand(question)) reply('Sign in to let the assistant make changes. In demo mode I can answer questions about the sample data.');
      else addCopilotMessage(executeCopilotQuery(question, { accounts, transactions, budgets, goals, debts, isAiEnabled: preferences.isAiEnabled }));
      setIsProcessing(false);
    }, 400);
  };

  // "Ask about this page" (and other prefills) send once per nonce.
  const sentNonce = useRef<number | null>(null);
  const sendRef = useRef(handleSend);
  useEffect(() => {
    sendRef.current = handleSend;
  });
  useEffect(() => {
    if (!prefill || sentNonce.current === prefill.nonce) return;
    sentNonce.current = prefill.nonce;
    if (prefill.text) sendRef.current(prefill.text);
    else inputRef.current?.focus();
  }, [prefill]);

  /**
   * Runs one proposal through the same FinanceContext action the app's own buttons use. '$prev' in its args is
   * the record an earlier step of the same plan created (e.g. "create goal" then "make a plan for it").
   */
  const execute = async (msgId: string, p: ActionProposal): Promise<string | undefined> => {
    if (!(ASSISTANT_OPS as readonly string[]).includes(p.op)) return 'Unknown action.';
    const prev = createdIds.current.get(msgId);
    if (p.args.includes('$prev') && !prev) return 'Confirm the step before this one first.';
    const args = p.args.map((a) => (a === '$prev' ? prev : a));
    let error: string | undefined;
    try {
      if (p.op === 'navigate') onNavigate?.(String(args[0]));
      else if (p.op === 'openQuickAdd') onOpenQuickAdd?.();
      else {
        const res: unknown = await (finance[p.op] as (...a: unknown[]) => unknown)(...args);
        // Actions report failure as false, undefined (add*), { success: false, conflict } or { error }; the rest show the app's error toast.
        if (res === false || (p.op === 'addGoal' && !res)) error = 'That change could not be saved.';
        else if (res && typeof res === 'object') {
          if ('id' in res && typeof res.id === 'string') createdIds.current.set(msgId, res.id);
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
      const error = await execute(msg.id, p);
      setStep(msg.id, i, { status: error ? 'failed' : 'done', error });
      if (error) break;
    }
    setRunningKey(null);
  };

  const startNewChat = () => {
    newChat();
    if (compact) setSidebarOpen(false);
    inputRef.current?.focus();
  };

  // ---- Sidebar ---------------------------------------------------------------------------------

  const sidebar = sidebarOpen && (
    <aside
      aria-label="Chat history"
      className={`${compact ? 'absolute inset-y-0 left-0 z-20 w-72 shadow-2xl' : 'absolute inset-y-0 left-0 z-20 w-72 shadow-2xl md:static md:z-auto md:shadow-none'} flex flex-col border-r border-slate-200 bg-slate-50`}
    >
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          <History className="h-3.5 w-3.5" /> Chats
        </span>
        <button onClick={() => setSidebarOpen(false)} aria-label="Hide chat history" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 cursor-pointer">
          <PanelLeft className="h-4 w-4" />
        </button>
      </div>
      <div className="px-3 pb-2">
        <button
          onClick={startNewChat}
          className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs hover:border-sky-300 hover:bg-sky-50 cursor-pointer"
        >
          <SquarePen className="h-3.5 w-3.5 text-sky-600" /> New chat
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-3">
        {chats.length === 0 && <p className="px-2 py-6 text-center text-[11px] text-slate-400">Your chats will appear here.</p>}
        {groupChats(chats, now).map((g) => (
          <div key={g.label} className="mt-2">
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{g.label}</p>
            <ul className="space-y-0.5">
              {g.items.map((c) => (
                <li key={c.id} className="group relative">
                  <button
                    onClick={() => {
                      void openChat(c.id);
                      if (compact) setSidebarOpen(false);
                    }}
                    aria-current={c.id === activeChatId ? 'true' : undefined}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 pr-8 text-left text-xs cursor-pointer ${
                      c.id === activeChatId ? 'bg-white font-semibold text-slate-900 shadow-2xs ring-1 ring-slate-200' : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{c.title}</span>
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete "${c.title}"?`)) void deleteChat(c.id);
                    }}
                    aria-label={`Delete chat ${c.title}`}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 opacity-0 hover:bg-rose-50 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100 cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-3 text-[11px]">
        {!isSignedIn ? (
          <p className="text-slate-500">Sign in to save chats across devices.</p>
        ) : preferences.chatHistoryEnabled ? (
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-emerald-700 font-semibold">
              <CheckCircle2 className="h-3 w-3" /> History saved
            </span>
            {chats.length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm('Delete all saved chats? This cannot be undone.')) void deleteAllChats();
                }}
                className="text-slate-500 hover:text-rose-600 cursor-pointer"
              >
                Delete all
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-slate-600 leading-snug">Chats are kept only until you reload. Save them to your account to pick up later on any device.</p>
            <button
              onClick={() => setPreferences({ chatHistoryEnabled: true })}
              className="w-full rounded-lg bg-[#0F172A] px-3 py-1.5 font-semibold text-white hover:bg-neutral-800 cursor-pointer"
            >
              Save chat history
            </button>
          </div>
        )}
      </div>
    </aside>
  );

  // ---- Messages ---------------------------------------------------------------------------------

  const renderMessage = (msg: CopilotMessage) => {
    if (msg.sender === 'user') {
      return (
        <div key={msg.id} className="flex justify-end">
          <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[#0F172A] px-4 py-2.5 text-[13px] leading-relaxed text-white shadow-sm">{msg.content}</p>
        </div>
      );
    }
    const proposals = msg.proposals ?? [];
    const pending = proposals.flatMap((q, j) => (q.status ? [] : [j]));
    const hasDelete = pending.some((j) => proposals[j].destructive);
    return (
      <div key={msg.id} className="flex gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 shadow-sm">
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="min-w-0 flex-1 space-y-3 text-[13px] leading-relaxed text-slate-800">
          <p className="whitespace-pre-wrap">{msg.content}</p>

          {msg.insights && msg.insights.length > 0 && (
            <ul className="space-y-1.5">
              {msg.insights.map((ins) => (
                <li key={ins.title} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <span className="font-semibold text-slate-900">{ins.title}</span>
                  <span className="text-slate-600"> · {ins.description}</span>
                </li>
              ))}
            </ul>
          )}

          {msg.facts && msg.facts.length > 0 && (
            <ul aria-label="Calculated facts" className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {msg.facts.slice(0, 6).map((f) => (
                <li key={f.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-500">{f.label}</p>
                  <p className="font-mono text-[13px] font-semibold text-slate-900">
                    {formatFact(f)}
                    {f.kind === 'estimate' && <span className="ml-1 font-sans text-[10px] font-medium text-amber-700">estimate</span>}
                  </p>
                </li>
              ))}
              {msg.facts.length > 6 && <li className="self-center px-1 text-[11px] text-slate-500">+{msg.facts.length - 6} more figures</li>}
            </ul>
          )}

          {proposals.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3.5 py-2.5">
                <span className="text-xs font-bold text-slate-900">{proposals.length > 1 ? `Plan · ${proposals.length} steps` : 'Change to confirm'}</span>
                {proposals.length > 1 && pending.length > 0 && (
                  <button
                    onClick={() => runSteps(msg, pending)}
                    disabled={!!runningKey}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50 cursor-pointer ${hasDelete ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[#0F172A] hover:bg-neutral-800'}`}
                  >
                    {runningKey?.startsWith(`${msg.id}:`) ? 'Running…' : `Run all ${pending.length}${hasDelete ? ' · includes a delete' : ''}`}
                  </button>
                )}
              </div>
              <ol aria-label="Changes to confirm" className="divide-y divide-slate-100">
                {proposals.map((p, i) => {
                  const running = runningKey === `${msg.id}:${i}`;
                  return (
                    <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                          p.status === 'done' ? 'bg-emerald-100 text-emerald-700' : p.status === 'failed' ? 'bg-rose-100 text-rose-700' : p.destructive ? 'bg-rose-50 text-rose-600' : 'bg-sky-50 text-sky-700'
                        }`}
                      >
                        {p.status === 'done' ? <Check className="h-3 w-3" /> : p.destructive && !p.status ? <AlertTriangle className="h-3 w-3" aria-label="Cannot be undone" /> : i + 1}
                      </span>
                      <p className={`min-w-0 flex-1 text-xs font-medium ${p.status === 'cancelled' ? 'text-slate-400 line-through' : p.destructive ? 'text-rose-900' : 'text-slate-800'}`}>{p.summary}</p>
                      {!p.status ? (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => setStep(msg.id, i, { status: 'cancelled' })}
                            disabled={running}
                            className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
                          >
                            {proposals.length > 1 ? 'Skip' : 'Cancel'}
                          </button>
                          <button
                            onClick={() => runSteps(msg, [i])}
                            disabled={!!runningKey}
                            className={`rounded-full px-3 py-1 text-[11px] font-bold text-white disabled:opacity-50 cursor-pointer ${p.destructive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-sky-600 hover:bg-sky-700'}`}
                          >
                            {running ? 'Saving…' : p.destructive ? 'Delete' : 'Confirm'}
                          </button>
                        </div>
                      ) : (
                        <span role="status" className={`text-[11px] font-semibold ${p.status === 'done' ? 'text-emerald-700' : p.status === 'failed' ? 'text-rose-700' : 'text-slate-400'}`}>
                          {p.status === 'done' ? 'Done' : p.status === 'failed' ? `Not saved: ${p.error}` : proposals.length > 1 ? 'Skipped' : 'Cancelled'}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {msg.quickReplies && msg.quickReplies.length > 0 && msg.id === copilotHistory[copilotHistory.length - 1]?.id && (
            <div className="flex flex-wrap gap-1.5">
              {msg.quickReplies.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  disabled={isProcessing}
                  className="rounded-full border border-sky-300 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800 hover:bg-sky-100 disabled:opacity-50 cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {msg.limitations && msg.limitations.length > 0 && (
            <ul className="space-y-0.5 text-[11px] text-amber-800">
              {msg.limitations.map((l) => (
                <li key={l}>Note: {l}</li>
              ))}
            </ul>
          )}

          {msg.suggestedActions && msg.suggestedActions.length > 0 && onNavigate && (
            <div className="flex flex-wrap gap-1.5">
              {msg.suggestedActions
                .filter((a) => ACTION_TABS[a.action])
                .map((a) => (
                  <button
                    key={a.action}
                    onClick={() => onNavigate(ACTION_TABS[a.action])}
                    className="flex items-center gap-1 rounded-full border border-sky-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-sky-800 hover:bg-sky-50 cursor-pointer"
                  >
                    {a.label}
                    <ArrowRight className="h-3 w-3" />
                  </button>
                ))}
            </div>
          )}

          {msg.source && (
            <p className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
              <CheckCircle2 className="h-3 w-3" />
              {msg.source === 'rules'
                ? 'Calculated by WealthPilot'
                : msg.facts?.length
                  ? 'Worded by AI · every number calculated by WealthPilot'
                  : 'Understood by AI · checked by WealthPilot'}
            </p>
          )}
        </div>
      </div>
    );
  };

  // ---- Layout -----------------------------------------------------------------------------------

  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setDragOver(false);
        attach(e.dataTransfer.files);
      }}
      className={`${
        compact
          ? 'relative flex h-full min-h-0 overflow-hidden'
          : 'relative flex h-[calc(100dvh-12rem)] min-h-[560px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm'
      } ${dragOver ? 'wp-dropzone-active' : ''}`}
    >
      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-sky-50/80 backdrop-blur-[2px]">
          <p className="wp-pop rounded-2xl border border-sky-300 bg-white px-5 py-3 text-sm font-bold text-sky-800 shadow-lg">Drop to read receipts, statements or spreadsheets</p>
        </div>
      )}
      {sidebar}
      {sidebarOpen && compact && <div className="absolute inset-0 z-10 bg-slate-900/10" onClick={() => setSidebarOpen(false)} aria-hidden="true" />}

      <section className="flex min-w-0 flex-1 flex-col bg-white">
        {/* Header */}
        <header className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 sm:px-4">
          {!sidebarOpen && (
            <button onClick={() => setSidebarOpen(true)} aria-label="Show chat history" title="Chat history" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer">
              <PanelLeft className="h-4 w-4" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-bold text-slate-900">{isEmpty ? 'WealthPilot Assistant' : activeTitle}</h2>
            <p className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500">
              <span className={`h-1.5 w-1.5 rounded-full ${isSignedIn && preferences.isAiEnabled ? 'bg-emerald-500' : isSignedIn ? 'bg-sky-500' : 'bg-amber-500'}`} />
              {isSignedIn ? (preferences.isAiEnabled ? 'AI on · changes need your confirmation' : 'Calculated answers · AI off') : 'Demo data · read-only'}
            </p>
          </div>
          <button onClick={startNewChat} aria-label="New chat" title="New chat" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer">
            <SquarePen className="h-4 w-4" />
          </button>
          {onExpand && (
            <button onClick={onExpand} aria-label="Open full page" title="Open full page" className="hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 sm:block cursor-pointer">
              <Maximize2 className="h-4 w-4" />
            </button>
          )}
          {onClose && (
            <button onClick={onClose} aria-label="Close assistant" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          )}
        </header>

        {isSignedIn && !preferences.isAiEnabled && (
          <div className="flex items-center justify-between gap-3 border-b border-sky-100 bg-sky-50 px-4 py-2 text-[11px] text-sky-900">
            <span>AI is off: I answer with calculations and simple commands. Turn it on for free-form requests and follow-ups.</span>
            <button onClick={() => setConsentOpen(true)} className="shrink-0 rounded-full bg-[#0F172A] px-3 py-1 font-semibold text-white hover:bg-neutral-800 cursor-pointer">
              Turn on
            </button>
          </div>
        )}

        {/* Thread */}
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {isEmpty ? (
            <div className="mx-auto flex max-w-xl flex-col items-center pt-4 text-center sm:pt-10">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 shadow-lg shadow-sky-500/25">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <h3 className="mt-4 text-lg font-bold tracking-tight text-slate-900">How can I help with your money today?</h3>
              <p className="mt-1 max-w-sm text-xs text-slate-500">Ask for advice, or tell me what to change. I&apos;ll show a plan and wait for your confirmation before saving anything.</p>
              <div className={`mt-6 grid w-full gap-2 ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                {STARTERS.map(({ icon: Icon, title, prompt }) => (
                  <button
                    key={title}
                    onClick={() => handleSend(prompt)}
                    disabled={!canAsk}
                    className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left hover:border-sky-300 hover:bg-sky-50/50 disabled:opacity-50 cursor-pointer"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 group-hover:bg-sky-100 group-hover:text-sky-700">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-slate-900">{title}</span>
                      <span className="block truncate text-[11px] text-slate-500">{prompt}</span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap justify-center gap-1.5">
                {SEGMENTS.filter((s) => ['goals', 'budgets', 'bills', 'transactions', 'debts'].includes(s.id)).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSend(`/${s.id}`)}
                    disabled={!canAsk}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono text-[11px] text-slate-600 hover:border-sky-300 hover:text-sky-800 disabled:opacity-50 cursor-pointer"
                  >
                    /{s.id}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-6">{conversation.map(renderMessage)}</div>
          )}

          {isProcessing && (
            <div className="mx-auto mt-6 flex max-w-3xl items-center gap-3" role="status" aria-label="Assistant is thinking">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-600">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="flex gap-1">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${d}ms` }} />
                ))}
              </span>
            </div>
          )}
          <div ref={threadEnd} />
        </div>

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="border-t border-slate-100 bg-white px-3 pb-3 pt-2.5 sm:px-4"
        >
          <div className="relative mx-auto max-w-3xl">
            {segmentOptions.length > 0 && (
              <ul
                id="wp-segment-menu"
                role="listbox"
                aria-label="Pick what you need help with"
                className="wp-pop absolute bottom-full left-0 z-10 mb-2 max-h-72 w-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl"
              >
                <li className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400" role="presentation">
                  Get help with
                </li>
                {segmentOptions.map((seg, i) => (
                  <li key={seg.id} role="option" aria-selected={i === menuIndex}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickSegment(seg.id)}
                      className={`w-full rounded-xl px-2.5 py-2 text-left cursor-pointer ${i === menuIndex ? 'bg-sky-50' : 'hover:bg-slate-50'}`}
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-900">/{seg.id}</span>
                        <span className="text-[10px] text-slate-400">{seg.label}</span>
                      </span>
                      <span className="block truncate text-[11px] text-slate-500">e.g. {seg.examples[0]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {pageLabel && (
              <div className="mb-2 flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setUsePageScope((v) => !v)}
                  aria-pressed={usePageScope}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold transition-colors cursor-pointer ${
                    usePageScope ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-slate-200 bg-white text-slate-500'
                  }`}
                  title={usePageScope ? 'Answers focus on this page. Click to ask about anything.' : 'Click to focus answers on this page'}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${usePageScope ? 'bg-sky-500' : 'bg-slate-300'}`} />
                  {usePageScope ? `Focused on ${pageLabel}` : 'Any topic'}
                </button>
              </div>
            )}
            <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 shadow-2xs focus-within:border-sky-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-sky-500/10">
              <input ref={fileInput} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => e.target.files && (attach(e.target.files), (e.target.value = ''))} />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                aria-label="Attach receipts, statements or spreadsheets"
                title="Attach a receipt photo, PDF statement, CSV or Excel file"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-white hover:text-sky-700 cursor-pointer"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <textarea
                ref={inputRef}
                rows={1}
                value={inputQuery}
                placeholder={canAsk ? 'Ask anything, or tell me what to change…  Type / for a section' : 'Turn on AI in Settings to use the demo assistant'}
                onChange={(e) => {
                  setInputQuery(e.target.value);
                  setMenuIndex(0);
                }}
                onPaste={(e) => {
                  const files = Array.from(e.clipboardData.files);
                  if (files.length) {
                    e.preventDefault();
                    attach(files);
                  }
                }}
                onKeyDown={(e) => {
                  if (segmentOptions.length) {
                    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                      e.preventDefault();
                      setMenuIndex((i) => (i + (e.key === 'ArrowDown' ? 1 : segmentOptions.length - 1)) % segmentOptions.length);
                      return;
                    }
                    if (e.key === 'Enter' || e.key === 'Tab') {
                      e.preventDefault();
                      pickSegment(segmentOptions[Math.min(menuIndex, segmentOptions.length - 1)].id);
                      return;
                    }
                    if (e.key === 'Escape') {
                      e.stopPropagation(); // closes the menu, not the assistant panel
                      setInputQuery('');
                      return;
                    }
                  }
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                role="combobox"
                aria-expanded={segmentOptions.length > 0}
                aria-controls="wp-segment-menu"
                aria-autocomplete="list"
                disabled={!canAsk || isProcessing}
                aria-label="Ask the copilot a question"
                maxLength={500}
                className="max-h-40 min-h-[24px] flex-1 resize-none bg-transparent py-1 text-[13px] leading-relaxed text-slate-900 placeholder-slate-400 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!inputQuery.trim() || !canAsk || isProcessing}
                aria-label="Send"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#0F172A] text-white transition-colors hover:bg-sky-600 disabled:bg-slate-300 cursor-pointer"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-slate-400">
              Enter to send · Shift+Enter for a new line · Attach or drop receipts and statements to import them · Numbers are calculated from your ledger.
            </p>
          </div>
        </form>
      </section>

      {importOpen && (
        <div className="absolute inset-0 z-40 flex flex-col bg-white/95 backdrop-blur-sm wp-enter" role="dialog" aria-modal="true" aria-label="Import from files">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-extrabold text-[#0F172A]">Add transactions from files</p>
              <p className="text-[11px] font-medium text-slate-500">Read on your device · check and edit, then save</p>
            </div>
            <button type="button" onClick={() => setImportOpen(false)} aria-label="Close import" className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer">
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <DocumentDropzone imp={docs} compact />
            <ImportReview
              imp={docs}
              onAskConsent={() => setDocConsentOpen(true)}
              onSaved={(n) => {
                addCopilotMessage({
                  id: messageId('copilot'),
                  sender: 'assistant',
                  timestamp: new Date().toISOString(),
                  content: `Saved ${n} transaction${n === 1 ? '' : 's'} from your files. You can undo it from the import sheet, or edit them in Transactions.`,
                  suggestedActions: [{ label: 'Open transactions', action: 'open_transactions' }],
                });
              }}
            />
          </div>
        </div>
      )}
      <DocumentReadingConsent open={docConsentOpen} onClose={() => setDocConsentOpen(false)} />
      <AiConsentDialog isOpen={consentOpen} onClose={() => setConsentOpen(false)} />
    </div>
  );
}
