# SPDD Analysis: Employee Training Session Registration with Waitlist Support

## Original Business Requirement

### Issue #84 — WH-2: Employee can register for an available training session

**Type:** Story
**Status:** In Progress
**Priority:** Medium

**Context**
Employees can currently browse training sessions (WH-1). The next step is allowing them to register. Registration is the core transactional action of WorkshopHub — it increments the registered count on a session and records the employee's details.

This is a **trainee exercise story**. It is not implemented in the baseline template.

**Description**
As an employee, I want to register for an available training session so that I can secure my place before it fills up.

An employee submits their name and email to register. The system confirms the registration and shows the updated capacity. If the session is full, the employee cannot register (see WH-3 for the waitlist).

**Acceptance Criteria**
- A register button or form is visible on each session card (or session detail page)
- The employee provides their name and email to register
- On success, the registered count increments by 1
- On success, a confirmation message is shown to the employee
- If registered >= capacity, the register button is disabled or hidden
- POST /api/training-sessions/:id/registrations accepts { name, email } and returns HTTP 201 with registration details
- Returns HTTP 400 if required fields are missing
- Returns HTTP 409 if the session is full (see WH-3 for waitlist)
- Returns HTTP 404 if the session does not exist

**Out of Scope**
- Duplicate registration prevention
- Waitlist behaviour when full (WH-3)
- Cancellation (WH-4)
- Email notification (WH-8)
- Authentication or SSO

**Suggested Tests**
- POST /api/training-sessions/1/registrations { name, email } → 201
- POST /api/training-sessions/1/registrations {} → 400, missing fields
- POST /api/training-sessions/999/registrations → 404
- POST when session is full → 409
- registered count increments after successful registration

**Notes**
The Registration model will need to be added to the Prisma schema. Consider whether registered count is stored on the session row or computed from the registrations table.

Need to consider the race condition when creating a registration and incrementing the count.

---

### Issue #85 — WH-3: Waitlist when a training session is full

**Type:** Story
**Status:** To Do
**Priority:** Medium

**Context**
After WH-2 is implemented, a session can fill up. When a session reaches capacity, subsequent employees who want to attend should be placed on a waitlist rather than being turned away. This ensures demand is captured and can be fulfilled if a registered employee cancels (WH-4 → WH-5).

This is a **trainee exercise story**. It is not implemented in the baseline template.

**Description**
As an employee, I want to join a waitlist for a full training session so that I can attend if a place becomes available.

When a session is full, an employee can join the waitlist. The system records their position and informs them they are waitlisted, not confirmed.

**Acceptance Criteria**
- When registered >= capacity, new registrations are added to the waitlist
- The waitlisted employee sees a message confirming they are waitlisted (not confirmed)
- The session card shows a "Join Waitlist" option when the session is full
- POST /api/training-sessions/:id/registrations returns HTTP 202 with { status: "waitlisted", position: N } when full
- Waitlisted registrations have status waitlisted in the database
- Confirmed registrations have status confirmed

**Out of Scope**
- Promotion from waitlist (WH-5)
- Cancellation (WH-4)
- Email notification (WH-8)
- Maximum waitlist size

**Suggested Tests**
- POST when session is full → 202 with status: "waitlisted"
- POST when session has space → 201 with status: "confirmed"
- Waitlisted count is tracked separately from registered count
- Position in waitlist is correct (1st, 2nd, etc.)

**Data Model Hint**
The Registration model should include a status field: confirmed | waitlisted | cancelled.

## Domain Concept Identification

#### Existing Concepts (from codebase)
- **TrainingSession** (`api/prisma/schema.prisma`, model `TrainingSession`, mapped table `training_sessions`): the schedulable workshop. Owns `capacity` and `registered` (a persisted counter, not computed) — `registered`/`capacity` arithmetic already drives the frontend's "full" state (`app/src/components/TrainingSessionCard.tsx:34-35`, `spotsLeft = capacity - registered`). This field is the existing anchor point both WH-2 and WH-3 must integrate with.
- **TrainingSessionService** (`api/src/services/trainingSessionService.ts`): the only existing service, currently read-only (`getAllSessions`, `getSessionById`). Establishes the service-layer convention: thin functions wrapping `prisma.trainingSession.*`, no validation logic, return Prisma objects directly.
- **TrainingSessionCard / TrainingSessionsPage** (`app/src/components/`, `app/src/pages/`): existing display surface where the register/waitlist UI must be added. Card already computes `isFull` locally — this logic will need to extend to show register vs. waitlist CTA.

