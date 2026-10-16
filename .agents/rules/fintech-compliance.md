# FinTech Compliance & Architecture Rules for WealthPilot

These rules apply across all coding, refactoring, and AI tasks in WealthPilot.

## 1. Single Source of Truth & Memory Protocol
- **MANDATORY:** Before writing or modifying any feature, check [PROJECT_MEMORY.md](file:///d:/%23%23%23Competetions/Shenzhen%20International%20FinTech%20Competition-2026/code/WealthPilot/PROJECT_MEMORY.md) to inspect what components are already completed and tested.
- Whenever a major milestone is completed, update `PROJECT_MEMORY.md` with the new completion state and any new ADRs.

## 2. Integer Minor-Unit Financial Arithmetic Standard
- Never use raw floating-point numbers for money arithmetic (e.g. `0.1 + 0.2`).
- All monetary values must be stored, computed, and transferred as **integer minor units** (`amountCents` / `poisha`) using `BigInt` or integer `number`.
- Convert to display currency only at the presentation boundary via `formatMoney(cents)`.

## 3. Multi-Tenant Authorization & BOLA Defense
- All backend routes, server actions, and AI tools must bind strictly to the authenticated `session.user.id`.
- Never trust a `userId` supplied in the client request body or URL parameters.

## 4. AI Copilot Grounding & Anti-Hallucination
- The AI model (Google Gemini Flash / Groq) is strictly a semantic narrator and classifier.
- Never let the model compute financial totals or execute raw database queries.
- All numbers must come from server-side deterministic functions (`get_financial_summary`, `get_category_breakdown`, `compare_periods`, `get_budget_status`).
- Always check `user.isAiEnabled` before firing external AI requests.

## 5. Security & Zero Secret Leaks
- Never commit real API keys (`GEMINI_API_KEY`, `DATABASE_URL`, `NEXTAUTH_SECRET`).
- Run `npm run check:security` before submitting code changes.
