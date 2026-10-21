# SPDD Analysis: Organiser Can View Registrations For A Session

## Original Business Requirement

# WH-6: Organiser can view registrations for a session

**Type:** Story
**Status:** In Progress
**Priority:** Medium

**Context**
Training organisers need visibility into who has registered for each session. They need to see confirmed registrations and the waitlist to prepare for delivery and communicate with participants.

This is a **trainee exercise story**. It is not implemented in the baseline template.

**Description**
As a training organiser, I want to view the list of registrations for a session so that I can see who is attending and who is waitlisted.

**Acceptance Criteria**

User interactions:
- Clicking on a session card navigates the user to a session detail page (e.g., /sessions/:id)
- The session detail page shows full session info (title, date, location, description) plus a "Registrations" section below
- The Registrations section has two subsections: Confirmed (N) and Waitlist (N)
- Each entry in both subsections shows: registrant name, email, and registration date
- When both sections are empty, the page shows "No registrations yet"
- Cancelled registrations are not shown
- The page is accessible to anyone without login (consistent with the no-auth training model)

API behaviour:
- GET /api/training-sessions/:id/registrations returns HTTP 200 with the full registration list
- The response includes separate arrays for confirmed and waitlisted registrations
- Each registration includes: id, name, email, status, createdAt
- Cancelled registrations are excluded from the response
- Returns HTTP 404 if the session does not exist

**Out of Scope**
- Authentication or role-based access control
- Export to CSV or other formats
- Editing or cancelling registrations via this view
- Pagination

**Suggested Tests**
- GET /api/training-sessions/1/registrations → 200 with confirmed and waitlisted arrays
- Cancelled registrations not included in response
- Returns 404 for unknown session
- Response includes name, email, status per registration

---
Copied from upstream: https://github.com/dsta-tw-agentic/workshophub/issues/88

## Domain Concept Identification

#### Existing Concepts (from codebase)
- `TrainingSession`: the event entity, already fully modeled (`api/prisma/schema.prisma`) with `title`, `date`, `location`, `description`, `capacity`, `registered`. `getSessionById` (`api/src/services/trainingSessionService.ts`) already fetches a single session by id, augmented with a computed `waitlistCount`. This story's "session detail page" reuses this existing fetch, it doesn't need a new one.
- `Registration`: an employee's claim on a session, already has every field this story's AC asks to display — `id`, `name`, `email`, `status` (`confirmed` | `waitlisted` | `cancelled`, unconstrained `String`), `createdAt`. No new columns needed; this story is purely a new read/list view over existing data.
- `GET /api/training-sessions/:id` route (`training-sessions.ts`): already returns 404 for a missing session and 200 with the full session object otherwise — the exact response-shape precedent this story's new registrations endpoint should follow.
- `TrainingSessionCard` (`app/src/components/TrainingSessionCard.tsx`) and `TrainingSessionsPage` (`app/src/pages/TrainingSessionsPage.tsx`): the only existing frontend surface. The card currently handles register/cancel inline, no navigation anywhere in the app today — confirmed by reading both files and `App.tsx`/`main.tsx`.

#### New Concepts Required
- **Session detail page** (a new frontend page/route): nothing like this exists today. The app has exactly one screen (`TrainingSessionsPage`, rendered directly by `App.tsx`) and **no client-side router at all** — `react-router-dom` is not a dependency of `app/package.json`, and no `<Router>`/`<Route>` usage exists anywhere in `app/src`. This story is the first to require any navigation between views.
- **Registrations-by-session query/endpoint**: nothing in the codebase today reads registrations scoped to a session and split by status for *display* purposes (as opposed to the count-only `_count` used for `waitlistCount`, or the single-row lookups used by `registerForSession`/`cancelRegistration`). This is new service logic, though it's a straightforward `findMany` — no new relationships or schema.
- **Confirmed/Waitlist grouping shape**: the AC's `{ confirmed: [...], waitlisted: [...] }`-style split (two arrays) doesn't exist as a return shape anywhere in the service layer today — closest precedent is `waitlistCount`'s separate-count-by-status pattern on `getAllSessions`/`getSessionById`, but that returns a number, not a list.

