/**
 * WealthPilot — Copilot response contract (plan §7.4).
 *
 * The MODEL returns LlmNarration: prose that references numbers ONLY through {{fN}}
 * placeholders. The SERVER owns every number (facts[]) and fills the placeholders.
 */

import { z } from 'zod';
import type { ActionProposal } from '@/types/finance';

export const SUGGESTED_ACTIONS = [
  'open_transactions',
  'open_budgets',
  'open_goals',
  'open_bills',
  'open_category_report',
  'open_settings_privacy',
] as const;
export type SuggestedAction = (typeof SUGGESTED_ACTIONS)[number];

export const LlmNarration = z.object({
  answer: z.string().min(1).max(1200),
  insights: z.array(z.object({ title: z.string().min(1).max(80), description: z.string().min(1).max(240) })).max(3).default([]),
  suggested_actions: z.array(z.object({ label: z.string().min(1).max(60), action: z.enum(SUGGESTED_ACTIONS) })).max(3).default([]),
});
export type LlmNarration = z.infer<typeof LlmNarration>;

export type FactUnit = 'cents' | 'pct' | 'count' | 'days' | 'months' | 'date' | 'text';

/** A number (or date/name) computed by the server. The only source of figures in an answer. */
export interface Fact {
  id: string; // f1, f2, ...
  label: string;
  value: number | string;
  unit: FactUnit;
  currency?: string;
  kind: 'recorded' | 'estimate';
}
export type FactDraft = Omit<Fact, 'id'>;

export interface CopilotAnswer extends LlmNarration {
  period: { start: string; end: string } | null;
  facts: Fact[];
  limitations: string[];
  source: 'rules' | 'llm:groq' | 'llm:gemini';
  /** Changes for the user to confirm (assistant commands). */
  proposals?: ActionProposal[];
  /** The answer asks the user for missing details; their next message continues this request. */
  needsReply?: boolean;
  /** One-tap answers to that question (e.g. the amounts the user wrote). */
  quickReplies?: string[];
  /** The command waiting for that answer; the client sends it back with the reply. */
  pending?: { name: string; args: Record<string, unknown>; field: string };
}