#### New Concepts Required
- **Registration**: new entity representing one employee's registration attempt for one `TrainingSession`. Fields implied by the two stories: `name`, `email`, a `status` (`confirmed | waitlisted | cancelled` per WH-3's explicit data-model hint), and a link back to the session. Lifecycle starts at creation; WH-4 (cancellation, out of scope here) will later transition status to `cancelled`, and WH-5 (out of scope) will later promote `waitlisted` → `confirmed`. This analysis only needs the `confirmed`/`waitlisted` creation paths.
- **Waitlist position**: not a stored field per se but a conceptual ordering — "Nth waitlisted registration for this session," surfaced in the API response (`{ status: "waitlisted", position: N }`). Derived from existing waitlisted `Registration` rows for the session, not an independent concept to persist redundantly (though persisting it is a valid implementation choice to defer to REASONS Canvas).
- **Registration endpoint** (`POST /api/training-sessions/:id/registrations`): new route, nested under the existing `training-sessions` route group by URL shape, but not yet present in `api/src/routes/training-sessions.ts`.

#### Key Business Rules
- **Capacity gate**: a registration is `confirmed` only while `registered < capacity` at the moment of creation; once `registered >= capacity`, all new registrations become `waitlisted` instead of being rejected. This rule is now shared and reframed by WH-3 — WH-2's AC "Returns HTTP 409 if the session is full" is explicitly superseded by WH-3's "returns HTTP 202 ... when full" (WH-2 text says "see WH-3 for waitlist", and WH-3 fully defines the full-session behavior). Governs `TrainingSession.registered`, `TrainingSession.capacity`, `Registration.status`.
- **Registered-count integrity**: `TrainingSession.registered` must increment exactly once per `confirmed` registration and must never exceed `capacity`. This is the race condition WH-2's Notes explicitly calls out — governs `TrainingSession.registered` and the create-`Registration` operation atomically.
- **Waitlist is session-scoped and ordered**: position is computed per-session among `waitlisted` registrations only, not global. Governs `Registration.status`, `Registration.trainingSessionId`.
- **Required fields**: `name` and `email` are mandatory on every registration attempt (confirmed or waitlisted) — missing fields are a 400 regardless of capacity state. Governs `Registration.name`, `Registration.email`.
- **Session existence precedes all other checks**: a non-existent `:id` is a 404 before capacity or field validation is meaningfully evaluated for that session. Governs `TrainingSession` lookup ordering.

## Strategic Approach

#### Solution Direction
Follow the existing layering already established by `TrainingSessionService`/`training-sessions.ts`: route parses/validates input and shapes the HTTP response only (per `CLAUDE.md` team norm — no Prisma calls in routes), a service function performs the actual registration logic against Prisma. Data flow: `POST /api/training-sessions/:id/registrations` → route validates `id`/`name`/`email` shape → service resolves session, decides confirmed-vs-waitlisted, persists `Registration`, updates `registered` counter when confirmed → route maps the service's result to 201/202/404/400. On the frontend, extend `TrainingSessionCard`'s existing `isFull` branch to offer a "Join Waitlist" CTA instead of hiding the action entirely, reusing the same name/email capture flow for both paths.

Since WH-2 and WH-3 together fully determine the endpoint's behavior (WH-2 alone is not shippable as specified, because its own text defers the full-session case to WH-3), treat this as **one combined endpoint design**, not two sequential ones — avoids building a 409 path in WH-2 that gets immediately replaced by WH-3's 202 path.

