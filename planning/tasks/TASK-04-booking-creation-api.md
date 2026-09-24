# TASK-04: Booking creation API + conflict-prevention constraints

## Purpose
Deliver the first selected PoC functionality end-to-end at the API layer: an employee can search availability and create a booking, and both database-level conflict-prevention constraints (resource-level and employee-level) are wired to clean, actionable HTTP responses.

## Approved requirements / validation criteria
FR-03 (create booking), FR-01 (availability search, scaffolding depth only), FR-05/R-01 (resource-level conflict prevention), BR-02 (employee-level daily limit), BR-01/BR-03/BR-04 (one working day, booking window, resource-status gating) — all enforced server-side. Validation items 1, 2, 3, 7 (partially — search is exercised here, release reappearance proven in TASK-10).

## Dependencies
TASK-03.

## Scope
- `GET` availability query: active resources of a type in an office minus resources with an active (`Reserved`/`CheckedIn`) booking on a given date.
- `POST /bookings`: creates a `Reserved` booking; rejects resources that are `Unavailable`/`UnderMaintenance` (BR-04), rejects dates outside the policy's booking window (BR-03), always books exactly one working day (BR-01).
- Maps both partial-unique-index violations (from TASK-02) to a clean `409 Conflict` with a message identifying which constraint fired (resource already booked vs. employee already has one of that type that day).
- Server-side authorization: an employee can only create bookings for themselves, resolved from the seeded dev-token identity (TASK-03), never from a client-supplied employee id.

## Explicit out of scope
Resource-characteristic filtering beyond a plain available/unavailable list (Q-03 open, not needed for PoC); view/cancel endpoints (FR-04, not selected); the adversarial concurrency test suite itself (TASK-05).

## Acceptance criteria
- A valid booking request returns `201` with status `Reserved`.
- A request for an unavailable/under-maintenance resource returns a clear rejection, not a 500 or a silent success.
- A request outside the booking window is rejected server-side even if a client bypasses UI validation.
- A resource-level conflicting request returns `409` with a body distinguishing it from an employee-level conflict.
- An employee cannot create a booking on behalf of another employee id.

## Required automated tests
Unit tests for BR-01/03/04 as isolated domain logic; API-level tests (Supertest) for the happy path and each rejection case, run against the real Compose Postgres per TASK-01.

## Verification evidence
Test suite output covering every acceptance criterion above.

## Demo contribution
Feeds TASK-13 Step 1 (happy-path booking) directly; the constraints it wires are proven under real concurrency in TASK-05 and demoed live in TASK-13 Step 2.
