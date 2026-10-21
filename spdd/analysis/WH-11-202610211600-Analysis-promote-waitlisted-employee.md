# SPDD Analysis: Promote First Waitlisted Employee After Cancellation

## Original Business Requirement

**Type:** Story
**Status:** In Progress
**Priority:** Medium

**Context**
When a confirmed registration is cancelled (WH-4), a seat becomes available. The first person on the waitlist should be automatically promoted to confirmed status. This closes the loop between cancellation and waitlist management.

This is a **trainee exercise story**. It is not implemented in the baseline template.

**Description**
As a waitlisted employee, I want to be automatically promoted to confirmed when a registered employee cancels so that I can secure the now-available place.

Promotion is automatic — it fires as a side effect of cancellation (WH-4). No user directly triggers it. The first waitlisted employee (by createdAt) is promoted to confirmed.

**Acceptance Criteria**

What the user sees:
- Promotion is invisible to the cancelling employee — they see only the standard cancellation success message
- A waitlisted employee who refreshes the sessions page after being promoted sees their status shown as "Confirmed" instead of "Waitlisted"
- The session card's registered/capacity count stays the same after promotion (the vacated seat is immediately filled)
- A notification is sent to the promoted employee (WH-8)

API and backend behaviour:
- When a confirmed registration is cancelled, the first waitlisted employee is automatically promoted to confirmed
- If there are no waitlisted employees, no promotion occurs and the registered count decrements by 1
- The session's registered count remains unchanged when promotion occurs (cancelled −1 and promoted +1 = net zero)
- Promotion is atomic: cancellation and promotion happen in the same database transaction
- The API response for cancellation includes { status: "cancelled", promotedRegistrationId: N } if a promotion occurred, or { status: "cancelled", promotedRegistrationId: null } if none

**Out of Scope**
- Manual promotion by an organiser
- Promotion notification UI (covered in WH-8)

**Suggested Tests**
- Cancel confirmed registration → first waitlisted employee is promoted
- Promoted employee status changes to "confirmed"
- No promotion when waitlist is empty — registered count decrements
- registered count unchanged when promotion occurs
- Cancellation and promotion are atomic (no partial state)

**Implementation Hint**
Use a Prisma transaction to cancel and promote atomically.

---
Source: https://github.com/Estois/workshophub/issues/11

## Domain Concept Identification

#### Existing Concepts (from codebase)
- `TrainingSession`: the event being registered for — owns `capacity` and `registered` (persisted seat counter). Already mutated transactionally by both `registerForSession` (increment) and `cancelRegistration` (decrement).
- `Registration`: a single employee's claim on a session, with `status` as an unconstrained string column (`confirmed` | `waitlisted` | `cancelled` today). Ordered within a session's waitlist by `createdAt` (already the exact ordering `registerForSession`'s waitlist-position count uses, and the ordering this story's AC calls for — "first waitlisted employee by createdAt").
- `cancelRegistration` / `promoteFromWaitlist` (trainingSessionService.ts): WH-4 already built the exact integration seam this story fills in. `cancelRegistration`'s confirmed-cancellation branch already calls `promoteFromWaitlist(tx, sessionId)` inside the same `prisma.$transaction` as the cancellation and the `registered` decrement — today it's a documented no-op (`// WH-5 trigger point: promotion algorithm is not implemented yet, this is a no-op seam.`). This story's entire backend scope is implementing that one function's body, not building new plumbing.
- `DELETE /:id/registrations/:registrationId` route (training-sessions.ts): already maps `cancelRegistration`'s result to `200 { status: 'cancelled' }`. This story's AC requires widening that response body, not changing the route's control flow.

