# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

BookEra is a booking/CRM platform for beauty & service businesses (salons, masters). Two apps in one repo: a FastAPI backend (repo root) and a Next.js frontend (`bookera-frontend/`). Code comments, log messages, API error `detail` strings and UI text are in Ukrainian — match that when adding user-facing text.

## Commands

### Backend (run from repo root, use `venv/`)
```bash
pip install -r requirements.txt -r requirements-dev.txt
docker compose up -d                       # local Postgres 15 + Redis (db: bookera_db / bookera_user)
alembic upgrade head                       # apply migrations (needs DATABASE_URL)
alembic revision --autogenerate -m "msg"  # new migration — ALWAYS hand-review the generated file
uvicorn main:app --reload                  # API on :8000
```
Tests need a real Postgres with `btree_gist` (the default URL in `tests/conftest.py` is `postgresql+asyncpg://postgres:postgres@localhost:5432/bookera_test`; the DB must already be migrated):
```bash
DATABASE_URL=postgresql+asyncpg://... pytest tests/ -v
DATABASE_URL=... pytest tests/test_slots.py::test_name -v   # single test
```
`conftest.py` TRUNCATEs a hard-coded list of tables before every test — when you add a table that tests write to, add it to that list. Tokens in tests are HS256 JWTs signed with `SUPABASE_JWT_SECRET` (`make_token` / `auth_headers` fixtures). `pytest.ini` uses `asyncio_mode = auto` (no `@pytest.mark.asyncio` needed) with a session-scoped loop.

### Frontend (`cd bookera-frontend`)
```bash
npm run dev          # :3000
npm run typecheck    # tsc --noEmit
npm run lint
npm run build        # runs tsc --noEmit first, then next build (output: 'standalone')
```
e2e tests: `npm run test:e2e` (Playwright, `bookera-frontend/e2e/`, desktop + mobile projects; starts its own `next dev` on :3100, or set `E2E_BASE_URL` to test a running server). Currently covers only the public storefront and does not need the backend or a login. After UI changes, use the `playwright-tester` subagent (`.claude/agents/playwright-tester.md`). Note `bookera-frontend/.github/workflows/playwright.yml` is not at the repo root, so GitHub does not run it.

