/**
 * "…add this goal with a plan", "create a goal for a car", "I want to save for a trip": asking for a NEW goal
 * anywhere in the sentence (not "how is my goal doing?").
 */
export const GOAL_INTENT =
  /\b(?:add|create|make|set up|start|open|new)\b[^.?!]{0,40}\bgoals?\b|\bgoal\s+(?:called|named)\b|\bsav(?:e|ing)\s+(?:up\s+)?(?:for|towards?)\b|\b(?:want|plan|need)\s+to\s+(?:buy|purchase|afford)\b/i;

/** Imperative messages ("add…", "pay…", "delete…") are assistant commands, not questions. Shared by server and the demo chat. */
export function looksLikeCommand(message: string): boolean {
  if (GOAL_INTENT.test(message)) return true;
  return /^(?:please\s+|(?:i(?:\s+(?:want|need|would like)|'d like)|let's|can you|could you|help me)\s+(?:to\s+)?)?(?:add|create|new|set|change|update|rename|edit|delete|remove|pay|pause|resume|record|log|contribute|put|move|switch|turn|mark|open|go to|take me|plan)\b/i.test(message.trim());
}

/** App segments the user can address with "/goals …" in the assistant chat. */
export const SEGMENTS = [
  { id: 'overview', label: 'Overview', examples: ['How much did I spend this month?', 'Compare this month to last month', 'open budgets'] },
  { id: 'transactions', label: 'Transactions', examples: ['add $12 coffee', 'spent $40 on groceries', 'delete my latest Uber transaction'] },
  { id: 'accounts', label: 'Accounts', examples: ['add savings account Emergency with $500', 'rename account Checking to Main', 'open accounts'] },
  { id: 'budgets', label: 'Budgets', examples: ['set dining budget to $300', 'Am I over budget this month?', 'delete the Shopping budget'] },
  { id: 'goals', label: 'Goals', examples: ['add $200 to Vacation', 'pause Car goal', 'plan Emergency Fund goal'] },
  { id: 'bills', label: 'Bills', examples: ['What bills are due soon?', 'pay Spotify', 'add bill Gym $40 monthly'] },
  { id: 'debts', label: 'Debts', examples: ['Summarise my debts', 'add debt Visa $2,000 at 19.9% APR', 'update debt Visa balance to $1,500'] },
  { id: 'planning', label: 'Planning', examples: ['Compare debt payoff options', 'How are my savings goals doing?', 'open planning'] },
  { id: 'learn', label: 'Learn', examples: ['What should I learn first?', 'How many months of cash do I have?', 'open learn'] },
  { id: 'import', label: 'Import', examples: ['open import', 'Scan for duplicate charges', 'How much did I spend this month?'] },
  { id: 'settings', label: 'Settings', examples: ['change my currency to BDT', 'turn on reduced motion', 'open settings'] },
] as const;
export type SegmentId = (typeof SEGMENTS)[number]['id'];

/** The assistant segment for an app tab (Copilot has none). */
export function segmentForTab(tab: string): SegmentId | undefined {
  return SEGMENTS.find((s) => s.id === tab)?.id;
}
export const SEGMENT_IDS = SEGMENTS.map((s) => s.id) as [SegmentId, ...SegmentId[]];

/** "/goals plan my car" → { scope: 'goals', text: 'plan my car' }; anything else → no scope. */
export function parseScope(input: string): { scope?: SegmentId; text: string } {
  const m = input.trim().match(/^\/([a-z]+)\b\s*(.*)$/i);
  const seg = m && SEGMENTS.find((s) => s.id === m[1].toLowerCase());
  return seg ? { scope: seg.id, text: m[2].trim() } : { text: input.trim() };
}
