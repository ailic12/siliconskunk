# Context Sufficiency Gate

The gate answers one question:

> Do we have enough reliable evidence to plan this specific change safely?

It does not require every possible document. It requires enough evidence for the task's risk and scope.

## Required answers

Before returning `CONTEXT SUFFICIENT — READY FOR PLANNING`, answer with sufficient evidence:

- What needs to change?
- Why does it need to change?
- What outcome is expected?
- What is in scope?
- What is explicitly out of scope where material?
- What constraints apply?
- Which existing decisions govern the change?
- Which assumptions remain unresolved?
- Which systems and components are affected?
- How will acceptance be demonstrated?
- What are the original Acceptance Criteria, preserved verbatim with stable IDs?
- Which decisions are `CLOSED`, `DELEGATED IMPLEMENTATION CHOICE`, `ASSUMPTION`, `SUPERSEDED`, or `UNRESOLVED BLOCKING`?
- What is the change risk profile: `LOW`, `MEDIUM`, or `HIGH`?
- What required sources were `FOUND`, `NOT FOUND`, `UNAVAILABLE`, `ACCESS DENIED`, or `FAILED TO RETRIEVE`?
- Can all Acceptance Criteria be satisfied within one bounded implementation scope?

## Proportionality

- Low-risk isolated UI changes may rely mainly on the Work Item, acceptance criteria, and affected repository evidence.
- Interface, data, operational, or cross-repository changes require relevant contracts, dependencies, and affected-system evidence.
- Authentication, session, payment, migration, security, or system-boundary changes require relevant decisions, risks, validation, and current implementation evidence.

For `HIGH` work, explicitly consider applicable authorization/access-control
impact, negative-path behavior, sensitive-data handling, abuse/security scenarios,
compatibility, rollback/recovery, dependency/configuration changes, and failure
behavior. Record why each non-applicable item is excluded.

Use this evidence table for HIGH-risk work:

| Control | Applicability | Evidence / source | Verification considered | Result | Residual risk |
|---|---|---|---|---|---|
| <control> | APPLICABLE / NOT APPLICABLE — reason | <source> | <check or rationale> | <result> | <risk or none> |

For `MEDIUM` and `HIGH` work, a readable Work Item alone is never sufficient.
Check the configured Decision Closure source and relevant interface, dependency,
security, operational, or migration evidence. For `LOW` work, stop after the
Work Item, original criteria, and affected repository evidence establish that
the change is truly isolated.

## Blocking conditions

Return `CONTEXT INSUFFICIENT` when any required answer is missing, based only on
inference, contradicted by credible evidence, dependent on stale source without
corroboration, or blocked by an unresolved decision, assumption, dependency, or
acceptance interpretation. This includes any uncertainty that could alter
externally visible behavior, architecture, data ownership, an interface,
security/authentication, migration behavior, compatibility, cross-system
dependency, scope, or an Acceptance Criterion.

Non-blocking assumptions may remain only when explicitly labelled, safe, and not behaviour- or risk-changing.

Return `DECOMPOSITION REQUIRED` instead of proceeding when one bounded scope
cannot satisfy all ACs or the task requires multiple independently reviewable
repositories, deployables, unrelated subsystems, external contracts, or
migration/application units.

The gate never authorizes code changes. Its successful result is only `READY FOR PLANNING`.
