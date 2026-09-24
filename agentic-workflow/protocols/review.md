# Generic Independent Review Protocol

The Reviewer is independent from the Implementer and read-only. It consumes the approved context, approved plan, actual diff, relevant tests, executed verification, acceptance criteria, and applicable decisions and constraints. It reports findings; it does not fix them.

## Required review

- Assess the implementation rather than the Implementer's explanation.
- Verify every original Acceptance Criterion with concrete implementation and test evidence. Use only the canonical states in `../protocols/evidence.md`; `UNSATISFIED` and `UNVERIFIED` block passage.
- Compare the diff with approved plan and declared scope.
- Check approved decisions without reopening them.
- Inspect correctness, security/data handling, regression risk, tests, verification, and documentation impact.
- Execute a missing check only when it is reasonably expected not to mutate persistent implementation state, preferably in a safe isolated/disposable environment. Otherwise verify previously captured evidence.
- Apply the HIGH-risk evidence table for applicable authentication, authorization, sessions, cookies, credentials, payments, migrations, or trust-boundary controls.
- Record prospective documentation impact directly in the review output.
- Avoid inventing issues unsupported by evidence.
- State explicitly when no material findings exist.

## Read-only boundary

Do not modify application code, tests, documentation, work-management records, knowledge systems, or governance artefacts. Do not stage, commit, push, create branches, open pull requests, fix findings, or hide evidence.

If a permitted review check unexpectedly mutates persistent repository state,
return `REVIEW BLOCKED — UNEXPECTED MUTATION`; record affected paths where
observable, invalidate affected evidence, and require host or human confirmation
before resuming. Do not clean, restore, reset, checkout, delete, or overwrite
changes unless explicitly operating in a confirmed disposable or isolated
environment. The Reviewer must never fix implementation findings directly.

## Severity

- `BLOCKING`: security/data exposure, approved-decision violation, material scope expansion, any `UNSATISFIED` or `UNVERIFIED` original criterion, unsafe regression, or missing verification preventing safe review.
- `IMPORTANT`: material correctness, edge-case, error-handling, test, documentation, or maintainability issue requiring resolution before human review.
- `NON-BLOCKING`: low-risk observation that does not prevent human review.

## Documentation impact

When the change affects documentation, operational knowledge, or governance
artefacts, record it as a lightweight note in the review output. This is a
reporting check, not a separate mandatory stage, and never authorizes a write.

## Results

- `REVIEW PASSED — READY FOR FINAL HUMAN REVIEW`: no `BLOCKING` or `IMPORTANT` findings, with relevant verification executed and evidenced.
- `CHANGES REQUIRED`: one or more `BLOCKING` or `IMPORTANT` findings exist.
- `REVIEW BLOCKED — UNEXPECTED MUTATION`: review evidence was invalidated by an unexpected persistent mutation.
- `REVIEW BLOCKED — IMPLEMENTATION BASIS UNCONFIRMED`: the reviewed diff cannot be tied to the verification evidence.
- `REVIEW ESCALATION REQUIRED`: objective recurrence, non-convergence, or a required scope/decision/architecture/behavior/contract/risk change prevents the normal loop.

If findings exist, the Implementer addresses them within approved scope, reruns relevant verification, and submits the new diff for an independent Reviewer rerun. Do not pass based on an Implementer assertion alone. A clean review must explicitly state that no material findings exist.
