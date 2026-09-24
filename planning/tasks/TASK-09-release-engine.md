# TASK-09: Release Engine (timezone-aware sweep)

## Purpose
Automatically release bookings that pass their check-in deadline without accepted evidence, correctly per-office-timezone, in a way that is provably safe to re-run.

## Approved requirements / validation criteria
FR-09, BR-05/BR-06/BR-07, R-02/R-05, R-06 (multi-office timezones); validation items 4 and 7 (release mechanism half).

## Dependencies
TASK-04.

## Scope
- Deadline-computation utility: `booking_date + policy.release_deadline_local` interpreted in the office's IANA timezone, converted to a UTC instant, computed at evaluation time (not pre-baked).
- Scheduled worker: query `status='Reserved' AND now > effective_deadline`, per office; for each match, a conditional `UPDATE booking SET status='Released' WHERE id=... AND status='Reserved'` (the conditional `WHERE` is what makes re-runs safe).
- Uses the injected `Clock` (plan §1 decision 10) so tests and the live demo can both control "now" without waiting for a real deadline.

## Explicit out of scope
Notification dispatch itself, including any outbox row or domain event for the release notice — this task performs **only** the release state transition (the conditional `UPDATE`). TASK-11 is solely responsible for extending this task's transaction to also persist the `ReleaseNotice` notification intent; this task's own code must not create, reference, or assume the existence of an outbox row. Audit write (explicitly dropped, plan §1 decision 13, §9 item 2).

## Acceptance criteria
- A `Reserved` booking past its office-local deadline transitions to `Released` on the next sweep.
- A booking not yet past its deadline is untouched.
- The deadline computation is correct across at least one DST transition test case for one seeded office's timezone.
- Running the sweep twice in immediate succession never double-processes an already-released booking (verified in TASK-10, but this task's own smoke test should cover the basic case).
- This task's implementation contains no notification/outbox code — that is TASK-11's responsibility, extending this task's transaction.

## Required automated tests
Unit tests for the deadline-computation utility (incl. the DST case); one integration test for the basic sweep-fires-correctly case (the adversarial retry-safety test lives in TASK-10).

## Verification evidence
Unit test output for deadline math, integration test output for basic sweep behaviour.

## Demo contribution
Feeds TASK-13 Step 1 (release firing after the demo-scoped short deadline).
