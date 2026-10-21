# SPDD Analysis: Cancel Registration

## Original Business Requirement

# WH-4: Cancel registration

**Type:** Story
**Status:** To Do
**Priority:** Medium

**Context**
An employee may need to cancel their confirmed registration. This frees up a seat that can be offered to the first person on the waitlist (WH-5). Cancellation should update the registered count and trigger waitlist promotion.

This is a **trainee exercise story**. It is not implemented in the baseline template.

**Description**
As a registered employee, I want to cancel my registration so that I can release my place for someone else.

The employee cancels using their registration ID. The system marks the registration as cancelled, decrements the registered count, and shows the updated state in the UI.

**Acceptance Criteria**

User interactions:
- A "Cancel Registration" button is visible on the session card or registration confirmation page for an employee who has a confirmed registration
- Clicking "Cancel" shows a confirmation prompt: "Are you sure you want to cancel your registration for [Session Title]?"
- After confirming, the page shows a success message: "Your registration has been cancelled"
- The session card updates to reflect the new registered/capacity count (e.g., "11 / 20 registered (9 spots left)")
- If the employee has already cancelled, the Cancel button is not shown (or is disabled with label "Cancelled")

API behaviour:
- DELETE /api/training-sessions/:id/registrations/:registrationId returns HTTP 200 with { status: "cancelled" }
- On cancellation, the registration status changes to cancelled in the database
- On cancellation, the session's registered count decrements by 1
- Returns HTTP 404 if the registration does not exist
- Returns HTTP 409 if the registration is already cancelled
- After cancellation, waitlist promotion (WH-5) is triggered

**Out of Scope**
- Email confirmation of cancellation (WH-8)
- Cancellation by organiser
- Authentication — the registration ID serves as the identity token for training simplicity

**Suggested Tests**
- DELETE /api/.../registrations/1 → 200, status "cancelled"
- DELETE /api/.../registrations/999 → 404
- DELETE already-cancelled registration → 409
- registered count decrements after cancellation
- Waitlist promotion triggered after cancellation

---
Source: https://github.com/Estois/workshophub/issues/10

## Domain Concept Identification

#### Existing Concepts (from codebase)
- **Registration** (`api/prisma/schema.prisma`, model `Registration`, mapped table `registrations`): already has a `status: String` field, populated today with `'confirmed'` or `'waitlisted'` (`api/src/services/trainingSessionService.ts:50,56`). No `'cancelled'` value is written anywhere yet, but the field is schema-ready for this story — no migration needed to add the value itself, only to the state-transition logic that writes it.
- **TrainingSession.registered** (`api/prisma/schema.prisma`): persisted counter, incremented exactly once per confirmed registration today (`registerForSession`, `trainingSessionService.ts:43-46`). WH-4 needs the inverse operation — decrement by exactly one per cancellation of a `confirmed` registration.
- **TrainingSessionService** (`api/src/services/trainingSessionService.ts`): currently exposes `getAllSessions`, `getSessionById`, `registerForSession`. Establishes the layering convention this story must extend: a new service function owns the Prisma/transaction logic; the route only parses/validates and shapes the response.
- **`routes/training-sessions.ts`**: nested registration routes already live here (`POST /:id/registrations`). The new `DELETE /:id/registrations/:registrationId` route is a natural sibling in the same file/router.
- **TrainingSessionCard** (`app/src/components/TrainingSessionCard.tsx`): holds local `result: Registration | null` state after a successful register/waitlist call, which is the only place the frontend currently knows a registration's `id`. This is the existing surface the Cancel button/confirmation flow must attach to.
- **waitlistCount** (`api/src/services/trainingSessionService.ts:7-12,18-19` / `app/src/types/index.ts`): already-derived, read-time count of `waitlisted` registrations per session. Promotion (WH-5) will mutate the pool this count reads from, but computing/display of the count itself is unaffected by WH-4.

