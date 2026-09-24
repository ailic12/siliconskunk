# Independent Review Workflow

## Purpose

Independently evaluate an implemented change against its approved context, plan, decisions, constraints, acceptance criteria, tests, verification evidence, and documentation impact. This workflow is read-only and ends at the human review boundary.

## Lifecycle

Use the canonical lifecycle in [`../protocols/lifecycle.md`](../protocols/lifecycle.md).
This workflow's entry state is `IMPLEMENTATION COMPLETE — READY FOR REVIEW` and
its exit states are `CHANGES REQUIRED`, `REVIEW BLOCKED — UNEXPECTED MUTATION`,
`REVIEW BLOCKED — IMPLEMENTATION BASIS UNCONFIRMED`, `REVIEW ESCALATION
REQUIRED`, or `REVIEW PASSED — READY FOR FINAL HUMAN REVIEW`. It never performs
delivery actions.

## Entry condition

Independent Review may start only when the same task has a passing Normalized Engineering Context, approved Implementation Plan, explicit human approval, declared scope, actual implementation diff, relevant tests, and executed verification results.

If any required input is absent, stale, mismatched, or not approved, stop and report the missing review input. Do not review from the Implementer's summary alone.

## Read-only independence

- Review the actual diff and repository state, not only the Implementer's report.
- Never modify application code, tests, documentation, work-management records, knowledge systems, or governance artefacts.
- Never create commits, branches, pull requests, tickets, or equivalent delivery artefacts.
- Do not reopen approved decisions or invent issues unsupported by evidence.
- Do not pass review with unverified relevant tests or checks.
- Prefer a fresh review invocation/context where the host supports it. If review
  shares context with implementation, disclose that limitation in the output.

## Procedure

### 1. Read review inputs

Read the original Acceptance Criteria, Normalized Engineering Context, approved
plan and approval, actual diff, changed-file list, relevant tests and fixtures,
executed verification results, and relevant approved decisions and constraints
from the project adapter's authoritative source categories. Review the actual
implementation, not only the Implementer's summary.

Read additional repository or knowledge sources only when needed to verify a concrete review question.

### 2. Review scope and plan adherence

Compare actual changed files with declared scope. Identify undeclared changes, missing planned changes, changed explicitly unchanged surfaces, and deviations from the approved approach.

Record the implementation comparison basis used by verification: changed-file
snapshot, bounded scope, diff basis, and repository base/current revision where
available. If the basis cannot be established or includes unrelated pre-existing
changes, return `REVIEW BLOCKED — IMPLEMENTATION BASIS UNCONFIRMED`; do not pass
review from an unbound verification result.

### 3. Review acceptance criteria

For every original criterion, reproduce its exact wording and determine whether
it is implemented, evidenced by code, evidenced by tests/checks, and consistent
with the approved plan. Use only the canonical AC states in
`../protocols/evidence.md`. `UNSATISFIED` and `UNVERIFIED` block passage.

### 4. Review decisions and constraints

Check architecture, security, data, interface, operational, compatibility, and system-boundary constraints. Do not reopen approved decisions.

### 5. Review correctness and risk

Inspect logic, edge cases, error handling, state transitions, race conditions, regressions, interfaces, and external dependency assumptions.

### 6. Perform risk-proportional security verification

- Low-risk isolated UI: input/output handling, accessibility state, client exposure, and relevant tests.
- Medium-risk boundary, API, data, or configuration: validation, errors, data flow, authorization effects, and relevant checks.
- High-risk authentication, authorization, session, cookie, credential, payment, migration, or trust-boundary changes: deeper access-control, sensitive-data, token/session, logging, dependency/configuration, and security-test checks.

Report the checks performed and actual results. A required but unexecuted check is an `IMPORTANT` or `BLOCKING` finding according to risk.

### 7. Review tests and execute missing checks

Verify meaningful happy-path, edge, error, and security coverage. Inspect skipped
or weakened tests, fixtures, assertions, and executed command output. Execute a
missing check only when it is reasonably expected not to mutate persistent
implementation state, preferably in a safe isolated/disposable environment. If
that cannot be guaranteed, verify previously captured evidence instead. A passed
review requires actual results or justified verified evidence.

If a review command unexpectedly mutates persistent repository state, return
`REVIEW BLOCKED — UNEXPECTED MUTATION`. Record the mutation and affected paths
where observable, invalidate affected review and verification evidence, and
require host or human confirmation that repository state is safe before resuming.
Do not run `git clean`, checkout/reset, delete files, restore files, overwrite
changes, or otherwise attempt cleanup unless explicitly operating in a confirmed
disposable or isolated environment. Never fix implementation findings directly.

