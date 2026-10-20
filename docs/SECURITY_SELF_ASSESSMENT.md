# WealthPilot: Security Self-Assessment Report

**Deliverable 05 · Permission-tier implementation and known-risk list**

| | |
|---|---|
| System assessed | WealthPilot 1.0, repository `main` branch, and the live deployment https://darkslategray-duck-848813.hostingersite.com/ |
| Assessment date | 2026-10-20 |
| Assessed by | Team Joker (self-assessment) |
| Related documents | Technical documentation §4 (security design) · Test report · Sandbox operation logs · Appendix A (route inventory) |

## 1. Scope and method

The assessment covers the web application, its HTTP API (54 route files, 79 handlers), the server layer, the database schema, the AI copilot and the live deployment. Seven methods were used, and every finding below is backed by at least one of them:

1. **Source review** of every route handler, wrapper, repository and AI component, with file references in this report.
2. **Generated route inventory** (`scripts/route-inventory.mts`, Appendix A). It reads each handler's wrapper, rate limits and input validation from the code. Result: 79 of 79 handlers are wrapped by a permission tier; 0 are unwrapped.
3. **Automated tests:** 115 unit, 15 database integration and 57 AI evaluation cases, all passing (`docs/TEST_CASES.md`).
4. **Attack simulation** on a production build against a sandbox database: 11 attacks in the sandbox run, all blocked (`docs/SANDBOX_OPERATION_LOG.md`).
5. **Dependency audit:** `npm audit` on 2026-10-20.
6. **Secret and layering scan:** `npm run check:security` (no committed secrets; routes never call the database directly).
7. **Live-site checks** (read-only) on 2026-10-20:
   - response headers;
   - HTTP-to-HTTPS redirect;
   - anonymous access (401);
   - a forged-Origin request (403).

## 2. Executive summary

WealthPilot enforces four permission tiers entirely on the server. The tier of every request comes from a revocable server-side session and server-side configuration; nothing the browser sends can raise it.
- Every one of the 79 API handlers is exported through a tier wrapper.
- Every database query on user data is scoped to the session user.
- Another user's records return 404, so their ids are never confirmed.
- The AI tier adds versioned consent, quotas and a privacy gateway, and the model has no write or database access.

**Controls verified:**
- **Escalation paths:** 12 of 12 blocked (§3.4).
- **OWASP API Security Top 10:** 7 implemented, 3 partial.
- **OWASP LLM Top 10:** all 6 applicable risks addressed.
- **Attacks in the sandbox run:** 11 of 11 blocked.

**Known risks: 20.**

| Severity | Count | Most important |
|---|---|---|
| High | 2 | R-01 sign-up and login IP limits shared by all visitors on the current host; R-02 no multi-factor authentication or account recovery |
| Medium | 8 | Missing HSTS header, live build behind the repository, admin without a second factor, cross-currency integrity issues, incomplete data wipe, CSP `unsafe-inline` |
| Low | 10 | Dependency findings in build/dev tooling only, header disclosure, review findings in the copilot, model limitations |

No risk allows reading or changing another user's data, and none bypasses a permission tier. The two High items concern availability and account recovery. R-01 is a one-line configuration fix before go-live (§6).

## 3. Permission-tier implementation

### 3.1 Tier model

| Tier | Who belongs | Decided by | Granted by | Revoked by |
|---|---|---|---|---|
| **T0 Anonymous** | Any visitor | Absence of a valid session | | |
| **T1 User** | A signed-in person | `authed()`: a valid HMAC-signed cookie **and** a live `Session` row | Sign-up or sign-in (bcrypt password check) | Sign-out, account deletion, expiry (7 days), server-side revocation |
| **T2 AI-consented user** | A user who accepted the current AI notice | `canUseLlm()` per request, from database fields (never from the session token) | `POST /user/ai-consent` with chosen providers | `DELETE /user/ai-consent`; a new notice version invalidates old consent automatically |
| **T3 Admin** | A user whose email is in `ADMIN_EMAILS` | `adminOnly()`, reading the email from the database and comparing it with the server environment | Server operator edits `ADMIN_EMAILS` | Removing the email from `ADMIN_EMAILS` (effective on the next request) |

Tiers are cumulative: T2 and T3 require T1. T2 and T3 are independent of each other.

### 3.2 How each tier is enforced

**T0 → T1: every protected handler goes through `authed()`** (`src/server/http.ts`):

