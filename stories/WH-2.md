# WH-2: Employee can register for an available training session

Issue: https://github.com/dsta-tw-agentic/workshophub/issues/84

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