#### New Concepts Required
- **Cancellation transition**: a new state change on an existing `Registration` row, `confirmed → cancelled` (the AC and "Suggested Tests" only exercise cancelling a `confirmed` registration; cancelling a `waitlisted` registration is not in the ACs — see Risk section). Relates to `Registration.status` and, for confirmed registrations, to `TrainingSession.registered`.
- **Cancellation endpoint** (`DELETE /api/training-sessions/:id/registrations/:registrationId`): new route, sibling to the existing `POST /:id/registrations` under the same router.
- **Waitlist promotion trigger (WH-5 boundary)**: WH-4's own AC requires "After cancellation, waitlist promotion (WH-5) is triggered," but WH-5 itself is a separate, not-yet-built story (per `CLAUDE.md`'s trainee-exercise list and this session's own scope memory). This is a new integration point — WH-4 must call *something* after a successful confirmed-cancellation — but the promotion logic's own rules (who gets promoted, how `registered`/`waitlistCount` update as a result, what the promoted employee is told) are explicitly WH-5's concern, not WH-4's.
- **Cancel UI affordance**: a "Cancel Registration" button + native confirmation prompt + success message on `TrainingSessionCard` (or a registration confirmation page, per the AC's "or"), scoped to the registration the current browser session just made (no auth — see Key Business Rules).

#### Key Business Rules
- **Registration ID is the sole identity/authorization token**: per "Out of Scope," there is no auth — anyone holding a `registrationId` can cancel it. This matches the existing no-auth posture of `POST /:id/registrations`. Governs the route's authorization model (i.e., there isn't one beyond knowing the ID).
- **Registered-count integrity on cancellation**: `TrainingSession.registered` must decrement by exactly 1 only when a `confirmed` registration is cancelled; cancelling a registration must not double-decrement or decrement for a `waitlisted` cancellation (no seat was ever counted for it). Governs `TrainingSession.registered`, `Registration.status`.
- **Idempotency / already-cancelled guard**: a `registrationId` that is already `status: 'cancelled'` must return 409, not silently succeed or double-decrement. Governs `Registration.status`.
- **Session+registration pairing**: the route is nested as `/:id/registrations/:registrationId` — both the `TrainingSession` id and `Registration` id are in the URL. The analysis must surface whether a mismatch (registration exists but belongs to a different session id) is validated or whether `:id` is effectively advisory. Not stated by the AC (see Risk section).
- **Promotion is downstream, not inline**: the AC separates "decrements the registered count" (WH-4's own job) from "waitlist promotion is triggered" (WH-5's job) — WH-4 owns the cancellation + decrement + invoking the trigger; WH-5 owns what happens when triggered.

## Strategic Approach

#### Solution Direction
Follow the same layering already established by WH-2/WH-3: the route (`api/src/routes/training-sessions.ts`) adds `DELETE /:id/registrations/:registrationId`, validates both path params are numeric, and delegates to a new service function (e.g. living in `trainingSessionService.ts` alongside `registerForSession`, matching the existing one-service-file convention — no new service file needed for this scope). The service function wraps the lookup, status checks, conditional decrement, and status transition in a single `prisma.$transaction`, mirroring `registerForSession`'s existing transactional shape. The route maps the service result to 200/404/409. On the frontend, `TrainingSessionCard` gains a "Cancel Registration" affordance conditioned on holding a `confirmed` or `waitlisted` `result` from the existing post-registration state, using the browser's native `confirm()` (or an equivalent lightweight pattern already used elsewhere in the component — none exists yet, so native `confirm()` matches the "no new UI library/pattern" bias of this codebase) for the "Are you sure" prompt, then a DELETE call and a success-message state update.

Since WH-5 (promotion) is out of scope for this story but the AC requires WH-4 to "trigger" it, the recommended direction is to implement cancellation fully now and leave an explicit, narrow seam (e.g., a single function call or comment marking where promotion logic will plug in) rather than either (a) silently doing nothing about promotion, which fails the AC's letter, or (b) building WH-5's promotion logic now, which oversteps WH-4's scope and this session's prior "don't build WH-5 beyond the minimal trigger WH-4 itself requires" guidance.