```ts
export async function requireSession(request: Request): Promise<AuthedSession | NextResponse> {
  const payload = getSessionFromRequest(request);          // HMAC-SHA256 signature + expiry
  if (!payload) return fail('UNAUTHORIZED', 'Please sign in.', 401);
  const session = await prisma.session.findFirst({
    where: { id: payload.sid, userId: payload.userId, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true },
  });
  if (!session) return fail('UNAUTHORIZED', 'Your session has ended. Please sign in again.', 401);
  return { userId: payload.userId, sid: payload.sid };
}
```

The cookie (`wealthpilot_session`) is HttpOnly, SameSite=Lax and Secure in production. It carries no data beyond the session id and user id. A copied cookie stops working the moment its `Session` row is revoked, so a signature alone is not enough.

**T1 data boundary: repositories scope every query** (`src/server/repos/*.ts`). The user id is a parameter from the session, never from the request:

```ts
export async function patchGoal(userId: string, id: string, patch: z.infer<typeof GoalPatch>) {
  const existing = await prisma.savingsGoal.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) throw notFound('Goal');                    // another user's id looks the same as a missing one
  …
}
```

Zod schemas (`src/server/schemas.ts`) drop unknown keys. A `userId`, `isAdmin`, `status: "VOID"` or balance field sent by a client therefore never reaches the database (mass-assignment defence).

**T1 → T2: the AI gate** (`src/server/ai/privacy.ts`, `gate.ts`):

```ts
export function canUseLlm(user: AiConsentState, provider: Provider): boolean {
  const consented = user.isAiEnabled && !!user.aiConsentAt &&
    user.aiConsentVersion === CURRENT_AI_NOTICE && user.aiProviders.includes(provider);
  return consented && (provider !== 'gemini' || allowGemini(user));   // Gemini: never EEA/UK/CH/CN or unknown region
}
```

**Even at T2:**
- The model receives fact labels only, never amounts, rows or personal data.
- Its text is rejected if it states a number of its own.
- It cannot write: changes are proposals that the user must confirm. They then run through the normal T1 API, and only operations on the `ASSISTANT_OPS` allowlist can run.
- Quotas apply: 20 AI calls per user per day and a global per-minute cap. Beyond them the copilot falls back to calculated answers.
- AI document reading is a further opt-in (`canReadDocuments`: Groq only, never Gemini), and receives redacted text.

**T1 → T3: the admin guard** (`src/server/http.ts`):

```ts
export function adminOnly(fn) {
  return authed(async (request, session, ctx) => {
    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { email: true } });
    if (!isAdminEmail(user?.email)) return fail('FORBIDDEN', 'Admins only.', 403);
    return fn(request, session, ctx);
  });
}
```

The `isAdmin` flag sent to the browser (via `/bootstrap`) only decides whether the Admin tab is visible. Every admin API call re-checks on the server.

### 3.3 Capability matrix

| Capability (route family) | T0 Anonymous | T1 User | T2 AI-consented | T3 Admin |
|---|---|---|---|---|
| Sign up, sign in, sign out, health | Yes | Yes | Yes | Yes |
| Own ledger: accounts, transactions, import, rollback | No (401) | Own data only | Own data only | Own data only |
| Own budgets, goals, bills, debts, loans, investments | No (401) | Own data only | Own data only | Own data only |
| Public data: banks, macro, markets, FX, partner offers (read) | No (401) | Yes (rate-limited) | Yes | Yes |
| Copilot and page insights | No (401) | Calculated answers only | + model wording and tool choice (quota) | as T1/T2 |
| AI document reading | No | No | Only with the extra "documents" consent | as T2 |
| Export, erase own data / account | No (401) | Own, password re-entry for erasure | same | same |
| Other users' data | No | **No (404)** | **No (404)** | **No**: admins have no access to user data |
| Partner and offer management, offer statistics | No (401) | No (403) | No (403) | Yes |

The admin tier deliberately has **no** access to users' financial data. Its routes only touch partner, offer and anonymous-statistics tables.

### 3.4 Escalation paths tested

| Attempt | Expected | Result | Evidence |
|---|---|---|---|
| Call a protected API with no cookie | 401 | 401 | Sandbox #44; live site `GET /bootstrap`: 401 |
| Forge or alter a cookie | 401 | 401 | Unit: session token signature tests (NIST SP 800-63B suite) |
| Replay a valid cookie after sign-out | 401 | 401 | Sandbox #57; integration: "rejects a revoked session even though its token signature is valid" |
| Read, change or delete another user's record by id | 404 | 404 | Sandbox #45–47; integration: cross-tenant 404 tests |
| Send `userId` of someone else in a body | Ignored | Record created for the session user only | Sandbox #52 |
| Cross-site request carrying the victim's cookie | 403 | 403 | Sandbox #48; live site forged-Origin `POST`: 403 |
| Normal user calls an admin API | 403 | 403 | Sandbox #51; integration: "lets only ADMIN_EMAILS use the admin API" |
| Client claims to be admin | No effect | Admin APIs still 403 | `adminOnly()` reads the email from the database |
| Use AI without consent, or with an outdated consent version | Calculated answers only | As expected | AI evals `gate-no-consent`, `gate-old-notice` |
| Use Gemini from the EEA/UK or without a region | Refused | Refused | AI evals `gate-gemini-eea`, `gate-gemini-no-region`, `gate-gemini-other-eu` |
| Make the AI change data without confirmation | Impossible | Proposal only | Unit: "Assistant commands (propose, never write)"; sandbox #38–39 |
| Guess passwords | 429 after 10 per email per hour | 429 on the 11th | Sandbox #53 |

### 3.5 Route inventory result

| Tier (wrapper) | Handlers |
|---|---|
| Public (`handle`): sign-up, sign-in, sign-out, health | 4 |
| User (`authed`) | 68 |
| Admin (`adminOnly`) | 7 |
| **Unwrapped** | **0** |

The full route-by-route table, with methods, rate limits and validation, is Appendix A.

## 4. Control assessment

### 4.1 OWASP API Security Top 10 (2023)

| Risk | Status | Controls | Evidence |
|---|---|---|---|
| API1 Broken Object Level Authorization | Implemented | Session-scoped repositories; `findFirst({ id, userId })`; 404 for foreign ids | Integration cross-tenant tests; sandbox #45–47 |
| API2 Broken Authentication | Partial | bcrypt cost 12; constant-time dummy compare; HMAC token + revocable session; per-email limit | Gap: no MFA or recovery (R-02); shared IP bucket (R-01) |
| API3 Broken Object Property Level Authorization | Implemented | Zod drops unknown keys; mappers return only intended fields (never password hashes) | Sandbox #52; unit schema tests |
| API4 Unrestricted Resource Consumption | Partial | Per-route limits (Appendix A); list caps (2,000 import rows, 20 locations, 10 funds); AI quotas | Gap: R-01 |
| API5 Broken Function Level Authorization | Implemented | Tier wrappers on every handler; `adminOnly` for admin routes | Route inventory 0 unwrapped; sandbox #51 |
| API6 Unrestricted Access to Sensitive Business Flows | Implemented | Idempotent bill payment and loan taking; AI actions need confirmation; limits on contributions and payments | Sandbox #23, #29 |
| API7 Server-Side Request Forgery | Implemented | The server only calls fixed hosts; user input in URLs is a validated ISO country code; partner links are only rendered (https-only), never fetched | Source review; schemas |
| API8 Security Misconfiguration | Partial | CSP, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy present on the live site | Gaps: no HSTS (R-03), `unsafe-inline` (R-09), `x-powered-by` (R-16) |
| API9 Improper Inventory Management | Implemented | Single version `/api/v1`; generated route inventory; documentation | Appendix A |
| API10 Unsafe Consumption of APIs | Implemented | Timeouts on every outside call; defensive parsing (GDELT, Wikidata, Yahoo); Zod on AI output; cache with stale fallback | Unit: "GDELT parsing (real response shape)", AI model-failure evals |

### 4.2 OWASP Top 10 for LLM Applications (2025)

| Risk | Status | Controls | Evidence |
|---|---|---|---|
| LLM01 Prompt Injection | Implemented | Rules first; model sees labels only; text with its own numbers rejected; fixed server question for page insights and plans; document text marked as data | 10 injection evals; sandbox #40 |
| LLM02 Sensitive Information Disclosure | Implemented | No amounts, rows or personal data sent; redaction of national ids, secrets, account and card numbers, emails, phones; Groq with zero data retention; versioned consent | Unit: AI privacy gateway, GLBA, PCI suites |
| LLM05 Improper Output Handling | Implemented | Model JSON validated with Zod; placeholders filled by the server; React escapes all text | Model-failure evals |
| LLM06 Excessive Agency | Implemented | No database or write access; proposals need user confirmation; `ASSISTANT_OPS` allowlist; names resolved only against the user's own records; amounts must appear in the user's message | Command unit tests; sandbox #38–39 |
| LLM09 Misinformation | Implemented | Every figure from server tools; limitations stated; the AI never states current events (politics only via the World Bank index and chosen scenarios) | 20 exact-figure evals |
| LLM10 Unbounded Consumption | Implemented | 20 per user per day, global per-minute cap, per-route limits, page-insight cache keyed by computed data | `gate.ts`; `llm-rate-limited` eval |

