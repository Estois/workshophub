# SPDD Analysis: Success/waitlist banners after registration (TDD lab slice 3)

## Lab Scope Note (overrides full-issue scope below for this slice)

This is the third and final slice of WH-8. The previous two slices (merged/pushed to
this branch) covered the backend notification triggers: confirmed registration and
waitlist promotion, both via `notifyEmployee`. The full GitHub issue body is preserved
verbatim below.

- **In scope for this slice**: the UI-facing acceptance criteria only — AC 1 through 5
  (success banner copy, waitlist banner copy, no-reload immediate display, dismiss/
  auto-dismiss, and silent-on-notification-failure behaviour). This is a frontend-only
  slice; no backend files are touched.
- **Out of scope for this slice**: anything backend (already done in the previous two
  slices). No new API calls, no new API response fields — the data needed for the
  banners is already available in `TrainingSessionCard.tsx`'s existing state.
- Per the `tdd` skill's hard rule: one slice, implemented and green, then stop.

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

- **`TrainingSessionCard.tsx`**: already renders an inline, non-dismissible text message after a registration attempt via the `result` state (a `Registration` object: `{ id, status: 'confirmed' | 'waitlisted', position? }`) returned from the `POST /api/training-sessions/:id/registrations` call. Current copy: `"You're registered!"` for confirmed, `` `You're on the waitlist, position ${result.position}` `` for waitlisted. This is the exact seam this slice upgrades.
- **`session` prop**: `TrainingSessionCard` already receives the full `TrainingSession` object (including `title` and `date`) as a prop — both values this slice's banner copy needs are already in scope, no new fetch required.
- **`formatDate` helper**: a date-formatting function already exists in `SessionDetailPage.tsx` (`"Monday, January 5, 2026"` style via `toLocaleDateString('en-SG', {...})`) but is not exported or shared — `TrainingSessionCard.tsx` does not currently import or use any date formatter.
- **Backend notification (previous two slices)**: already fires fully independently of the HTTP response — the frontend has no visibility into whether `notifyEmployee` succeeded or failed, which is exactly what AC 5 ("if the backend notification fails, the banner still appears") requires: the banner is driven purely by the registration API response, never by notification success.

#### New Concepts Required (this slice)

- **Banner component**: a small, dismissible (manually or by timeout) UI element replacing the current plain `<p className="session-card__registration-message">`. New — no existing banner/toast/alert component exists anywhere in `app/src`.
- **Auto-dismiss timer**: a `setTimeout`-based (or equivalent) mechanism to hide the banner after a few seconds if the user hasn't dismissed it manually. New — no existing timer-based UI behaviour in this component.
- **Shared/reusable date formatter**: needed for the exact banner copy "`[Session title] on [formatted date]`" — either extract `formatDate` from `SessionDetailPage.tsx` into a shared location, or duplicate a minimal version locally in `TrainingSessionCard.tsx`. This is a small, genuinely new decision point (see Strategic Approach).

#### Explicitly Out of Scope for This Slice

- **Any backend file**: `notificationService.ts`, `trainingSessionService.ts`, and all route files are untouched by this slice — the previous two slices already cover AC 6–11.
- **New API calls or response fields**: the banner is built entirely from data already available in component state/props today.
- **Waitlist promotion UI**: WH-8's ACs only specify banners for registration (confirmed/waitlisted) at submission time, not for a promotion happening asynchronously later while a different user might be viewing the page — there is no existing mechanism (e.g. polling, websockets) to notify a browser tab of an async promotion, and the story does not ask for one. Out of scope, not silently assumed.

#### Key Business Rules

- **Banner content is derived, not stored**: the exact strings in the ACs are template strings built from `session.title` and `session.date` (formatted) plus the existing `result.status`/`result.position` — no new fields needed from the API.
- **Banner visibility is decoupled from notification success**: AC 5 requires the banner to always appear on a successful registration API response, regardless of what the backend's fire-and-forget notification does. Because the frontend already has zero visibility into the backend notification (by design, from the previous two slices), this rule is automatically satisfied by construction — there is no code path by which notification failure could even reach the frontend.
- **Two distinct copy strings, same trigger mechanism**: both banners are driven by the same `result.status` discriminator already used by the existing inline message — this slice swaps the rendering (plain text → dismissible banner), not the trigger logic.

## Strategic Approach

#### Solution Direction

Replace the existing `result ? <p className="session-card__registration-message">...</p> : ...` block in `TrainingSessionCard.tsx` with a small, local banner render driven by a new piece of state (e.g. `bannerDismissed`, reset to `false` whenever a new `result` is set) plus a `useEffect` that starts an auto-dismiss timer when `result` changes. The banner's copy is computed from the existing `result` and `session` props/state using a small local date-formatting helper. No new component file is strictly required — the JSX can stay inline in `TrainingSessionCard.tsx`, consistent with the "narrow scope, no generic notification system" decision already made in the first slice's canvas — but a tiny presentational sub-component is also acceptable if it keeps the render method readable.

#### Key Design Decisions