### Environment
Backend `.env` (see `.env.example`, heavily commented) — required: `DATABASE_URL` (must be `postgresql+asyncpg://`, Supabase transaction pooler), `SUPABASE_URL`, `ALLOWED_ORIGINS`, `FRONTEND_URL`. Frontend `.env.local` (see `.env.example.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`. Without SMTP creds emails are only logged (`[Email Mock]`); without `WFP_*` keys subscription "pay" extends the subscription immediately.

## Backend architecture

- **Layering**: `app/api/` (routers) → `app/services/` (business logic) → `app/models/` (SQLAlchemy 2.0 async) with `app/schemas/` (Pydantic). `app/api/crm/` holds the owner/staff cabinet endpoints (`/crm/...`); the top-level `app/api/*.py` modules are public/marketplace, client wallet, master tools, etc. All routers are registered in `main.py` — a new router must be `include_router`'d there.
- **Schema is Alembic-only.** `main.py` does not `create_all`; at startup it only logs an error if `alembic_version` ≠ head. `init_db.py` is a stale pre-Alembic leftover — don't use it. Autogenerate can't see exclusion constraints (double-booking prevention relies on `btree_gist`), RLS, or triggers. `migrations/` only contains an archive of pre-Alembic SQL.
- **Auth** (`app/core/auth.py`): Supabase JWTs are verified server-side — first via JWKS (ES256/RS256, needs `SUPABASE_URL`), then HS256 fallback with `SUPABASE_JWT_SECRET`. The user's `role` comes from `user_metadata` in the token. Role strings are historically inconsistent (`business_owner`/`vendor`/`owner` all mean owner; `admin`; `master`/`staff`).
- **Access control is centralized** in `auth.py`: `assert_business_access` (any active staff + valid subscription), `assert_business_admin` (owner/admin only — money, payouts, staff, settings), `is_limited_to_own_schedule` (masters see only their own appointments/clients). The **subscription check lives inside `_get_access_level`**, so every CRM endpoint gets it for free — don't re-implement it per endpoint. `business_id` in path/query → `require_business_access` dependency; in body → call `assert_business_access` inside the handler.
- **Appointment status side effects go through `app/services/visit_hooks.on_status_change`** (platform commission + inventory write-off/revert). Status can change via the calendar endpoint, the CRM endpoint, and the auto-completion loop — all three must call this hook; don't duplicate the logic. Inventory consume/revert (`services/inventory.py`) is idempotent and computed from `InventoryMovement` net totals.
- **Background loop**: `services/reminders.reminder_loop` is started in the FastAPI lifespan and always runs hourly: sends 24h reminders (only if SMTP is configured) and auto-completes past appointments (which drives master payouts, so it must not depend on SMTP).
- **DB engine** (`app/core/database.py`): asyncpg behind pgbouncer, so prepared-statement caches are disabled; pooling is replaced by `NullPool` when `PYTEST_CURRENT_TEST` or `DISABLE_DB_POOL=1` (tests create a loop per test). Note `get_db` exists in both `database.py` and `app/api/deps.py`.
- **Errors**: global handlers in `main.py` map `IntegrityError` → 409, `SQLAlchemyError` → 503, validation errors → 422 with a human-readable `detail`; unhandled exceptions return a generic 500 (details only in logs).
- `services/business_profile.py` is the single place where the business type/category from registration turns into behavior (default slot step, visit duration, minimum advance booking). Put new type-dependent rules there, not in endpoints.
- **Radar (paid promotion) and storefront ranking live in `app/services/ranking.py`** — weights, packages/prices (7/14/30 days, paid by card via `create_payment_intent` or by points), `rank_score`, `grant_radar`. The storefront order lives in one pure, unit-tested function, `bookera-frontend/src/lib/storefront-sort.ts` (`npm run test:unit`): all three modes follow "closest to me" (Nearest = by distance; Cheapest/Recommended = first inside `nearby_radius_km`, then the rest, each block by its own rule; a scope switch "Спершу поруч / По всьому місту" removes the split). It must read every number from `GET /businesses/ranking-rules`, never duplicate them. Radar adds +20 to `rank_score` and a 2 km "bonus" in the nearest sort; boosted cards show "Реклама". Commission (`monetization.charge_commission_if_applicable`) is charged only for `source == "marketplace"` visits — Radar does not change it. Radar card payments are confirmed through the shared WayForPay callback (`rb-` order prefix → `complete_radar_payment`).
- **Analytics (`StatsTab`) is computed on the server in `app/services/analytics.py`** (`GET /crm/businesses/{id}/analytics`), never in the browser. Revenue = `Appointment.price` of completed visits (not the catalog price); profit = revenue − expenses dated up to today (no forecasts); clients are keyed like `client_stats` (client_id, else last 9 phone digits); new/returning use the whole visit history. A running period is compared with the same number of first days of the previous one. `businesses.monthly_revenue_goal` is a `deferred` column (migration `e8f9a0b1c2d3`) so an unmigrated DB does not break ordinary business queries.
- One-off maintenance scripts (coordinate backfill/checks, email check) live in `scripts/`.
- Other service modules: `monetization` (platform commissions/points), `payments` + `api/payments_wfp.py` (WayForPay), `subscription`, `geocoding` (Nominatim via httpx), `routing`, `bonuses`, `client_stats`, `audit`. Time helpers are in `app/core/time_utils.py`.

## Frontend architecture

- `bookera-frontend/CLAUDE.md` → `AGENTS.md` warns that this Next.js version has breaking changes: read the relevant guide in `bookera-frontend/node_modules/next/dist/docs/` before writing Next-specific code. `next dev` re-adds that block, so don't strip it from diffs.
- Next.js App Router (Next 16, React 19, Tailwind 4, shadcn/radix). Route groups: `(marketplace)` — public storefront, `[slug]` salon pages, account, booking management; `(business)` — business landing/registration, staff `invite`, and the main `cabinet` page.
- The cabinet UI is a set of tab components under `src/components/cabinet/` (Calendar, Clients, Services, Team, Inventory, Stats, Marketing, Settings, Storefront, Master*…); `components/profile/` is the end-client account (wallet, visits, work).
- **Auth is Supabase on the frontend** (`@supabase/ssr`, `src/middleware.ts` refreshes the session; `lib/supabase/`, `lib/auth-token-*.ts`), and the access token is sent as a Bearer token to the FastAPI backend. There are no Next.js API routes — all data comes from the FastAPI backend through `src/lib/api.ts` (also holds the shared TS types mirroring backend schemas; keep them in sync with `app/schemas/`).
- Role helpers live in `src/lib/roles.ts` (`isBusinessRole`, `isOwnerRole`, `roleLabel`) — use them instead of comparing role strings, mirroring the backend's multiple owner-role aliases.
- Project skills in `.claude/skills/`: use `supabase-postgres-best-practices` for migrations/RLS and `vercel-react-best-practices` for React/Next work.
