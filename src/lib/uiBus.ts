/**
 * Tiny in-page event bus for cross-tab UI intents (no data, no persistence):
 * an insight on one page can open another tab, pre-filter Transactions, or ask the assistant.
 */

export type UiEvent =
  | { type: 'navigate'; tab: string }
  | { type: 'filter-transactions'; query: string }
  | { type: 'ask-assistant'; question: string; scope?: string }
  | { type: 'review-budget'; category: string };

const NAME = 'wp:ui';
let pendingFilter: string | null = null;
let pendingBudgetReview: string | null = null;

export function emitUi(e: UiEvent): void {
  if (typeof window === 'undefined') return;
  if (e.type === 'filter-transactions') {
    // Kept until the Transactions tab mounts and takes it.
    pendingFilter = e.query;
    window.dispatchEvent(new CustomEvent<UiEvent>(NAME, { detail: { type: 'navigate', tab: 'transactions' } }));
  }
  if (e.type === 'review-budget') {
    // Kept until the Budgets tab mounts and takes it.
    pendingBudgetReview = e.category;
    window.dispatchEvent(new CustomEvent<UiEvent>(NAME, { detail: { type: 'navigate', tab: 'budgets' } }));
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

/** The Budgets tab calls this on mount to pick up a budget review requested from another page. */
export function takePendingBudgetReview(): string | null {
  const c = pendingBudgetReview;
  pendingBudgetReview = null;
  return c;
}

/** Reads the pending budget review without clearing it. */
export function peekPendingBudgetReview(): string | null {
  return pendingBudgetReview;
}