- **Inline banner markup vs. a new `Banner` component**: trade-off between a reusable component (more structure, but no second consumer exists yet) vs. inline JSX (simpler, matches this story's narrow scope per the first slice's "Banner component scope" decision, which recommended staying narrow since Out of Scope explicitly excludes a notification history/inbox system). Recommended: a small local presentational component (e.g. `RegistrationBanner`) in the same file or a short new file — gives the dismiss/auto-dismiss logic a clean boundary and makes it directly unit-testable in isolation, without overbuilding a generic toast system.
- **Date formatting**: trade-off between extracting `SessionDetailPage.tsx`'s `formatDate` into a shared `app/src/utils` (or similar) location and importing it in both places, vs. writing a second, separate formatter scoped to this component. Recommended: extract into a small shared utility — avoids copy-pasting the same `toLocaleDateString` call with the same locale/options twice, and is a trivial, safe refactor (pure function, no behavior change to the existing call site) rather than the kind of unnecessary structural change the project's conventions warn against; it is justified here because a second real call site now exists, not because of hypothetical future reuse.
- **Auto-dismiss duration**: the story leaves this unspecified ("a few seconds"). Recommended: 5000ms, a common convention for transient UI feedback, implemented via `setTimeout` inside a `useEffect` keyed on `result`, cleared on unmount or when `result` changes again (e.g. after a cancel-then-re-register flow).
- **Manual dismiss affordance**: a small dismiss button/icon inside the banner, following the same plain-button convention already used elsewhere in this component (e.g. the existing `session-card__cancel-button`), not a generic icon library.

#### Alternatives Considered

- **Global/app-wide toast system (e.g. a context provider at the `App.tsx` level)**: rejected — this story's own Out of Scope section rules out "notification history or inbox," and a global toast system is more machinery than one component's transient confirmation message needs; the existing `result` state is already scoped correctly to this one card.
- **Fetching session date formatting from the backend (pre-formatted string in the API response)**: rejected — would require a backend change this slice explicitly excludes, and the existing `TrainingSession.date` is already an ISO string the frontend can format client-side, consistent with how `SessionDetailPage.tsx` already does it.

## Risk & Gap Analysis

#### Requirement Ambiguities

- **Exact auto-dismiss duration**: resolved above as 5000ms — a concrete choice the implementer must use, not re-derive.
- **Banner placement/visual style**: the story only specifies copy and dismiss behaviour, not visual design (color, position, animation). This slice should keep styling minimal and consistent with the existing `.session-card` visual language (plain text block, same font sizing as the message it replaces) rather than introducing a new visual pattern — a close reading of the existing CSS (`.session-card__registration-message`) is the baseline to extend, not replace wholesale.
- **Waitlist position in the banner**: the current inline message shows `position` for waitlisted registrations (`"You're on the waitlist, position ${result.position}"`), but the story's exact specified copy for the waitlist banner is `"You're on the waitlist for [Session title]. We'll let you know if a spot opens up."` — no position number. This is a genuine content change, not just a rendering change: the position detail is dropped from the user-facing copy to match the story's exact wording. Flagging this explicitly so it isn't silently lost or silently kept against the story's exact text.

#### Edge Cases

- **User re-registers or cancels while a banner is still showing**: the existing `result`/`cancelled` state transitions already exist; the new banner-dismiss state must reset correctly when `result` changes (e.g. a new registration attempt after a previous one), not persist a stale dismissed/shown state across different results.
- **Component unmounts while the auto-dismiss timer is pending** (e.g. user navigates away): the `setTimeout` must be cleared in the `useEffect` cleanup function to avoid a React "set state on unmounted component" warning/leak.
- **Cancellation message** (`"Your registration has been cancelled"`): this existing message is a separate UI string from the two banners this story specifies — out of scope for this slice; it should keep rendering as it does today, not be folded into the new banner component, since WH-8's Out of Scope list explicitly excludes "Notification for cancellation."

#### Technical Risks

- **Shared date-formatter refactor touching `SessionDetailPage.tsx`**: a minimal, behavior-preserving extraction, but it does touch a second file outside the immediate card component — must be verified with a quick re-check that `SessionDetailPage.tsx`'s existing rendering is unaffected (same output for the same input) after the extraction.
- **Testing a `setTimeout`-based auto-dismiss**: will need fake timers (`jest.useFakeTimers()`) in the test for this slice — a different testing technique from the backend slices' promise-based assertions; must be decided concretely, not left implicit, when tests are written.

#### Acceptance Criteria Coverage (this slice only)

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| 1 | Success banner "You're registered! [Session title] on [formatted date]" after confirmed registration | Yes | Date format decision: reuse/extract `SessionDetailPage.tsx`'s existing `formatDate` |
| 2 | Waitlist banner "You're on the waitlist for [Session title]. We'll let you know if a spot opens up." | Yes | Drops the existing `position` detail from the copy — intentional, to match the story's exact specified string (see ambiguity above) |
| 3 | Both banners appear immediately, no page reload | Yes | Already true of the existing `result`-state-driven mechanism being restyled; this SPA never reloads on form submit today |
| 4 | Banners dismissible by user or auto-dismiss after a few seconds | Yes | 5000ms auto-dismiss (decision above) plus a manual dismiss control, both resetting cleanly on a new `result` |
| 5 | If backend notification fails, banner still appears (failure is silent) | Yes | Automatically satisfied — the frontend has no code path to the backend notification's success/failure at all |
