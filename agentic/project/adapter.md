# Project Adapter Configuration

This file is the only project-specific mapping required by the reusable engineering core. Replace these values when adopting the framework in another repository.

## Work item resolution

- System: local repository files. There is no external work-management system (no Jira, Linear, or equivalent) in this workflow.
- Work Item identifier: `TASK-XX` (e.g. `TASK-07`).
- Work Item source: exactly one file matching `planning/tasks/TASK-XX-*.md`.
- Resolution rule:
  - zero matches -> `TASK NOT FOUND`, stop;
  - more than one match -> `TASK RESOLUTION AMBIGUOUS`, stop;
  - exactly one match -> that file is the bounded execution contract for the invocation.
- Never guess which task file was intended and never infer a task identifier from partial input.
- The task file defines the requested implementation, scope, Acceptance Criteria, task-specific constraints, and non-goals where specified. It is authoritative for immediate executable scope.

## Pre-development status

Context Discovery, HLD, PoC Selection, and PoC Task Planning are already complete and approved for this repository. Do not repeat, reopen, or redesign them during `/work TASK-XX` execution unless a genuine implementation blocker or material conflict requires a human decision (see [`../protocols/human-clarification.md`](../protocols/human-clarification.md)).

Approved artefacts and status:

| Artefact | Path | Status |
| --- | --- | --- |
| Smart Office Context | `context/smart-office-context.md` | APPROVED |
| High-Level Design | `design/smart-office-hld.md` | APPROVED |
| PoC Selection | `poc/smart-office-poc-selection.md` | APPROVED |
| PoC Implementation Plan | `planning/poc-implementation-plan.md` | APPROVED — READY FOR IMPLEMENTATION |
| Task backlog | `planning/tasks/TASK-01-*.md` .. `TASK-14-*.md` | APPROVED |

There are exactly three selected PoC capabilities (do not reconsider whether these were the correct choices): Booking Creation; Automatic Release of Unconfirmed Bookings; Notification Dispatch via Transactional Outbox.

## Source authority (highest to lowest)

1. Task file — immediate executable scope and Acceptance Criteria.
2. `planning/poc-implementation-plan.md` — sequencing/dependencies and broader implementation intent.
3. `poc/smart-office-poc-selection.md` — what belongs in the PoC and what does not.
4. `design/smart-office-hld.md` — approved architecture and system boundaries.
5. `context/smart-office-context.md` — business/system context.
6. Repository source/tests/config — current implementation reality.

Repository reality describes the current state; it does not override an approved target-state decision. If current implementation differs from an approved artefact because the task is moving it toward that target, classify it as `EXPECTED CURRENT/TARGET DIFFERENCE`. Otherwise use `STALE KNOWLEDGE`, `MATERIAL CONFLICT`, `NON-MATERIAL DOCUMENTATION DIFFERENCE`, or `UNRESOLVED AUTHORITY` as defined in [`../protocols/evidence.md`](../protocols/evidence.md). A material unresolved conflict blocks planning — stop for a human decision rather than silently redesigning around it.

## Knowledge-source mapping

| Core category | This project source mapping |
| --- | --- |
| Business context | `context/smart-office-context.md` |
| Approved decisions | `planning/poc-implementation-plan.md` §1 (Implementation Assumptions and Decisions) and §9 (Risks, Blockers, and Human Decisions Required); `poc/smart-office-poc-selection.md` |
| Architecture/design evidence | `design/smart-office-hld.md` |
| Task scope and Acceptance Criteria | the resolved `planning/tasks/TASK-XX-*.md` |
| Engineering reality | repository source, tests, manifests, and configuration |

Relevant sources are followed proportionally to the task's risk and scope; this list is not permission to re-read every approved artefact for every task.

## External and project knowledge sources

No external knowledge system (Confluence, Atlassian, or equivalent) is configured for this project. All authoritative project knowledge required for execution is local to this repository. Do not attempt external knowledge discovery.

## Repository and system sources

The application code is built up progressively by the task backlog; only the parts relevant to the resolved task will exist yet. Per [`planning/poc-implementation-plan.md`](../../planning/poc-implementation-plan.md) §2, the expected structure is:

- Repository root manifests: `package.json`, `tsconfig.base.json`, `docker-compose.yml` (Postgres only), `.env.example`.
- Migrations/seed: `db/migrations/` (node-pg-migrate), `db/seed/`.
- Application source: `src/shared/` (clock, db, auth, queue, http, logging), `src/modules/` (office, resource-policy, booking, checkin-contract, checkin-ingress, checkin-gateway, release-engine, notification), `src/api/server.ts`, `src/worker/worker.ts`.
- Tests: `test/unit/`, `test/integration/`, `test/contract/`, `test/e2e/`.
- Demo/dev scripts: `scripts/demo/`, `scripts/dev/`.

Stack: Node.js, TypeScript, Fastify, PostgreSQL via local Docker Compose only (no cloud/managed DB), pg-boss for queues/background jobs, node-pg-migrate for migrations, Vitest + Supertest for tests, mocked identity, mocked notification provider. No external managed services, no CI/CD pipeline, no AWS/Vercel/Next.js runtime — none of that applies to this repository; do not assume it.

## Security constraints

- Apply repository and authoritative security constraints relevant to the change.
- Treat authentication, authorization, sessions, credentials, migrations, and trust-boundary changes as high-risk. Identity is mocked for the PoC, but the mocked authorization/`role_scope` boundary is still a real trust boundary and must be treated as such.
- Do not expose sensitive data or weaken existing security boundaries.
- Require deeper security verification for high-risk changes, per the HIGH-risk evidence table in [`../protocols/context-sufficiency.md`](../protocols/context-sufficiency.md).

## Verification commands

Use repository-defined `package.json` scripts for the affected change (e.g. test, lint, migrate) once TASK-01 establishes them. The adapter does not prescribe a single universal command; the plan must identify relevant commands for the task, and the Implementer/Reviewer must report actual executed results — a command that has not been run yet is not evidence.

## Governance and mutation policy

- Context Discovery and Planning are read-only.
- Implementation modifies only the explicitly declared bounded scope for the resolved task, after human approval, including planned tests.
- Independent Review is read-only.
- No external work-management or knowledge system exists to modify.
- Commits, pushes, branches, pull/merge requests, merges, release tags, deployments, publications, and equivalent delivery actions are outside this adapter and are never performed automatically by this workflow.