#### Key Design Decisions
- **Scope of the "trigger waitlist promotion" AC** — Trade-off: implementing full promotion logic now satisfies the AC literally but duplicates/preempts WH-5's own story (already filed, fork issue mapped as #11 "in-review" per project tracking); implementing a visible-but-inert seam (e.g., a clearly-named stub function/TODO call site) satisfies "triggered" structurally without inventing WH-5's business rules. **Recommendation: build the trigger point (a call from the cancellation service function) but keep promotion logic itself minimal/explicit-boundary, deferring the actual promotion algorithm to WH-5** — the exact shape (stub vs. minimal first-in-line promotion) should be pinned down in REASONS Canvas, not here, but the strategic split (cancel ≠ promote) should not be re-litigated there.
- **Validating `:id`/`:registrationId` pairing** — Trade-off: strictly validating that `registrationId` belongs to session `:id` (extra lookup) adds a check not explicitly required by the AC (which only lists 404-if-registration-missing and 409-if-already-cancelled, no "403/404 if registration belongs to a different session"); skipping it is simpler and matches the AC literally, but allows a URL with a mismatched `:id` to still cancel a real registration under a different session. **Recommendation: validate the pairing and treat a mismatch as 404** (reuses the existing "resource not found at this URL" semantic, no new status code), since this is a cheap, low-risk consistency check and the AC's own URL shape (`:id` present at all) implies it's meaningful — confirm in REASONS Canvas rather than assuming silently.
- **Decrement mechanism (direct update vs. conditional update)** — Trade-off: `registerForSession`'s existing increment uses a conditional `updateMany` (`registered: { lt: capacity } }`) specifically to guard a race on the way up; the way down has a different race shape (two concurrent cancels of two different confirmed registrations are both individually valid, no shared ceiling to guard). A plain conditional update keyed on the *registration's* current status (not the session's capacity) is the natural analogue. **Recommendation: use the same `$transaction` + conditional-update pattern (conditioned on `Registration.status = 'confirmed'`, not session capacity) for symmetry with the existing increment code and to close the same class of double-cancel race** — exact Prisma call shape is a REASONS Canvas concern.
- **Where the cancel affordance lives in the frontend** — AC says "session card or registration confirmation page" (either is acceptable). Trade-off: this repo has no separate "registration confirmation page" today (confirmation is inline `result` state on the card itself, per `TrainingSessionCard.tsx:119-124`); building a new page is a bigger surface change than extending the existing inline state. **Recommendation: extend the existing inline post-registration state on `TrainingSessionCard`** — no new route/page, consistent with "don't add abstractions beyond what the task requires."

#### Alternatives Considered
- **Implement WH-5's full promotion algorithm inside WH-4**: rejected — WH-4's own "Out of Scope" list doesn't mention WH-5, but the story explicitly frames promotion as "(WH-5)" throughout, and this session has a standing instruction (prior session memory) to flag and avoid building ahead into a separate WH-<n> story's scope.
- **Separate `DELETE /api/registrations/:registrationId` (non-nested) endpoint**: rejected — the AC explicitly specifies the nested path `/api/training-sessions/:id/registrations/:registrationId`, matching the existing nested `POST` route's shape.
- **New dedicated "registration confirmation page" route**: rejected for now per the design decision above — larger surface than the AC requires; can be revisited if a future story needs persistent/sharable registration state (e.g., reloading the page and still seeing your registration), which today's inline `result` state does not survive.

## Risk & Gap Analysis

#### Requirement Ambiguities
- **Can a `waitlisted` registration be cancelled?** The AC and Suggested Tests only describe cancelling a `confirmed` registration ("frees up a seat," "decrements the registered count"). The Description says "registered employee" and "confirmed registration" explicitly in the Context line, but the API behavior section doesn't state what happens if `:registrationId` refers to a `waitlisted` row — presumably it should still transition to `cancelled` (so the employee can leave the waitlist) but must **not** decrement `registered` (no seat was ever held). This composition isn't stated and should be confirmed in REASONS Canvas.
- **`:id`/`:registrationId` pairing enforcement**: not addressed by the AC at all (see Key Design Decisions above) — needs an explicit decision, not an assumption.
- **What exactly "triggers" WH-5 means at a code level**: AC says "After cancellation, waitlist promotion (WH-5) is triggered" with no further detail (synchronous call? fire-and-forget? just a seam for WH-5 to fill in later?). Since WH-5 doesn't exist yet, this is the single biggest open point for REASONS Canvas to resolve concretely.
- **Frontend "already cancelled" guard**: AC says "If the employee has already cancelled, the Cancel button is not shown (or is disabled)" — but the frontend currently has no persistent memory of past cancellations (a page reload loses the inline `result` state entirely, and no page currently re-fetches a specific registration by ID). This AC seems to assume the cancel button's visibility is tracked for the *current browser session's lifetime of `result` state* only, not across reloads — worth confirming this narrower interpretation in REASONS Canvas rather than inferring a need for new fetch-by-registration-id capability.

#### Edge Cases
- **Cancelling a registration for a session that doesn't match `:id`**: see ambiguity above — needs an explicit 404-vs-ignore decision.
- **Cancelling the last confirmed registration when `registered == 1`**: decrement must not go negative; the conditional-update design (gated on `Registration.status = 'confirmed'`) naturally avoids this since it's keyed on the registration row, not an arithmetic floor check, but should be explicitly verified in testing.
- **Two concurrent cancel requests for the same `registrationId`**: must not both succeed (double-decrement) — one must see `409` after the other's transaction commits the `cancelled` status. This is the direct analogue of WH-2's already-identified confirm-race, now on the cancel path.
- **Cancelling immediately promotes a `waitlisted` registration that itself then needs the `registered` counter incremented** — this crosses into WH-5's logic the moment it's considered in detail, reinforcing that the trigger boundary (above) needs to be crisp so WH-4's own tests don't accidentally start asserting WH-5 behavior.
- **Non-numeric or missing `:id`/`:registrationId` path params**: existing routes (`GET /:id`, `POST /:id/registrations`) already guard `isNaN(id)` with a 400; the new route should do the same for both params, though the AC doesn't explicitly list a 400 case (only 404/409) — an omission to confirm, not necessarily a gap, since malformed-ID-as-400 is already this codebase's established convention.

#### Technical Risks
- **No existing fetch-by-registration-id capability**: today, the only way the frontend knows a `registrationId` is the response of the `POST` call held in local `result` state. If any part of the AC implies re-discovering a past registration after a reload, that's new scope (a `GET /api/training-sessions/:id/registrations/:registrationId` or similar) not mentioned anywhere in WH-4's AC — flag if REASONS Canvas finds this necessary, but the current reading (inline-session-state only) doesn't require it.
- **Seed script / test data**: `api/prisma/seed.ts` and existing integration tests (`api/tests/integration/training-sessions.test.ts`) don't currently create any `Registration` rows ahead of time for a cancellation test to target — new tests will need to first create a registration (via the existing `POST` endpoint or direct Prisma create) before exercising `DELETE`, same pattern the "Suggested Tests" imply (`DELETE /api/.../registrations/1` assumes registration `1` already exists).
- **SQLite single-writer transaction model**: already noted in the WH-2/WH-3 analysis as the existing mitigation context; the cancellation transaction should follow the same `$transaction`-wrapped conditional-update shape for consistency, not introduce a different concurrency strategy.
- **Promotion seam risks scope creep both ways**: too little (a no-op stub) risks the AC's "waitlist promotion is triggered" being effectively unimplemented and untestable; too much (building real promotion) risks duplicating WH-5. REASONS Canvas must pin an exact, narrow, testable definition of "triggered" for WH-4's own acceptance tests to check against, independent of WH-5's eventual correctness.

#### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| 1 | "Cancel Registration" button visible for confirmed registration | Yes | Scoped to existing inline post-registration state on `TrainingSessionCard`, per Strategic Approach |
| 2 | Confirmation prompt "Are you sure..." | Yes | Native `confirm()` dialog recommended; exact UX mechanism to confirm in REASONS Canvas |
| 3 | Success message "Your registration has been cancelled" | Yes | — |
| 4 | Session card updates registered/capacity count | Yes | Depends on frontend re-fetching or locally decrementing session state after DELETE succeeds — mechanism TBD in REASONS Canvas |
| 5 | Cancel button hidden/disabled if already cancelled | Partial | Only addressable for the current browser session's lifetime of in-memory state, per Requirement Ambiguities — no persistent re-check across reloads without new scope |
| 6 | DELETE .../registrations/:registrationId → 200 { status: "cancelled" } | Yes | — |
| 7 | Registration status → cancelled in DB | Yes | — |
| 8 | registered count decrements by 1 | Partial | Only for a `confirmed` registration being cancelled — behavior for cancelling a `waitlisted` registration is unspecified (see Ambiguities) |
| 9 | 404 if registration does not exist | Yes | Also must decide whether session/registration ID mismatch counts as "does not exist" (see Ambiguities) |
| 10 | 409 if already cancelled | Yes | — |
| 11 | Waitlist promotion (WH-5) triggered after cancellation | Partial | WH-5 itself is out of scope and not yet built; WH-4 can only build the trigger point, not the promotion outcome — exact seam definition deferred to REASONS Canvas |
