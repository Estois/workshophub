# SPDD Analysis: Send notification after waitlist promotion (TDD lab slice 2)

## Lab Scope Note (overrides full-issue scope below for this slice)

This is the second slice of WH-8, following the registration-notification slice
already merged (PR #26). The full GitHub issue body is preserved verbatim below.

- **In scope for this slice**: the WH-5 waitlist-promotion path only — filling in the
  existing `notifyPromotion` no-op seam inside `promoteFromWaitlist`, reusing the
  `notifyEmployee` function already built in the previous slice, with `status: 'promoted'`.
- **Out of scope for this slice**: all UI banner/dismiss work (still a separate, later
  slice); any change to `registerForSession`'s confirmed-branch notification (already
  done, untouched here); any change to `cancelRegistration` itself beyond what already
  calls `promoteFromWaitlist`.
- Per the `tdd` skill's hard rule: one slice, one AC, implemented and green, then stop.

## Original Business Requirement

# WH-8: Send notification after registration or waitlist promotion

**Type:** Story
**Status:** To Do
**Priority:** Medium

**Context**
Employees should receive feedback when they successfully register or are promoted from the waitlist. This confirmation helps them know their seat is secured without needing to check back.

This is a **trainee exercise story**. It is not implemented in the baseline template.

**Description**
As an employee, I want to receive a notification when I register or am promoted from the waitlist so that I know my seat is confirmed.

For training simplicity, the in-app UI shows a success banner immediately after the action. A backend notification (console log or Slack webhook) fires as a side effect and does not block the response.

**Acceptance Criteria**

User interactions (in-app feedback):
- After successfully registering (confirmed), the page shows a success banner: "You're registered! [Session title] on [formatted date]"
- After joining the waitlist, the page shows: "You're on the waitlist for [Session title]. We'll let you know if a spot opens up."
- Both banners appear immediately after the form is submitted without a page reload
- The banners can be dismissed by the user or auto-dismiss after a few seconds
- If the backend notification fails, the banner still appears (notification failure is silent)

Backend notification:
- After a successful registration (confirmed), a notification event is emitted on the server
- After a waitlist promotion (confirmed via WH-5), a notification event is emitted on the server
- The notification includes: employee name, email, session title, session date, status (confirmed or promoted)
- For baseline: notification is logged to the server console
- Optional extension: if SLACK_WEBHOOK_URL is set in the environment, a Slack message is sent to the configured channel
- Notification failures must not fail the registration or promotion (fire-and-forget)

**Out of Scope**
- Real email delivery
- SMS notifications
- Notification for cancellation
- Notification history or inbox

**Suggested Tests**
- Registration success → success banner shown in UI
- Waitlist registration → waitlist banner shown in UI
- Registration success → notification logged with correct employee and session details
- Waitlist promotion → notification logged
- Notification failure does not affect API response
- Slack notification sent when SLACK_WEBHOOK_URL is set (optional, integration test)

**Implementation Hint**
Use an event emitter or a simple async side-effect function. The core registration path should not await the notification.

---
Copied from upstream: https://github.com/dsta-tw-agentic/workshophub/issues/90

Issue: https://github.com/Estois/workshophub/issues/14

## Domain Concept Identification

#### Existing Concepts (from codebase)

- **`notifyEmployee`**: the notification function built in the previous slice (`api/src/services/notificationService.ts`). Already handles console log + optional Slack webhook + fire-and-forget resiliency. This slice reuses it as-is — no changes to its implementation or signature, other than that `status` must already accept `'promoted'` as well as `'confirmed'` (currently typed as the literal `'confirmed'` only — this is a required, narrowly-scoped change to the existing type).
- **`promoteFromWaitlist`**: in `api/src/services/trainingSessionService.ts`, already finds the oldest waitlisted `Registration` for a session, promotes it to `confirmed`, increments the session's `registered` count, and calls the existing no-op `notifyPromotion(candidate.id)` seam. Called from `cancelRegistration` when a confirmed seat is cancelled.
- **`TrainingSession`**: not currently fetched inside `promoteFromWaitlist` — only `sessionId` (a number) is available as a parameter. The function already has a `tx` (Prisma transaction client) in scope, so fetching the session inside it is a one-line addition following the same pattern as `registerForSession`.
- **`Registration` (candidate)**: already fetched and available as `candidate` inside `promoteFromWaitlist` after the `findFirst` call — has `name`, `email` already.

#### New Concepts Required (this slice)

- None. No new files, no new types beyond widening `NotifyEmployeeParams['status']` from the literal `'confirmed'` to `'confirmed' | 'promoted'`.

#### Explicitly Out of Scope for This Slice

- **UI banner/dismiss behaviour**: still untouched, a separate later slice.
- **`registerForSession`'s existing notification call**: already implemented and merged; not modified by this slice.
- **`cancelRegistration` itself**: no notification call is added to cancellation directly — only `promoteFromWaitlist`, which it calls, gains one.

#### Key Business Rules

- **Same fire-and-forget guarantee applies to promotion**: a notification failure during promotion must not cause `cancelRegistration` (the caller) to fail or roll back the cancellation/promotion that already succeeded.
- **Status field distinguishes the two trigger points**: `notifyEmployee` already accepts a `status` field — this slice's only required change to it is widening the type to also accept `'promoted'`, passed by the new call site.

## Strategic Approach

#### Solution Direction