#### Key Design Decisions
- **Registered counter: persisted field vs. computed from Registration rows** — WH-2's Notes explicitly raise this. Trade-off: computing `registered` as `count(Registration where status=confirmed)` removes dual-source-of-truth risk but changes every existing read path (`getAllSessions`, `getSessionById`, and the frontend's direct use of `session.registered`) and requires a join/aggregate on every session list fetch. Keeping `TrainingSession.registered` as a persisted counter preserves all existing read paths untouched and matches the existing schema shape. **Recommendation: keep `registered` as a persisted, atomically-updated counter**, written only through the registration service path — minimizes blast radius on WH-1's already-shipped read endpoints and the frontend's existing arithmetic.
- **Concurrency control for the capacity check + counter increment** — WH-2's Notes explicitly flag this race. Trade-off: a plain read-then-write (`findUnique` then `update`) is vulnerable to two concurrent requests both reading `registered < capacity` before either writes. An atomic conditional update (e.g., a single write that only succeeds when the capacity condition still holds, combined with a transaction around the paired `Registration` row insert) avoids a TOCTOU gap without introducing new infrastructure (no locking service, no queue). **Recommendation: resolve the confirmed/waitlisted decision and the counter mutation inside a single database transaction**, keeping the existing SQLite + Prisma stack — exact transaction shape and conditional-update mechanics belong in REASONS Canvas, not here.
- **Waitlist position: computed on read vs. stored on the row** — Trade-off: storing position on `Registration` at creation time is cheap to read later but goes stale if an earlier waitlisted registration is later cancelled (WH-4, out of scope, but will exist soon) or promoted (WH-5, out of scope). Computing position on demand (count of `waitlisted` rows for that session created before this one, +1) stays correct across future WH-4/WH-5 changes without a backfill step. **Recommendation: compute position at response time rather than persisting it** — avoids coupling this story to WH-4/WH-5 migration work later.
- **One endpoint vs. two** — Trade-off: a separate waitlist endpoint (e.g. `POST /training-sessions/:id/waitlist`) would mirror the two stories' separate numbering, but contradicts WH-3's own AC, which specifies the *same* `POST /api/training-sessions/:id/registrations` route returning 202 instead of 201. **Recommendation: single endpoint, branching internally on capacity** — matches WH-3's AC verbatim, avoids the frontend needing to pick between two call sites.

