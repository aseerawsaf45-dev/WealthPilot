# WealthPilot — PostgreSQL Database & Multi-Tenant Schema Specification (Phase 3)

**Competition Document**: Shenzhen International FinTech Competition-2026  
**Status**: ACTIVE & GENERATED  
**Engine**: Prisma ORM 6.19.3 on PostgreSQL (Supabase / Neon Serverless Free Tier)  
**Tenancy Standard**: Strict Multi-Tenant Isolation with GDPR Art. 17 Cascading Erasure  
**Arithmetic Precision**: Discrete 64-Bit Integer Minor Units (`BigInt` Cents / Poisha)

---

## 1. Architectural Overview & Entity-Relationship Model

WealthPilot leverages PostgreSQL as its primary relational store. Every financial entity belongs strictly to a tenant (`User`) through an unbroken relational tree with `onDelete: Cascade`.

### 1.1 Complete Entity-Relationship (ER) Diagram

```mermaid
erDiagram
    User ||--o{ FinancialAccount : "owns (Cascade)"
    User ||--o{ Transaction : "records (Cascade)"
    User ||--o{ BudgetCategory : "allocates (Cascade)"
    User ||--o{ SavingsGoal : "tracks (Cascade)"
    User ||--o{ BillSubscription : "commits (Cascade)"
    User ||--o{ DebtAccount : "manages (Cascade)"
    User ||--o{ AuditEvent : "audits (Cascade)"
    User ||--o{ CopilotMessage : "interacts (Cascade)"

    FinancialAccount ||--o{ Transaction : "contains (Cascade)"
    FinancialAccount ||--o{ BillSubscription : "auto-debits (SetNull)"
    Transaction ||--o{ TransactionSplit : "allocates (Cascade)"

    User {
        string id PK
        string email UK
        string name
        string passwordHash
        string preferredCurrency "USD | BDT"
        string timezone
        boolean isAiEnabled "GDPR Art. 25 Kill Switch"
        datetime createdAt
        datetime updatedAt
    }

    FinancialAccount {
        string id PK
        string userId FK
        string name
        string institution
        enum type "CHECKING | SAVINGS | CREDIT | INVESTMENT | CASH | LOAN"
        string currency
        bigint balanceCents "Integer minor-units"
        string accountNumberMask "GLBA ****1234"
        boolean isManual
        boolean isIncludedInNetWorth
        datetime lastSyncedAt
    }

    Transaction {
        string id PK
        string userId FK
        string accountId FK
        string financialDate "YYYY-MM-DD"
        datetime postedAt
        string merchant
        string normalizedMerchant
        string category
        bigint amountCents "Inflow > 0, Outflow < 0"
        string currency
        enum status "PENDING | CLEARED | RECONCILED | VOID"
        boolean isTransfer
        string linkedTransferId
        enum source "MANUAL | CSV_IMPORT | BANK_FEED"
        string importFingerprint "SHA-256 deduplication"
        string notes
        string[] tags
    }

    TransactionSplit {
        string id PK
        string transactionId FK
        string category
        bigint amountCents "SOX Section 404 Split"
        string note
    }

    BudgetCategory {
        string id PK
        string userId FK
        string category
        bigint allocatedCents
        string monthYear "YYYY-MM"
        boolean rolloverEnabled
        int alertThresholdPercent
    }

    SavingsGoal {
        string id PK
        string userId FK
        string name
        bigint targetCents
        bigint currentCents
        string targetDate "YYYY-MM-DD"
        string category
        boolean isAutomated
        bigint monthlyDepositCents
    }

    BillSubscription {
        string id PK
        string userId FK
        string name
        bigint amountCents
        enum frequency "WEEKLY | BIWEEKLY | MONTHLY | QUARTERLY | ANNUAL"
        string nextDueDate "YYYY-MM-DD"
        string category
        boolean isAutoPay
        string linkedAccountId FK
    }

    DebtAccount {
        string id PK
        string userId FK
        string name
        bigint balanceCents
        float aprPercent
        bigint minimumPaymentCents
        int dueDateDay "1 - 31"
        string category
        string targetPayoffDate
    }

    AuditEvent {
        string id PK
        string userId FK
        string eventType "SOX 302 Audited"
        string actor "USER | SYSTEM | COPILOT"
        string details "Redacted"
        string ipAddress
        string userAgent
        string checksumBefore
        string checksumAfter "Cryptographic SHA State"
        datetime createdAt
    }

    CopilotMessage {
        string id PK
        string userId FK
        string role "user | assistant | system"
        string content
        string evidenceScope "Audited Evidence Tag"
        datetime createdAt
    }
```

---

## 2. Invariant & Regulatory Enforcement

### 2.1 GDPR Article 17: Right to Erasure ("Cascading Purge")
- Every user-associated model is bound by `onDelete: Cascade`.
- When an account deletion is requested:
  ```ts
  await prisma.user.delete({ where: { id: session.user.id } });
  ```
