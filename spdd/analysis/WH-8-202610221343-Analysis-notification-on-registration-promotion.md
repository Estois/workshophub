# SPDD Analysis: Send notification after registration (TDD lab slice)

## Lab Scope Note (overrides full-issue scope below for this slice)

This analysis is scoped to the Day 3 multi-agent training lab's WH-8 slice, which is
narrower than the full GitHub issue body preserved verbatim below:

- **In scope for this slice**: baseline WH-2/WH-3 registration path only (the `confirmed`
  branch of `registerForSession`), a `notifyEmployee`-style backend logging function,
  resiliency (notification failure must not fail the registration response), and the
  Slack webhook as a stretch/optional extension.
- **Out of scope for this slice**: the WH-5 waitlist-promotion notification trigger
  (`notifyPromotion` stays a no-op for now), all UI banner/dismiss work, and any
  multi-AC "implement the whole story" suite. Per the `tdd` skill's hard rule, this is
  one slice, one AC, implemented and green, then stop — not a vehicle for the rest of
  the issue's acceptance criteria in one pass.

The rest of this document (Domain Concepts, Strategic Approach, Risk & Gap Analysis)
has been trimmed to this slice. The full issue is kept below, verbatim, as the record
of the complete story this slice is drawn from.

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

- **Registration**: a confirmed employee record for a session — `Registration` Prisma model (`api/prisma/schema.prisma`), fields `name`, `email`, `status`, `trainingSessionId`, `createdAt`. Already the source of the employee name/email this slice's notification needs.
- **TrainingSession**: the session being registered for — `TrainingSession` Prisma model, fields `title`, `date` (among others). Already the source of the session title/date this slice's notification needs.
- **Confirmed registration flow**: `registerForSession` in `api/src/services/trainingSessionService.ts`, called from `POST /api/training-sessions/:id/registrations` in `api/src/routes/training-sessions.ts`. Returns a `RegistrationResult` discriminated union (`confirmed` / `waitlisted` / `not_found`); this slice only touches the `confirmed` branch.

#### New Concepts Required (this slice)

- **`notifyEmployee`-style notification function**: a side-effect function, called after a confirmed registration, carrying employee name, email, session title, session date, and status (`confirmed`). Does not exist anywhere in the codebase today (confirmed via search — no notification code in `api/src`).
- **Notification channel(s)**: console log (baseline, always on) and an optional Slack webhook stretch (gated on `SLACK_WEBHOOK_URL` being set).
- **Fire-and-forget dispatch**: the mechanism that ensures a notification failure never affects the registration response. New — `registerForSession` runs inside a Prisma `$transaction` today and has no existing async, non-blocking side-effect pattern to reuse.

#### Explicitly Out of Scope for This Slice

- **Waitlist promotion notification**: the existing `notifyPromotion` no-op seam inside `promoteFromWaitlist` (WH-5 path) stays untouched. Noted here only so the implementer agent does not "helpfully" fill it in while wiring the registration-side notification.
- **UI banner/dismiss behaviour**: `TrainingSessionCard.tsx`'s existing inline registration message is not touched by this slice. The full issue's frontend ACs belong to a later slice, not this one.
- **Waitlisted registrations**: this slice's trigger is the `confirmed` branch only — the `waitlisted` branch of `registerForSession` is not in scope.

#### Key Business Rules

- **Notification never blocks or fails the primary action**: governs the notification function and fire-and-forget dispatch — registration must succeed (and respond) even if the notification channel throws or times out.
- **Cancellation and promotion are explicitly out of scope for this slice**: `cancelRegistration` and `promoteFromWaitlist` must NOT gain a notification call as part of this slice.

## Strategic Approach

#### Solution Direction

Backend only, one call site: introduce a small notification function (e.g. `notifyEmployee` in `api/src/services/notificationService.ts`) that fires a console log and, conditionally, a Slack webhook call, without being awaited by the caller. Wire it into exactly one call site: `registerForSession`'s `confirmed` branch in `trainingSessionService.ts`. Data flow: `registerForSession (confirmed branch) → fire-and-forget notifyEmployee call → (console.log always; Slack webhook conditionally)`, with the HTTP response path continuing unaffected in parallel. No frontend change in this slice.

#### Key Design Decisions

