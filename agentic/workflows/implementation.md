# Implementation Workflow

## Purpose

Execute an approved Implementation Plan in the current repository without reopening discovery, redesigning approved decisions, or expanding scope. This workflow ends at review readiness and never performs delivery actions.

## Entry condition

Implementation may start only when the current invocation has the same Work Item identifier, a passing Normalized Engineering Context, an approved Implementation Plan, the mandatory approval record, and an approved bounded implementation scope. A `DECOMPOSITION REQUIRED` result must be resolved into approved linked implementation units before implementation.

If the plan, plan identity, approved scope, approval disposition, or approval conditions are absent, stale, mismatched, ambiguous, or not explicitly approved, stop. Do not reconstruct, infer, or approve the plan.

## Boundaries

- Context Discovery remains the mandatory entry point.
- The Normalized Engineering Context and approved plan are the governing inputs.
- Approved business, architecture, security, and scope decisions are constraints, not prompts for redesign.
- Modify only the declared implementation scope.
- Do not invent requirements, acceptance criteria, interfaces, or missing decisions.
- Do not silently change the implementation approach.
- Do not modify governance artefacts or approved planning documents as part of implementation.
- Do not create commits, push commits or branches, create or update pull/merge requests, merge code, tag releases, trigger deployments, publish artifacts, or perform equivalent delivery actions. These require a separate explicit human instruction after the workflow stops.
- Follow [`../protocols/lifecycle.md`](../protocols/lifecycle.md) for continuity, mutation, resume, and review-loop rules.

## Procedure

### 1. Validate approved inputs

Confirm that the plan identifies target state, current reality, approved bounded scope, ordered steps, test and verification strategy, original AC mapping, security verification, documentation impact, decision classifications, assumptions, risks, unresolved questions, and the mandatory human approval record.

If any missing item is material to safe execution, return `IMPLEMENTATION BLOCKED` before editing.

### 2. Declare edit scope

Record the exact canonical files to create or modify before changing code, within the approved bounded scope. Include test files and planned documentation. Treat any file not in the declaration as outside scope. Paths must remain inside the repository root; reject traversal and unresolved symlinks.

If a needed change is discovered outside the approved scope, stop and report scope expansion as requiring re-planning and human approval. Do not edit it first. Narrowing the approved scope is allowed only when documented and does not change behavior, risk, or acceptance coverage.

### 3. Inspect implementation context

Use read-only inspection to confirm the approved plan against current repository reality: source and component boundaries, existing patterns and interfaces, tests and fixtures, and configured runtime constraints.

Do not restart business-context discovery or broaden exploration without a concrete implementation need.

### 4. Implement in scope

Apply the approved approach and ordered steps. Preserve unchanged paths, variants, contracts, and decisions. Write or update tests alongside behaviour. Update documentation identified by the plan.

### 5. Detect and handle deviations

Stop immediately if implementation exposes a material ambiguity or conflict involving required behaviour, approved decisions, dependencies, interfaces, scope, approach, or risk. Return `IMPLEMENTATION BLOCKED` with the discovery, impact, affected criteria, and required human decision.

Non-material deviations may be recorded only when they preserve approved behaviour, scope, risk posture, and acceptance criteria.

### 6. Execute verification

Before verification, record the implementation comparison basis: changed-file
snapshot, bounded scope, diff basis, and repository base/current revision where
available. Verification evidence applies only to that implementation state.

Execute every relevant test and verification check identified by the approved plan, repository conventions, risk profile, and changed risk surface. Execute deeper security checks for `HIGH` risk. Record exact commands, states from `../protocols/evidence.md`, relevant output, and the requirement or risk verified.

If a relevant check cannot be executed or fails, return `IMPLEMENTATION BLOCKED`. Use `UNAVAILABLE`, `BASELINE FAILURE`, or `POSSIBLY FLAKY` honestly; none is a pass.

### 7. Verify acceptance criteria

For every original criterion, reproduce the exact wording and record its canonical state and concrete implementation and test evidence. `UNSATISFIED` and `UNVERIFIED` prevent successful completion.

### 8. Report implementation completion

Return `IMPLEMENTATION COMPLETE — READY FOR REVIEW` only when the approved scope is complete, relevant verification has executed successfully, and every original Acceptance Criterion has an allowed final state and evidence.

## Required output

```markdown
# Implementation — <task-id>

## Result

IMPLEMENTATION COMPLETE — READY FOR REVIEW
or
IMPLEMENTATION BLOCKED

## Approved Inputs

- Normalized Engineering Context:
- Approved Implementation Plan:
- Human approval:

## Declared Scope

- Files/components declared:
- Files/components explicitly outside scope:

## Files Created

- <path>

## Files Modified

- <path> — <change>

## Tests Added/Updated

- <path> — <coverage>

## Verification Executed

- <command> — <state> — <actual result/output> — verifies <AC or risk>

## HIGH-RISK Evidence

| Control | Applicability | Evidence / source | Verification performed | Result | Residual risk |
|---|---|---|---|---|---|
| <control> | APPLICABLE / NOT APPLICABLE — reason | <source> | <check> | <result> | <risk or none> |

## Implementation Comparison Basis

- Changed-file snapshot:
- Approved bounded scope:
- Diff basis:
- Repository base/current revision where available:

## Acceptance Criteria Mapping

- AC-1: <exact original criterion, unchanged>
  - Status: SATISFIED / REMOVED_BY_AUTHORITY / SUPERSEDED_BY_AUTHORITY / UNSATISFIED / UNVERIFIED
  - Implementation evidence: <file:line or concrete artifact>
  - Test/verification evidence: <test, command, and result>

## Documentation Changes

- <path and change, or none>

## Deviations From Plan

- <deviation and evidence, or none>

## Unresolved Non-blocking Items

- <item, or none>

## Implementation Evidence

- <technical choice -> exact source>
```

For a blocker, additionally state what was discovered, why the plan is unsafe, affected criteria, required human decision, and any safe partial changes.

For partial changes, also state:

- Changed paths:
- Whether partial changes appear safe or incomplete:
- Verification already performed:
- Recommended next lifecycle action:
- No automatic delete, revert, reset, restore, or cleanup performed:
