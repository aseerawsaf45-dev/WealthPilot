# WealthPilot — Project Memory & Implementation Tracker
> **Document Purpose:** Single Source of Truth (SSOT) tracking all completed features, active milestones, architectural decisions, and security compliance records.  
> **Last Updated:** 2026-10-17  
> **Status:** Phase 1 & 2 (Frontend & Core Presentation) Completed • Phase 3 (Backend & AI) Initiated  

---

## 1. Executive Progress Dashboard

```
Overall Project Completion: [====================          ] 65%

[X] Phase 1: UX/UI Design System & Presentation Layer          (100%)
[X] Phase 2: Client Financial State & Deterministic Math       (100%)
[X] Phase 2.5: Build System Hardening & Tailwind v4 Engine      (100%)
[ ] Phase 3: PostgreSQL Database & Multi-Tenant Schema         (0%)   <-- CURRENT MILESTONE
[ ] Phase 4: Server Route Handlers & Auth API Layer            (0%)
[ ] Phase 5: Free AI Copilot Tool Calling (Gemini Flash)       (0%)
[ ] Phase 6: Statistical ML Forecasting & Outlier Detection    (0%)
[ ] Phase 7: Regulatory Compliance Verification & Final Audit  (0%)
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

| Priority | Task ID | Description | Target Files | Status |
| :---: | :---: | :--- | :--- | :---: |
| 🔴 High | **BE-01** | Create Prisma schema and connect free Supabase/Neon PostgreSQL | `prisma/schema.prisma`, `src/server/db.ts` | **Next Up** |
| 🔴 High | **BE-02** | Implement NextAuth.js v5 authentication & session route handlers | `src/app/api/auth/[...nextauth]/route.ts` | Queued |
| 🟡 Med | **BE-03** | Migrate in-memory finance context to server Route Handlers | `src/app/api/transactions/route.ts`, `src/app/api/dashboard/route.ts` | Queued |
| 🔴 High | **AI-01** | Implement Gemini Flash Tool-Calling copilot route handler | `src/app/api/ai/copilot/route.ts`, `src/server/ai/geminiClient.ts` | Queued |
| 🟡 Med | **ML-01** | Implement Holt-Winters cash-flow forecasting & Z-Score anomaly API | `src/server/services/forecastService.ts`, `src/app/api/ml/*` | Queued |
| 🟢 Low | **SEC-01**| GDPR Data Export & Account Deletion endpoints | `src/app/api/user/export/route.ts`, `src/app/api/user/account/route.ts`| Queued |

---

## 5. Security & Compliance Protocol Audit Checklist

| Requirement | Regulatory Framework | Verification Mechanism | Status |
| :--- | :--- | :--- | :---: |
| **Right to Erasure** | GDPR Art. 17 | Cascading database delete of all user records | ⏳ Pending BE-01 |
| **Data Portability** | GDPR Art. 20 | Signed JSON + CSV export endpoint | ⏳ Pending SEC-01 |
| **BOLA / IDOR Defense**| OWASP API Security | Enforce `userId = session.user.id` on all queries | ⏳ Enforced in specs |
| **Zero PAN Storage** | PCI-DSS | Account numbers masked (`****1234`) | Verified in UI |
| **AI Kill Switch** | EU AI Act & GDPR | User-toggleable local privacy mode | Verified in UI |
| **Prompt Injection Defense**| OWASP LLM Top 10 | Tool context wrapped in XML `<evidence>` tags | Verified in specs |
| **Formula Injection Defense**| OWASP ASVS | Prefixing `=`, `+`, `-`, `@` with `'` on CSV export | Verified in tests |

---

## 6. How AI Agents & Contributors Update This Memory

1. **Before Starting Any Task:** Inspect this document (`PROJECT_MEMORY.md`) to verify what features are marked complete. Do not re-implement or break existing working components.
2. **When Completing a Milestone:** 
   - Update the completion percentage in Section 1.
   - Move the task from Section 4 (WIP) to Section 2 (Completed Milestones).
   - If an architectural shift occurred, log a new ADR in Section 3.
3. **Commit Rule:** Always run `npm run check:security` to confirm that no API secrets or improper float arithmetic were introduced.
