# Agentic Engineering Framework — Smart Office Camp

This folder contains a vendor-neutral, evidence-led engineering lifecycle, adapted for the Smart Office ZRS Camp 2026 two-day hackathon. The reusable core is separated from repository-specific configuration in [`project/adapter.md`](project/adapter.md).

Pre-development (Context Discovery, HLD, PoC Selection, PoC Task Planning) is already complete and approved for this repository. This framework covers only the execution of the 14 approved implementation tasks in `planning/tasks/`, one at a time.

## Lifecycle

The canonical lifecycle, statuses, routing, and recovery rules are defined only in [`protocols/lifecycle.md`](protocols/lifecycle.md). Stage files define local responsibilities and entry/exit states without redefining the full workflow.

## Core guarantees

- Evidence-first reasoning with source authority and confidence states.
- Proportional Context Discovery scoped to one task, not repeated pre-development.
- Ask rather than guess; material ambiguity stops the lifecycle for a human decision.
- Current-state and approved target-state distinctions.
- Explicit context sufficiency before planning.
- Normalized Engineering Context as the planning handoff.
- Human approval gate before implementation, and a human review gate after independent review.
- Declared scope, acceptance-criteria verification, and executed checks.
- Risk-proportional security verification.
- Lightweight documentation-impact reporting during planning and review, not a separate mandatory stage.
- Independent, read-only review with a fix-and-rerun loop.
- Pre-delivery human review handoff; the default terminal state is the local working tree.
- Exactly one task executed per `/work TASK-XX` invocation; never an automatic continuation to the next task.

## Structure

- `workflows/context-discovery.md` — task resolution, proportional discovery, and sufficiency gate.
- `workflows/implementation-planning.md` — lightweight task-level planning and human approval.
- `workflows/implementation.md` — approved-plan implementation and verification.
- `workflows/independent-review.md` — independent review and fix-and-rerun lifecycle.
- `protocols/evidence.md` — claim, source, confidence, and conflict rules.
- `protocols/context-sufficiency.md` — proportional readiness gate.
- `protocols/human-clarification.md` — precise stop-and-ask format and the human decision boundary.
- `protocols/human-review.md` — plan-approval and final-review boundaries.
- `protocols/implementation.md` — reusable implementation controls.
- `protocols/review.md` — reusable review controls.
- `protocols/lifecycle.md` — canonical routing, artifact continuity, safety, and recovery rules.
- `project/adapter.md` — task resolution, source authority, repository, security, and verification configuration for this repository.
- `project/rules.md` — repository-specific operating rules.

## Invocation

```text
/work TASK-01
/work TASK-02
...
```

Each invocation resolves exactly one task file, `planning/tasks/TASK-XX-*.md`, and executes exactly one approved task through to `COMPLETE`, `REJECTED`, or `DEFERRED`. It never automatically continues to the next task — every task requires its own `/work TASK-XX` invocation.

```text
Run the context-discovery workflow for TASK-XX.
```

After `CONTEXT SUFFICIENT — READY FOR PLANNING`:

```text
Run implementation planning for TASK-XX using the Normalized Engineering Context.
```

After `HUMAN APPROVAL REQUIRED` and explicit human approval:

```text
Implement TASK-XX using the approved implementation plan.
```

After implementation and executed verification:

```text
Run independent review for TASK-XX using the approved context, plan, diff, and verification evidence. Run this in a fresh reviewer context/invocation where the host supports it — the reviewer must not be the same context as the Implementer.
```

After `REVIEW PASSED — READY FOR FINAL HUMAN REVIEW`, produce the final evidence package and stop for Final Human Review. A disposition of `APPROVED`, `REJECTED`, or `DEFERRED` stops automatic execution either way; only `APPROVED` makes the implementation eligible for a later separate explicit human delivery instruction.

Do not bypass a gate, invent missing context, or perform delivery actions. The workflow never creates commits, pushes commits or branches, creates or updates pull/merge requests, merges code, tags releases, triggers deployments, publishes artifacts, or performs equivalent delivery actions.