#### Key Business Rules
- **Cancelled registrations are never shown**: governs the new registrations-list query — must filter `status != 'cancelled'` (or equivalently `status IN ('confirmed', 'waitlisted')`), consistent with how `waitlistCount`'s `_count` already filters to a specific status rather than returning everything.
- **No access control**: this view is intentionally public, consistent with every other endpoint in this codebase today (no auth exists anywhere) — not a new decision this story introduces, just a continuation of the existing no-auth posture.
- **404 on missing session**: governs the new endpoint the same way `GET /:id` already behaves — must check the session exists before (or instead of) querying its registrations.

## Strategic Approach

#### Solution Direction
Backend: add one new service function (e.g. `getRegistrationsForSession(sessionId)`) in `trainingSessionService.ts` that checks the session exists (404 if not), then queries `Registration` filtered to `trainingSessionId` and `status != 'cancelled'`, and returns the confirmed/waitlisted split. Add one new route, `GET /:id/registrations`, in `training-sessions.ts`, following the exact same route → service → prisma layering already used by every other endpoint in that file. No schema changes.

Frontend: this is the strategically heavier half of the story, because of the missing-router gap identified below. The direction that best fits "clicking a session card navigates to a detail page" is introducing minimal client-side routing (most naturally `react-router-dom`, the de facto standard for a Vite+React 18 app, though the REASONS Canvas phase should confirm this choice explicitly rather than assume it) with exactly two routes: the existing sessions list at `/`, and a new session detail page at `/sessions/:id`. The detail page re-fetches the single session via the existing `GET /:id` endpoint and fetches the new registrations endpoint, rendering the existing session info fields plus the new Confirmed/Waitlist sections.

#### Key Design Decisions
- **Adding a routing library vs. a hand-rolled view-switch**: Trade-off — `react-router-dom` is a new dependency (this codebase currently has zero frontend routing dependencies), but hand-rolling "show detail view when some piece of state is set" would fight against the AC's explicit framing of this as navigation to a URL (`/sessions/:id`), which implies real URLs that are shareable/bookmarkable/back-button-aware. Recommendation: add `react-router-dom` — it's the standard, lowest-friction way to satisfy "navigates to a page" semantics in a Vite+React app, and avoids inventing ad hoc client-side routing logic that a standard library already solves correctly (e.g., browser back/forward behavior). This should be confirmed, not silently assumed, in the REASONS Canvas phase, since it's the single most consequential new-dependency decision in this story.
- **Response shape for the new registrations endpoint**: Trade-off — a single flat array with a `status` field per entry (client splits it) vs. a pre-split `{ confirmed: [...], waitlisted: [...] }` object (server splits it). Recommendation: pre-split on the server, since the AC explicitly frames the UI as "two subsections" with independent counts (`Confirmed (N)` / `Waitlist (N)`) — pushing that grouping into the service layer avoids duplicating the same filter/group logic in the frontend, and matches the existing precedent of computing `waitlistCount` server-side rather than deriving it client-side from a raw list.
- **Whether the session-info portion of the detail page re-fetches via `GET /:id` or receives the already-fetched session object via navigation state**: Trade-off — reusing the already-known session data (passed via router state or kept in a shared cache) avoids a redundant fetch, but a full page reload / direct URL visit to `/sessions/:id` (e.g., a bookmarked or shared link) would have no prior fetched state to rely on. Recommendation: the detail page should independently fetch via `GET /:id` on mount, not rely on navigation state — this is the only approach that correctly supports direct URL access, which the AC implies by specifying a real path (`/sessions/:id`) rather than a modal or in-page expansion.

#### Alternatives Considered
- **In-page expansion/modal instead of a separate route** (e.g., clicking a card expands a registrations panel inline on the same list page, no URL change): rejected — the AC explicitly says "navigates the user to a session detail page (e.g., /sessions/:id)," which specifies a distinct URL, not an in-page interaction.
- **Returning a single combined registrations array with a `status` field, letting the frontend group it**: rejected per the response-shape decision above — the AC's framing as two named subsections with independent counts is better served by the server doing the split once, not the client doing it on every render.
- **Extending `GET /:id` itself to inline a `registrations` field** rather than adding a new nested endpoint: rejected — the AC explicitly specifies a distinct endpoint path (`GET /api/training-sessions/:id/registrations`), and keeping it separate avoids bloating the main session-list/detail payload (`GET /` and `GET /:id`) with per-registration data those existing call sites don't need.

