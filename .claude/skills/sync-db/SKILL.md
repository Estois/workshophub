---
name: sync-db
description: Sync the local SQLite dev DB to the current branch's Prisma schema after a branch switch (e.g. between spdd-wh-2-wh-3, which has the Registration model, and main/ui branches, which don't). Tries a safe `prisma db push` first; if that would drop data, warns and asks before force-resetting + reseeding. Use after "switch branch", "checkout", "pull from main", or when `make dev`/tests fail with a Prisma schema-mismatch or missing-table error.
---

# sync-db

The dev SQLite DB file (`api/database/workshophub.sqlite`) is shared across worktrees/branches in this repo. Different branches have different `api/prisma/schema.prisma` contents (e.g. `spdd-wh-2-wh-3` has a `Registration` model; `main` and UI-only branches don't). Switching branches does **not** touch the DB file, so it can silently hold the wrong shape — leading to confusing Prisma errors or failing tests that have nothing to do with the code change at hand.

This skill brings the DB back in sync with whichever schema is currently checked out, without silently destroying data.

## When to run this

- Right after `git checkout`/`git switch` to a different branch, before `make dev` or running tests.
- When `pnpm run test`, `make dev`, or a Prisma call fails with something like `Unknown argument`, `does not exist in the current database`, or a schema-mismatch error from `prisma db push`.

## Steps

1. **Confirm which branch/schema is active**: `git branch --show-current` and skim `api/prisma/schema.prisma` for the model list, so you can tell the user what you're syncing *to*.

2. **Try a non-destructive push first**:
   ```
   cd api && pnpm exec prisma db push
   ```
   - If it succeeds (including "already in sync"), you're done — report that and stop. No data was touched.

3. **If it reports data loss** (e.g. "You are about to drop the `X` table" / "not possible to execute this step"):
   - Read the warning output and summarize concretely what will be lost (table name, row count, any column being dropped) — don't just say "some data."
   - **Stop and ask the user** (AskUserQuestion or a direct question) whether to proceed with a destructive sync. Default recommendation: yes, since this is a local dev DB seeded from `prisma/seed.ts` and not a source of truth — but always ask, never assume.
   - Only on explicit confirmation, run:
     ```
     cd api && pnpm exec prisma db push --force-reset
     ```
   - Then reseed: `make seed` (equivalently `cd api && pnpm exec prisma db seed`).

4. **Report the result**: which path was taken (safe push vs. force-reset+seed), and the current row counts for key tables if easy to check (e.g. `prisma.trainingSession.count()`), so the user knows what state the DB is in.

## Guardrails

- Never run `--force-reset` without an explicit yes from the user in that turn — not from a prior turn, not inferred from "just fix it."
- Never run this against anything other than the local dev SQLite file (`DATABASE_URL` from `.env`, not a prod/CI database) — check `api/.env` if unsure before proceeding.
- Don't silently swallow the "already in sync" case as a no-op without telling the user — a one-line confirmation is enough.
- If `make dev` or test servers are currently running against the DB file, mention that force-reset will wipe their in-memory assumptions (restart recommended) rather than assuming the user already knows.
