# TASK-03: Seed data & dev identity fixtures

## Purpose
Populate the schema from TASK-02 with deterministic demo/test data: two offices in two IANA timezones (folding in PoC-Q-03's multi-office/timezone evidence at no extra architectural cost), desks and parking resources, policies (including a short demo-override deadline variant for live demos), and seeded employees with dev-only bearer tokens spanning the role_scopes the PoC needs to demonstrate (plain employee; office-scoped admin only if a task actually needs it — no admin UI is built, so keep this minimal).

## Approved requirements / validation criteria
Supports FR-16/A-04/A-05 (multi-office/timezone) as seed-data variation per PoC Selection §6 (PoC-Q-03 verdict: fold in, not a separate slot); enables validation items 1–11 by giving every later task real rows to operate on.

## Dependencies
TASK-02.

## Scope
Idempotent seed script (safe to re-run against a clean DB) covering: 2 offices with distinct IANA timezones, ~10–20 desks/parking spaces per office, one default policy per office (14-day window, 10:00 local deadline) plus one demo-override policy variant with a short deadline for live demos, a handful of employees with seeded dev tokens.

## Explicit out of scope
Any real Entra ID integration, any admin UI to manage seed data — this is a script, not a feature.

## Acceptance criteria
- Running the seed script against a freshly migrated DB populates all tables with the counts above and exits 0.
- Re-running it is a no-op or safely idempotent (no duplicate-key errors).
- A query for "available resources in office A on date D" returns a non-empty, sane result immediately after seeding.

## Required automated tests
One integration test asserting expected row counts and that the two offices have distinct `iana_timezone` values after seeding.

## Verification evidence
Seed run log + the row-count assertion test output.

## Demo contribution
Supporting/foundation work — the seed data itself is what step 1 of TASK-13's demo operates on.
