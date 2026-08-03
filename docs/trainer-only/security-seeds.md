# Security Seeds — Trainer Reference

Do not share this file with trainees before Workshop 8.

These vulnerabilities are intentionally seeded in the template to guarantee concrete findings during the AI-assisted security audit exercise. They are written to look like realistic developer shortcuts, not obvious planted bugs.

---

## Seed 1 — A03 Injection: Raw SQL with string interpolation

**File:** `api/src/routes/training-sessions.ts`
**Route:** `GET /api/training-sessions/search?q=<input>`

The search endpoint uses `prisma.$queryRawUnsafe` with the `q` query parameter interpolated directly into the SQL string. A request like:

```
GET /api/training-sessions/search?q=' OR '1'='1
```

returns all rows. A destructive payload like `'; DROP TABLE training_sessions; --` will fail on SQLite due to single-statement mode, but data exfiltration is fully exploitable.

**Expected fix:** Replace with `prisma.$queryRaw` using tagged template literals, or use `prisma.trainingSession.findMany({ where: { OR: [...] } })`.

---

## Seed 2 — A05 Misconfiguration: Stack trace in error response

**File:** `api/src/app.ts`
**Location:** Global error handler at the bottom of the file

The error handler always includes `stack: err.stack` and `error: err.message` in the JSON response body, regardless of `NODE_ENV`. Any unhandled exception (e.g., throwing inside a route handler) will expose the full Node.js stack trace to the client.

Demonstrate by triggering a 500:
```
GET /api/training-sessions/0  # causes Prisma to throw if DB is not seeded
```
Or throw deliberately in a test route during the workshop.

**Expected fix:** Wrap stack trace in `if (process.env.NODE_ENV !== 'production')` and return only a generic message in production.

---

## Seed 3 — A01 Broken Access Control: Unauthenticated admin endpoint

**File:** `api/src/routes/admin.ts`
**Route:** `GET /api/admin/sessions`

This route returns the full session list (including capacity and registered count) at an "admin" path with no authentication or authorisation check. The `// TODO: restrict to authenticated users` comment is intentional — it mirrors how such gaps appear in real codebases.

```
GET /api/admin/sessions  # returns all sessions with no credentials
```

**Expected fix:** Add an `authenticateAdmin` middleware, or at minimum a static API key check, before the route handler.

---

## Trivy

The Trivy CI job is disabled with `if: false` in `.github/workflows/security.yml`. The expected outcome when trainees re-enable it is **0 HIGH/CRITICAL findings** on the clean dependency tree. This contrast — "Trivy says clean, Claude found three real issues" — is the automation bias lesson.

Trainees re-enable Trivy by removing the `if: false` line during Workshop 8 Step 6 (Update `security.yml`).
