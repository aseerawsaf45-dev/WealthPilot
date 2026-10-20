# Deployment Guide

This guide deploys WealthPilot to **Hostinger (Node.js hosting)** with **Neon Postgres**, the setup used in production. The same steps work on any Node.js host.

## 1. Prerequisites

| Need | Notes |
|---|---|
| Node.js 20+ | Tested on 24.12 |
| A Neon project | Free tier is enough. Use the **main branch for production** and **a separate branch for every test** |
| A Hostinger Node.js website (or any Node host) | Build command `npm run build`, start command `npm start` |
| Optional: Groq API key | Enables AI-worded answers; enable Zero Data Retention in Groq settings |
| Optional: Gemini API key | Backup model; never used for users in the EEA, UK, Switzerland or China |

## 2. Environment variables

Set these in the host's environment settings, **never in a committed file**. Names come from `.env.example`.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Neon **pooled** connection string (runtime) |
| `DATABASE_URL_UNPOOLED` | yes | Neon **direct** connection string (migrations) |
| `SESSION_SECRET` | yes | ≥ 32 bytes; signs session cookies. The app refuses to sign sessions without it |
| `AUDIT_PEPPER` | yes | ≥ 16 characters; keys the rate-limit and erasure-receipt hashes |
| `APP_URL` | yes | Public https origin, e.g. `https://your-domain`; used by the CSRF origin check |
| `ADMIN_EMAILS` | for the Admin tab | Comma-separated emails that may manage partner offers |
| `GROQ_API_KEY`, `GROQ_MODEL` | optional | Primary AI provider |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | optional | Backup AI provider |
| `NEON_BRANCH` | optional | Label only |
| `PORT` | host-dependent | Port the server listens on |

**Do not set `NODE_ENV`.** `scripts/next-prod.mjs` forces `production` for build and start. Hosts that inject `NODE_ENV=development` would otherwise mix React builds and crash prerendering.

Generate secrets (a different value per environment):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## 3. Database

1. In Neon, copy the pooled and direct connection strings of the **main** branch into `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
2. Apply the migrations (9, all additive). From a machine with those variables set:

   ```bash
   npx prisma migrate deploy
   ```

3. Rehearse first: create a Neon branch from main, point the variables at the branch, run `migrate deploy` and the integration tests there, then run it on main.
4. Never run `prisma migrate reset`, `db push --force-reset` or `--accept-data-loss` against production.

## 4. Deploy on Hostinger

1. Connect the GitHub repository (or upload the project) to a Node.js website.
2. Build command: `npm run build`. Start command: `npm start`. Node version: 20 or newer.
3. Add the environment variables from §2 and save. Next.js reads server variables at runtime, but rebuild after changing any of them to be safe.
4. Deploy, then open `https://your-domain/api/v1/health`. The expected answer is `{"success":true,"data":{"db":"ok","latencyMs":…}}`.
5. Sign up, set your country in Settings, and check that the Overview loads.

The build is tuned for shared hosts:
- `next.config.ts` limits build workers (`NEXT_CPUS`, default 2), and `next-prod.mjs` caps Rayon and Tokio threads, so many-core hosts do not hit process limits.
- Fonts are self-hosted, so builds need no network access to Google Fonts.
- The on-device readers are copied to `public/vendor` at install (`postinstall`). Worker files use `.js` because some hosts serve `.mjs` as text.

## 5. Optional content

| Task | Command |
|---|---|
| Load clearly labelled sample partner offers | `APP_URL=https://your-domain npx tsx scripts/seed-sample-offers.mts` |
| Remove the samples | `npx tsx scripts/seed-sample-offers.mts --remove` |
| Refresh the bundled bank list (about 10 minutes) | `npx tsx scripts/fetch-banks.mts` (`--thin` only refreshes countries with fewer than 5 banks) |
| Become an admin | Add your email to `ADMIN_EMAILS` and restart; the Admin tab appears under **More** |

## 6. Verify a deployment

```bash
curl -s https://your-domain/api/v1/health
BASE_URL=https://your-STAGING-domain DATABASE_URL=<that staging branch> SANDBOX_LABEL=staging npx tsx scripts/sandbox-run.mts
```

The sandbox run creates and deletes two fictional users. Run it only against a **staging** deployment that uses a Neon test branch, never production.

## 7. Rollback

- **Application:** redeploy the previous commit. Migrations are additive (new tables and nullable columns), so older code keeps working with a newer schema.
- **Data:** Neon point-in-time restore, or restore a branch from a snapshot.

## 8. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `Too many attempts` on sign-up for everyone | Off Vercel, the IP-based limit is shared by all visitors (known risk #1 in the technical documentation). Wait an hour, or clear `signup:%` rows in `rate_limit_buckets` |
| `The database connection was reset (it was idle)` | Neon scaled to zero (`P1017`); the next request reconnects |
| PDF import fails with a worker error | `public/vendor` missing: run `npm install` (postinstall copies the workers) |
| Build crashes with `os error 11` / `SIGABRT` | Too many threads on a many-core host: keep `NEXT_CPUS` at 2 |
| `Cross-site request blocked` | `APP_URL` does not match the domain in the browser |
| Investment plans fail to load after deploying new code | Migrations not applied: run `npx prisma migrate deploy` |
