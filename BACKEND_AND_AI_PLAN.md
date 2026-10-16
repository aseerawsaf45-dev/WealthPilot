# WealthPilot — Backend, AI/ML & Security Compliance Blueprint
> **Classification:** Competition-Grade Engineering Specification & Implementation Manual  
> **Target Event:** Shenzhen International FinTech Competition (2026)  
> **Status:** Active Master Architecture Blueprint  
> **Free Tier Compliance:** 100% Zero-Cost Cloud & AI Tier Architecture

---

## 1. System Overview & Monorepo Architecture Decision

### 1.1 Repository Architecture Verdict
```
+-----------------------------------------------------------------------------+
|                      WealthPilot Unified Repository                         |
|                                                                             |
|  [Frontend Presentation]           [Backend Engine & BFF]                   |
|  - Next.js 16 App Router UI        - App Router Route Handlers (/api/v1/*)  |
|  - Tailwind CSS v4 Frosted UI      - NextAuth v5 Crypto Session Guards      |
|  - Lucide & Financial Charts       - Zod Request / Response Sanitizers      |
|  - Minor-Unit Integer Formatter    - Multi-Tenant RLS Query Filters         |
|                                                                             |
|  [Deterministic Financial Engine]  [Free AI / ML Subsystem]                 |
|  - Prisma ORM 6 on PostgreSQL      - Google Gemini 2.0 / 1.5 Flash (Free)   |
|  - Integer Cents Ledger Math       - Groq Cloud Llama-3.3-70B (Free Backup) |
|  - CSV Formula-Safe Ingestion      - Holt-Winters Cash Flow Predictor       |
|  - Audit Log Event Stream          - Robust Z-Score Anomaly Detector        |
+-----------------------------------------------------------------------------+
```

* **Single Monorepo Decision:** Keeping the backend and frontend unified inside this repository is **strongly recommended and strategically superior**:
  1. **Shared End-to-End Type Safety:** Both the client and server share `src/types/finance.ts`, eliminating duplicate DTO schemas and deserialization drift.
  2. **Zero CORS & Cookie Isolation:** First-party `HttpOnly`, `SameSite=Lax`, `Secure` session cookies operate seamlessly with zero cross-origin configuration friction.
  3. **Zero Hosting & Compute Overhead:** Next.js Route Handlers run in serverless/Node.js edge containers on free hosting platforms (Vercel, Render, Railway) without paying for a separate second backend server.
  4. **FinTech Competition Demo Readiness:** Judges pull a single repository, run `npm install && npm run dev`, and can evaluate the entire working pipeline locally.

---

## 2. 100% Free-Tier Resource Strategy

To eliminate infrastructure costs while preserving production performance, every external provider is selected from permanent, credit-card-free tiers:

| Component | Selected Provider | Free Limits & Quota | Purpose |
| :--- | :--- | :--- | :--- |
| **Primary LLM** | **Google Gemini 1.5 / 2.0 Flash** *(via Google AI Studio)* | **15 RPM**, **1,000,000 TPM**, **1,500 requests/day** for free. No credit card required. | Structured tool-calling, financial narrative generation, and query intent resolution. |
| **Failover LLM** | **Groq Cloud** *(Llama 3.3 70B Versatile)* | **30 RPM**, **6,000 TPM**, up to 14,400 req/day free. | Sub-second fallback when Gemini rate-limits or undergoes maintenance. |
| **Relational Database**| **Supabase PostgreSQL** or **Neon Serverless Postgres** | **500 MB** storage, automated TLS encryption, full relational integrity. | Storing accounts, ledgers, categories, budgets, goals, and audit trails. |
| **Authentication** | **NextAuth.js (Auth.js v5)** | **Unlimited** (Self-hosted within Next.js runtime). | Argon2id/Bcrypt password hashing and tamper-proof JWT sessions. |
| **Statistical ML** | **Native TypeScript / Node.js Engine** | **Unlimited** (Runs locally inside server runtime). | Time-series forecasting (Holt-Winters) and anomaly outlier detection (Z-Score). |

---

## 3. FinTech Data Security & Regulatory Compliance Protocols

Personal financial management platforms handle sensitive records and require strict compliance mechanisms:

### 3.1 Regulatory Compliance Matrix

```
[User Request] ──> [Session Authenticator] ──> [Tenant Isolation (session.user.id)]
                                                        │
                      ┌─────────────────────────────────┴─────────────────────────────────┐
                      ▼                                                                   ▼
       [Data Read / Write Operations]                                     [AI Copilot Query Flow]
       - Integer minor units only                                         - Check User AI Kill Switch
       - Zod Input & Output Sanitization                                  - Neutralize Prompt Injections
       - Parameterized SQL (Prisma)                                       - Call Read-Only Aggregations
       - Audit Log Record Created                                         - Ground In XML <evidence> Tags
```