### 4.3 Data protection

| Control | Status |
|---|---|
| Passwords: bcrypt cost 12, 8–128 characters, rehash on login when the cost is lower | Implemented |
| Session secret ≥ 32 bytes enforced at runtime; separate `AUDIT_PEPPER` for keyed hashes | Implemented |
| Card numbers (Luhn) refused in free-text fields | Implemented (sandbox #50) |
| Files and location processed on the device only | Implemented |
| Tamper-evident audit log (SHA-256 chain, advisory lock) with no emails or card numbers in details | Implemented (sandbox: 29-event chain intact) |
| GDPR export and erasure with a pseudonymous receipt | Implemented (sandbox: 0 rows left) |
| Anonymous partner-offer statistics (no user id, no location) | Implemented |

## 5. Known-risk list (risk register)

Severity = likelihood × impact on this 3×3 matrix:

| Likelihood ↓ / Impact → | Low | Medium | High |
|---|---|---|---|
| **High** | Medium | High | High |
| **Medium** | Low | Medium | High |
| **Low** | Low | Low | Medium |

| ID | Risk | Category | Component | L | I | Severity | Evidence / how to reproduce | Mitigation in place | Planned fix | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| R-01 | IP-based sign-up (3/h) and login (20/15 min) limits share one bucket for all visitors on non-Vercel hosts | Availability / authentication | `clientIp()` in `src/server/http.ts` | High | Medium | **High** | On Hostinger the 4th sign-up in an hour fails for everyone; also reproduced in the sandbox | Per-email login limit (10/h) still stops guessing on one account | Trust the host proxy's forwarding header behind an env flag; keep per-email limits | Open (P1) |
| R-02 | No multi-factor authentication, email verification or password reset | Authentication | Auth routes | Medium | High | **High** | Feature absent | bcrypt, rate limits, revocable sessions | TOTP MFA, verified email, reset via one-time token | Open (P2) |
| R-03 | No `Strict-Transport-Security` header on the live site | Misconfiguration | Hosting / `next.config.ts` | Low | High | **Medium** | Live `curl -I`: no HSTS (HTTP does redirect to HTTPS with 301) | Redirect to HTTPS; Secure cookies | Add `Strict-Transport-Security: max-age=31536000; includeSubDomains` | Open (P1) |
| R-04 | Live deployment is behind the repository (old Permissions-Policy; migrations 7–8 not yet applied) | Change management | Deployment | Medium | Medium | **Medium** | Live header shows `geolocation=()`; investment plans would fail if the new code ran without migrations | Migrations are additive | `npx prisma migrate deploy` then redeploy; add a deploy checklist | Open (P1) |
| R-05 | Admin tier relies on an email allowlist without a second factor | Authorisation | `adminOnly()` | Low | High | **Medium** | A stolen admin password grants offer management (not user data) | Admin scope limited to partner content; audited | MFA for admins (with R-02) | Open (P2) |
| R-06 | Moving a transaction to an account in another currency keeps its currency code | Data integrity | `updateTransaction` | Medium | Medium | **Medium** | Move a USD row into a BDT account: that balance mixes currencies | Rare user action | Refuse moves across currencies (409) | Open (P2) |
| R-07 | Budget spending adds different currencies without FX conversion | Data integrity | `monthSpend` | Medium | Medium | **Medium** | Spend USD and BDT in one category: the budget total mixes them | Copilot answers convert correctly | Convert with the daily rate, as the AI tools do | Open (P2) |
| R-08 | "Delete my financial data" keeps investment plans and loan offers (account deletion is complete) | Privacy | `clearFinancialData` | Medium | Medium | **Medium** | Wipe data, then reload Planner: plans remain | Full erasure via account deletion works (sandbox) | Delete both tables in the wipe; add a test | Open (P1) |
| R-09 | CSP allows inline scripts (needed by the framework's static rendering) | Misconfiguration / XSS | `next.config.ts` | Low | High | **Medium** | Live CSP header | React escaping; HttpOnly cookie; strict `connect-src`, `frame-ancestors`, `object-src` | Nonce-based CSP when the rendering mode allows | Accepted (framework constraint) |
| R-10 | 7-day sessions with no idle timeout and no "sign out other devices" | Session management | Session lifecycle | Low | Medium | **Medium** | Design | Revocation on sign-out and deletion | Idle timeout (e.g. 24 h) and a sessions list in Settings | Open (P3) |
| R-11 | Partial PATCH of investment plans or loan offers re-applies defaults | Data integrity | `InvestmentPlanPatch`, `LoanOfferPatch` | Low | Medium | Low | A request with only `{name}` would reset mix and scenarios (the app always sends full objects) | Client sends complete objects | Patch schemas without defaults | Open (P2) |
| R-12 | Two simultaneous goal withdrawals can pass the "not below zero" check | Concurrency | `contributeToGoal` | Low | Medium | Low | Double-submit race | Per-user rate limit (60 per minute) | Conditional update `currentCents >= amount` | Open (P3) |
| R-13 | A copilot proposal confirmed much later can overwrite edits made in between | Data integrity | `src/server/ai/commands.ts` | Low | Medium | Low | Ask, edit the plan in the UI, then confirm the old proposal | User sees the proposal text before confirming | Send only changed fields (after R-11) | Open (P3) |
| R-14 | Copilot classification and country edge cases ("take-home pay" treated as a command; an unknown country shown differently from what is saved) | Correctness | Copilot rules | Low | Low | Low | Code review | Proposals need confirmation | Tighten the regex; compute the country once | Open (P3) |
| R-15 | `npm audit`: Prisma CLI → `@prisma/config` → `deepmerge-ts` (high, stack exhaustion) | Supply chain | Build/migration tooling | Low | Low | Low | `npm audit` 2026-10-20 | Not on the request path; only parses our own config | Upgrade to Prisma 7 | Open (P3) |
| R-16 | `npm audit`: `eslint-config-next` → `micromatch`/`braces` (high, ReDoS) | Supply chain | Development lint tooling only | Low | Low | Low | `npm audit` 2026-10-20 | Not shipped in the runtime; inputs are our own file globs | Upgrade with the next ESLint config | Open (P3) |
| R-17 | `x-powered-by: Next.js` response header | Information disclosure | `next.config.ts` | Low | Low | Low | Live `curl -I` | None needed beyond removal | `poweredByHeader: false` | Open (P1, one line) |
| R-18 | Outside data sources: Yahoo chart API is unofficial; GDELT blocks IPs after bursts; Wikidata may be slow | Availability / licensing | `repos/markets.ts`, `banks.ts` | Medium | Low | Low | Observed GDELT block during development | Caching, throttling, bundled bank snapshot, graceful degradation | Licensed market-data feed for production | Accepted |
| R-19 | Fund-mix volatility is a weighted average (correlations ignored) | Model risk | `mixStats` | Medium | Low | Low | Method | Overstates risk (conservative); labelled as history-based, not advice | Covariance from the same history | Accepted |
| R-20 | Live database latency (health check 2 s on 2026-10-20) | Availability / performance | Hosting region vs database region | Medium | Low | Low | Live `/api/v1/health` | Health check, idle reconnect | Host app and database in the same region; keep the database warm | Open (P2) |

## 6. Residual risk and remediation roadmap

| Priority | Before | Items | Effort |
|---|---|---|---|
| **P1** | Go-live / judging | R-01 rate-limit key, R-03 HSTS, R-04 migrate and redeploy, R-08 complete data wipe, R-17 header | Hours: each is a one- or few-line change plus a test |
| **P2** | Next release | R-02 MFA, verified email and reset; R-05 admin MFA; R-06 and R-07 currency integrity; R-11 patch schemas; R-20 co-location | Days |
| **P3** | Backlog | R-10 session management, R-12 conditional withdrawal, R-13/R-14 copilot refinements, R-15/R-16 dependency upgrades | Small, scheduled |
| Accepted | | R-09 CSP inline (framework), R-18 outside data, R-19 model simplification | Reviewed each release |

**Residual risk statement.** With the P1 items done, no known High risk remains open apart from R-02 (MFA and recovery), which is mitigated by strong hashing, rate limiting and revocable sessions. No known issue lets a user reach another user's data or raise their permission tier.

## 7. Evidence index

| Evidence | Location |
|---|---|
| Route-by-route tier inventory | Appendix A (`docs/ROUTE_INVENTORY.md`, generated) |
| Test catalogue with results | `docs/TEST_CASES.md` (generated from real runs) |
| Attack simulations and audit-chain verification | `docs/SANDBOX_OPERATION_LOG.md`, `submission/evidence/sandbox-run-*.jsonl` |
| Security design and threat model | `docs/TECHNICAL_DOCUMENTATION.md` §4 |
| Dependency audit | `npm audit` (summary in R-15, R-16) |
| Live-site checks | §1 item 7; results in R-03, R-04, R-17, R-20 and §3.4 |
