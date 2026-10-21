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