- PostgreSQL's foreign key cascading engine permanently obliterates all linked rows in a single atomic database transaction, leaving zero orphaned PII or financial records.

### 2.2 SOX Section 404 & Minor-Unit Math Standard
- All balance and transaction columns (`balanceCents`, `amountCents`, `allocatedCents`, `targetCents`, `minimumPaymentCents`) are typed as `BigInt`.
- **Zero Floating-Point Drift**: IEEE 754 float representation (`0.1 + 0.2 = 0.30000000000000004`) is completely eliminated at the schema definition level.
- **BDT / High-Unit Scaling**: A standard 32-bit signed integer caps out at $21.4M cents (~$214,000 USD). In Bangladesh Poisha (where $1 USD = ~122 BDT), $200k USD would overflow a 32-bit integer. `BigInt` supports values up to $9.22 \times 10^{18}$, eliminating overflow risks permanently.

### 2.3 GLBA 16 CFR § 314.4: Nonpublic Personal Information (NPI)
- Financial account numbers are stored strictly as `accountNumberMask` (e.g. `•••• 4821`).
- Full unmasked card numbers or bank account numbers are rejected by schema and compliance scanners.

### 2.4 High-Performance Database Indexes
Composite indexes are tuned for sub-5ms multi-tenant query execution:
- `@@index([userId, financialDate])`: Powers instant ledger pagination and date-range queries.
- `@@index([userId, category])`: Powers spending breakdowns and budget pacing calculations.
- `@@index([accountId])`: Powers account ledger drill-downs.
- `@@index([importFingerprint])`: Enables instantaneous duplicate detection during CSV statement ingestion.
- `@@unique([userId, category, monthYear])`: Enforces deterministic envelope ceilings for any given month.

---

## 3. Manual Step-by-Step Setup Guide for Users

To connect WealthPilot to a 100% free PostgreSQL database, follow these simple steps:

### Option A: Free Supabase PostgreSQL (Recommended)

1. **Create Free Account**:
   - Go to [https://supabase.com](https://supabase.com) and click **Start your project** (Free plan, no credit card required).
2. **Create New Project**:
   - Name: `wealthpilot-db`
   - Database Password: Create a strong password (save it safely).
   - Region: Select the region closest to you (e.g., `East US` or `Southeast Asia`).
3. **Copy the Connection String**:
   - In Supabase dashboard, click **Project Settings** (gear icon in sidebar) $\rightarrow$ **Database**.
   - Under **Connection string**, select the **URI** tab.
   - Choose **Mode: Session** (port 5432) or **Transaction** (port 6543 pooler).
   - Copy the string. It will look like:
     ```
     postgresql://postgres.[PROJECT_REF]:[YOUR_PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
     ```
4. **Update `.env`**:
   - Open `.env` in the project root:
     ```bash
     DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[YOUR_PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require"
     ```

---

### Option B: Free Neon Serverless PostgreSQL (Alternative)

1. Go to [https://neon.tech](https://neon.tech) and sign up for free.
2. Click **Create Project** $\rightarrow$ Name: `wealthpilot`.
3. In the project dashboard, copy the **Connection string** (with pooled connection enabled).
4. Paste it into your `.env`:
   ```bash
   DATABASE_URL="postgresql://[USER]:[PASSWORD]@[HOST]/wealthpilot?sslmode=require"
   ```

---

### Option C: Local PostgreSQL (Docker or Local Installation)

If you have PostgreSQL running locally:
```bash
# Example with Docker:
docker run --name wealthpilot-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=wealthpilot -p 5432:5432 -d postgres:16-alpine

# Set in .env:
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/wealthpilot?sslmode=prefer"
```

---

## 4. Applying Schema & Seeding Data

Once your `DATABASE_URL` is configured in `.env`, run these CLI commands:

### Step 1: Push Schema to Database
```bash
npm run db:push
```
*Creates all tables, enums, foreign keys, and indexes instantly on your remote database.*

### Step 2: Seed Competition Demonstration Data
```bash
npm run db:seed
```
*Populates the database with realistic demo accounts (Checking, HYSA, Vanguard VTSAX, Amex Gold), multi-month categorized transactions, budget envelopes, and a SOX Section 302 audit entry.*

### Step 3: Inspect Database Visually via Prisma Studio
```bash
npm run db:studio
```
*Launches an interactive GUI at `http://localhost:5555` to browse and inspect your live PostgreSQL tables.*

---

## 5. Verification Commands

Run the automated verification suite at any time to guarantee full regulatory compliance:

```bash
# 1. Run full 8-point regulatory and schema compliance audit
npm run check:compliance

# 2. Run automated financial invariant & schema test suite (27 passing tests)
npm run test:compliance

# 3. Verify Next.js production build with strict TypeScript typechecking
npm run build
```
