# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# WorkshopHub

Internal training registration system (employees browse/register for training sessions). This repo is the **baseline template for a 3-day AI-assisted delivery training** — several features are intentionally unimplemented as trainee exercises (see below), and some intentional vulnerabilities are seeded for later workshops.

pnpm monorepo, two packages:

- `api/` — Express + Prisma + SQLite, TypeScript. Entry `api/src/server.ts` → `api/src/app.ts`. Routes in `api/src/routes`, business logic in `api/src/services`, Prisma client singleton in `api/src/lib/prisma.ts`.
- `app/` — React 18 + TypeScript frontend (Vite 5). Pages in `app/src/pages`, components in `app/src/components`, shared types in `app/src/types`.

Workspace filters: `@workshophub/api`, `@workshophub/app`.

## Commands

Run from repo root unless noted. `make` wraps `pnpm` — prefer `make` targets.

- `make setup` — install deps, generate Prisma client, push schema, seed DB (copies `.env.example` → `.env` if missing)
- `make dev` — frontend (`:5173`) + backend (`:3001`) concurrently
- `make test` — all tests (`pnpm run test`, API only today — uses a real SQLite DB, not mocked)
- `make test-unit` — API unit tests only, no DB required
- `make lint` — ESLint, both packages
- `make format-check` — Prettier check, both packages
- `make build` — build both packages
- `make seed` / `make reset-db` — seed / force-reset + reseed SQLite DB
- `make smoke-test` — curl-based checks against a running app (health, list, single, 404)
- `make security` — Gitleaks + Trivy local scan (both disabled in CI; trainees re-enable in Workshop 8)
- `make prod-up` / `make prod-down` / `make prod-logs` — Docker Compose prod-like env on `:8080`

Single test / one file, run inside `api/`:
- `pnpm exec jest tests/integration/training-sessions.test.ts`
- `pnpm exec jest -t 'returns 404 when session does not exist'`
- `pnpm run test:unit` / `pnpm run test:integration` — filters by `tests/unit` or `tests/integration` path

Jest config (`api/jest.config.js`) loads `api/tests/setup.ts` before every suite, which sets `DATABASE_URL`/`NODE_ENV=test`. Integration tests (`api/tests/integration/*`) hit the real SQLite DB via `supertest(app)` — no mocking layer. Unit tests (`api/tests/unit/*`) exercise the service layer directly.

## Architecture notes

- **Request flow**: `server.ts` loads env and starts `app.ts`'s Express app. `app.ts` mounts `/health`, `/api/training-sessions`, `/api/admin`, then (if `app/dist` exists) serves the built frontend as static files with an SPA catch-all — this is how the Docker prod image serves both frontend and API from one process/port.
- **Routes → services → Prisma**: the intended layering is route handler → service function (`api/src/services/*Service.ts`) → `prisma` singleton from `lib/prisma.ts`. `trainingSessionService.ts` follows this. `routes/training-sessions.ts` (a raw SQL `/search` endpoint) and `routes/admin.ts` (unauthenticated, instantiates its own `PrismaClient`) currently violate it — these are seeded intentionally for later security workshops, not accidental; don't "clean them up" without being asked.
- **Global error handler** in `app.ts` returns `err.stack` in the JSON response body — also intentional seed state, same caveat.
- **Vite dev proxy**: `app/vite.config.ts` proxies `/api` and `/health` to `VITE_API_URL` (default `http://localhost:3001`), so the frontend never hardcodes the API origin. `host: true` so Docker port publishing can reach the dev server.
- **DB**: SQLite file, path from `DATABASE_URL` (dev: `file:../database/workshophub.sqlite`, prod: set in compose to `file:/app/api/database/workshophub.sqlite`). No migrations — schema changes go live via `prisma db push` (dev) or automatically on container start in prod (`docker-entrypoint.sh`), which preserves existing data for additive changes.
- **Docker**: multi-stage build (deps → builder → runner); `docker-entrypoint.sh` runs `prisma db push` then starts the server, so prod schema updates need no manual migration step.

## Team norms

- No `any`. Type everything properly — including Express `Request`/`Response` generics and Prisma return types.
- No Prisma calls in route handlers. Routes (`api/src/routes/*.ts`) only parse/validate input, call a service, shape the response. All `prisma.*` / `$queryRaw*` calls live in `api/src/services/*.ts`.
- All code must pass `make test` and `make lint` before it's considered done. Run both before saying a task is finished.

## Trainee exercise features (not implemented)

Intentionally missing, to be built during the training: employee registration for a session, duplicate-registration prevention, waitlist when full, cancellation, waitlist promotion after cancellation, organiser view of registrations, registration deadline enforcement, notification on registration/promotion, audit log for registration state changes.

## MCP permissions

<!-- placeholder — document which MCP servers are approved for this repo and what each is allowed to do -->

## AGENT_BOUNDARY

<!-- placeholder — define may / must-ask / never for autonomous agent actions in this repo -->
