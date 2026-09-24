# TASK-13: End-to-end demo harness

## Purpose
Assemble the already-proven functionality from TASK-05/TASK-10/TASK-12 into one coherent, runnable demo: the happy-path story plus the four adversarial demonstrations plus the adapter-extensibility evidence packaging, per PoC Selection §5's "coherent demo story."

## Approved requirements / validation criteria
Key validation items are exercised live; all 11 are backed by automated evidence (TASK-05/TASK-10/TASK-12); PoC Selection §5.

## Dependencies
TASK-05, TASK-10, TASK-12.

## Scope
- One happy-path script/test: Discover → Reserve → Confirm → No-checkin → Release → Re-offer, per plan §8 Step 1, asserting each transition and printing/logging it clearly for a live audience.
- Four adversarial demo scripts, per plan §8 Step 2: concurrent booking race, duplicate check-in, late check-in after release, notification provider failure — each independently runnable, each reusing the already-tested code paths (this task orchestrates, it does not reimplement).
- Adapter-extensibility evidence packaging, per plan §8 Step 3: a short script/README pointing at TASK-07's contract tests and TASK-08's adapter-agnostic dependency as the proof.

## Explicit out of scope
Any new business logic — every scenario here must be a thin orchestration layer over TASK-04/05/06/07/08/09/10/11/12. If a demo script needs new logic to work, that's a sign a prior task's scope was incomplete, not new scope for this task.

## Acceptance criteria
Each of the five scripts (happy path + 4 adversarial) runs standalone and produces clear, legible pass/fail output a non-technical viewer can follow live.

## Required automated tests
The happy-path script is also runnable as an automated e2e test (`test/e2e/demo-story.spec.ts`) asserting the same transitions non-interactively.

## Verification evidence
A recorded/logged run of all five scripts, referenced directly by TASK-14's final evidence bundle.

## Demo contribution
This task *is* the demo — all of plan §8 Steps 1–3.
