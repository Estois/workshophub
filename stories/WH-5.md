# WH-5: Promote first waitlisted employee after cancellation

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
