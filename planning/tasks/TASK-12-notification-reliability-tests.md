# TASK-12: Notification reliability test suite

## Purpose
Prove the two reliability claims that make Notification Dispatch a distinct PoC functionality rather than plumbing: a failing/slow channel never affects booking or release correctness, and the one documented duplicate-send window (crash between provider-ack and status commit) stays confined to that window.

## Approved requirements / validation criteria
FR-18, R-05, NFR-03; validation items 9, 10, 11.

## Dependencies
TASK-11.

## Scope
- Failure-isolation test: configure the fake channel to fail/time out; create a booking; assert the booking transaction still succeeds (`201`) and is fully committed regardless of notification outcome.
- Crash-simulation dedup test: simulate a worker that successfully calls the fake channel but crashes/is killed before committing `status='Sent'`; on lease expiry, confirm the notification is re-claimed and resent (the one documented duplicate), and that this never corrupts booking/release state — it only ever produces an extra "sent" log entry.
- Exactly-one-intent test: run a full booking→release lifecycle under normal (non-crash) operation and assert exactly one `Confirmation` and one `ReleaseNotice` row reach `Sent`.

## Explicit out of scope
Any attempt to make notification delivery exactly-once — the whole point of this test suite is proving the at-least-once guarantee is honestly scoped (HLD §5.5), not eliminating it.

## Acceptance criteria
All three scenarios pass repeatably; the crash-simulation test explicitly demonstrates the duplicate is confined to the documented window and never appears outside it across repeated runs.

## Required automated tests
The three scenarios above are the deliverable.

## Verification evidence
Test run output for all three, the evidence artifact for validation items 9–11.

## Demo contribution
Feeds TASK-13 Step 2 (notification-provider-failure adversarial demo).
