'use client';

/**
 * Assistant chat history (the sidebar). The open chat is `copilotHistory` in FinanceContext; this hook
 * keeps the other chats and saves the open one. Signed in with chat history on, chats are saved to
 * /ai/conversations; otherwise they live only in this tab (no financial data in browser storage).
 */

import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { CopilotMessage } from '../types/finance';

export interface ChatSummary {
  id: string;
  title: string;
  updatedAt: string;
  saved: boolean;
}

const localId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const isLocal = (id: string | null) => !id || id.startsWith('local_');
const titleOf = (messages: CopilotMessage[]) => {
  const first = messages.find((m) => m.sender === 'user')?.content.trim() ?? 'New chat';
  return first.length > 60 ? `${first.slice(0, 57)}…` : first;
};

export function useChatHistory(opts: {
  isAuthed: boolean;
  enabled: boolean;
  history: CopilotMessage[];
  setHistory: (m: CopilotMessage[]) => void;
  onError: (message: string) => void;
}) {
  const { isAuthed, enabled, history, setHistory, onError } = opts;
  const persist = isAuthed && enabled;
  const [others, setOthers] = useState<ChatSummary[]>([]); // every chat except the open one
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const unsaved = useRef(new Map<string, CopilotMessage[]>()); // chats kept in this tab only
  const lastSaved = useRef(new Map<string, string>()); // server id -> messages JSON last saved (skips no-op saves)
  const creating = useRef<Promise<string> | null>(null);

  const hasUser = history.some((m) => m.sender === 'user');
  const activeEntry: ChatSummary | null = hasUser
    ? { id: activeChatId ?? 'draft', title: titleOf(history), updatedAt: history[history.length - 1].timestamp, saved: !isLocal(activeChatId) }
    : null;
  // Saved chats show only while history is on; the open chat is always first.
  const chats = [...(activeEntry ? [activeEntry] : []), ...others.filter((c) => c.id !== activeChatId && (persist || !c.saved))];

  // Load saved chats when history is (or becomes) available.
  useEffect(() => {
    if (!persist) return;
    api
      .get<{ id: string; title: string; updatedAt: string }[]>('/ai/conversations')
      .then((rows) => setOthers((prev) => [...prev.filter((c) => !c.saved), ...rows.map((r) => ({ ...r, saved: true }))]))
      .catch(() => onError('Could not load your saved chats.'));
  }, [persist, onError]);

  /** Saves a chat to the server; returns its server id (creating it once if it has none yet). */
  const save = async (id: string | null, messages: CopilotMessage[]): Promise<string> => {
    const json = JSON.stringify(messages);
    const body = { title: titleOf(messages), messages };
    if (isLocal(id)) {
      creating.current ??= api.post<{ id: string }>('/ai/conversations', body).then((r) => r.id);
      try {
        const serverId = await creating.current;
        lastSaved.current.set(serverId, json);
        return serverId;
      } finally {
        creating.current = null;
      }
    }
    if (lastSaved.current.get(id!) !== json) {
      await api.patch(`/ai/conversations/${encodeURIComponent(id!)}`, body);
      lastSaved.current.set(id!, json);
    }
    return id!;
  };

  // Save the open chat shortly after it changes.
  useEffect(() => {
    if (!persist || !hasUser) return;
    if (!isLocal(activeChatId) && lastSaved.current.get(activeChatId!) === JSON.stringify(history)) return;
    const t = setTimeout(async () => {
      try {
        const id = await save(activeChatId, history);
        if (id !== activeChatId) {
          if (activeChatId) unsaved.current.delete(activeChatId);
          setActiveChatId(id);
        }
      } catch {
        onError('This chat could not be saved.');
      }
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- save is recreated each render; history/activeChatId drive it
  }, [history, activeChatId, persist, hasUser]);

  /** Moves the open chat into the list (saving it right away if history is on) before switching. */
  const stashOpenChat = () => {
    if (!activeEntry) return;
    const id = activeChatId ?? localId();
    const messages = history;
    if (persist) {
      void save(activeChatId, messages)
        .then((serverId) => setOthers((prev) => prev.map((c) => (c.id === id ? { ...c, id: serverId, saved: true } : c))))
        .catch(() => onError('This chat could not be saved.'));
    }
    if (isLocal(id)) unsaved.current.set(id, messages);
    setOthers((prev) => [{ ...activeEntry, id }, ...prev.filter((c) => c.id !== id)]);
  };

  const newChat = () => {
    stashOpenChat();
    setActiveChatId(null);
    setHistory([]);
  };

  const openChat = async (id: string) => {
    if (id === activeChatId || id === 'draft') return;
    const local = unsaved.current.get(id);
    let messages = local;
    if (!messages) {
      try {
        messages = (await api.get<{ messages: CopilotMessage[] }>(`/ai/conversations/${encodeURIComponent(id)}`)).messages;
        lastSaved.current.set(id, JSON.stringify(messages));
      } catch {
        onError('Could not open that chat.');
        return;
      }
    }
    stashOpenChat();
    setActiveChatId(id);
    setHistory(messages);
  };

  const deleteChat = async (id: string) => {
    const chat = chats.find((c) => c.id === id);
    if (chat?.saved) {
      try {
        await api.del(`/ai/conversations/${encodeURIComponent(id)}`);
      } catch {
        onError('Could not delete that chat.');
        return;
      }
    }
    unsaved.current.delete(id);
    setOthers((prev) => prev.filter((c) => c.id !== id));
    if (id === (activeChatId ?? 'draft')) {
      setActiveChatId(null);
      setHistory([]);
    }
  };

  const deleteAllChats = async () => {
    if (persist) {
      try {
        await api.del('/ai/conversations');
      } catch {
        onError('Could not delete your chats.');
        return;
      }
    }
    unsaved.current.clear();
    lastSaved.current.clear();
    setOthers([]);
    setActiveChatId(null);
    setHistory([]);
  };

  /** Sign-out: forget every chat of the previous user. */
  const resetChats = () => {
    unsaved.current.clear();
    lastSaved.current.clear();
    setOthers([]);
    setActiveChatId(null);
  };

  return { chats, activeChatId: activeEntry?.id ?? null, newChat, openChat, deleteChat, deleteAllChats, resetChats };
}
