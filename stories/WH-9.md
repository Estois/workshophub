# WH-9: Audit log for registration state changes

**Type:** Story
**Status:** To Do
**Priority:** Medium
**Issue:** https://github.com/Estois/workshophub/issues/15

## Context

For compliance and debugging, every state change to a registration should be recorded. An audit log captures who did what and when, and provides a full history for each registration lifecycle.

This is a **trainee exercise story**. It is not implemented in the baseline template.

## Description

As a training organiser, I want an audit log of every state change to a registration so that I can trace the full history of a registration for reporting or dispute resolution.

Each state change (registered, waitlisted, promoted, cancelled) creates an immutable audit log entry. The organiser queries the audit log via the API.

## Acceptance Criteria

### Organiser workflow
- The organiser opens the session registrations page (WH-6) and identifies the registration ID they want to investigate
- The organiser calls `GET /api/training-sessions/:id/registrations/:registrationId/audit` to see the full state history
- The response shows a time-ordered list of transitions, e.g.: `null → confirmed` (registered), `confirmed → cancelled` (cancelled), and for a different registration: `null → waitlisted` then `waitlisted → confirmed` (promoted)
- This gives the organiser a complete picture of every state a registration has been through

### Data and API behaviour
- An `AuditLog` table is created with: id, registrationId, fromStatus, toStatus, changedAt, reason (optional string)
- Every registration state change creates an audit log entry atomically within the same transaction
- `GET /api/training-sessions/:id/registrations/:registrationId/audit` returns the full audit history in chronological order
- Audit entries are immutable: they cannot be updated or deleted via the API
- Returns HTTP 404 if the registration does not exist
- The audit log captures all transitions: initial registration, promotion, cancellation

## Out of Scope
- User identity / actor tracking (no auth in this training)
- Audit log UI page (API only is sufficient for training)
- Log rotation or archival

## Suggested Tests
- Register → audit entry created with `fromStatus: null`, `toStatus: "confirmed"`
- Waitlist registration → audit entry with `fromStatus: null`, `toStatus: "waitlisted"`
- Promotion → audit entry with `fromStatus: "waitlisted"`, `toStatus: "confirmed"`
- Cancellation → audit entry with `fromStatus: "confirmed"`, `toStatus: "cancelled"`
- `GET .../audit` returns full history in chronological order
- Audit entries not modified after creation

## Implementation Hint

Add the `AuditLog` Prisma model and create entries inside each Prisma transaction that modifies registration status.