1. **GDPR Art. 17 (Right to Erasure / "Be Forgotten"):**
   - Implemented via endpoint `DELETE /api/v1/user/account`.
   - Executes a cascading transaction deleting all user rows across `User`, `Account`, `Transaction`, `Budget`, `SavingsGoal`, `Bill`, `Conversation`, and `AuditLog`.
2. **GDPR Art. 20 (Right to Data Portability):**
   - Implemented via endpoint `GET /api/v1/user/export`.
   - Returns a cryptographically signed archive containing normalized JSON and RFC 4180 CSV export files.
3. **PCI-DSS Scope Exclusion:**
   - WealthPilot is strictly a Personal Financial Management (PFM) workstation.
   - **Zero PAN Storage:** The platform never accepts, processes, or stores 16-digit card numbers, CVVs, or online banking passwords. Account numbers are stored masked (e.g. `****4821`).
4. **Multi-Tenant Isolation (BOLA / IDOR Defense):**
   - Client requests are prohibited from supplying a target `userId`.
   - All server queries automatically inject `WHERE userId = session.user.id` derived directly from the authenticated session cookie.
5. **Formula Injection Neutralization (CSV Security):**
   - All text cells exported or imported are sanitized against formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`). Any character beginning with these triggers is prepended with a single quote (`'`).

---

## 4. API Endpoints Specification (`/api/v1`)

All endpoints use REST conventions, strict JSON payloads, and minor-unit integer values (`amountCents`).

### 4.1 Route Inventory

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/signup` | Registers user with salt-hashed password & initializes defaults | No |
| `POST` | `/api/v1/auth/login` | Authenticates user & issues secure `HttpOnly` session cookie | No |
| `POST` | `/api/v1/auth/logout` | Revokes active session & clears auth cookies | Yes |
| `GET` | `/api/v1/auth/me` | Returns profile, preferred currency (`BDT`/`USD`), & settings | Yes |
| `GET` | `/api/v1/dashboard/summary` | Deterministic totals: balance, income, expenses, burn rate | Yes |
| `GET` | `/api/v1/transactions` | Paginated & filtered ledger list (dates, categories, search) | Yes |
| `POST` | `/api/v1/transactions` | Creates a manual income, expense, or transfer transaction | Yes |
| `PATCH`| `/api/v1/transactions/:id` | Updates transaction tags, notes, or categorization | Yes |
| `DELETE`| `/api/v1/transactions/:id`| Soft-deletes / voids transaction with audit entry | Yes |
| `POST` | `/api/v1/transactions/import` | Ingests CSV statement with duplicate deduplication | Yes |
| `GET` | `/api/v1/budgets` | Returns active monthly budget envelopes & % pacing | Yes |
| `POST` | `/api/v1/budgets` | Creates or updates category spending caps | Yes |
| `GET` | `/api/v1/goals` | Lists savings goals with milestone projections | Yes |
| `POST` | `/api/v1/goals/:id/contribute` | Records savings deposit toward goal target | Yes |
| `GET` | `/api/v1/bills/upcoming` | Returns scheduled bills due in next 7/14/30 days | Yes |
| `POST` | `/api/v1/bills/:id/pay` | Marks bill as paid and logs linked ledger debit | Yes |
| `POST` | `/api/v1/ai/copilot` | Evidence-grounded natural language query (Gemini Flash) | Yes |
| `GET` | `/api/v1/ml/forecast` | Computes 30/60/90 day cash flow curve via Holt-Winters | Yes |
| `GET` | `/api/v1/ml/anomalies` | Discovers category outliers via robust Z-score & IQR | Yes |
| `PATCH`| `/api/v1/user/privacy` | Toggles AI Kill Switch and local privacy mode | Yes |
| `GET` | `/api/v1/user/export` | Generates full machine-readable GDPR export | Yes |
| `DELETE`| `/api/v1/user/account` | Permanently deletes account and purges user data | Yes |

---

## 5. Free AI Copilot Tool Calling Architecture

The AI copilot adheres to the **"Compute Deterministically, Explain Semantically"** principle. The LLM is strictly prohibited from executing arithmetic or direct SQL.

```
+------------------------------------------------------------------------+
| User Query: "How much did I spend on groceries this month vs last?"    |
+-----------------------------------┬------------------------------------+
                                    │
                                    ▼