Inside `promoteFromWaitlist`, after finding `candidate` and before (or after) incrementing `registered`, fetch the `TrainingSession` row via `tx.trainingSession.findUnique({ where: { id: sessionId } })` (reusing the existing `tx`), then replace the no-op body of `notifyPromotion` with a call to `notifyEmployee({ name: candidate.name, email: candidate.email, sessionTitle: session.title, sessionDate: session.date, status: 'promoted' })`, called without `await`, same fire-and-forget shape as the registration slice.

#### Key Design Decisions

- **Where to fetch the `TrainingSession` row**: `promoteFromWaitlist` already has `sessionId` and `tx` in scope but not the session row itself → trade-off is fetching it here (one extra query, but keeps the function self-contained) vs. threading it in as a new parameter from `cancelRegistration` (which also doesn't have it loaded, so this would just move the query up one level, not avoid it). Recommended: fetch inside `promoteFromWaitlist`, using the existing transaction, consistent with how `registerForSession` already has its own session lookup.
- **Keep or inline the `notifyPromotion` wrapper function**: the existing no-op is a separate named function, `notifyPromotion(_registrationId)`, called from `promoteFromWaitlist` → trade-off is keeping `notifyPromotion` as a thin wrapper around `notifyEmployee` (preserves the existing seam's name and signature as a stable call site) vs. deleting `notifyPromotion` and calling `notifyEmployee` directly from `promoteFromWaitlist`. Recommended: delete `notifyPromotion` and call `notifyEmployee` directly — the wrapper added no value beyond being a placeholder for this exact slice, and keeping a one-line pass-through function that takes only an ID (not enough data to actually notify) would require changing its signature anyway.
- **Widening `NotifyEmployeeParams['status']`**: the existing type is `status: 'confirmed'` (a literal). Trade-off: widen to `'confirmed' | 'promoted'` now (minimal, exactly what's needed) vs. widen to a general `string` (loses type safety). Recommended: widen to the literal union `'confirmed' | 'promoted'` — matches the story's own AC wording exactly ("status (confirmed or promoted)") and keeps the "No `any`"/strict-typing team norm.

#### Alternatives Considered

- **Having `cancelRegistration` fetch the session and pass it down to `promoteFromWaitlist`**: rejected — `promoteFromWaitlist` already receives `sessionId` and has a `tx` to query with; passing a redundant object down adds a parameter without removing a query (since `promoteFromWaitlist` already needs `sessionId` for its own `trainingSession.update` call).
- **Emitting a separate "promotion" notification type/shape distinct from `notifyEmployee`**: rejected — the REASONS canvas from the previous slice already modeled `notifyEmployee`'s `status` field as the discriminator between confirmed and promoted; introducing a second function would duplicate the console/Slack delivery logic for no benefit.

## Risk & Gap Analysis

#### Requirement Ambiguities

- None new. The only ambiguity from the previous slice's analysis (console-log-as-notification vs. a separate emit step) applies equally here and remains resolved the same way: a direct function call is the notification.

#### Edge Cases

- **No waitlisted candidate exists**: `promoteFromWaitlist` already returns `null` early in this case (confirmed by reading the existing code) — `notifyEmployee` must not be called at all when there's nothing to promote. This is already naturally satisfied by placing the new call after the existing `if (!candidate) { return null }` and `if (update.count === 0) { return null }` guards.
- **Race on `update.count === 0`** (candidate was already un-waitlisted by another request): already guarded by existing code returning `null` before any notification would fire — no new risk introduced.

#### Technical Risks

- **Type-widening ripple**: widening `NotifyEmployeeParams['status']` could in principle require touching the previous slice's test file if it asserts the literal type narrowly — needs to be checked (not assumed) when writing this slice's tests; the existing `notificationService.test.ts` tests should continue to pass unchanged since `'confirmed'` remains a valid member of the widened union.
- **Test observability inside a nested transaction call**: `promoteFromWaitlist` takes a `tx: Prisma.TransactionClient`, not the top-level `prisma` client, and is only reachable through `cancelRegistration`'s transaction — this slice's tests most likely need an integration-style test (hitting `cancelRegistration` end-to-end) rather than a pure unit test in isolation, since `promoteFromWaitlist` is not exported for direct top-level testing in the same way `notifyEmployee` is. (It is exported, so a unit test calling it directly with a test `tx` is also possible — to be decided concretely in Operations below.)

#### Acceptance Criteria Coverage (this slice only)

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| 7 | Notification event emitted after waitlist promotion (confirmed via WH-5) | Yes | Fills the existing `notifyPromotion` seam by calling `notifyEmployee` with `status: 'promoted'` |
| 8 | Notification includes employee name, email, session title, session date, status | Yes | All fields available via `candidate` (already fetched) plus one new `tx.trainingSession.findUnique` call |
| 9 | Baseline: notification logged to server console | Yes | Already implemented in `notifyEmployee`, reused unchanged |
| 10 | Optional: Slack webhook if `SLACK_WEBHOOK_URL` is set | Yes | Already implemented in `notifyEmployee`, reused unchanged — no new work needed for this AC in this slice |
| 11 | Notification failures must not fail registration or promotion (fire-and-forget) | Yes | Already guaranteed by `notifyEmployee`'s existing internal try/catch; this slice only adds a new call site, not new resiliency logic |

**Explicitly deferred to a later slice**: AC 1–5 (UI banners, dismiss/auto-dismiss, date formatting).
