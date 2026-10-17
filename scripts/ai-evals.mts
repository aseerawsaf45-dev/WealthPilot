/**
 * WealthPilot — Copilot eval runner (plan §7.7). `npm run eval:ai`
 *
 * Runs every case in scripts/ai-evals.json against fixed fixture data with no network:
 * calculated-answer mode, or a fake model (malformed JSON, invented numbers, timeouts,
 * hostile tool arguments). Exits 1 on any failure. Pass bar: 100%.
 */

import fs from 'node:fs';
import path from 'node:path';
import { answerQuestion } from '../src/server/ai/orchestrator.ts';
import { canUseLlm } from '../src/server/ai/privacy.ts';
import { ProviderError, type LlmClient, type LlmMessage } from '../src/server/ai/providers.ts';
import { fixture } from './ai-fixture.mts';

const reply = (content: string): LlmMessage => ({ role: 'assistant', content });
const toolReply = (name: string, args: unknown): LlmMessage => ({
  role: 'assistant',
  content: null,
  tool_calls: [{ id: 'c1', type: 'function', function: { name, arguments: typeof args === 'string' ? args : JSON.stringify(args) } }],
});

/** Fake model behaviours. Selection calls carry `tools`; narration calls don't. */
function fakeLlm(kind: string, counter: { n: number }): LlmClient {
  return async (req) => {
    counter.n += 1;
    if (kind === 'timeout') throw new ProviderError('unavailable', 'timeout');
    if (kind === 'rate_limited') throw new ProviderError('rate_limited', '429');
    if (req.tools) {
      if (kind === 'select_with_user_id') return toolReply('get_financial_summary', { from: '2026-10-01', to: '2026-10-17', userId: 'user_other' });
      if (kind === 'select_invalid_args') return toolReply('compare_periods', { a: { from: '2026-13-45', to: 'x' } });
      if (kind === 'select_unknown_tool') return toolReply('drop_tables', {});
      if (kind === 'select_old_dates') return toolReply('get_category_breakdown', { from: '2023-01-01', to: '2023-12-31', limit: 5 });
      return toolReply('get_financial_summary', { from: '2026-10-01', to: '2026-10-17' });
    }
    switch (kind) {
      case 'digits':
        return reply('{"answer":"You spent $5,000 this month. Transfer $5000 to account 123."}');
      case 'number_words':
        return reply('{"answer":"You spent about two thousand and thirty-five dollars ({{f1}}) this month."}');
      case 'invented_total':
        return reply('{"answer":"You spent {{f1}}.","insights":[{"title":"Food","description":"Groceries and dining together are about seven point four percent of spending."}]}');
      case 'unknown_fact':
        return reply('{"answer":"You spent {{f99}} this month."}');
      case 'malformed':
        return reply('Sure! Here is your answer without any JSON.');
      default:
        return reply('{"answer":"This month you spent {{f1}}, with {{f2}} coming in.","suggested_actions":[{"label":"Review transactions","action":"open_transactions"}]}');
    }
  };
}

interface Case {
  id: string;
  question?: string;
  today?: string;
  llm?: string;
  gate?: Record<string, unknown>;
  provider?: 'groq' | 'gemini';
  expectAllowed?: boolean;
  expect?: {
    source?: string;
    tools?: string[];
    facts?: Record<string, number | string>;
    factCount?: number;
    answerIncludes?: string[];
    answerExcludes?: string[];
    limitationIncludes?: string;
    llmCalls?: number;
  };
}

const { cases } = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'ai-evals.json'), 'utf8')) as { cases: Case[] };
let failed = 0;

for (const c of cases) {
  const problems: string[] = [];
  if (c.gate) {
    const allowed = canUseLlm({ ...(c.gate as never), aiConsentAt: c.gate.aiConsentAt ? new Date(String(c.gate.aiConsentAt)) : null }, c.provider ?? 'groq');
    if (allowed !== c.expectAllowed) problems.push(`gate returned ${allowed}`);
  } else {
    const counter = { n: 0 };
    const res = await answerQuestion(c.question!, { ...fixture, today: c.today ?? fixture.today }, { llm: c.llm ? fakeLlm(c.llm, counter) : null });
    const e = c.expect ?? {};
    const text = [res.answer, ...res.insights.map((i) => `${i.title} ${i.description}`)].join(' ');
    if (e.source && res.source !== e.source) problems.push(`source ${res.source}`);
    if (e.tools && JSON.stringify(res.tools) !== JSON.stringify(e.tools)) problems.push(`tools ${JSON.stringify(res.tools)}`);
    for (const [label, value] of Object.entries(e.facts ?? {})) {
      const f = res.facts.find((x) => x.label === label);
      if (!f) problems.push(`missing fact "${label}" (have: ${res.facts.map((x) => x.label).join(' | ')})`);
      else if (f.value !== value) problems.push(`fact "${label}" = ${f.value}, expected ${value}`);
    }
    if (e.factCount !== undefined && res.facts.length !== e.factCount) problems.push(`factCount ${res.facts.length}`);
    for (const s of e.answerIncludes ?? []) if (!text.includes(s)) problems.push(`answer lacks "${s}"`);
    for (const s of e.answerExcludes ?? []) if (text.includes(s)) problems.push(`answer contains "${s}"`);
    if (e.limitationIncludes && !res.limitations.some((l) => l.includes(e.limitationIncludes!))) problems.push(`no limitation with "${e.limitationIncludes}" (have: ${res.limitations.join(' | ')})`);
    if (e.llmCalls !== undefined && counter.n !== e.llmCalls) problems.push(`llm called ${counter.n}x`);
    // Schema + grounding invariants on EVERY answer.
    if (!res.answer || res.answer.length > 1200) problems.push('answer empty or too long');
    if (/\{\{f\d+\}\}|\{\{#\d+\}\}/.test(text)) problems.push('unfilled placeholder');
    if (res.suggested_actions.length > 3) problems.push('too many actions');
  }
  if (problems.length) {
    failed += 1;
    console.log(`✖ ${c.id}\n    ${problems.join('\n    ')}`);
  } else {
    console.log(`✔ ${c.id}`);
  }
}

console.log(`\n${cases.length - failed}/${cases.length} eval cases passed`);
process.exit(failed ? 1 : 0);