+------------------------------------------------------------------------+
| 1. AI Orchestrator (Next.js Server API)                                |
|    - Validates User Session (session.user.id)                          |
|    - Asserts User AI Privacy Flag (isAiEnabled === true)               |
|    - Evaluates Anti-Prompt-Injection Guardrails                        |
+-----------------------------------┬------------------------------------+
                                    │
                                    ▼
+------------------------------------------------------------------------+
| 2. Google Gemini Flash (with Declarative Function Tools)               |
|    - Emits Tool Call: compare_periods({                                |
|        category: "Food & Groceries",                                   |
|        period1: { start: "2026-10-01", end: "2026-10-31" },           |
|        period2: { start: "2026-09-01", end: "2026-09-30" }            |
|      })                                                                |
+-----------------------------------┬------------------------------------+
                                    │
                                    ▼
+------------------------------------------------------------------------+
| 3. Server Domain Services (Deterministic Calculation)                  |
|    - Runs SQL parameterized aggregation on PostgreSQL                  |
|    - Computes: Oct = $560.00, Sept = $480.00, Diff = +$80.00 (+16.7%)  |
|    - Returns JSON structured evidence payload                          |
+-----------------------------------┬------------------------------------+
                                    │
                                    ▼
+------------------------------------------------------------------------+
| 4. Second LLM Inference Pass (Narrative Synthesis)                     |
|    - Model generates structured response grounded in facts             |
|    - Injects Citation & Confidence Tag: "verified_fact"                |
+------------------------------------------------------------------------+
```

### Approved Read-Only Copilot Tools:
1. `get_financial_summary`: Inflows, outflows, net cash flow, and account balances for a defined date window.
2. `get_category_breakdown`: Category-by-category expense distribution and percentage shares.
3. `compare_periods`: Mathematical comparison between two distinct time intervals (absolute difference & variance).
4. `get_budget_status`: Active envelope limit, actual cleared spending, and remaining delta.

---

## 6. Statistical Machine Learning Specifications

Following [ml-best-practices](file:///C:/Users/Gazi%20Faysal%20Jubayer/.gemini/config/skills/ml-best-practices/SKILL.md), all predictive and analytical computations are deterministic, reproducible, and private:

### 6.1 Cash-Flow Time-Series Forecasting
* **Objective:** Predict bank balance velocity and estimate financial runway over 30, 60, and 90 days.
* **Technique:** Double Exponential Smoothing (Holt's Linear Trend) with chronological train/validation splits:
  $$\ell_t = \alpha y_t + (1-\alpha)(\ell_{t-1} + b_{t-1})$$
  $$b_t = \beta(\ell_t - \ell_{t-1}) + (1-\beta)b_{t-1}$$
  $$\hat{y}_{t+h} = \ell_t + h \cdot b_t$$
* **Validation:** Computes Root Mean Squared Error (RMSE) against historical 30-day holdout windows.

### 6.2 Anomaly & Outlier Detection
* **Objective:** Identify billing anomalies, abnormal transaction spikes, and accidental subscription price increases.
* **Technique:** Robust Modified Z-Score using Median Absolute Deviation (MAD):
  $$\text{Modified Z-Score} = \frac{0.6745 \cdot (x_i - \tilde{x})}{\text{MAD}}$$
  Transactions with $|\text{Z-Score}| > 3.2$ are flagged with an investigation badge.

---

## 7. Step-by-Step Manual Setup Checklist

### Step 1: Provision Free PostgreSQL Database
1. Visit [Supabase](https://supabase.com) (or [Neon](https://neon.tech)).
2. Create a new free project titled `wealthpilot-db`.
3. Go to **Project Settings -> Database** and copy the Connection String (`Node.js / Prisma` mode).
4. Ensure SSL mode is enabled (`sslmode=require`).

### Step 2: Acquire Free Google Gemini API Key
1. Navigate to [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google account.
3. Click **Get API key** -> **Create API key in new project**.
4. Save the generated key as `GEMINI_API_KEY`.

### Step 3: Configure Local Environment
Create `.env` in `WealthPilot/`:
```bash
# Database
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres?sslmode=require"

# Authentication Security
NEXTAUTH_SECRET="generate-32-char-random-base64-secret"
NEXTAUTH_URL="http://localhost:3000"

# Free AI Integration
GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL="gemini-1.5-flash"

# Application Settings
NODE_ENV="development"
```

### Step 4: Install Dependencies & Run Database Migration
```bash
npm install prisma @prisma/client @google/genai zod bcryptjs next-auth@beta
npm install -D @types/bcryptjs
npx prisma init
npx prisma migrate dev --name init_fintech_schema
npx prisma generate
```

### Step 5: Verify Automated Security Hooks
Run the automated FinTech security scanner:
```bash
npm run check:security
```
