# TASK-10: Check-in/Release reliability test suite

## Purpose
Prove, under adversarial conditions and against the real system, the four reliability guarantees the Automatic Release functionality exists to validate: duplicate check-in idempotency, release-sweep retry-safety, late-check-in-after-release non-restoration, and released-resource availability refresh.

## Approved requirements / validation criteria
R-02/R-03/R-04/R-05, BR-07/BR-08, FR-10; validation items 4, 5, 6, 7.

## Dependencies
TASK-08, TASK-09.

## Scope
Four integration test scenarios against the real DB+queue: (1) the same canonical check-in event delivered twice → exactly one applied effect (extends TASK-08's basic test with an explicit redelivery race); (2) the release sweep run twice back-to-back (or with overlapping triggers) → no double-release, no duplicate release-side-effects; (3) a check-in event arriving for a booking that has already been released → booking stays `Released`, evidence recorded `Unmatched`, never silently restored; (4) after a release, the freed resource reappears in TASK-04's availability search with no manual step.

## Explicit out of scope
Notification-specific dedup (that's TASK-12's crash-simulation test, a different mechanism).

## Acceptance criteria
All four scenarios above pass repeatably against the real Postgres+queue, with the suite failing loudly if any guarantee is violated even once across repeated runs.

## Required automated tests
The four scenarios are the deliverable.

## Verification evidence
Test run output for all four scenarios, the evidence artifact for validation items 4–7.

## Demo contribution
Feeds TASK-13 Steps 1 and 2 (release-and-reappear happy path; duplicate-check-in and late-check-in adversarial demos).
