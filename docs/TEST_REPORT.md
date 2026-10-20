# WealthPilot: Test Report

**Supporting deliverable 04 · Test strategy, results, traceability and defect analysis**

| | |
|---|---|
| System under test | WealthPilot 1.0 (Next.js 16 application, `main` branch) |
| Test period | Development through 2026-10-20 |
| Report date | 2026-10-20 |
| Detailed catalogue | Appendix: every test case with its latest result (`docs/TEST_CASES.md`) |
| Execution evidence | `docs/SANDBOX_OPERATION_LOG.md` and `submission/evidence/` |

## 1. Summary and verdict

**Verdict: pass.** Every automated test, evaluation and sandbox assertion in the latest runs passed, and every exit criterion in §12 is met. Open issues are known design limitations, not failing tests. They are listed in §11 and ranked in the Security Self-Assessment Report (deliverable 05).

| Suite | Cases | Passed | Pass rate |
|---|---|---|---|
| Unit and logic tests (`npm test`) | 115 | 115 | 100% |
| Database integration tests (Neon test branch) | 15 | 15 | 100% |
| AI copilot evaluations (`npm run eval:ai`) | 57 | 57 | 100% |
| End-to-end sandbox operations (production build, HTTP) | 63 | 63 | 100% |
| **Total** | **250** | **250** | **100%** |
| Static checks | TypeScript strict: 0 errors · security gates: all passed · route inventory: 79/79 handlers wrapped | | |

## 2. Scope and objectives

**In scope:**
- Money and ledger.
- Import and on-device document reading.
- Budgets, goals, bills and debts.
- The debt and wealth planner (loans, investment projection, fund mixes, bank suggestions).
- The AI copilot (questions, commands, grounding, privacy, consent).
- ML insights and partner offers.
- Authentication, authorisation, auditing and data rights.

**Objectives:**
1. Prove that money is exact: integer minor units, derived balances, no cross-currency sums.
2. Prove tenant isolation and the permission tiers.
3. Prove that every number the AI says comes from server code, and that hostile input or a hostile model cannot change that.
4. Prove that writes are idempotent where it matters (imports, bill payments, taking a loan) and fully audited.
5. Show the system working end to end on a production build.

**Out of scope for this report:**
- Load and stress testing beyond single-user latency.
- Visual-regression testing.
- Formal penetration testing by a third party.
- Accessibility audits beyond manual checks.
- Code-coverage measurement (not reported; see §12).

## 3. Test strategy

Testing is layered so that each risk is caught at the cheapest level that can catch it.

| Level | What it proves | Tooling | Runs |
|---|---|---|---|
| 1. Unit and logic | Pure maths and rules: money parsing, ML models, loan and investment formulas, mix construction, parsers, Zod schemas, copilot router, commands and grounding, security helpers | `node:test` via `tsx` (`scripts/test-runner.mts`) | Every commit (pre-commit hook) |
| 2. Database integration | Repositories against real Postgres: derived balances, tenant isolation (404), idempotent payments, goal limits, audit hash chain, session revocation, offer visibility, admin guard | `node:test` + Prisma against a **Neon test branch** (`scripts/integration.mts`) | Before migrations and releases |
| 3. AI evaluations | The full copilot pipeline with scripted fake models, including hostile ones: exact figures, tool choice, schema, prompt injection, consent gates, failure fallbacks | `scripts/ai-evals.mts` + `scripts/ai-evals.json` | Every change to `src/server/ai` |
| 4. End-to-end sandbox | Two simulated users over real HTTP on a production build: 63 operations including 11 attack attempts, audit-chain recomputation and erasure | `scripts/sandbox-run.mts` | Before submission and releases |
| 5. Browser checks | Key flows in headless Chrome at 1440 px and 390 px: Planner, Copilot proposals, Admin, Near you with emulated GPS | Chrome DevTools Protocol scripts | After UI changes |
| Static | Types, lint rules, layering (routes never call Prisma), secret scan, route-tier inventory | `tsc`, ESLint, `check:security`, `scripts/route-inventory.mts` | Every commit / push (pre-push rebuilds in a clean worktree) |

Principles:
- Tests use fixed dates and fixture data, so results are deterministic.
- Database tests create throwaway users and delete them.
- **Production data is never used.** Every database run uses a separate Neon branch.
- AI evaluations need no API key and spend no quota.

## 4. Test environment

