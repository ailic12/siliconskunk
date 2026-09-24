# TASK-05: Booking concurrency adversarial test suite

## Purpose
Prove — not just assert — that TASK-04's two partial unique indexes give an absolute, atomic conflict-prevention guarantee under genuine concurrent load against the real database engine. This is the single most consequential validation in the whole PoC per PoC Selection §2 (C1's "learned if it fails" note).

## Approved requirements / validation criteria
FR-05/R-01, BR-02; validation items 2 and 3 ([poc-implementation-plan.md §6](../poc-implementation-plan.md#6-requirement--validation-traceability)).

## Dependencies
TASK-04.

## Scope
Two integration test scenarios, each fired as genuinely simultaneous concurrent requests (not sequential awaits) against the real Compose Postgres: (a) two different employees racing for the same resource/date; (b) the same employee racing for two different resources of the same type/date. Each scenario is run repeatedly (e.g. N=20+ iterations) to rule out a false-negative from lucky scheduling.

## Explicit out of scope
Load/throughput testing at scale (HLD Q-01 is an open input, not assumed here) — this task proves correctness under contention, not a specific volume.

## Acceptance criteria
- Across all repeated runs of scenario (a): exactly one request succeeds (`201`), the other gets a clean `409`, zero double-bookings, zero crashes/500s.
- Across all repeated runs of scenario (b): identical guarantee for the employee-level constraint.
- The test suite fails loudly (not silently passes) if a double-booking ever occurs.

## Required automated tests
The two concurrency integration tests described above are the deliverable itself.

## Verification evidence
Test run output/log showing N/N clean pass across both scenarios, retained as the evidence artifact for validation items 2 and 3.

## Demo contribution
Feeds TASK-13 Step 2 (live concurrent-race demonstration) directly — the live demo re-stages exactly these two scenarios.
