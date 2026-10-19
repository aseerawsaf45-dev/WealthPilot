/**
 * Tiny in-page event bus for cross-tab UI intents (no data, no persistence):
 * an insight on one page can open another tab, pre-filter Transactions, or ask the assistant.
 */

export type UiEvent =
  | { type: 'navigate'; tab: string }
  | { type: 'filter-transactions'; query: string }
  | { type: 'ask-assistant'; question: string; scope?: string };

const NAME = 'wp:ui';
let pendingFilter: string | null = null;

export function emitUi(e: UiEvent): void {
  if (typeof window === 'undefined') return;
  if (e.type === 'filter-transactions') {
    // Kept until the Transactions tab mounts and takes it.
    pendingFilter = e.query;
    window.dispatchEvent(new CustomEvent<UiEvent>(NAME, { detail: { type: 'navigate', tab: 'transactions' } }));
  }
  window.dispatchEvent(new CustomEvent<UiEvent>(NAME, { detail: e }));
}

export function onUi(handler: (e: UiEvent) => void): () => void {
  const fn = (ev: Event) => handler((ev as CustomEvent<UiEvent>).detail);
  window.addEventListener(NAME, fn);
  return () => window.removeEventListener(NAME, fn);
}

/** The Transactions tab calls this on mount to pick up a filter requested from another page. */
export function takePendingFilter(): string | null {
  const q = pendingFilter;
  pendingFilter = null;
  return q;
}

/** Reads the pending filter without clearing it (safe in a state initializer). */
export function peekPendingFilter(): string | null {
  return pendingFilter;
}
