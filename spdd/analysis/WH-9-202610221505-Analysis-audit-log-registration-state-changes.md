# SPDD Analysis: Audit Log for Registration State Changes

## Original Business Requirement

# WH-9: Audit log for registration state changes

**Type:** Story
**Status:** To Do
**Priority:** Medium
**Issue:** https://github.com/Estois/workshophub/issues/15

## Context

For compliance and debugging, every state change to a registration should be recorded. An audit log captures who did what and when, and provides a full history for each registration lifecycle.

This is a **trainee exercise story**. It is not implemented in the baseline template.

## Description

As a training organiser, I want an audit log of every state change to a registration so that I can trace the full history of a registration for reporting or dispute resolution.

Each state change (registered, waitlisted, promoted, cancelled) creates an immutable audit log entry. The organiser queries the audit log via the API.

## Acceptance Criteria

### Organiser workflow
- The organiser opens the session registrations page (WH-6) and identifies the registration ID they want to investigate
- The organiser calls `GET /api/training-sessions/:id/registrations/:registrationId/audit` to see the full state history
- The response shows a time-ordered list of transitions, e.g.: `null → confirmed` (registered), `confirmed → cancelled` (cancelled), and for a different registration: `null → waitlisted` then `waitlisted → confirmed` (promoted)
- This gives the organiser a complete picture of every state a registration has been through

### Data and API behaviour
- An `AuditLog` table is created with: id, registrationId, fromStatus, toStatus, changedAt, reason (optional string)
- Every registration state change creates an audit log entry atomically within the same transaction
- `GET /api/training-sessions/:id/registrations/:registrationId/audit` returns the full audit history in chronological order
- Audit entries are immutable: they cannot be updated or deleted via the API
- Returns HTTP 404 if the registration does not exist
- The audit log captures all transitions: initial registration, promotion, cancellation

## Out of Scope
- User identity / actor tracking (no auth in this training)
- Audit log UI page (API only is sufficient for training)
- Log rotation or archival

## Suggested Tests
- Register → audit entry created with `fromStatus: null`, `toStatus: "confirmed"`
- Waitlist registration → audit entry with `fromStatus: null`, `toStatus: "waitlisted"`
- Promotion → audit entry with `fromStatus: "waitlisted"`, `toStatus: "confirmed"`
- Cancellation → audit entry with `fromStatus: "confirmed"`, `toStatus: "cancelled"`
- `GET .../audit` returns full history in chronological order
- Audit entries not modified after creation

## Implementation Hint

Add the `AuditLog` Prisma model and create entries inside each Prisma transaction that modifies registration status.

---
Source: https://github.com/Estois/workshophub/issues/15

## Domain Concept Identification

