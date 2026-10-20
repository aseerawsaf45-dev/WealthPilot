# WealthPilot — Project Memory & Implementation Tracker
> **Document Purpose:** Single Source of Truth (SSOT) tracking all completed features, active milestones, architectural decisions, and security compliance records.  
> **Last Updated:** 2026-10-17  
> **Status:** Phase 1 & 2 (Frontend & Core Presentation) Completed • Phase 3 (Backend & AI) Initiated  

---

<!-- agent-context:start -->
### Agent quick context (verified 2026-10-19 — keep this block short and true)
- **Plan of record:** `BACKEND_AND_AI_PLAN.md` (task IDs SEC-*, API-*, AI-*, ML-*, OPS-*). Work top-down by phase. **P3 ML-01..05 done 2026-10-19** (see below). Next: SEC-09, OPS-01, transfer pairs, cursor pagination.
- **Stack:** Next.js 16.4 App Router (read `node_modules/next/dist/docs/` before writing routes) · React 19 · Prisma 6.19 · Neon Postgres · Zod 4 · single repo, backend = `src/app/api/v1/**` route handlers.
- **Real state:** P0 security + P1 core APIs done. Signed in, `FinanceContext` loads `GET /api/v1/bootstrap` and every action calls the API (applies the server response). Signed out = landing page only (no demo since 2026-10-19: #app URLs are rewritten to #landing); seed data remains only as the pre-auth state. Server layer: `src/server/{http,audit,rateLimit,mappers,schemas}.ts` + `repos/{ledger,planning,user}.ts` (routes never call Prisma outside `auth/`; `check:security` enforces it). Copilot (P2 done): `POST /api/v1/ai/copilot` → `src/server/ai/{router,tools,orchestrator,privacy,providers,data}.ts`. Numbers only from server tools; Groq writes `{{fN}}` placeholders, any stray digit or number word → template. Works with no key (calculated answers). **Groq live since 2026-10-17** (key only in local `.env`; check with `npm run eval:ai:live`). Decisions from live tests: router-matched questions always use the server template (more complete, halves Groq quota); Groq only picks tools + words answers for questions the router can't match; the model never sees numeric values (labels + placeholders); model-chosen dates outside the last 366 days are clamped; the server states the period if the model omits it. Signed-out demo still uses the client `copilotService.ts`. Copilot tab is now in the nav.
- **DB:** Prisma migrations now exist (`0_init` baseline + `1_sessions_ratelimits_derived_balances`, applied to Neon `production`). Balances are DERIVED: `openingBalanceCents` + SUM(non-VOID tx). Neon project `quiet-forest-08883816`; backup branch `backup-before-p0-p1-2026-10-17`; scratch branch `migration-test-1` (safe to delete).
- **Full CRUD wired (2026-10-17):** every entity has create/edit/delete in the UI and API: accounts (PATCH sets the *current* balance via derived opening balance; DELETE is 409 until `?cascade=true`), transactions (edit incl. moving account), budgets, goals (+ `POST /goals/:id/contributions`, atomic, never < 0), bills (+ `POST /bills/:id/pay`, idempotent per dueDate, records the expense), debts (list + edit/delete in Debt Planner). Learn XP syncs via `uiPrefs.learn`. Settings refreshes `/audit` on open. Tabs re-sync from the server when the browser tab becomes visible. Shared `RowActions` component (edit/delete with confirm).
- **AI goal planner (2026-10-17):** `POST /api/v1/goals/:id/plan` + "AI plan" button per goal (`GoalPlanDialog`). Pure `planGoal` tool in `src/server/ai/tools.ts`: avg income/spending over last 3 complete months (falls back to this month ≥ 7 days, scaled, labelled rough), subtracts other dated goals, verdict on_track (≤ ½ free surplus) / stretch / not_reachable, cuts top 3 flexible categories by a fifth, milestones. Model-visible fact labels contain no digits and no user-typed names (models copy them → grounding rejects). `monthsUntil` counts contributions that fit before the deadline day.
- **Saved plans:** migration `2_goal_plan` (`SavingsGoal.plan` Json, `planUpdatedAt`). The plan endpoint saves the latest `GoalPlanSnapshot` (latest only, no history); bootstrap returns it on each goal; the card shows it and the dialog reopens it without an API call. `planStaleReason` (`src/lib/goalPlan.ts`) flags changed target/savings/deadline or > 30 days. **Animations use `animation-fill-mode: backwards`**: `both` left a transform on tab wrappers and clipped every fixed modal.
- **Providers:** `src/server/ai/gate.ts` `resolveLlm` (shared by copilot + planner) → `llmChain([groq, gemini?])`. Gemini (`gemini-3.5-flash-lite`; 2.5 closed to new users) only if consent lists it AND region set and not EU/EEA/UK/CH/CN/"EU". Consent notice is **ai-notice-v2** (labels only, never values; Gemini opt-in); profile reports *effective* consent, so v1 consenters see AI off. Settings has a Country selector.
- **Secrets rotated 2026-10-17** after a screenshot leak: Neon `neondb_owner` password, SESSION_SECRET, AUDIT_PEPPER (local `.env` updated). Groq + Gemini keys still need regenerating by the user; host env vars must be updated by the user.
- **Not done from P0/P1:** SEC-09 (demo password `admin123` still in seed + AuthModal demo button), OPS-01, transfer pairs, cursor pagination (bootstrap returns newest 2,000 tx), GoalContribution history table (contributions are in the audit log only). Groq Zero Data Retention not confirmed (Groq console setting); `/ai/messages` chat history not built; Gemini adapter not built (stretch).
- **Write reliability (2026-10-17):** Prisma `transactionOptions { maxWait 10s, timeout 30s }` in `src/server/db.ts` (default 5 s expired real edits from far-away clients → P2028 → 500). `writeAudit` is 2 round trips (lock + one INSERT…SELECT computing the hash in SQL, identical to `chainHash`; createdAt strictly increasing per user). `handle()` maps P2028/P2024/P1001/P1017 to a clear 503. Dev Prisma client is cached on globalThis → **restart `next dev` after db.ts changes**. Editing a split transaction with an unchanged amount is allowed. UI: motion system in globals.css (`wp-enter`, `wp-stagger`, `wp-pop`, `wp-skeleton`, shims for `animate-in`/`zoom-in-95`), `html[data-reduced-motion]` from Settings; navbar has 7 inline tabs + a "More" menu (Debt Planner/Learn/Import; the indicator measures with getBoundingClientRect because More sits in a wrapper), sliding indicator, scroll-compact header, Saved/Saving/Demo chip (`isSaving` from context), working alerts bell (bills + budgets).
- **Latency:** each DB round trip from the dev machine to `us-east-2` is ~0.5 s, so local writes take 4–6 s. Expected to be far lower when deployed in a US-East region.
- **2026-10-19 release (on Neon prod via migration `4_fx_page_insights`: `fx_snapshots`, `page_insights`):**
  - **Currencies:** all ISO 4217 codes (`src/lib/currency.ts`, fixed exponents JPY 0 / KWD 3). `formatMoney` uses Intl; the client default is the base currency via `setDisplayCurrency` (server code must always pass a currency). `toMinor`/`fromMinor` use string math. Goals/budgets/bills/debts are in the base currency (decision: no per-row currency column). FX: daily open.er-api.com snapshot (ECB has no BDT) cached in `fx_snapshots`, BigInt conversion in `src/lib/fx.ts`; converted totals are labelled estimates; copilot data converts foreign rows (`fxNote`).
  - **ML (P3 done):** pure shared code in `src/lib/ml` (browser for demo + server): categorize (your history → keywords), recurring, anomalies (MAD z), forecast 30/60/90 (band = spread of 30-day spending), month compare, budget pace, goal ETA ±20%. `GET /insights`, `get_insights` tool, `GET /reports/monthly`, `GET /user/export` (full DB export, audited), `POST /transactions/recategorize`.
  - **Per-page AI:** `PageInsights` panel on every tab + `POST /ai/page-insight` (cached by data hash; cache checked BEFORE the AI quota). Floating assistant is page-scoped (`pageScope`); cross-tab intents via `src/lib/uiBus.ts`.
  - **Goal planner:** matched by id, computed once (`answerQuestion(..., { outputs })`), ETA range, averages saved in `basis` (stale on >15% change), atomic `POST /goals/:id/plan/apply` (option read from the saved plan), demo plan in the browser (`src/lib/demoPlan.ts`), calculated-only plans don't use `ai:min`.
  - **Document import (ADR):** files are read ONLY in the browser (`src/lib/extract`: RFC 4180 CSV, SheetJS, pdf.js, tesseract.js OCR, heic2any; 5 MB / 5 files; ambiguous day/month order chosen by closeness to today). Workers/wasm self-hosted in `public/vendor` by `scripts/copy-vendor.mjs` (worker files must be `.js`, not `.mjs`: Hostinger serves .mjs as text/plain) (postinstall; `eng.traineddata.gz` committed). CSP adds `'wasm-unsafe-eval'` + `worker-src 'self' blob:`. Optional AI reading is a separate opt-in: `aiProviders` entry `documents` (requires groq, never Gemini, no notice-version bump). `POST /ai/extract` sends redacted TEXT only; every amount must appear verbatim in the text. The review grid (`src/components/import`) is used by the Import page and the Copilot paperclip/drop/paste; saves via `/transactions/import` with undo.
  - **Motion:** `motion@12.43.0` (TabTransition animates opacity + x only: never leave a transform/filter on tab wrappers), AnimatedNumber, CSS v2 effects; the OS reduced-motion block now also zeroes delays.
  - **UI facts:** Overview has no fake offers/stats; Landing has no fabricated testimonials or local-only claims. Use `useToday()` instead of `new Date()` during render (Next 16 prerender error).
  - **Local build:** webpack can't build in a path containing '#': build a copy elsewhere (the pre-push hook does). Test DB: Neon branch `migration-test-4-fx` (br-proud-wildflower-b43bojej); run `test:integration` with its DATABASE_URL, not prod.
- **Debt & Wealth Planner (2026-10-19, migration `5_invest_loans` on prod: investment_plans, loan_offers, country_macros):** tab id stays `planning` (nav label "Planner") with sub-tabs Debt · Loans · Invest · Pay or invest?. Pure maths in `src/lib/planning/` (loans: EMI/amortize/effective APR/DTI/prepay; invest: country assumptions + deterministic lognormal P10–P90 + scenarios; scenarios.ts fixed stress catalogue; link.ts pay-debt-or-invest, loanToDebtInput, freeCashFlow, netWorthPaths, consideredEmis = cheapest offer only). Rates stored as basis points. Country data = World Bank API (inflation, lending/deposit/real rate, GDP, WGI political stability GOV_WGI_PV.EST source=3, 5-yr FX depreciation) cached 30 days in `repos/macro.ts`. Routes /investments, /loans, /loans/:id/take (atomic, idempotent via conditional status flip), /macro. AI tools compare_loans, get_investment_outlook (+ segments loans/invest). Politics = only the WGI index + user-picked scenarios; AI never states current events.
- **Bank & market suggestions (2026-10-20, migration `6_external_cache` on prod):** public data only, no user data sent. Banks = Wikidata per country (central/defunct excluded) + FSB G-SIBs shown only when local news mentions them; news = GDELT (1 query/country/6h, global 5.5 s throttle; GDELT blocks an IP for a while after violations, so never retry in loops); markets = Yahoo Finance chart API (unofficial, user-approved, 15-min cache, stale fallback) + World Bank CM.MKT.INDX.ZG. All cached in `external_cache` via `repos/externalCache.ts`. Picks/mixes are deterministic with reasons; no per-bank rates are claimed (country average is the benchmark). AI bank brief sees headlines only, digits must appear in them. Google News RSS rejected (feed terms: personal non-commercial use only).
- **Saved mixes + copilot planner control (2026-10-20, migration `7_plan_allocation` applied on test branch only; PROD NOT YET MIGRATED: run `npx prisma migrate deploy` before deploying, or investment plan queries fail):** `InvestmentPlan.allocation` (Json, weights sum 100, UNIVERSE symbols only, Zod-enforced) + `mixName`. `suggestMixes` gives 5 mixes (core, global, lower_swings, growth, resilient); `mixStats` re-scores edits. UI: `planner/MixEditor.tsx` (edit/balance/save) + `MarketsCard` mix tabs with Apply. Copilot commands add/update/delete_investment_plan, set_investment_scenario, apply_investment_mix, add/update/delete_loan_offer, take_loan (rules phrasings + segments planning/loans/invest); confirmed planner ops navigate to Planner. Verified in Chrome on a prod build against the branch.
- **Banks fix + Loans tools (2026-10-20):** live Wikidata bank query never worked on the deployed host (prod had no `banks:*` cache rows) and the old subclass-walk query timed out for big countries. Now: fast query `wikidataBankQuery` (starts from bank types, `hint:optimizer "None"`, 1–3 s), bundled `src/lib/planning/banks-snapshot.json` (158 countries; refresh with `npx tsx scripts/fetch-banks.mts`, `--thin` = only countries with < 5 banks); request waits ≤ 2.5 s for live banks and ≤ 1.5 s for GDELT news, else snapshot / no news (the fetch continues and fills the cache). Banks with a foreign parent org = international local arm. Loans tab: `LoanTools.tsx` (calculator at country average rate, borrow capacity 36%/43% via `borrowCapacity`/`maxPrincipal`, loan types guide `loanTypes.ts`, no invented rates); `compare_loans` gives borrowing facts with no offers.
- **Partner offers "Near you" (2026-10-20, migration `8_partner_offers` on test branch only; prod needs `npx prisma migrate deploy` for 7 + 8):** tables partners/offers/offer_locations/offer_stats. Overview card `NearbyOffers.tsx`: browser geolocation stays on device (haversine in `src/lib/geo.ts`; only the country goes to `GET /offers?country=`), Permissions-Policy now `geolocation=(self)`. Every card shows Partner/Sponsored/Ad; samples show "Sample: not a real partner"; investment cards say not advice. Users see only live + in-date + verified ≤ 90 days. Anonymous daily views/clicks (`POST /offers/:id/event`). Admin = `ADMIN_EMAILS` env (comma list; `adminOnly()` in http.ts; `isAdmin` via bootstrap shows the Admin tab under More); `/admin/{offers,partners,offers/stats}`. Samples: `APP_URL=https://… npx tsx scripts/seed-sample-offers.mts` (`--remove` deletes them). Copilot tool `get_partner_offers` (counts only).
- **Competition deliverables 01/04/06 (2026-10-20):** Markdown sources `docs/TECHNICAL_DOCUMENTATION.md`, `README.md` (rewritten, accurate), `docs/DEPLOYMENT.md`, `docs/TEST_CASES.md` (generated by `npx tsx scripts/test-catalogue.mts` from real runs), `docs/SANDBOX_OPERATION_LOG.md` (generated by `scripts/sandbox-run.mts`: 63 ops, 2 simulated users, HTTP on a prod build against the Neon TEST branch, audit chain + erasure verified; never point at prod). Word files: `npm run docs:build` → `submission/0{1,4,6}_*.docx` (docx devDependency; `submission/meta.json` holds liveUrl/team/members, written into the Markdown between `<!-- meta:key -->` markers). Diagrams: `docs/diagrams/*.svg` → PNG via Inkscape. Sandbox latency is dominated by ~270 ms DB round trips (Dhaka → Neon us-east-2).
- **Test report + deliverable 05 (2026-10-20):** `docs/TEST_REPORT.md` (area table generated between `<!-- gen:areas -->` markers by `scripts/test-catalogue.mts`) → `submission/04A_Test_Report.docx`; `docs/SECURITY_SELF_ASSESSMENT.md` (4 permission tiers, OWASP API + LLM Top 10, 20-item risk register R-01..R-20) + generated `docs/ROUTE_INVENTORY.md` (`scripts/route-inventory.mts`, exits 1 on any unwrapped handler; 79/79 wrapped) → `submission/05_Security_Self_Assessment_Report.docx`. `submission/meta.json` now holds Team Joker, 5 KUET members, live URL; the build never overwrites Markdown with empty values. Live-site findings 2026-10-20: no HSTS, `x-powered-by` exposed, live build older than repo (geolocation=()), health DB latency ~2 s.
- **AI provider rule:** Groq (Zero Data Retention on) is primary. Gemini free tier may be used **only** with de-identified aggregates and **never** for EEA/UK/CH users (Google Unpaid Services terms). Rule-based fallback must always work offline.
- **Invariants:** integer minor units (BigInt cents) only · every query scoped by session userId · LLM never computes totals or sees raw rows · AI is opt-in (only `/user/ai-consent` writes `isAiEnabled`).
- **Checks (2026-10-20):** npm test (101) · npm run eval:ai (57/57) · npm run test:integration (13, against a Neon branch) · npx tsc --noEmit (clean) · npx eslint src (5 errors, pre-existing) · npm run check:security (0 errors) · production build passes in a clean copy.
- **Env:** `SESSION_SECRET`, `AUDIT_PEPPER`, `APP_URL` are required (added to local `.env` 2026-10-17; set separately on Vercel).
- **Git hooks** in `.githooks/` auto-activate on `npm install` (`prepare` sets `core.hooksPath`). pre-commit: security + tests. pre-push: clean worktree `npm ci` + tsc + security + `NODE_ENV=development npm run build` (blocks undeployable pushes). **Deploy:** never set `NODE_ENV` in host env vars; `build`/`start` force production via `scripts/next-prod.mjs`. Fonts are self-hosted in `public/fonts/` with `@font-face` in `globals.css` (eliminates `next/font/google` external network fetch and `loader.js` null-regex crash on Hostinger).
<!-- agent-context:end -->

---

## 1. Executive Progress Dashboard

```
[X] Phase 1: UX/UI Design System & Presentation Layer          (100%)
[X] Phase 2: Client Financial State & Deterministic Math       (100%)
[X] Phase 2.5: Build System Hardening & Tailwind v4 Engine      (100%)
[X] Phase 3: PostgreSQL Database & Multi-Tenant Schema         (100%)
[~] Phase 4: Server Route Handlers & Auth API Layer            (auth only; domain APIs not started)
[ ] Plan P0: Security fixes SEC-01..12                         <-- CURRENT MILESTONE
[ ] Plan P1: Domain APIs + FinanceContext migration (API-*)
[ ] Plan P2: AI copilot with server tools (AI-*)
[ ] Plan P3: ML insights (ML-*)
[ ] Plan P4-P5: Offers, hardening, demo readiness (OFR-*, OPS-*)
```

---

## 2. Completed Milestones & Feature Audit (What Has Been Done)

### 2.1 Frontend Presentation & Interactive Workspaces (100% Complete)
* [x] **Swiss Frosted Glassmorphism Design System:** Custom glass navigation (`.glass-nav`), double-bezel card architecture (`.keel-card`), and light luxury tokens in [globals.css](file:///d:/%23%23%23Competetions/Shenzhen%20International%20FinTech%20Competition-2026/code/WealthPilot/src/app/globals.css).
* [x] **Executive Financial Overview Dashboard:** Four KPI cards (Total Balance, Income this month, Spent this month, Savings progress) with micro-animations.
* [x] **Interactive Cash Flow & Spending Breakdown:** Real-time percentage breakdowns, category distributions, and income vs. expense visual comparisons.
* [x] **Debt Payoff Engine (Avalanche vs. Snowball):** Interactive amortization calculator dynamically comparing interest saved vs. psychological debt milestone wins.
* [x] **Savings Goals & Milestone Pacing:** Target vs. current progress bar with remaining contribution period estimations.
* [x] **Upcoming Commitments & Bill Tracker:** Categorized bill alerts distinguishing scheduled, due soon, and overdue states.
* [x] **Verified Regional Perks Directory:** Dual-market verified merchant discounts (Bangladesh `৳ BDT` & Global `$` USD) with external terms verification.
* [x] **Financial Learning Academy:** Gamified scenario simulations with XP levels, streaks (`🔥`), and real-world finance decision drills.
* [x] **Marketing Landing Page:** High-converting presentation view featuring a 5-year compounding wealth visualizer and runway velocity calculator.

### 2.2 Financial Calculation & Client Ledger Engine (100% Complete)
* [x] **Minor-Unit Integer Arithmetic Standard:** Strict usage of integer minor units (`amountCents`) in [lib/money.ts](file:///d:/%23%23%23Competetions/Shenzhen%20International%20FinTech%20Competition-2026/code/WealthPilot/src/lib/money.ts) preventing IEEE-754 floating-point drift.
* [x] **Formula-Injection Safe CSV Engine:** Automatic neutralization of spreadsheet injection triggers (`=`, `+`, `-`, `@`) upon export and import in [services/importService.ts](file:///d:/%23%23%23Competetions/Shenzhen%20International%20FinTech%20Competition-2026/code/WealthPilot/src/services/importService.ts).
* [x] **Client-Side Grounded AI Copilot Mock:** Rule-based intent router in [services/copilotService.ts](file:///d:/%23%23%23Competetions/Shenzhen%20International%20FinTech%20Competition-2026/code/WealthPilot/src/services/copilotService.ts) featuring an emergency AI Kill Switch and prompt injection sanitization.
* [x] **Local Audit Log Stream:** Client activity and balance change logging in [services/auditService.ts](file:///d:/%23%23%23Competetions/Shenzhen%20International%20FinTech%20Competition-2026/code/WealthPilot/src/services/auditService.ts).
* [x] **Vitest Test Suite:** Automated unit tests validating money arithmetic and debt payoff schedules with 100% pass rate.

### 2.3 Build System & Platform Hardening (100% Complete)
* [x] **Next.js 16 + Tailwind CSS v4 Build Stability:** Converted experimental Turbopack loader to stable PostCSS compilation via `@tailwindcss/postcss` and [postcss.config.mjs](file:///d:/%23%23%23Competetions/Shenzhen%20International%20FinTech%20Competition-2026/code/WealthPilot/postcss.config.mjs).
* [x] **Windows Path `#` Null-Byte Resolution:** Engineered automated [scripts/patch-tailwind.js](file:///d:/%23%23%23Competetions/Shenzhen%20International%20FinTech%20Competition-2026/code/WealthPilot/scripts/patch-tailwind.js) postinstall hook to sanitize `\0#` escaping in `enhanced-resolve`.
* [x] **Cross-Origin LAN HMR Configured:** Configured `allowedDevOrigins` in [next.config.ts](file:///d:/%23%23%23Competetions/Shenzhen%20International%20FinTech%20Competition-2026/code/WealthPilot/next.config.ts) for smooth testing on mobile/network IP addresses.

### 2.4 Multi-Tenant PostgreSQL Database & Invariants (100% Complete)
* [x] **Prisma ORM 6.19.3 Production LTS:** Generated strongly typed client in [prisma/schema.prisma](file:///d:/%23%23%23Competetions/Shenzhen%20International%20FinTech%20Competition-2026/code/WealthPilot/prisma/schema.prisma).
* [x] **GDPR Art. 17 Cascading Purge:** Foreign keys across all 10 domain entities specify `onDelete: Cascade`.
* [x] **64-bit Minor Units:** Balance and amount fields configured as `BigInt` cents, preventing IEEE 754 float drift and currency overflow.
* [x] **Database Singleton & Serializer:** Created [src/server/db.ts](file:///d:/%23%23%23Competetions/Shenzhen%20International%20FinTech%20Competition-2026/code/WealthPilot/src/server/db.ts) with `BigInt.prototype.toJSON` polyfill and connection health check.
* [x] **Database Seeding Engine:** Created [prisma/seed.ts](file:///d:/%23%23%23Competetions/Shenzhen%20International%20FinTech%20Competition-2026/code/WealthPilot/prisma/seed.ts) to populate demo user, accounts, transactions, and a genesis SOX 302 audit log.
* [x] **Multi-Tenancy Specification:** Published manual setup guide and ER diagram in [docs/DATABASE_AND_TENANCY_SPECIFICATION.md](file:///d:/%23%23%23Competetions/Shenzhen%20International%20FinTech%20Competition-2026/code/WealthPilot/docs/DATABASE_AND_TENANCY_SPECIFICATION.md).

---

## 3. Architecture Decision Records (ADRs)

* **ADR-001: Integer Minor-Units for Monetary Representation**  
  *Decision:* Represent all currency values as integer cents (`BigInt` / `number` cents).  
  *Rationale:* Floating-point math (`0.1 + 0.2 !== 0.3`) causes unacceptable accounting drift in FinTech applications.  

* **ADR-002: Single Next.js 16 Unified Monorepo**  
  *Decision:* Build backend endpoints inside `src/app/api/` rather than creating a separate Python/Express repository.  
  *Rationale:* Eliminates CORS overhead, unifies TypeScript types, reduces deployment costs to $0, and simplifies live judging.  

* **ADR-003: 100% Free AI Layer via Google Gemini Flash**  
  *Decision:* Standardize on Google AI Studio's Gemini 1.5/2.0 Flash (free 15 RPM, 1.5K req/day) with Groq Cloud Llama-3.3 fallback.  
  *Rationale:* Satisfies the project's strict zero-cost constraint while delivering native function/tool calling and fast inference.  

* **ADR-004: Strict Function Calling & Grounded Evidence Guardrails**  
  *Decision:* Prohibit direct SQL generation or calculation by LLMs. The backend executes deterministic calculations; the LLM merely translates and narrates.  
  *Rationale:* Prevents financial hallucinations and protects against prompt injection.  

* **ADR-005: PCI-DSS Zero-PAN Storage Exemption**  
  *Decision:* Explicitly exclude cardholder PAN, PIN, and CVV from application schemas.  
  *Rationale:* Minimizes PCI-DSS audit compliance footprint while satisfying all PFM user workflows.  

---

## 4. Work in Progress (WIP) & Upcoming Roadmap

The task list now lives in `BACKEND_AND_AI_PLAN.md` §9 (task IDs SEC-*, API-*, AI-*, ML-*, OFR-*, OPS-*). Mark tasks done there and add a line to `.agents/memory/log.md`. BE-01 (Prisma schema, client, seed) is complete. BE-02 (NextAuth) is **cancelled**: custom HMAC session auth is kept and hardened instead (ADR-006 in the plan).

---

## 5. Security & Compliance Protocol Audit Checklist

| Requirement | Regulatory Framework | Verification Mechanism | Status |
| :--- | :--- | :--- | :---: |
| **Right to Erasure** | GDPR Art. 17 | `verifyCascadingPurgeContract` (all-or-nothing cascading purge + SHA-256 proof) | ✅ Implemented & Tested |
| **Data Portability** | GDPR Art. 20 | `generateGdprPortabilityArchive` (machine-readable JSON + RFC 4180 CSV) | ✅ Implemented & Tested |
| **Privacy by Design / Kill Switch** | GDPR Art. 25 | `assertAiPrivacyConsent` (offline isolation enclave; zero external egress) | ✅ Implemented & Tested |
| **Split Preservation Invariant** | SOX Section 404 | `assertSoxSplitPreservation` (zero-variance $\Delta = 0$ allocation enforcement) | ✅ Implemented & Tested |
| **Tamper-Evident Ledger Audit** | SOX Section 302 | `createSoxAuditEntry` (cryptographic state hash chain of custody) | ✅ Implemented & Tested |
| **Discrete Minor-Units Standard** | SOX Section 404 | `assertMinorUnitIntegrity` (discrete integer cents without IEEE 754 drift) | ✅ Implemented & Tested |
| **Account Number Truncation** | GLBA 16 CFR § 314.4 | `maskAccountNumber` (terminal 4 digits preserved, e.g. `****1234`) | ✅ Implemented & Tested |
| **NPI Autonomous Redactor** | GLBA Safeguards Rule | `scanAndRedactNpi` (autonomous regex redaction of SSNs & routing numbers) | ✅ Implemented & Tested |
| **Zero-PAN Scope Minimization** | PCI-DSS v4.0 Req 3 | `passesLuhnCheck` & `scanAndEnforcePciDssScope` (Mod 10 card interception) | ✅ Implemented & Tested |
| **Formula Injection Defense** | OWASP ASVS / RFC 4180 | `sanitizeCsvCell` (neutralizing `=`, `+`, `-`, `@` vectors) | ✅ Implemented & Tested |
| **Continuous Git Pre-Commit Gate** | DevSecOps Standard | `.githooks/pre-commit` executes static scanner & 23 automated tests | ✅ Active & Automated |

---

## 6. Regulatory Documentation Index
- Detailed compliance specification: [docs/COMPLIANCE_PROTOCOLS.md](file:///d:/%23%23%23Competetions/Shenzhen%20International%20FinTech%20Competition-2026/code/WealthPilot/docs/COMPLIANCE_PROTOCOLS.md)
- Automated verification runner: `npm run check:compliance` or `npm test`

---

## 6. How AI Agents & Contributors Update This Memory

1. **Before Starting Any Task:** Inspect this document (`PROJECT_MEMORY.md`) to verify what features are marked complete. Do not re-implement or break existing working components.
2. **When Completing a Milestone:** 
   - Update the completion percentage in Section 1.
   - Move the task from Section 4 (WIP) to Section 2 (Completed Milestones).
   - If an architectural shift occurred, log a new ADR in Section 3.
3. **Commit Rule:** Always run `npm run check:security` to confirm that no API secrets or improper float arithmetic were introduced.
