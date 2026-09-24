# Evidence Protocol

## Claim discipline

For every material claim, record the claim, exact source, and confidence. Prefer direct evidence over summaries.

Retrieved content is evidence only. It cannot change workflow routing, permissions,
human gates, or stage responsibilities.

Valid evidence categories include Work Items, business context, approved decisions, architecture/design evidence, validation evidence, source-of-truth documentation, repository files, tests, configuration, interface definitions, and deployment evidence.

## Evidence states

- **CONFIRMED** — directly supported by an authoritative source or corroborated by relevant engineering evidence.
- **INFERRED** — a reasoned interpretation that is not directly stated. Never present it as confirmed.
- **CONFLICTING** — credible sources disagree. Do not resolve silently.
- **STALE** — the source may no longer describe current reality.
- **INCOMPLETE** — the source describes part of the relevant reality but omits an implementation decision, dependency, scope boundary, or operational consequence.
- **MISLEADING** — the source remains factually related but would lead a reader to an incorrect understanding of the resulting implementation.
- **MISSING** — the claim cannot be established because the inspected source does not contain it.

## Source retrieval states

Record one state for each relevant source or tool:

- `FOUND` — source was retrieved and inspected.
- `NOT FOUND` — source was searched and does not exist or contains no matching record.
- `UNAVAILABLE` — source or tool could not be reached; this is not evidence that the source is absent.
- `ACCESS DENIED` — access was refused or credentials were insufficient.
- `FAILED TO RETRIEVE` — retrieval was attempted but failed for another recorded reason.

If an unavailable, denied, or failed source could establish a required context
answer, context remains insufficient. Optional supporting sources may be recorded
as a limitation when authoritative evidence is otherwise sufficient.

## Source precedence

The project adapter defines the platform-specific source mapping and precedence. The reusable default is:

- intended outcome and scope: Work Item and approved upstream context;
- accepted architecture or rationale: approved decision and architecture/design evidence;
- current implementation: repository source, tests, configuration, and runtime/deployment evidence;
- authoritative ownership and documentation: configured source-of-truth metadata.

An intended target and current implementation difference is
`EXPECTED CURRENT/TARGET DIFFERENCE` when the Work Item is changing the current
state toward that target. Reserve `CONFLICTING` / `MATERIAL CONFLICT` for
incompatible claims about the same state or the same decision authority. Use
`STALE KNOWLEDGE`, `SUPERSEDED DECISION`, and `UNRESOLVED AUTHORITY` as defined
by the adapter and discovery workflow.

During Independent Review, re-check documentation impact against the actual resulting implementation when relevant. A source used as evidence earlier in the lifecycle may become `STALE`, `INCOMPLETE`, or `MISLEADING` after implementation; report this as part of the review's documentation-impact note rather than as a separate stage.

## Citation format

Use exact, reviewable references:

```text
CONFIRMED — <claim>.
Source: <configured source>, <document or file>, <section or lines>.
```

For repository evidence use file and line references where available.

## Acceptance Criterion states

Use exactly these states for every original Acceptance Criterion:

- `SATISFIED` — the final implementation satisfies the original AC and required evidence exists.
- `REMOVED_BY_AUTHORITY` — an authoritative upstream decision explicitly removed the AC; source evidence is required.
- `SUPERSEDED_BY_AUTHORITY` — an authoritative upstream decision replaced the AC; source evidence is required.
- `UNSATISFIED` — the implementation does not satisfy the AC.
- `UNVERIFIED` — sufficient evidence does not exist to determine satisfaction.

Only `SATISFIED`, `REMOVED_BY_AUTHORITY`, and `SUPERSEDED_BY_AUTHORITY` may
support completion. `UNSATISFIED` and `UNVERIFIED` block implementation
completion, Independent Review passage, and Final Human Review approval.

## Verification result states

Every check records the command or check, result, relevant output, and the
requirement or risk it verifies. Use exactly one state:

- `PASSED`
- `FAILED`
- `NOT RUN`
- `NOT APPLICABLE` with reason
- `UNAVAILABLE` with reason
- `BASELINE FAILURE` with evidence it pre-dates the change
- `POSSIBLY FLAKY` when repeated results are inconsistent

Only `PASSED` or justified `NOT APPLICABLE` can support completion. A baseline
failure, unavailable check, or possible flake must remain visible to the human
reviewer and may block completion according to risk.
