# WealthPilot 🧭
**Sovereign Personal Wealth Workspace & Minor-Unit Precision Ledger**

WealthPilot is a privacy-first personal finance workspace built with Next.js App Router and a server-backed PostgreSQL ledger. It combines deterministic minor-unit accounting, authenticated multi-tenant APIs, and optional AI assistance with strict data controls.

---

## ✨ Key Architectural Highlights

- **Minor-Unit Integer Accounting**: Monetary values are stored and computed as integer minor units (`BigInt` cents/poisha) to avoid floating-point drift.
- **Server-Backed Security Model**: Wealth data is stored in PostgreSQL via Prisma, with session-scoped server APIs and audited mutations.
- **Privacy-First UX**: Demo mode can run locally in-browser, while authenticated usage persists securely to the backend.
- **Verified Regional Perks**: Dual-region merchant discounting with transparent verification links (Bangladesh `৳ BDT` & Global `$` markets).
- **Self-Finance Learning Academy**: Gamified modules with scenario simulations, streaks, and XP progression.
- **Formula-Injection Safe CSV Engine**: Neutralizes dangerous spreadsheet prefixes (`=`, `+`, `-`, `@`) on import/export.

---

## 🛠️ Technology Stack

- **Framework**: [Next.js 16.4.2](https://nextjs.org/) (App Router)
- **Frontend**: [React 19.3.0](https://react.dev/), TypeScript
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Database**: PostgreSQL (Neon recommended) + Prisma 6.19.3
- **Validation**: Zod v4

---

## ✅ Prerequisites

- **Node.js + npm** (current LTS recommended)
- **PostgreSQL-compatible database** (Neon recommended)
- **AI provider API keys (optional)** only if you enable AI features (`GROQ_API_KEY` and/or `GEMINI_API_KEY`)

---

## 🔐 Environment Setup

1. Copy the template:

   ```bash
   cp .env.example .env
   ```

2. Fill all required values in `.env`:

   - `DATABASE_URL` (pooled runtime URL)
   - `DATABASE_URL_UNPOOLED` (direct/unpooled URL for Prisma migrations)
   - `SESSION_SECRET`
   - `AUDIT_PEPPER`
   - `APP_URL` (for local dev: `http://localhost:3000`)

3. Generate secure secrets (run twice, use different values):

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

4. Optional AI variables (only if enabling AI):

   - `GEMINI_API_KEY`, `GEMINI_MODEL`
   - `GROQ_API_KEY`, `GROQ_MODEL`

5. Never commit `.env` or real secrets.

---

## 🚀 Local Development Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Generate Prisma client (also done by `postinstall`, but safe to run explicitly):

   ```bash
   npm run db:generate
   ```

3. Apply development migrations:

   ```bash
   npm run db:migrate
   ```

4. (Optional) Seed sample data:

   ```bash
   npm run db:seed
   ```

5. Start dev server:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000).

### Development vs Production-Safe DB Commands

- `npm run db:migrate` (`prisma migrate dev`) is for development workflows.
- `npm run db:push` is useful for rapid local prototyping but **not recommended for shared production databases**.
- For production/staging, use committed migrations with:

  ```bash
  npx prisma migrate deploy
  ```

---

## ▲ Deploying to Vercel

1. Import `aseerawsaf45-dev/WealthPilot` into Vercel.
2. In Project Settings:
   - **Framework Preset**: Next.js
   - **Install Command**: `npm install`
   - **Build Command**: `npm run build`
   - **Output Directory**: leave default for Next.js (do not use static export output)
3. Configure environment variables in Vercel (Production, and Preview if needed):
   - Required: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `SESSION_SECRET`, `AUDIT_PEPPER`, `APP_URL`
   - Optional AI: `GEMINI_API_KEY`, `GEMINI_MODEL`, `GROQ_API_KEY`, `GROQ_MODEL`
   - Optional infra/context: `NEON_BRANCH`, `PORT`
4. Database URL mapping:
   - `DATABASE_URL` = pooled production URL
   - `DATABASE_URL_UNPOOLED` = direct/unpooled production URL
5. Run production-safe migrations (`npx prisma migrate deploy`) before or as part of your deployment pipeline. Do **not** assume Vercel runs Prisma migrations automatically.
6. Set `APP_URL` to your deployed HTTPS origin (for example `https://your-app.vercel.app`).
7. If environment variables change, trigger a redeploy.

> Note: `npm run build` and `npm run start` use `scripts/next-prod.mjs`, which forces `NODE_ENV=production` to avoid host misconfiguration issues.

---

## 🖥️ Deploying to Generic Node.js Hosts (VPS / Hostinger / similar)

Your host must support a long-running Node.js process. WealthPilot is a server-rendered Next.js app and should **not** be deployed as a static export.

1. Provision Node.js and a PostgreSQL-compatible database.
2. Upload code and set environment variables (`.env` or host panel secrets).
3. Install dependencies:

   ```bash
   npm install
   ```

4. Apply migrations safely:

   ```bash
   npx prisma migrate deploy
   ```

5. Build:

   ```bash
   npm run build
   ```

6. Start app:

   ```bash
   npm run start
   ```

Use a process manager (for example PM2/systemd) and a reverse proxy/TLS setup in front of the Node process.

---

## ✅ Post-Deployment Checklist

- App loads successfully over HTTPS (no 500 on initial page load).
- Sign-in works and sessions persist across page refresh.
- Authenticated actions read/write the production database correctly.
- AI behavior matches configuration (disabled by default unless user opts in and keys are configured).
- Runtime/build logs show no Prisma connection or migration errors.
- Security checks run in CI/local (`npm run check:security`) and pass.

---

## 🧯 Troubleshooting Deployment Issues

- **Missing env vars / auth failures**: Ensure `SESSION_SECRET`, `AUDIT_PEPPER`, `APP_URL`, `DATABASE_URL`, and `DATABASE_URL_UNPOOLED` are all set in the target environment.
- **Prisma migration/connection errors**: Verify pooled URL is in `DATABASE_URL`, direct URL is in `DATABASE_URL_UNPOOLED`, and run `npx prisma migrate deploy` against the correct database.
- **`NODE_ENV=development` during build**: Do not force `NODE_ENV` in host env settings. Use `npm run build` (which uses `scripts/next-prod.mjs` and forces production mode).
- **Incorrect origin/cookie/session behavior**: Set `APP_URL` to the exact deployed HTTPS origin and redeploy after updating env vars.

---

## 🧪 Quality & Security Commands

```bash
npm test
npx tsc --noEmit
npm run check:security
```

---

## 📚 Architectural & Engineering Documentation

- 📋 **[BACKEND_AND_AI_PLAN.md](./BACKEND_AND_AI_PLAN.md)**: Backend system design, REST endpoint contracts, AI integration plan, ML roadmap, and compliance protocols.
- 🧠 **[PROJECT_MEMORY.md](./PROJECT_MEMORY.md)**: Live source-of-truth for completed modules, ADRs, and pending milestones.
- 📐 **[docs/API_AND_MACHINE_LEARNING_SPECIFICATION.md](./docs/API_AND_MACHINE_LEARNING_SPECIFICATION.md)**: Detailed specification for APIs, feature extractors, and deterministic ledger pipelines.

---

## 🔒 Security & Privacy Architecture

WealthPilot is engineered under strict FinTech data governance standards:
- **Session-Scoped Multi-Tenancy:** Server queries are scoped to the authenticated session user.
- **Formula-Injection Neutralized:** Import/export guards against spreadsheet formula injection (`=`, `+`, `-`, `@`).
- **AI Privacy Controls:** AI is opt-in with provider/region controls and deterministic server-side financial computation.
- **Grounded Tool Calling:** AI never executes direct SQL and does not independently compute ledger totals.

*Disclaimer: WealthPilot is a personal financial calculation workspace and self-directed wellness tool, not a licensed broker-dealer or registered financial advisor.*

---

© 2026 WealthPilot. Built for the Shenzhen International FinTech Competition.
