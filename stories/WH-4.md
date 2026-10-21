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