- **Where the fire-and-forget boundary lives**: call `notifyEmployee` without `await`, or `.catch()` a promise and discard it, directly at the one call site → trade-off is a slightly less centralized error-handling story, but matches the story's own implementation hint ("the core registration path should not await the notification") and avoids adding a queue/worker for a training-scope exercise. Recommended: synchronous call without `await`, errors caught and logged inside `notifyEmployee` itself so nothing escapes to the caller.
- **Console log vs. structured event emitter**: the story explicitly offers either ("event emitter or a simple async side-effect function") → trade-off is an `EventEmitter`-based design (more extensible, more moving parts) vs. a plain async function call (simpler, matches the single-call-site scope of this slice). Recommended: plain async function — only one call site exists in this slice, so an emitter adds indirection without a second subscriber to justify it.
- **Slack webhook call shape**: the story leaves the Slack message format unspecified beyond "a Slack message is sent to the configured channel" → trade-off is building a generic webhook client vs. inlining a single `fetch` call with a minimal payload. Recommended: inline minimal `fetch` to `SLACK_WEBHOOK_URL` with a plain text payload — no Slack SDK dependency needed, consistent with the story's "optional extension" framing. This is the stretch part of the slice; the console-log path must be solid first.

#### Alternatives Considered

- **Awaiting the notification inside the transaction**: rejected — the story explicitly requires the registration path to not be blocked by notification failures, and `registerForSession` runs inside a Prisma `$transaction`, where an awaited failing side-effect could roll back an otherwise-successful registration.
- **Wiring `promoteFromWaitlist`'s `notifyPromotion` seam in the same slice**: rejected for this slice per the PDF lab's explicit scope — one AC, one call site. Reusing the same `notifyEmployee` function for promotion is a natural follow-up slice, not this one.
- **Adding a notification table for history**: rejected — explicitly listed as Out of Scope in the full issue ("Notification history or inbox").

## Risk & Gap Analysis

#### Requirement Ambiguities

- **Notification "emitted" wording**: the story alternates between "notification event is emitted" and "logged to the server console" — unclear whether the console log IS the notification, or whether there's meant to be a separate emit step that console-logging subscribes to. Strategic Approach above resolves this as a single function call, but this should be confirmed, not assumed, before coding.
- **Exact `notifyEmployee` signature**: not specified by the lab materials beyond "employee name, email, session title, session date, status" as the payload — needs to be fixed concretely in REASONS Canvas (e.g. a single object parameter vs. positional args).

#### Edge Cases

- **Missing or malformed `SLACK_WEBHOOK_URL`**: what happens if the env var is set but invalid (e.g. not a URL, or a 4xx/5xx from Slack)? The story requires failures to be silent/non-blocking, so this must be caught and swallowed (likely just logged) the same way as any other notification failure.
- **Session deleted or data inconsistent between registration and notification**: low risk given notification fires synchronously right after the DB write in the same request, but worth noting as a boundary condition if `notifyEmployee` re-fetches session data instead of receiving it as an argument.

#### Technical Risks

- **Silent swallowing must not become silent-swallowing-of-real-bugs**: because failures are required to be silent to the caller, there is a risk that notification code throws for reasons unrelated to delivery (e.g. a typo accessing `session.title`) and this is never surfaced anywhere. Mitigation direction: still log the error server-side (console.error) even though it's not surfaced to the HTTP response or the user.
- **Test observability of "fire-and-forget"**: because the notification call does not block the response, tests asserting "notification logged" (per Suggested Tests) need either a way to await the fire-and-forget promise in test mode, or to assert on a spy/mock rather than strictly on console output timing — this needs a concrete testing approach decided during REASONS Canvas, not left implicit. Per the lab's expected test location, this lands at `api/tests/unit/notificationService.test.ts`.
- **No existing test coverage to extend**: confirmed no existing tests reference `notifyPromotion` or any notification concept (only the one comment in source) — this is a clean, additive slice with no risk of breaking existing passing tests for this concern specifically.

#### Acceptance Criteria Coverage (this slice only)

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| 6 | Notification emitted after confirmed registration | Yes | New call site in `registerForSession`'s confirmed branch, via `notifyEmployee` |
| 8 | Notification includes employee name, email, session title, session date, status | Yes | All fields already available at the call site without additional queries |
| 9 | Baseline: notification logged to server console | Yes | Direct `console.log` call inside `notifyEmployee` |
| 10 | Optional: Slack webhook if `SLACK_WEBHOOK_URL` is set | Partial (stretch) | In scope as the stretch part of this slice, sequenced after the console-log path is green |
| 11 | Notification failures must not fail registration (fire-and-forget) | Yes | Core design decision above (no `await` at the call site, errors caught inside `notifyEmployee`) |

**Explicitly deferred to a later slice** (not this invocation of the `tdd` skill): AC 1–5 (UI banners, dismiss/auto-dismiss, date formatting) and AC 7 (notification on waitlist promotion via the `notifyPromotion` seam).