### 8. Record documentation impact

Compare the implementation with the planned documentation impact and record,
as a lightweight note in the review output, any repository documentation that
may need updating as a result. This is a reporting check, not a separate
mandatory stage.

### 9. Return the review result

After no `BLOCKING` or `IMPORTANT` findings remain, return
`REVIEW PASSED — READY FOR FINAL HUMAN REVIEW`.

### 10. Classify findings

- `BLOCKING`: security/data exposure, approved-decision violation, material scope expansion, any unsatisfied or unverified original criterion, unsafe regression, or missing verification preventing safe review.
- `IMPORTANT`: material correctness, edge-case, error-handling, test, documentation, or maintainability issue requiring resolution before human review.
- `NON-BLOCKING`: low-risk observation that does not prevent human review.

Every finding cites concrete file/line, diff, test, command output, or approved source. Do not manufacture findings. A clean review explicitly states that no `BLOCKING` or `IMPORTANT` findings exist.

### 11. Apply the fix-and-rerun loop

If `BLOCKING` or `IMPORTANT` findings exist, return `CHANGES REQUIRED`. The
Implementer addresses findings within approved scope, reruns relevant
verification, and submits the new diff for an independent review rerun. Track
finding IDs and disposition. If the same underlying finding recurs for the
second time after an attempted fix, classify it as `RECURRED` and return
`REVIEW ESCALATION REQUIRED`. Also escalate when two consecutive iterations
introduce new blocking findings, or when resolution requires scope expansion, a
new upstream decision, architectural/behavior/contract change, or new material
risk. Do not continue the normal loop in those cases.

## Required output

```markdown
# Independent Review — <task-id>

## Result

REVIEW PASSED — READY FOR FINAL HUMAN REVIEW
or
CHANGES REQUIRED
or
REVIEW BLOCKED — UNEXPECTED MUTATION
or
REVIEW ESCALATION REQUIRED
or
REVIEW BLOCKED — IMPLEMENTATION BASIS UNCONFIRMED

## Review Inputs

- Normalized Engineering Context:
- Approved Implementation Plan:
- Human approval:
- Implementation diff:
- Tests and executed verification:
- Implementation comparison basis used for verification:
- Reviewer identity/session and fresh-context status:
- Artifact versions or retrieval times, repository base revision when available:

## Scope and Plan Review

- Declared scope respected:
- Undeclared changes:
- Plan deviations:

## Findings

- Review iteration: <number or initial>

### BLOCKING

- F-1: <finding or none>
  - Severity:
  - Evidence:
  - Required correction:
  - Disposition: OPEN / RESOLVED / RECURRED / ESCALATED

### IMPORTANT

- F-2: <finding or none>
  - Severity:
  - Evidence:
  - Required correction:
  - Disposition: OPEN / RESOLVED / RECURRED / ESCALATED

### NON-BLOCKING

- F-3: <finding or none>
  - Severity:
  - Evidence:
  - Required correction:
  - Disposition: OPEN / RESOLVED / RECURRED / ESCALATED

## Acceptance Criteria Verification

- AC-1: <exact original criterion, unchanged>
  - Status: SATISFIED / REMOVED_BY_AUTHORITY / SUPERSEDED_BY_AUTHORITY / UNSATISFIED / UNVERIFIED
  - Code/diff evidence:
  - Test/verification evidence:

## Decision and Constraint Verification

- <approved decision/constraint -> evidence>

## Security Verification

- Risk level:
- Checks executed and results:
- Applicable high-risk minimum checks: authorization/access control, negative paths,
  sensitive data, abuse/security scenarios, compatibility, rollback/recovery,
  dependency/configuration changes, and failure behavior:

| Control | Applicability | Evidence / source | Verification performed | Result | Residual risk |
|---|---|---|---|---|---|
| <control> | APPLICABLE / NOT APPLICABLE — reason | <source> | <check> | <result> | <risk or none> |

## Documentation Impact

- Prospective impact identified during planning:
- Repository documentation checked:
- Stale, incomplete, or misleading documentation found during review, or none:

## Review Boundary

- No code, tests, documentation, or governance artefacts were modified.
- No commit, branch, pull request, or equivalent delivery action was performed.
- No commit, push, pull/merge request, merge, release, deployment, publication,
  or equivalent delivery action was performed or authorized by this review.
```
