<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# WealthPilot — protocol for every AI agent

Applies to Claude Code, Antigravity, Codex, Cursor, Copilot, Gemini CLI and humans alike.

## 1. Memory (read first, write last)
1. **Start:** run `node scripts/agent-memory.mjs start` (Claude Code does this automatically via a SessionStart hook). It prints the verified project state from `PROJECT_MEMORY.md` and the recent work log.
2. **Plan of record:** `BACKEND_AND_AI_PLAN.md`. Pick the next unchecked task ID; don't invent parallel plans.
3. **Finish:** `node scripts/agent-memory.mjs log <agent-name> "<what changed, what is next>"`. Update the `agent-context` block in `PROJECT_MEMORY.md` only when a status or decision changed, and keep it true (no claims that tests or features pass unless you ran them).
4. Never write secrets, passwords, connection strings or real user financial data into memory files.

## 2. Skills (plain markdown, any agent can follow them)
- New/changed API route → `.claude/skills/wealthpilot-api-route/SKILL.md`
- New/changed AI copilot tool or provider call → `.claude/skills/wealthpilot-ai-tool/SKILL.md`
- Neon / Postgres / branching → `.claude/skills/neon*/SKILL.md`

## 3. Non-negotiables
- Money is integer minor units (`BigInt` cents). No float arithmetic on money.
- Every DB query is scoped by the **session** user id. Never accept `userId` from the client.
- The LLM never computes totals, never sees raw transaction rows or PII, and never gets SQL access. Server tools compute; the model narrates.
- Don't read `.env` (use `.env.example`). Don't run `prisma migrate reset`, `db push --force-reset` or `--accept-data-loss` against the shared database. Use a Neon branch.
- Before saying "done": `npm test`, `npx tsc --noEmit`, `npm run check:security`. Report failures honestly.