| Item | Value |
|---|---|
| Operating system | Windows 11 (development machine) |
| Runtime | Node.js 24.12.0, TypeScript 5 (strict) |
| Application | Next.js 16.4 production build (`next build` + `next start` via `scripts/next-prod.mjs`) |
| Database | Neon Postgres, test branch `br-proud-wildflower-b43bojej` (isolated copy of the schema; production untouched), all 9 migrations applied |
| Browser | Google Chrome (headless, DevTools Protocol) |
| External services | World Bank, Wikidata, GDELT, Yahoo Finance, open.er-api: real calls in sandbox and browser runs; fixtures in unit tests |
| AI | Scripted fake models in evaluations; real calls are not needed for any pass criterion |
| Live deployment (reference) | https://darkslategray-duck-848813.hostingersite.com/ (health check returned `db: ok` on 2026-10-20) |

## 5. Results

### 5.1 Results by functional area

<!-- gen:areas -->
| Functional area | Unit / logic | DB integration | Passed |
|---|---|---|---|
| Partner offers | 3 | 2 | 5 / 5 |
| Planning: budgets, goals, debts | 11 | 0 | 11 / 11 |
| Wealth planner: loans, investing, banks, markets | 24 | 0 | 24 / 24 |
| Import and document reading | 11 | 1 | 12 / 12 |
| AI copilot: grounding, commands, privacy | 18 | 1 | 19 / 19 |
| ML insights | 7 | 0 | 7 / 7 |
| Security, privacy and compliance | 25 | 3 | 28 / 28 |
| Money, currencies and ledger | 16 | 8 | 24 / 24 |
| AI copilot evaluations (scripted models) | | | 57 / 57 |
| **All automated test cases** | **115** | **15** | **187 / 187** |

_Generated 2026-10-20 by `scripts/test-catalogue.mts`; integration ran on a Neon test branch._
<!-- /gen -->

### 5.2 AI copilot evaluations by category

| Category | Cases | What a pass requires |
|---|---|---|
| Exact figures and periods | 20 | Every expected fact matches to the minor unit: month and 30-day windows, leap February, month-end 31st, empty months, splits, refunds as income, transfers excluded, no cross-currency sums |
| Prompt injection | 10 | Instructions hidden in questions, merchant names, forecasts or political questions change nothing; no invented figure appears |
| Model failure and grounding | 12 | Malformed JSON, timeouts, rate limits, unknown tools or placeholders, number words, implausible dates: the answer falls back to the server template and stays correct |
| Consent and provider gates | 7 | No AI without consent, or with an outdated notice; Gemini refused without a region or in the EEA, UK or EU |
| Commands | 4 | Navigation, compound plans and natural-language goals become proposals; free-form commands need AI |
| Insights and planner | 4 | Insight, forecast, investment-outlook and loan answers use server facts only |
| **Total** | **57** | **57 passed** |

### 5.3 End-to-end sandbox run

The sandbox run (`docs/SANDBOX_OPERATION_LOG.md`) made 63 operations with two fictional users against a production build:

| Area | Operations | Passed |
|---|---|---|
| Identity and sessions | 5 | 5 |
| Ledger (multi-currency, import, rollback, void) | 11 | 11 |
| Planning (budgets, goals, bills, debts) | 9 | 9 |
| Wealth planner (loans, banks, macro, investments, mixes) | 9 | 9 |
| Insights and AI (insights, report, FX, copilot, page insight) | 8 | 8 |
| Partner offers | 2 | 2 |
| Security (attack simulations) | 11 | 11 |
| Privacy (export, audit, sign-out, erasure) | 6 | 6 |
| Audit (hash chain, clean details) | 2 | 2 |

## 6. Requirements traceability

Each core requirement is proven at more than one level.