#### Alternatives Considered
- **Reject full sessions with 409 (WH-2's literal AC) and add waitlist as a later, separate iteration**: rejected because WH-3 is being analyzed together with WH-2 in this pass specifically to avoid building and then immediately discarding the 409 path; WH-2's own text ("see WH-3 for the waitlist") signals the two stories were always meant to land together for the full-session case.
- **Compute `registered` from `Registration` rows instead of a persisted counter**: rejected per the design decision above — larger blast radius on existing, already-shipped read paths than the scope of these two stories justifies.

## Risk & Gap Analysis

#### Requirement Ambiguities
- **"Register button disabled or hidden" (WH-2) vs. "Join Waitlist option shown when full" (WH-3)**: the two ACs are in tension if read as WH-2 alone (hide/disable on full) — needs to be read as: hide/disable the *confirmed-registration* CTA when full, and show a distinct *waitlist* CTA in its place. Not contradictory once combined, but neither story states this composition explicitly.
- **What exactly increments for a waitlisted registration**: WH-3 says "waitlisted count is tracked separately from registered count" but doesn't say whether `TrainingSession` gains a new persisted `waitlisted` counter field or whether it's purely derived from `Registration` rows at read time. Given the recommendation above (computed position), a parallel persisted counter seems unnecessary, but this isn't stated by either story and should be confirmed in REASONS Canvas.
- **Does the frontend need to display waitlist position to the employee immediately**, or only confirm "you are waitlisted"? WH-3's AC says "sees a message confirming they are waitlisted (not confirmed)" — doesn't explicitly require showing position N on the UI, even though the API returns it. Ambiguous whether position display is in scope for the UI layer.

#### Edge Cases
- **Exact-capacity boundary**: a registration arriving when `registered == capacity - 1` must confirm and bring `registered` to exactly `capacity`; the next one must waitlist. Off-by-one here is the most likely implementation bug given the existing frontend's `spotsLeft <= 0` check uses `<=` while the condition must be `registered < capacity` (not `<=`) for the confirm path — these are consistent but worth stating explicitly since the two call sites (frontend display logic, backend gate logic) are independent and must agree.
- **Two simultaneous requests for the last remaining spot**: both see `registered < capacity` is true under naive read-then-write; both must not both confirm (this is the race WH-2's Notes call out directly, now compounded by needing exactly one to confirm and the other to waitlist, not just one to fail).
- **Missing name/email on a would-be-waitlisted registration**: WH-2's 400 rule must still apply even when the session is already full — i.e., field validation happens before the capacity branch, not only on the confirmed path.
- **Non-existent session ID combined with a full/empty state is irrelevant** — 404 must short-circuit before any capacity logic runs (no capacity state to evaluate for a session that doesn't exist).

#### Technical Risks
- **SQLite concurrency model**: this repo already carries a documented note (seen in a prior session's handoff, not part of this codebase scan but consistent with what's observed here) that SQLite is effectively single-writer; the transaction-based mitigation for the capacity race (recommended above) is well-suited to that constraint, but must still be validated under the repo's actual Prisma/SQLite setup — not assumed to behave like a multi-writer RDBMS.
- **Existing route-layer Prisma violation sets a bad precedent, not a license to repeat it**: `api/src/routes/training-sessions.ts:9-19` (`/search`) calls `prisma.$queryRawUnsafe` directly inside a route handler, bypassing the service layer and containing a labeled, intentional SQL-injection seed for a separate workshop exercise. This is a pre-existing deviation from the CLAUDE.md norm ("No Prisma calls in route handlers") and must **not** be used as a pattern for the new registration route — the new route must call into `trainingSessionService.ts` exclusively, with zero `prisma.*` imports in the route file.
- **Schema migration path**: adding the `Registration` model requires a new foreign key (`trainingSessionId` → `TrainingSession.id`) and will require `db:push`/`db:seed` to be re-run; `api/prisma/seed.ts` currently does `prisma.trainingSession.deleteMany()` with no child-table cleanup — once `Registration` exists, deleting sessions before deleting their registrations will violate the FK constraint on reseed. This is a concrete seed-script break, not a hypothetical.
- **No existing precedent for POST/transaction patterns in this codebase**: `trainingSessionService.ts` is currently 100% read-only (`findMany`/`findUnique`). There is no existing `prisma.$transaction` usage, write validation pattern, or error-shape convention for mutations anywhere in `api/src/services/` to follow — the write/transaction/error-response conventions for this feature will be established fresh, not inherited, increasing design surface for REASONS Canvas to resolve carefully.

#### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| WH-2.1 | Register button/form visible on session card | Yes | Needs waitlist-CTA composition per ambiguity above |
| WH-2.2 | Employee provides name and email | Yes | — |
| WH-2.3 | registered count increments by 1 on success | Yes | Only for confirmed path; must not increment on waitlisted path |
| WH-2.4 | Confirmation message shown on success | Yes | Message content must differ for confirmed vs. waitlisted (WH-3.2) |
| WH-2.5 | Register button disabled/hidden if full | Partial | Superseded/extended by WH-3.3 ("Join Waitlist" shown instead of plain hide) — needs explicit composition, not a straight AND |
| WH-2.6 | POST .../registrations accepts {name,email}, 201 w/ details | Partial | 201 applies only to the confirmed branch per WH-3; the waitlisted branch returns 202 instead — same endpoint, branching status code |
| WH-2.7 | 400 if required fields missing | Yes | Must apply before capacity branch is evaluated |
| WH-2.8 | 409 if session full | No (superseded) | Directly contradicted by WH-3.4 (202 instead of 409 when full) — WH-2 text itself defers this to WH-3, so WH-3's 202 behavior is the authoritative rule for this analysis |
| WH-2.9 | 404 if session doesn't exist | Yes | Must be checked first, before field/capacity validation short-circuits meaningfully |
| WH-3.1 | registered >= capacity → waitlisted | Yes | Combined with WH-2.8 supersession above |
| WH-3.2 | Waitlisted employee sees "waitlisted, not confirmed" message | Yes | Frontend message copy — depends on API returning a distinguishable status |
| WH-3.3 | Session card shows "Join Waitlist" option when full | Yes | — |
| WH-3.4 | POST returns 202 with {status:"waitlisted", position:N} when full | Yes | Position computation strategy to be finalized in REASONS Canvas (see design decision above) |
| WH-3.5 | Waitlisted registrations have status `waitlisted` in DB | Yes | Requires new `status` field on `Registration` |
| WH-3.6 | Confirmed registrations have status `confirmed` in DB | Yes | Same field, default/explicit value on the confirmed path |
