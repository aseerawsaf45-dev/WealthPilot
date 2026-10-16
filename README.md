# WealthPilot 🧭

**Sovereign Personal Wealth Workspace & Minor-Unit Precision Ledger**

WealthPilot is a private Next.js 16 application for personal finance tracking. In the current codebase, the main experience is rendered as a client-side React app (`src/app/page.tsx`) with data persisted in the browser (`localStorage`).

## Project Overview

- **Framework**: Next.js `16.4.2` (App Router)
- **UI**: React `19.3.0`, Tailwind CSS `4`, Lucide React icons
- **Data model**: Minor-unit integer accounting (for example cents/poisha) for ledger math
- **Storage model**: Local browser storage via `localStorage` (no backend API routes in `src/app/api`)

## Prerequisites

- **Node.js `>= 20.9.0`** (required by the locked Next.js dependency)
- **npm** (comes with Node.js)

Check your versions:

```bash
node -v
npm -v
```

If your Node.js version is older than `20.9.0`, upgrade Node before installing dependencies.

## Run Locally

```bash
git clone https://github.com/aseerawsaf45-dev/WealthPilot.git
cd WealthPilot
npm ci
npm run dev
```

Then open: [http://localhost:3000](http://localhost:3000)

> Prefer `npm ci` for reproducible installs (lockfile-based). Use `npm install` only if you intentionally need a fresh dependency resolution.

## Available Scripts

- `npm run dev` — start the development server
- `npm run build` — create a production build
- `npm run start` — run the production server (after `npm run build`)
- `npm run lint` — run ESLint
- `npm run test` — run Vitest (`vitest run`)

## Production Build (Local)

```bash
npm run build
npm run start
```

Then open: [http://localhost:3000](http://localhost:3000)

## App Navigation / Usage Flow

The app uses a single route (`/`) and switches views using URL hash state:

- `/#landing` — marketing/intro landing experience
- `/#app` — interactive ledger workspace

From the app workspace, use the top navigation to switch between:

- Overview
- Transactions
- Accounts
- Budgets
- Goals
- Bills
- Debt Planner
- Learn
- Import
- Settings

Quick actions:

- **Record** button (or keyboard **N**) opens the quick transaction modal.
- Number keys `1..0` map to tabs (`1` Overview ... `0` Settings).

## Troubleshooting

- **Install errors / engine mismatch**
  - Confirm Node.js is `>= 20.9.0`.
  - Remove `node_modules` and reinstall:
    ```bash
    rm -rf node_modules
    npm ci
    ```

- **Port 3000 already in use**
  - Run on another port:
    ```bash
    npm run dev -- --port 3001
    ```
  - Open [http://localhost:3001](http://localhost:3001)

- **Stale or unexpected local data**
  - The app persists data in `localStorage` (keys prefixed with `wealthpilot_v1_`).
  - Clear site storage in your browser devtools, then reload.

- **Production mode sanity check**
  - Ensure `npm run build` succeeds before `npm run start`.

## Security & Privacy Note

This project is designed for personal finance tracking workflows and local experimentation. It should not be treated as financial, investment, tax, or legal advice.

Based on the current repository structure, user ledger state is handled in-browser and persisted locally. Review the source before using with sensitive real-world data.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

© 2026 WealthPilot