| Requirement | Unit / logic evidence | Integration evidence | AI eval evidence | Sandbox evidence |
|---|---|---|---|---|
| Money is exact (integer minor units, any currency) | Financial Math & Minor Units; World currencies & FX | ledger: derived balances | 20 exact-figure cases, multi-currency-no-cross-sum | Float amount refused (400); balances re-derived after every write |
| Balances are derived, never stored | Server mappers | ledger: derived balances, void | n/a | Void and rollback recompute balances |
| Imports are idempotent and reversible | CSV Parsing & Duplicate Fingerprinting | import: dedupe, rollback, re-import | duplicates | Re-import: 0 inserted, 6 duplicates; rollback voids the batch |
| Tenant isolation (no BOLA/IDOR) | PostgreSQL Multi-Tenant invariants | ledger + full CRUD cross-tenant 404s | gate / other-user-arg injection | 3 cross-tenant attempts get 404 |
| Sessions are revocable | Authentication & NIST SP 800-63B | platform: session revocation | n/a | Replayed cookie after sign-out gets 401 |
| CSRF protection | CSRF origin check | n/a | n/a | Forged Origin gets 403 (also confirmed on the live site) |
| Input validation at the boundary | API input validation | n/a | llm-invalid-tool-args | Float money and card number refused (400) |
| Abuse limits | n/a | platform: rate limit with Retry-After | llm-rate-limited | 11th password guess gets 429 |
| Tamper-evident audit | Server mappers & audit chain (pure) | platform: unbroken audit chain | n/a | 29-event chain recomputed: intact |
| AI never invents numbers | Grounding check; AI Copilot Grounding & Adversarial Defense | n/a | 12 model-failure + 10 injection cases | Injection question answered without invented figures |
| AI changes need confirmation | Assistant commands (propose, never write); Copilot control of the Planner | assistant chat history | command-* cases | Proposal saved only after confirmation via the normal API |
| AI privacy and consent | AI privacy gateway; GLBA; PCI-DSS | n/a | 7 gate cases | No user data in AI calls (AI off in sandbox) |
| Idempotent money actions | Wealth planner maths (taken loan becomes a debt) | full CRUD: pay once per due date | n/a | Second bill payment gets 409; second loan take gets 409 |
| Goal never below zero | AI goal planner | full CRUD: contribute, never below zero | savings cases | Over-withdrawal refused (400) |
| Planner maths correct | Wealth planner maths; Loans: borrowing room; Several history-based mixes; Debt-first vs invest | n/a | invest-outlook, loans-compare | Mix applied with weights totalling 100%; invalid mix refused |
| Bank lists for every country | Bank picks; GDELT parsing; bundled snapshot covers big and small countries | n/a | n/a | 12 banks for Bangladesh, 3 "worth comparing" |
| Partner offers rules and privacy | Partner offers: input rules, distance | partner offers: visibility, admin guard, anonymous counts | n/a | 5 live offers, every card labelled; anonymous click counted |
| Data rights (GDPR) | GDPR protocols | n/a | n/a | Export works; account deletion leaves 0 rows |
| Admin tier | n/a | admin guard (403 / 200, case-insensitive allowlist) | n/a | Normal user gets 403 on the admin API |

## 7. Security testing summary

Security was tested at every level.

**Unit tests:**
- CSRF and origin rules.
- Zod trust boundary.
- Password hashing and session token rules (NIST SP 800-63B suite).
- PCI card detection (Luhn).
- GLBA redaction.
- CSV formula-injection neutralisation.
- AI privacy gateway and grounding.

**Integration tests:**
- Cross-tenant 404s.
- Revoked sessions.
- Rate limits.
- Audit chain.
- Admin guard.

**Sandbox attack simulations (11):**
- no session;
- three cross-tenant attempts;
- forged Origin;
- float money;
- card number in a note;
- non-admin calling the admin API;
- spoofed `userId` in a body;
- password guessing (429);
- replay of a revoked cookie.

**Live site checks (2026-10-20):**
- Anonymous `GET /api/v1/bootstrap` gets 401.
- A forged-Origin `POST` gets 403.
- HTTP redirects to HTTPS.
- The security headers are present.

The permission-tier implementation, the full control assessment and the risk register are in deliverable 05.

## 8. Non-functional results

| Property | Result | Evidence |
|---|---|---|
| Latency (sandbox, write-heavy mix) | p50 2.56 s, p95 5.94 s | Sandbox summary |
| Cause of latency | Database round trip of 274 ms from the test machine (Bangladesh) to the database (US-East); a write makes about 8–12 sequential round trips | Measured in the same run |
| Fast-fail paths | About 3–5 ms for a forged Origin or missing session (no database work) | Sandbox rows 44 and 48 |
| Concurrency | Two simultaneous offer clicks count exactly 2; the audit chain never forks (per-user advisory lock) | Integration tests |
| Idempotency | Bill paid twice gets 409; loan taken twice gets 409; re-import inserts 0 | Sandbox rows 23, 29, 11 |
| External-service resilience | Bank list answers within about 2.5 s even when Wikidata is slow (bundled snapshot); news waits at most 1.5 s; market data falls back to the last cached copy | Bank API timings (first view about 5 s, then about 1 s) |
| Responsive layout | No horizontal overflow at 390 px on Overview, Planner and Near you | Browser checks |