#### Existing Concepts (from codebase)
- **Registration** (`api/prisma/schema.prisma`, model `Registration`, table `registrations`): `status: String` field already cycles through `'confirmed'`, `'waitlisted'`, `'cancelled'` (the full literal set WH-9 needs to log is already in production use — no new status values required). This is the entity WH-9's audit trail is *about*; `AuditLog.registrationId` is a new foreign key onto it.
- **Three existing state-transition sites, all already transactional** (`api/src/services/trainingSessionService.ts`):
  - `registerForSession` (lines 33–75): two `tx.registration.create` call sites, one for the `null → confirmed` path (line 50) and one for the `null → waitlisted` path (line 63). Both already execute inside `prisma.$transaction(async (tx) => {...})`.
  - `promoteFromWaitlist` (lines 104–141): one `tx.registration.updateMany` performing `waitlisted → confirmed` (line 116–119). It is always invoked with a `tx` passed in from a caller's transaction (currently only `cancelRegistration`), never opens its own `$transaction` — this matters for where WH-9's audit-entry write must live (inside the *caller's* transaction, using the same `tx`).
  - `cancelRegistration` (lines 143–182): two `tx.registration.updateMany` call sites, one for `confirmed → cancelled` (line 158–161) and one for `waitlisted → cancelled` (line 173–176), both inside `prisma.$transaction(async (tx) => {...})`.
  - Together these four `status`-writing statements are the complete, closed set of places WH-9 must instrument — no other code path writes `Registration.status`.
- **`routes/training-sessions.ts`**: nested registration routes already live here (`GET/POST /:id/registrations`, `DELETE /:id/registrations/:registrationId`). The new `GET /:id/registrations/:registrationId/audit` is a natural sibling route in the same router/file, following the existing `:id/registrations/:registrationId` path-param convention.
- **`lib/prisma.ts`**: the shared `PrismaClient` singleton all service-layer transactions use (`import prisma from '../lib/prisma'`). A new `AuditLog` model becomes available on this same singleton once added to `schema.prisma`, with no separate client/connection work needed.
- **Session+registration pairing validation pattern**: the existing `DELETE /:id/registrations/:registrationId` route and `cancelRegistration` service function already establish the convention of checking `registration.trainingSessionId !== sessionId` and treating a mismatch as "not found" (`trainingSessionService.ts:149`). The new audit route's `:id`/`:registrationId` pairing should follow this same, already-decided precedent rather than reopening it.

#### New Concepts Required
- **AuditLog** (new Prisma model): per the AC's explicit schema — `id`, `registrationId` (FK to `Registration`), `fromStatus` (nullable string — `null` for the initial registration transition), `toStatus` (string), `changedAt` (timestamp), `reason` (nullable string). Relates to `Registration` as a one-to-many child (one registration has many ordered audit entries); has no relationship to `TrainingSession` directly — only reachable through `Registration`.
- **Audit-entry-on-transition**: a new write co-located with each of the four existing `status`-writing statements above, each producing exactly one `AuditLog` row per transition, using the *same* `tx` the status write already runs inside (so the audit entry and the status change commit or roll back together — this is the "atomically within the same transaction" requirement from the AC, which the existing transaction boundaries already support without restructuring).
- **Audit history endpoint** (`GET /api/training-sessions/:id/registrations/:registrationId/audit`): new route + new service function (e.g. `getAuditHistory` or similar, exact naming is a REASONS Canvas concern) returning the full ordered list of `AuditLog` rows for a given registration.
- **Immutability guarantee**: a non-code "concept" more than new code — no `PUT`/`PATCH`/`DELETE` route is ever added for `AuditLog`; immutability is achieved by omission (no mutating endpoint exists), not by a database-level constraint. Worth flagging explicitly since "cannot be updated or deleted via the API" is satisfied trivially by never building those routes, not by an enforced invariant at the data layer.

#### Key Business Rules
- **One audit entry per status transition, no exceptions**: every one of the four existing status-writing statements must gain a paired audit-entry write — missing even one (e.g. the `waitlisted → cancelled` path in `cancelRegistration`, which is easy to overlook since it has no `registered`-counter side effect like its `confirmed → cancelled` sibling) breaks the "captures all transitions" requirement. Governs `AuditLog`, all four transition sites in `trainingSessionService.ts`.
- **Atomicity**: the audit entry and the status change must commit or fail together — this is already structurally guaranteed by writing the audit row with the same `tx` handle inside the existing `$transaction` blocks, not a new mechanism to design. Governs `AuditLog`, `Registration.status`.
- **Chronological, append-only ordering**: `GET .../audit` must return entries ordered by `changedAt` ascending (or equivalently insertion order, since entries are never reordered or edited) — same `orderBy: { createdAt/changedAt: 'asc' }` pattern already used elsewhere (`getRegistrationsForSession`, `trainingSessionService.ts:89`). Governs `AuditLog.changedAt`.
- **`fromStatus: null` marks the birth of a registration**: the first audit entry for any registration (whether it starts `confirmed` or `waitlisted`) has `fromStatus: null` — this is the only place `fromStatus` is nullable; every subsequent transition's `fromStatus` must equal the prior entry's `toStatus` (an implicit consistency invariant the AC assumes but doesn't state outright — see Risk section).
- **Registration existence, not session existence, drives the 404**: the AC says "Returns HTTP 404 if the registration does not exist" (singular condition) — by analogy with the existing `cancelRegistration` pairing check, a `:registrationId` that exists but belongs to a different `:id` should presumably also 404, matching the established precedent above, but this needs explicit confirmation rather than assumption (see Risk section).

## Strategic Approach

#### Solution Direction
Follow the same layering already established by every prior registration-lifecycle story (WH-85/WH-10/WH-11): add the `AuditLog` model to `schema.prisma`, then instrument the four existing status-transition call sites inside `trainingSessionService.ts` with a paired `tx.auditLog.create(...)` call using the same transaction client already in scope — no new transaction boundaries, no restructuring of `registerForSession`, `promoteFromWaitlist`, or `cancelRegistration` is needed, since all four sites already run inside a `prisma.$transaction`. Add one new route, `GET /:id/registrations/:registrationId/audit`, as a sibling in `routes/training-sessions.ts`, delegating to a new service function that validates registration existence (and session pairing, per the existing cancellation precedent) and returns the ordered `AuditLog` rows. Data flow: `status-changing operation → tx.registration.update/create (existing) → tx.auditLog.create (new, same tx) → commit`, and separately `GET request → service lookup → ordered AuditLog query → JSON response`.

Because `promoteFromWaitlist` is always called from within `cancelRegistration`'s transaction and never opens its own, the audit-entry write for the promotion transition belongs inside `promoteFromWaitlist` itself (using the `tx` parameter it already receives) — this keeps the "promotion creates its own audit entry" logic co-located with the promotion logic itself, rather than requiring the caller (`cancelRegistration`) to know about promotion's internal state transitions.

#### Key Design Decisions
- **Where to place the audit-write call relative to the status-write call** — Trade-off: writing the audit entry immediately after each status-write statement (four separate call sites) is the most direct mapping to "instrument the existing transitions," keeping each site self-contained and easy to verify against the Suggested Tests one-by-one; alternatively, a single shared helper function (e.g. `recordTransition(tx, registrationId, from, to, reason?)`) called from all four sites reduces duplication of the `tx.auditLog.create` shape. **Recommendation: a small shared helper, since all four call sites write structurally identical rows (same fields, same `tx` pattern) and a helper makes it harder to accidentally omit a field or diverge in shape across sites** — exact signature is a REASONS Canvas concern.
- **Service-layer home for the new audit-read function** — Trade-off: adding it to the existing `trainingSessionService.ts` keeps all registration-related logic in one file (current convention — this file already owns registration, cancellation, and promotion); a new dedicated `auditLogService.ts` separates a now-growing file and gives `AuditLog` queries their own home as the concept's own surface area grows (team norms require all `prisma.*` calls to live in `api/src/services/*.ts`, but don't mandate one file per concept). **Recommendation: a new `auditLogService.ts`** — unlike the prior cancellation story (which was a single new function extending an existing entity's lifecycle), WH-9 introduces a wholly new entity (`AuditLog`) with its own read path independent of `TrainingSession`/`Registration` CRUD, and keeping it separate avoids further growing an already multi-concern file; confirm in REASONS Canvas against the file's current size/shape.
- **`:id`/`:registrationId` pairing enforcement on the new GET route** — Trade-off: strictly checking that `registrationId` belongs to training session `:id` (extra lookup, mirroring `cancelRegistration`'s existing pattern) versus trusting `:registrationId` alone and ignoring `:id` entirely (simpler, matches the AC's literal single 404 condition "if the registration does not exist"). **Recommendation: validate the pairing and treat a mismatch as 404**, for consistency with the precedent already set by `DELETE /:id/registrations/:registrationId` — re-litigating this per-route would produce an inconsistent API surface; confirm exact mechanics in REASONS Canvas.
- **Response shape for the audit history endpoint** — out of scope for this analysis (explicitly a REASONS Canvas / implementation concern), but worth flagging as a decision point: raw `AuditLog` rows vs. a derived "transition description" string (the AC's prose example reads `null → confirmed`, suggesting either the raw fields are sufficient for a client to construct that display, or the API itself should format it). Deferred.

#### Alternatives Considered
- **Database-level immutability (e.g., a trigger or read-only table permission) instead of relying on "no mutating route exists"**: rejected for this story — the AC's "Out of Scope" explicitly limits this to API-only behavior ("Audit entries not modified after creation" is listed under Suggested Tests, testable by simply never exposing a mutating endpoint), and SQLite/Prisma-level enforcement would be new infrastructure disproportionate to a training exercise.
- **Separate `/api/audit-logs/:registrationId` top-level route (non-nested under training-sessions)**: rejected — the AC explicitly specifies the nested path `/api/training-sessions/:id/registrations/:registrationId/audit`, matching the existing nested-resource convention already used by `POST`/`DELETE` on `:id/registrations`.
- **Capturing audit entries via a generic Prisma middleware/extension hook (`$use` or client extension) instead of explicit calls at each transition site**: rejected — four transition sites is a small, closed, enumerable set; a generic hook would need to infer "this is a state-changing write worth auditing" from arbitrary Prisma calls, adding indirection and magic for a problem that explicit instrumentation solves directly and more legibly, consistent with this codebase's preference for explicit over implicit (team norms, direct service-layer calls elsewhere).

## Risk & Gap Analysis

#### Requirement Ambiguities
- **`reason` field population**: the AC lists `reason (optional string)` in the schema but never states what populates it for any of the four transition types (register, waitlist, promote, cancel) — is it always `null` for now (schema-ready but unused), or should e.g. cancellation carry a system-generated reason like `"employee cancelled"` / promotion carry `"waitlist promotion"`? The Suggested Tests never assert on `reason` at all. Needs explicit resolution in REASONS Canvas; current reading leans toward "always null in this story, field exists for future use" since nothing in the AC requests reason text from any caller.
- **`:id`/`:registrationId` pairing enforcement on the new route**: as with the prior `cancelRegistration` story, the AC states only one 404 condition ("if the registration does not exist") and doesn't explicitly address a session/registration mismatch — the Strategic Approach above recommends following the existing precedent, but this is an inference, not a stated requirement, and should be confirmed rather than assumed.
- **Consistency invariant between consecutive audit entries**: the AC implies (via its example sequences) that each entry's `fromStatus` equals the previous entry's `toStatus`, but never states this as an explicit rule or says what should happen if the application code and the audit trail ever drift (they can't drift under the current design, since the audit write is colocated with the status write in the same transaction — but this should be named as a designed invariant, not left implicit).

#### Edge Cases
- **Promotion's audit entry must land inside `cancelRegistration`'s transaction, not a separate one**: `promoteFromWaitlist` is only ever called from within `cancelRegistration`'s `$transaction` and receives `tx` as a parameter (`trainingSessionService.ts:104,169`) — if the audit-write helper is accidentally given its own `prisma.$transaction` instead of reusing the passed-in `tx`, the promotion's audit entry would commit independently of (and potentially out of sync with) the cancellation that triggered it. Must verify the helper always accepts and uses an existing `tx`, never opens its own.
- **Notification failures must not affect audit-entry writes, and vice versa**: `promoteFromWaitlist` already fire-and-forgets `notifyEmployee(...).catch(() => {})` *after* the transaction's DB writes (line 130, called outside any `await` that would roll back the transaction) — the new audit write must execute *before* or independent of this notification call, inside the transaction, so a Slack webhook failure (already isolated by the existing `.catch`) can never affect whether the audit entry or status change commit. The existing isolation pattern should be preserved, not touched.
- **Two concurrent cancel requests for the same registration**: `cancelRegistration`'s existing conditional `updateMany` (gated on current `status`) already prevents double-cancellation (`update.count === 0` short-circuits to `already_cancelled`) — the audit-write helper must be called only on the branch where `update.count === 1` actually succeeded, not unconditionally, to avoid creating a spurious audit entry for a cancellation that didn't actually happen.
- **A registration with zero audit entries** should be structurally impossible once this story ships (every creation path writes `fromStatus: null`), but since `GET .../audit` returns 404 only for a *missing* registration (not an empty-but-existing one), this is worth a defensive integration test rather than a code branch — flag for REASONS Canvas test planning, not a design gap.

#### Technical Risks
- **SQLite single-writer transaction model**: already the established concurrency context for this codebase (noted in prior cancellation/promotion analyses) — adding one more write (`tx.auditLog.create`) per transition increases each transaction's write count but doesn't change the concurrency model; no new mitigation needed beyond the existing `$transaction`-wrapped conditional-update pattern already in place at all four sites.
- **Schema migration risk**: per `CLAUDE.md`, this repo has no migrations — `AuditLog` ships via `prisma db push` (dev) / automatic `prisma db push` on container start (prod), which "preserves existing data for additive changes." Adding a brand-new table with a foreign key to an existing table is a purely additive change (no column added to `Registration` itself), so this is low-risk, but should be explicitly noted as a `db push` step in the implementation plan, not assumed.
- **Test data setup gap**: no existing test (unit or integration) currently creates a multi-transition registration lifecycle (register → promote → cancel in sequence) to exercise WH-9's full audit trail — new integration tests will need to drive a registration through multiple real transitions via the existing public endpoints (`POST`, `DELETE`) to generate a realistic audit history, then assert on the new `GET .../audit` endpoint; this is more setup-heavy than prior single-transition stories' tests.
- **Service file growth / organization risk**: `trainingSessionService.ts` is already the single home for registration, cancellation, and promotion logic (183 lines) — adding four audit-write call sites plus their shared helper (if colocated) pushes this further; the recommendation above to place the *read* side (`auditLogService.ts`) separately partially mitigates this, but the *write* side (helper + four call sites) still lands in the existing file since that's where the transactions already live — flag as an acceptable, not ideal, growth pattern.

#### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| 1 | Organiser identifies registration ID via WH-6 registrations page | Yes | WH-6/WH-12 (`GET /:id/registrations`) already shipped; no new work needed here, purely a workflow precondition |
| 2 | `GET /api/training-sessions/:id/registrations/:registrationId/audit` returns full state history | Yes | New route + new service read function, per Strategic Approach |
| 3 | Response shows time-ordered transitions with correct example sequences | Yes | Ordering by `changedAt` ascending; exact response shape (raw rows vs. formatted strings) deferred to REASONS Canvas |
| 4 | `AuditLog` table with id, registrationId, fromStatus, toStatus, changedAt, reason | Yes | New Prisma model, additive schema change, no migration risk per `CLAUDE.md`'s `db push` model |
| 5 | Every state change creates an audit entry atomically in the same transaction | Yes | All four existing transition sites already run inside `prisma.$transaction`; audit write reuses the same `tx` handle, no new transaction boundaries needed |
| 6 | `GET .../audit` returns full history in chronological order | Yes | Same as AC#3 |
| 7 | Audit entries immutable (no update/delete via API) | Yes | Satisfied by never building a mutating route — not an enforced DB-level invariant, see Risk section |
| 8 | 404 if registration does not exist | Partial | Single-condition 404 stated explicitly; session/registration-ID mismatch handling is an inferred-but-unconfirmed extension of existing precedent (see Ambiguities) |
| 9 | Captures all transitions: initial registration, promotion, cancellation | Yes | Maps exactly to the four existing status-write call sites identified in Domain Concept Identification; the easily-missed one is `waitlisted → cancelled` (no counter side effect, easy to overlook) |
