# WorkshopHub

pnpm monorepo. Two packages:

- `api/` — Express + Prisma + SQLite, TypeScript. Routes in `api/src/routes`, business logic in `api/src/services`, Prisma client in `api/src/lib/prisma.ts`.
- `app/` — React + TypeScript frontend (Vite). Pages in `app/src/pages`, components in `app/src/components`.

Workspace filters: `@workshophub/api`, `@workshophub/app`.

## Commands

Run from repo root unless noted.

- `make setup` — install deps, generate Prisma client, push schema, seed DB
- `make dev` — run frontend + backend concurrently
- `make test` — run all tests (`pnpm run test`, API only today)
- `make test-unit` — API unit tests, no DB required
- `make lint` — ESLint, both packages
- `make format-check` — Prettier check, both packages
- `make build` — build both packages
- `make seed` / `make reset-db` — seed / reset SQLite DB
- `make smoke-test` — smoke test a running app
- `make security` — Gitleaks + Trivy local scan

## Team norms

- No `any`. Type everything properly — including Express `Request`/`Response` generics and Prisma return types.
- No Prisma calls in route handlers. Routes (`api/src/routes/*.ts`) only parse/validate input, call a service, shape the response. All `prisma.*` / `$queryRaw*` calls live in `api/src/services/*.ts`.
- All code must pass `make test` and `make lint` before it's considered done. Run both before saying a task is finished.

## MCP permissions

<!-- placeholder — document which MCP servers are approved for this repo and what each is allowed to do -->

## AGENT_BOUNDARY

<!-- placeholder — define may / must-ask / never for autonomous agent actions in this repo -->
