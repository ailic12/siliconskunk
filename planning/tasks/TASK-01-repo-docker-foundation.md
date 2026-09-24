# TASK-01: Repo, tooling & Docker Compose Postgres foundation

## Purpose
Establish the buildable skeleton every other task sits on: a TypeScript workspace with lint/format/test wiring, a local-only Postgres instance via Docker Compose, and the database access layer (connection pool, transaction helper) plus migration CLI wiring. Nothing domain-specific lives here.

## Approved requirements / validation criteria
Enabling infrastructure only — no functional/business requirement maps directly to this task; it is a precondition for all 11 validation items in [poc-implementation-plan.md §6](../poc-implementation-plan.md#6-requirement--validation-traceability).

## Dependencies
None — first task.

## Scope
- TS project scaffold (workspaces for api/worker/shared if using a monorepo layout, or a single package — implementer's call), lint/format config.
- `docker-compose.yml` running Postgres only, `.env.example`.
- `pg` connection pool + a `withTransaction` helper in `src/shared/db/`.
- node-pg-migrate CLI wired to `db/migrations/`, with an npm script to run migrations against the Compose Postgres.

## Explicit out of scope
Any domain schema (TASK-02), seed data (TASK-03), HTTP framework wiring beyond what's needed to prove the app boots, queue/pg-boss setup (introduced when first needed in TASK-06/TASK-11).

## Acceptance criteria
- `docker compose up` starts a reachable local Postgres.
- `npm run migrate` (against an empty DB) runs with zero migrations and exits 0.
- A trivial `withTransaction` round-trip test passes against the real Compose Postgres.
- Lint/format/test commands all run clean on the empty scaffold.

## Required automated tests
One smoke unit/integration test exercising the DB pool + transaction helper against the real Postgres instance.

## Verification evidence
CI/local run log showing `docker compose up`, migration run, and the smoke test all succeeding.

## Demo contribution
Supporting/foundation work, no direct demo step.
