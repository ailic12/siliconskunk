# Implementation Planning Workflow

## Purpose

Translate an approved, sufficient Normalized Engineering Context into an implementation-ready, evidence-led plan for the current repository. This workflow ends at human review / approval and never implements the plan.

## Entry condition

Planning may start only when the current invocation has a completed Context Discovery report with:

- the supplied Work Item identifier;
- a completed Normalized Engineering Context;
- `CONTEXT SUFFICIENT — READY FOR PLANNING`;
- original Acceptance Criteria preserved verbatim with stable IDs;
- evidence, unresolved assumptions, risk profile, and discovery metrics.
- no `DECOMPOSITION REQUIRED` result, or an approved decomposition handoff.

If that input is absent, stale, for a different Work Item, or marked `CONTEXT INSUFFICIENT`, stop and run Context Discovery instead. Do not reconstruct the context informally.

## Hard boundaries

- The Normalized Engineering Context is the primary input and scope boundary.
- Do not restart business-context discovery from scratch.
- Do not redesign the approved solution or reopen closed pre-development decisions.
- Do not invent requirements, acceptance criteria, interfaces, owners, or technical behaviour.
- Do not modify application code, work-management records, knowledge systems, governance artefacts, or generated project files.
- Do not create tickets, branches, commits, pull requests, or implementation tasks.
- Do not implement, execute tests, change configuration, or run deployment commands.
- Preserve approved target state versus current implementation distinctions.
- Stop with `CONTEXT INSUFFICIENT` if planning discovers a material context gap.
- Stop with `DECOMPOSITION REQUIRED` when one bounded implementation scope cannot satisfy all ACs.
- Stop with `HUMAN APPROVAL REQUIRED` after producing a plan.
- Follow [`../protocols/lifecycle.md`](../protocols/lifecycle.md) for global statuses, continuity, mutation, and recovery rules.

## Procedure

### 1. Validate the planning input

Verify that the context answers what changes, why, expected outcome, scope, non-goals, constraints, decisions, affected systems, acceptance expectations, unresolved questions, and assumptions.

Do not silently fill missing answers. A missing material answer is a return to `CONTEXT INSUFFICIENT`.

### 2. Extract implementation boundaries

Separate:

- approved target behaviour;
- current implementation reality;
- explicit compatibility requirements;
- repository evidence that can be reused;
- known gaps, risks, and non-goals.

Report conflicts rather than selecting a convenient interpretation. Closed decisions remain constraints on the plan.

### 3. Explore the repository proportionally

Perform targeted, read-only exploration only where needed to determine implementation details, patterns, affected files, interfaces, tests, or technical constraints.

Do not load the repository broadly. Every additional source must have a reason connected to an implementation decision.

### 4. Derive the implementation approach

Describe the smallest safe approach consistent with the approved context and current repository patterns. Identify the change boundary, sequencing, reuse versus extension, affected interfaces/data flow, unchanged compatibility surfaces, test strategy, security verification, and documentation impact.

Use `INFERRED` for choices not directly established by evidence. Do not present inferences as approved decisions.

#### Decision handling

- If an implementation or architecture decision is already approved by authoritative pre-development evidence, treat it as fixed. Record the decision and rationale; do not generate artificial alternatives or reopen it.
- If a choice affects behaviour, architecture, security, data, compatibility, scope, an external contract, ownership, or risk, it is not an ordinary local detail. Proceed only when it is `CLOSED` or explicitly `DELEGATED IMPLEMENTATION CHOICE`. Otherwise classify it as `UNRESOLVED BLOCKING`, stop, and request human selection or an upstream decision.
- Do not hide an unresolved choice inside an `INFERRED` implementation detail.

### 5. Apply the planning context gate

Return `CONTEXT INSUFFICIENT` using [`../protocols/human-clarification.md`](../protocols/human-clarification.md) when a newly discovered material fact is missing, contradicted, dependent on an unresolved decision, or required to choose safely between materially different implementations.

### 6. Produce the plan

Cite important technical choices using [`../protocols/evidence.md`](../protocols/evidence.md). End with [`../protocols/human-review.md`](../protocols/human-review.md).

## Required output

Keep the plan task-level and lightweight — this is not a second HLD or
pre-development plan.

```markdown
# Implementation Plan — <task-id>

## Planning Result

HUMAN APPROVAL REQUIRED
or
CONTEXT INSUFFICIENT
or
DECOMPOSITION REQUIRED

## Context

- Task:
- Relevant approved constraints (HLD/PoC Selection/implementation plan, only what applies):
- Relevant current repository state:
- Approved decisions reused without reopening:

## Implementation Approach

- Smallest safe approach consistent with the approved context and current repository patterns:
- Existing patterns reused:
- Unresolved meaningful choices requiring human selection, if any:

## Bounded Scope

- Approved bounded scope:
- Expected files/components to modify or create:
- Explicitly outside scope:
- Scope expansion requiring re-planning and human approval:

## Ordered Steps

1. <step>
2. <step>

## Verification

- Tests/checks to run, and expected evidence:
- Security verification proportional to risk, including the HIGH-risk evidence
  table from [`../protocols/context-sufficiency.md`](../protocols/context-sufficiency.md) where applicable:

## Acceptance Criteria Mapping

- AC-1: <exact original criterion, unchanged>
  - Planned implementation:
  - Planned verification:
  - Final state allowed: SATISFIED / REMOVED_BY_AUTHORITY / SUPERSEDED_BY_AUTHORITY / UNSATISFIED / UNVERIFIED

## Documentation Impact

- Documentation likely to need review if implemented, or none:

## Risks / Assumptions

- <material execution-level risk or assumption, or none>

## Unresolved Questions

- <question, or none>

## Evidence

- Technical choice -> exact source and confidence:

## HUMAN APPROVAL REQUIRED

### Review scope

- <task and planned change>

### Approval decisions

- <specific decisions requiring approval, or none>

### Plan status

- NOT APPROVED — implementation must not start from this output alone.
```
