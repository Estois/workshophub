---
allowed-tools: Bash(bash scripts/no-prisma-in-routes.sh:*), Bash(bash scripts/no-raw-sql.sh:*), Read
description: Check that route handlers don't call Prisma directly or use raw SQL, enforcing the service-layer boundary
---

# api-layer

1. Run `bash scripts/no-prisma-in-routes.sh` and `bash scripts/no-raw-sql.sh`.
2. If both pass, report that the route -> service -> prisma layering is intact.
3. If either fails, read the flagged file(s) and explain specifically what to move into a service function (or, if the file is `api/src/routes/admin.ts` / `api/src/routes/training-sessions.ts`, note that CLAUDE.md marks these as intentionally seeded vulnerabilities — don't suggest fixing them unless the user explicitly asks to address that specific seed).
4. Do not edit files automatically — report findings and let the user decide whether to fix now or later.