## Risk & Gap Analysis

#### Requirement Ambiguities
- **No routing library exists in this codebase today, and the story's AC assumes real page navigation.** This is the single biggest gap: the story was written as if client-side routing already exists (it doesn't), so "clicking a session card navigates to a session detail page" requires introducing net-new frontend infrastructure (a router, at minimum two defined routes, and a navigation mechanism on `TrainingSessionCard`) that is not mentioned anywhere in the story's scope, hint, or out-of-scope list. This must be resolved explicitly in the REASONS Canvas (which library, how routes are structured) rather than discovered mid-implementation.
- **"Clicking on a session card" — does the entire card become clickable, or only a specific element (e.g., a "View Registrations" link/button)?** The existing `TrainingSessionCard` already has interactive children (Register button, a registration form, a Cancel button) — making the whole card a click target risks conflicting with those existing click handlers (e.g., clicking the card to navigate vs. clicking a button inside it to register). Needs explicit resolution: most likely a dedicated link/button addition rather than wrapping the entire existing card in a navigation handler.

#### Edge Cases
- **A session with registrations but all of them cancelled**: AC says "when both sections are empty, the page shows 'No registrations yet'" — this is the correct and directly-covered behavior, since cancelled ones are excluded from the query entirely, so a session that is 100% cancelled registrations should behave identically to a session with zero registrations ever made.
- **Direct navigation to `/sessions/:id` for a non-existent session id**: the API correctly 404s (same as the existing `GET /:id` behavior), but the frontend detail page's handling of that 404 (show a "not found" state vs. silently blank) is not specified by the AC and needs a decision in the canvas phase, following the existing error-handling pattern already used by `TrainingSessionsPage` (loading/error/empty states).
- **Very large registrant lists**: explicitly out of scope per "Pagination" being excluded — no mitigation needed, just confirms the simple `findMany`-and-render approach is acceptable for this story.

#### Technical Risks
- **New dependency footprint**: adding `react-router-dom` (or any router) is this story's only new third-party dependency — low risk technically (mature, widely-used library, no known CVEs of note at time of writing) but is a process risk worth flagging given this repo's CLAUDE.md "Team norms" don't mention a preferred routing approach, and the prior pnpm-lockfile CI version mismatch (pnpm 9 in CI vs. pnpm 12 locally) means any new dependency addition must be done carefully — regenerate the lockfile with `corepack prepare pnpm@9 --activate` per established project convention, not with the sandbox's default pnpm version.
- **No risk to data integrity or concurrency**: this story is read-only (a `GET` endpoint over existing data, no mutations), so none of the transactional/race-condition concerns that shaped WH-4/WH-5 apply here.

#### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| 1 | Clicking a session card navigates to a session detail page | Yes, contingent on resolving the routing-library gap | Requires introducing client-side routing from scratch — biggest open design decision, must be resolved in REASONS Canvas, not assumed. |
| 2 | Detail page shows full session info + "Registrations" section | Yes | `GET /:id` already returns all needed session fields; no backend change needed for this part. |
| 3 | Registrations section has Confirmed (N) / Waitlist (N) subsections | Yes | Addressed by the new endpoint's pre-split response shape. |
| 4 | Each entry shows registrant name, email, registration date | Yes | All three fields already exist on `Registration` — no schema change. |
| 5 | Empty state shows "No registrations yet" | Yes | Directly addressable; same empty-state pattern as the exact copy specified. |
| 6 | Cancelled registrations not shown | Yes | Addressed by the new query's status filter. |
| 7 | No-login access | Yes | Already true of every endpoint/page in this codebase — no new work required. |
| 8 (API) | `GET /:id/registrations` returns 200 with confirmed/waitlisted arrays | Yes | New route + service function, following existing route → service → prisma layering. |
| 9 (API) | Each registration includes id, name, email, status, createdAt | Yes | Direct field selection from the existing `Registration` model. |
| 10 (API) | Cancelled registrations excluded from response | Yes | Same status filter as AC 6. |
| 11 (API) | 404 if session does not exist | Yes | Same existence-check pattern as the existing `GET /:id` route. |
