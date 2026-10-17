# Agent work log (append-only, newest last)

Add entries with `node scripts/agent-memory.mjs log <agent> "<what changed, what is next>"`. Never paste secrets, real user data, or passwords here.

- 2026-10-17 [claude-code] Reviewed repo; rewrote BACKEND_AND_AI_PLAN.md (verified free-tier terms: Groq ZDR primary, Gemini de-identified only); added agent-memory hooks (SessionStart/PreToolUse/Stop), project skills wealthpilot-api-route + wealthpilot-ai-tool, AGENTS.md agent protocol. Next: SEC-01..06.
- 2026-10-17 [claude-code] Plan v2 independently reviewed (20 findings: 19 applied, 1 rejected; see plan section 13). Added SEC-11 consent bypass and SEC-12 bcrypt/enumeration; balances become derived; grounding via fact placeholders. Next: SEC-01..12.
- 2026-10-17 [claude-code] P0+P1 core: hardened sessions (DB Session table, constant-time HMAC, cookie-only, required SESSION_SECRET), rate limits, hash-chained audit, generic 500s, consent-only isAiEnabled, bcrypt 12, CSP headers, Neon Auth removed; Prisma migrations baselined + migration 1 applied to Neon production (derived balances); 17 domain routes via src/server/repos; FinanceContext wired to /api/v1 with demo banner. 40 unit + 6 DB integration tests pass. Next: P2 AI-01..07; open: SEC-09, OPS-01, API-09, export, bill pay, account PATCH/DELETE.
