# TASK-08: Check-in Gateway worker (idempotent ingestion + matching)

## Purpose
Consume canonical `CheckInEvent`s from the queue, absorb duplicates via the database idempotency constraint, resolve provider-specific identifiers to local resources/employees, and match evidence to a `Reserved` booking — or record it as `Unmatched` when there's no safe match.

## Approved requirements / validation criteria
R-02/R-03/R-04 (idempotent, order-tolerant processing), BR-08 (late/ambiguous events never silently restore a booking); validation items 5 and 6.

## Dependencies
TASK-06, TASK-04. **Deliberately does not depend on TASK-07** — this worker imports only the canonical contract module from TASK-06 and consumes from the queue; it is tested by enqueuing hand-constructed canonical events directly, never through an adapter. This is the corrected dependency structure from human review (plan §1 decision 12).

## Scope
- Consume from the queue (at-least-once delivery assumed).
- Insert into `checkin_evidence` guarded by the `(source_system, external_event_id)` unique constraint; a constraint violation is a no-op acknowledge, not an error.
- On first delivery: resolve `subject_reference` via `external_mapping` to a resource (and employee, where the source identifies one); look up a `Reserved` booking for that resource(+employee) on the current office-local working day.
- Exactly one plausible match → apply `CheckedIn`. Zero or more-than-one plausible match → record `outcome=Unmatched`, never guess (per HLD §7.1).

## Explicit out of scope
Any adapter-specific logic (belongs in TASK-07); the release sweep (TASK-09); admin resolution UI for `Unmatched` evidence (no admin UI in this PoC).

## Acceptance criteria
- A hand-constructed canonical event with a valid mapping and an existing `Reserved` booking results in that booking becoming `CheckedIn`.
- The same event, submitted a second time, produces zero additional state change and no error.
- An event with no mapping match, or an ambiguous match, is recorded `Unmatched` and the booking (if any) is untouched.
- None of this task's code imports anything from the adapters module.

## Required automated tests
Integration tests against the real queue+DB for: first-delivery match, duplicate-delivery no-op, unmatched/ambiguous cases — using directly-constructed canonical events, not adapter payloads.

## Verification evidence
Test output for all three cases above, plus a static-import check (or code-review note) confirming no dependency on the adapters module.

## Demo contribution
Enables TASK-10's reliability tests and TASK-13 Steps 1–2 (check-in application and duplicate-check-in demo).
