# Human Review Protocol

Planning ends before execution. The generated plan is advisory and requires explicit human approval. After Independent Review and required fixes/verification reruns have completed successfully, the workflow produces `READY FOR FINAL HUMAN REVIEW` and stops automatic execution.

## Required boundary

- Do not modify application code, work-management records, knowledge systems, governance artefacts, or generated project files.
- Do not create tickets, branches, pull requests, commits, or implementation tasks as side effects.
- Do not create or update pull/merge requests, merge code, tag releases, trigger deployments, publish artifacts, or perform equivalent delivery actions.
- Do not claim that the plan has been approved.
- Do not continue into implementation after producing the plan.
- Do not treat `APPROVED` final implementation review as permission to commit, push, create/update a pull or merge request, merge, release, deploy, or publish. Those require a separate explicit human instruction after this workflow stops.

## Required output

```markdown
## HUMAN APPROVAL REQUIRED

### Review scope

- <task identifier and planned change>

### Approval decisions

- <specific plan decisions requiring human approval, if any>

### Plan status

- NOT APPROVED — implementation must not start from this output alone.
```

Explicit approval is an input to Implementation, not an automatic transition. The approval must identify the task, plan version or retrieval time, scope, approver, date, and any conditions. If exact identity is unavailable, mark it `UNAVAILABLE`; do not claim the plan is bound. Approval is invalidated by a material context, plan, scope, target, decision, interface, security, or risk change.

## Mandatory plan approval record

```markdown
## PLAN APPROVAL

- Task:
- Plan identity/version or clearly identifiable plan instance:
- Approved bounded implementation scope:
- Disposition: APPROVED / NOT APPROVED
- Human approver identifier: <identifier or UNAVAILABLE>
- Approval date/time: <value or UNAVAILABLE>
- Conditions:
```

Implementation must not begin when the plan identity, approved bounded scope,
or approval disposition is missing or ambiguous. Approval of a plan also approves
the bounded scope described in that plan. Narrowing may be documented during
implementation; expanding the scope requires re-planning and human approval.

## Final evidence package

The human receives a concise package containing the task identifier, original
Acceptance Criteria, authoritative decisions, approved plan, actual scope and
deviations, verification states/results, Independent Review result and findings,
changed files, concise diff summary, residual risks and known limitations,
recommended manual testing, and local run/inspection instructions. Final
disposition is one of `APPROVED`, `REJECTED`, or `DEFERRED`. This disposition
concerns the implementation only, not delivery. `APPROVED` requires every
original AC to be `SATISFIED`, `REMOVED_BY_AUTHORITY`, or `SUPERSEDED_BY_AUTHORITY`.

## Mandatory final disposition record

```markdown
## FINAL HUMAN REVIEW

- Task:
- Evidence package/artifacts considered:
- Original Acceptance Criteria status:
- Approved implementation scope:
- Reviewed implementation comparison basis:
- Implementation unchanged since verification and review: YES / NO
- Independent Review status:
- Residual risks / known limitations:
- Final disposition: APPROVED / REJECTED / DEFERRED
- Reviewer identifier: <identifier or UNAVAILABLE>
- Review date/time: <value or UNAVAILABLE>
- Conditions/comments:
```

`APPROVED` applies to the reviewed implementation state for this task only, not
to any other task. If the implementation changes after approval, approval is
stale and delivery eligibility is invalid until verification and Independent
Review are completed again and Final Human Review produces a new `APPROVED`
record. `APPROVED`, `REJECTED`, and `DEFERRED` all stop automatic execution;
none of them starts discovery, planning, or implementation for another task. A
new `/work TASK-XX` invocation is required for every task.
