/**
 * WealthPilot — Live check of the AI goal planner against real providers (fixture data, no user data).
 * `npx tsx --env-file=.env scripts/ai-plan-live.mts` — runs Groq, then Gemini alone (the backup path).
 */

import { answerQuestion, formatFact, hasStrayNumber } from '../src/server/ai/orchestrator.ts';
import { groqClient, geminiClient, llmChain, type LlmClient } from '../src/server/ai/providers.ts';
import { planGoal } from '../src/server/ai/tools.ts';
import { fixture } from './ai-fixture.mts';

const QUESTION = 'Explain whether this savings goal is reachable by its deadline and give a short, encouraging step-by-step plan.';
const providers: [string, LlmClient | null][] = [
  ['groq', llmChain([groqClient()].filter((c): c is LlmClient => !!c))],
  ['gemini', llmChain([geminiClient()].filter((c): c is LlmClient => !!c))],
];
let failures = 0;

for (const [name, llm] of providers) {
  if (!llm) {
    console.log(`\n[${name}] skipped: no key in .env`);
    continue;
  }
  for (const targetDate of ['2027-10-01', '2026-12-31']) {
    const args = { goalName: 'Emergency Fund', targetDate };
    const plan = planGoal(args, fixture);
    let raw = '';
    const spy: LlmClient = async (req) => {
      const m = await llm(req);
      raw = m.content ?? '';
      return m;
    };
    const res = await answerQuestion(QUESTION, fixture, { llm: spy }, { calls: [{ name: 'plan_goal', args }], narrate: true });
    if (res.limitations.some((l) => l.includes('accuracy check'))) {
      // Show what tripped the grounding check so prompt/label fixes are evidence-based.
      const bare = raw.replace(/\{\{(f\d+)\}\}/g, '');
      const hits = bare.match(/[^.\n]{0,30}(\d|\b(two|three|four|five|six|seven|eight|nine|ten|hundreds?|thousands?|percent|point \w+|half|halved|twice|double\w*|triple\w*)\b)[^.\n]{0,20}/gi);
      console.log(`  rejected wording, offending text: ${JSON.stringify(hits?.slice(0, 4) ?? ['(schema or unknown placeholder)'])}`);
    }
    const text = [res.answer, ...res.insights.map((i) => `${i.title} ${i.description}`)].join(' ');
    const remainder = res.facts.map(formatFact).sort((a, b) => b.length - a.length).reduce((t, f) => t.split(f).join(' '), text);
    const ungrounded = res.source !== 'rules' && hasStrayNumber(remainder);
    if (ungrounded) failures += 1;
    console.log(`\n[${name} → ${res.source}] deadline ${targetDate} · verdict ${plan.verdict}${ungrounded ? ' · UNGROUNDED' : ''}`);
    console.log(`  ${res.answer}`);
    for (const i of res.insights) console.log(`  • ${i.title}: ${i.description}`);
    if (res.limitations.length) console.log(`  notes: ${res.limitations.join(' | ')}`);
    await new Promise((r) => setTimeout(r, 5000));
  }
}
process.exit(failures ? 1 : 0);
