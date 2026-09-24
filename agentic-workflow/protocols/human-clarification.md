# Human Clarification Protocol

When the context gate or another safety gate fails, stop. Do not guess, browse without a reason, plan, implement, or modify anything. Do not redesign around the problem.

## Human decision boundary

A genuine, material problem discovered anywhere in the lifecycle — not only during Context Discovery — uses this same stop-and-ask protocol. Examples that cross this boundary:

- an approved architecture decision conflicts with repository reality;
- the required change exceeds the resolved task's approved scope;
- an Acceptance Criterion cannot be satisfied as written;
- a new architectural decision is required that the approved artefacts do not already make;
- a required dependency or interface is undefined;
- implementation would require changing an approved HLD decision;
- the task's assumptions materially conflict with another approved artefact (context, HLD, PoC Selection, or implementation plan).

Ordinary missing evidence that the current stage can retrieve itself, routine source traversal, or a recoverable tooling issue does not qualify.

Use this output:

```markdown
## CONTEXT INSUFFICIENT

### What was discovered

- <specific material fact, conflict, or blocker>

### Evidence / source

- <task file, approved artefact, or repository file/line>
- Retrieval state for each unavailable, denied, or failed source/tool:

### Why this blocks planning or implementation

- <specific safety or scope consequence>

### Affected Acceptance Criteria

- <AC-ID(s) affected, or none>

### Human clarification required

- <the smallest concrete decision or fact required from the human>
```

Questions must identify the decision or fact required. Do not ask broad questions. If several independent facts are missing, list separate questions and explain which are blocking.