## 9. Defects found and fixed during development

These defects were found by the tests and checks above while building the product. Each is fixed, and a test now guards it.

| # | Symptom | Root cause | Fix | Guarding test |
|---|---|---|---|---|
| 1 | "Banks to compare" showed 0 banks for every country on the live site | Live Wikidata call never succeeded on the host; the query also timed out (> 60 s) for big countries | Query rewritten to start from bank types (1–3 s); bundled snapshot of 158 countries; live data used only if it answers within 2.5 s | "the bundled snapshot covers big and small countries"; "parses Wikidata banks…" |
| 2 | Bank API took 14–16 s on the first view of a country | Waiting for throttled news (5.5 s spacing + 20 s timeout) | News waits at most 1.5 s and keeps loading in the background | Sandbox timing |
| 3 | News fetches failed after repeated calls | GDELT blocks an IP after rate violations | Global throttle (1 per 5.5 s), 6-hour cache, no retry loops | "parses articles, drops duplicates and rate-limit notices…" |
| 4 | 10-year fund returns showed as empty | A history a few weeks short of 10 years was rejected | Accept series up to 3 months short | "market stats: annualised return, volatility, drawdown…" |
| 5 | "Pay debt or invest" favoured one side unfairly | The two paths did not spend the same total money | Both paths spend the same amount over the same months | "with a 24% card and a 6% return, paying the card first ends with more net worth" |
| 6 | Free cash flow was far too low with several loan offers | Every offer under consideration was counted as a payment | Only the cheapest offer is counted | Wealth planner maths |
| 7 | Two Planner panels stacked on top of each other | Two components shared one React key | Distinct keys | Browser check |
| 8 | PDF import failed on the host | Hostinger serves `.mjs` workers as text | Workers published as `.js` | Browser check on the live site |
| 9 | Pressing Back after sign-out reopened app pages | App URLs stayed reachable without a session | Signed-out app URLs rewritten to the landing page; the server returns 401 | Sandbox rows 44 and 57 |
| 10 | Ambiguous dates (02/10) read as February | Day/month order guessed per locale | Pick the order closest to today | "02/10 … 07/10 in a US locale on 19 Oct are October" |
| 11 | Lint errors (state set inside effects, impure `Date.now()` during render) in new UI | React 19 rules | Keyed results set in async callbacks; `useToday()` | ESLint (0 errors in changed files) |
| 12 | Sample-offer seeding failed against the remote database | Interactive transaction exceeded the 5 s default (P2028) | 60 s timeout for the seed transaction | Seed run twice (idempotent: still 7 samples) |

## 10. Code-review findings (open)

An independent review of the latest changes found the issues below. They are open and tracked in deliverable 05.
- Partial updates of investment plans and loan offers re-apply schema defaults.
- A copilot proposal confirmed late can overwrite edits made in the meantime.
- The copilot can propose a different country than it saves.
- "Take-home pay" is classified as a command.

## 11. Open issues

No test is failing. Known limitations (design gaps, not regressions) are ranked by severity in the Security Self-Assessment Report §5. The most important:
1. On non-Vercel hosts the IP-based sign-up and login limits share one bucket.
2. Budget spending is not FX-converted.
3. "Delete my financial data" keeps investment plans and loan offers.
4. A goal-withdrawal race is possible.

## 12. Gaps and recommendations

| Gap | Recommendation |
|---|---|
| No code-coverage metric is reported | Run `node --test --experimental-test-coverage` in CI and set a floor for `src/lib` and `src/server` |
| No load or soak test | k6 scenario for bootstrap, transaction writes and copilot at 50–200 concurrent users, with the app and database in the same region |
| No visual-regression suite | Snapshot the main tabs at 1440 and 390 px in CI |
| Browser checks are scripts, not a suite | Promote the CDP scripts to Playwright tests |
| Tests for the open issues | Add failing tests first when fixing each risk (rate-limit key, cross-currency move, budget FX, data wipe, withdrawal race) |
| No MFA or recovery flows to test | Add tests together with the features |

**Exit criteria (all met):**
- 100% of unit, integration and evaluation cases pass.
- 0 prompt-injection successes.
- 0 type errors.
- All security gates pass.
- Every route handler is wrapped by a permission tier.
- The sandbox run passes with the audit chain intact and complete erasure.

## 13. Sign-off

| Role | Name | Date |
|---|---|---|
| Test lead | | 2026-10-20 |
| Security review | | 2026-10-20 |
| Team | Team Joker | 2026-10-20 |