#### New Concepts Required
- **Promotion outcome signal**: `cancelRegistration`'s return type (`CancellationResult`) has no field today for "was a waitlisted registration promoted, and which one." The AC's `promotedRegistrationId: N | null` in the response requires this to flow from `promoteFromWaitlist` (or logic colocated with it) back up through `cancelRegistration` to the route.
- **Promotion algorithm itself**: "find the oldest waitlisted registration for this session, flip it to confirmed" — this is genuinely new logic; nothing in the codebase today reads-then-mutates the waitlist in this direction (`registerForSession`'s waitlist path only ever creates+counts, never promotes).

#### Key Business Rules
- **Net-zero registered count on promotion**: `registered` must end at the same value it started at when a promotion occurs (cancel confirmed: −1, promote waitlisted→confirmed: the promoted registration is already counted or not — this is the central business-rule ambiguity, see Risk & Gap Analysis). Governs `TrainingSession.registered`.
- **FIFO waitlist ordering**: the employee with the earliest `createdAt` among `status = 'waitlisted'` rows for the session is the one promoted. Governs `Registration.status`, ordering by `Registration.createdAt`.
- **Promotion only follows a confirmed-origin cancellation**: WH-4 already encodes this — `promoteFromWaitlist` is called only from the `confirmed`-cancellation branch, never the `waitlisted`-cancellation branch (cancelling a waitlisted registration frees no seat, so nothing to promote). This story must preserve that call-site constraint, not relax it.
- **Atomicity**: cancellation + promotion must commit or roll back together — already structurally guaranteed by `promoteFromWaitlist` sharing WH-4's `tx: Prisma.TransactionClient`, not a fresh `prisma` call. This story's implementation must keep using the passed-in `tx`.
- **Idempotent/race-safe promotion**: two concurrent cancellations on the same session must not both promote the same waitlisted registration (double-promotion), and must not promote two different people when only one seat actually opened — same race class WH-4 already solved for cancellation via conditional `updateMany`; promotion needs the equivalent guard.

## Strategic Approach

#### Solution Direction
Implement the promotion algorithm entirely inside the existing `promoteFromWaitlist(tx, sessionId)` function body — no new route, no new service entry point, no schema change. Inside the already-open transaction: find the oldest `waitlisted` registration for `sessionId` (`tx.registration.findFirst` ordered by `createdAt` ascending, filtered `status: 'waitlisted'`), and if one exists, transition it to `confirmed` via a conditional `updateMany` keyed on `id` + `status: 'waitlisted'` (mirroring WH-4's own race-guard pattern for the cancellation side), then return its id to the caller. `cancelRegistration` threads that id (or `null`) into its own return value, and the route surfaces it as `promotedRegistrationId` in the JSON body. This keeps the change surface to: widen `promoteFromWaitlist`'s return type from `Promise<void>` to `Promise<number | null>`, widen `CancellationResult`'s `cancelled` variant to carry it, and add one field to the route's success response — no new files, following the exact layering WH-4 already established (route → service → prisma, one transaction).

#### Key Design Decisions
- **Does promoting a waitlisted registration need its own `registered` increment, or does it piggyback on the AC's "net zero" framing?** → The AC states "cancelled −1 and promoted +1 = net zero" as if promotion independently increments `registered`. But re-reading `registerForSession`: a `waitlisted` registration was *never* counted in `registered` in the first place (the increment only happens on the `confirmed` branch). So if `cancelRegistration`'s confirmed branch decrements `registered` by 1 unconditionally (as WH-4 already does, before calling `promoteFromWaitlist`), and promotion is meant to "immediately fill the vacated seat," then promotion must *increment* `registered` by 1 to restore it — net effect across cancel+promote is 0 vs. the pre-cancellation value, matching the AC's wording. Recommendation: `promoteFromWaitlist`, on a successful promotion, does `tx.trainingSession.update({ data: { registered: { increment: 1 } } })` — restoring the seat WH-4's decrement just released. This is the reading that makes the AC's "stays the same" literally true against the pre-cancellation baseline, and is consistent with `registered` always meaning "current confirmed headcount." This is the single most load-bearing design decision in this story and should be stated explicitly and unambiguously in the REASONS Canvas, not left implicit.
- **Response shape widening**: `cancelRegistration`'s `{ status: 'cancelled' }` variant must gain a field. Two options: (a) always include `promotedRegistrationId: number | null` on every `cancelled` result (including the `waitlisted`-cancellation branch, where it's always `null`), or (b) only include it on confirmed-origin cancellations. Recommendation: (a) — a single consistent shape for `{ status: 'cancelled' }` is simpler for the frontend/tests to assert against than a shape that varies by which branch produced it, and the AC's wording ("if a promotion occurred... or null if none") reads as a property of the response, not of the input branch.
- **Where the "first waitlisted" query lives**: inside `promoteFromWaitlist` itself (self-contained) vs. passed in by `cancelRegistration` (caller does the lookup, seam just does the mutation). Recommendation: keep the lookup inside `promoteFromWaitlist` — it already receives `sessionId`, and keeping the whole "find + promote" responsibility in one function matches the "named integration point" framing from WH-4's canvas, and avoids widening `promoteFromWaitlist`'s input signature at all (only its return type changes).

#### Alternatives Considered
- **New dedicated endpoint for promotion** (e.g., an organiser-triggered `POST /:id/promote`): rejected — AC explicitly states promotion is automatic and invisible to the user, and "manual promotion by an organiser" is explicitly out of scope.
- **Separate transaction for promotion, chained after cancellation's transaction commits**: rejected — AC explicitly requires atomicity ("cancellation and promotion happen in the same database transaction"); a second transaction reintroduces the exact non-atomic risk the AC calls out.
- **Storing a denormalized "waitlist position" column updated on every mutation**: rejected — `registerForSession`'s existing waitlist-position feature already computes position on-the-fly via `count()`, no stored position exists anywhere in the schema; introducing one now would be unrelated scope creep and contradicts the "no schema changes" pattern this feature can otherwise follow.

## Risk & Gap Analysis

#### Requirement Ambiguities
- **"Promoted employee status changes to confirmed" visible to whom, how?** The AC says a promoted employee "sees their status shown as Confirmed... after refreshing." But (confirmed by reading `TrainingSessionCard.tsx`): the frontend has no persistent identity or lookup — `result` is pure in-memory React state set only immediately after that browser's own POST/DELETE call, lost on any page reload, and there is no existing endpoint to fetch "my registration by registration ID" after the fact. **This AC cannot be satisfied by backend work alone, and may not be satisfiable at all without a new GET endpoint + frontend persistence mechanism (e.g., storing `registrationId` in `localStorage` and polling/fetching it on mount) that is not mentioned anywhere in this story's scope, hint, or out-of-scope list.** This is the single biggest gap and must be resolved explicitly before REASONS Canvas — either the AC is reinterpreted as backend-only (the data is correct in the DB, UI reflection is implicitly deferred), or new frontend/API scope is added that isn't currently hinted at.
- **"Notification is sent to the promoted employee (WH-8)" listed as a "what the user sees" AC, but WH-8 notification UI is explicitly out of scope.** Same pattern as WH-4's `promoteFromWaitlist` seam: likely resolved by adding a `notifyPromotion`-style no-op seam call inside the promotion path, structurally present but not implemented — mirroring precedent. Should be stated explicitly rather than silently dropped, the same way WH-4's canvas explicitly called out the `promoteFromWaitlist` no-op pattern.

#### Edge Cases
- **Multiple waitlisted registrations with identical `createdAt`** (SQLite datetime precision, or near-simultaneous registrations): `findFirst` ordered by `createdAt` ascending with no tiebreaker could be non-deterministic across runs on a tie. `registerForSession`'s existing waitlist-position `count()` has the same latent issue (uses `createdAt: { lte: ... } `), so this isn't a new risk this story introduces, but promotion determinism matters more than position-display cosmetics. Consider ordering by `createdAt` then `id` ascending as a stable tiebreaker.
- **Cancelling a registration when the waitlist is empty**: no promotion, `registered` decrements by 1, `promotedRegistrationId: null` — already directly covered by the AC and naturally falls out of "promoteFromWaitlist finds nothing, returns null."
- **Two concurrent cancellations on the same session, both confirmed-origin, one waitlisted employee available**: both transactions call `promoteFromWaitlist`; without a race guard, both could find the same single waitlisted registration via `findFirst` before either commits its `updateMany`, but only one `updateMany` (keyed on `status: 'waitlisted'`) will actually affect a row — the other's `count` will be 0 and must be treated as "no promotion happened" (not an error), exactly mirroring how WH-4 already treats a losing `updateMany` on the cancellation side as `already_cancelled` rather than a crash.
- **Cancelling a `waitlisted` registration itself while another employee is also waitlisted**: WH-4 already excludes this path from calling `promoteFromWaitlist` at all (no seat was freed) — must remain untouched by this story.

#### Technical Risks
- **`registered` increment-on-promotion correctness depends entirely on the design decision above being right.** If the actual intended semantics are "a waitlisted registration was never counted, so promoting it should NOT increment `registered` (because the decrement from cancellation already reflects the net state correctly)," the implementation would be wrong and silently break the capacity invariant (the session would permanently under-report `registered` by 1 every time a promotion occurs). This is a correctness-critical decision, not a style choice — the REASONS Canvas must state the exact `registered` arithmetic unambiguously, and ideally the generated code's tests must assert the net-zero behavior across a cancel+promote sequence, not just assert each side independently.
- **Race-safety of the `findFirst` + `updateMany` promotion pattern**: unlike `cancelRegistration`'s conditional `updateMany` (which is self-contained — one atomic conditional write), `promoteFromWaitlist` needs a read (`findFirst`) followed by a conditional write (`updateMany` keyed on that specific id). Within a single Prisma `$transaction`, SQLite's locking (the whole transaction holds a write lock once any write happens) should make this safe in practice for this codebase's SQLite setup, but the REASONS Canvas should still specify the `updateMany` being keyed on `id + status: 'waitlisted'` (not just `id`) as the explicit safety net, consistent with WH-4's pattern, rather than relying solely on transaction isolation.

#### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| 1 | Promotion invisible to cancelling employee — standard cancellation message only | Yes | Frontend already only shows the cancellation message (`TrainingSessionCard.tsx`'s `cancelled` branch); adding `promotedRegistrationId` to the response body doesn't require the cancelling employee's UI to read or display it. |
| 2 | Promoted employee sees "Confirmed" after refreshing sessions page | **Partial — major gap.** | No persistent identity/lookup mechanism exists for a registrant to re-check their own status after a reload. Needs explicit resolution before design (see Requirement Ambiguities). Likely needs new scope (GET-by-registration-id endpoint + frontend persistence) not currently hinted at by this story. |
| 3 | Session card registered/capacity count stays the same after promotion | Yes, contingent on the `registered`-increment design decision above being implemented correctly | This is the AC the strategic approach's key design decision directly targets. |
| 4 | Notification sent to promoted employee (WH-8) | **Partial — seam only.** | Same pattern as WH-4's `promoteFromWaitlist` placeholder: can be satisfied structurally with a no-op `notifyPromotion`-style seam call, not real notification delivery (WH-8 explicitly out of scope). Should be stated explicitly in the canvas, not silently omitted. |
| 5 | First waitlisted employee auto-promoted on confirmed cancellation | Yes | Directly addressed by the strategic approach — `findFirst` ordered by `createdAt` inside `promoteFromWaitlist`. |
| 6 | No waitlist → no promotion, registered decrements by 1 | Yes | Already true today after WH-4; `promoteFromWaitlist` finding nothing and returning `null` changes nothing about the existing decrement behavior. |
| 7 | registered unchanged when promotion occurs | Yes, contingent on same design decision as AC 3 | Same note as AC 3 — these two ACs are really one invariant. |
| 8 | Promotion atomic with cancellation (same transaction) | Yes | Already structurally guaranteed by WH-4's existing `tx` threading into `promoteFromWaitlist`; this story must not break that by introducing a second `prisma.$transaction` or a bare `prisma.*` call. |
| 9 (API) | Response includes `{ status: "cancelled", promotedRegistrationId: N \| null }` | Yes | Requires widening `CancellationResult`'s `cancelled` variant and the route's success-response JSON; this is a **breaking response-shape change to the WH-4 endpoint just shipped** — flagged separately as scope overlap below. |
