# TASK-02: Core domain schema migrations

## Purpose
Create every table the PoC needs in one coherent migration set: Office, Resource, Policy, Employee, Booking (including both conflict-prevention partial unique indexes), CheckinEvidence (including its idempotency unique constraint), ExternalMapping, and the Notification outbox (including its dedup unique constraint). Grouped deliberately — these are one review unit, not eight.

## Approved requirements / validation criteria
Structural precondition for validation items 1–11 ([poc-implementation-plan.md §6](../poc-implementation-plan.md#6-requirement--validation-traceability)); directly encodes the constraint-level guarantees behind items 2, 3, 5, 9 (HLD §5.2, §5.3, §5.5).

## Dependencies
TASK-01.

## Scope
- `office(id, name, iana_timezone, country, active)`
- `resource(id, office_id, type, name, status, characteristics jsonb)`
- `policy(office_id, resource_type nullable, booking_window_days, release_deadline_local, accepted_evidence_methods, employee_daily_limit)` — `post_checkin_cancellation` (HLD §4/N-05) intentionally omitted from the PoC schema; not used by any selected PoC functionality or validation criterion (see plan §9)
- `employee(id, entra_object_id, home_office_id, display_name, email, role_scope)` + a dev-only bearer-token table
- `booking(id, resource_id, employee_id, booking_date, resource_type, status, created_at, updated_at)` **plus** `UNIQUE (resource_id, booking_date) WHERE status IN ('Reserved','CheckedIn')` **and** `UNIQUE (employee_id, booking_date, resource_type) WHERE status IN ('Reserved','CheckedIn')`
- `checkin_evidence(id, booking_id nullable, source_system, external_event_id, occurred_at, received_at, outcome)` + `UNIQUE(source_system, external_event_id)`
- `external_mapping(entity_type, entity_id, source_system, external_reference)` + `UNIQUE(source_system, external_reference)`
- `notification(id, booking_id, type, channel, dedup_key UNIQUE, status, lease_owner, lease_expires_at, sent_at)`

## Explicit out of scope
No `audit_record` table (plan §1 decision 13 / §9 item 2) — Audit Module is not part of this PoC. No seed data (TASK-03). No admin/override tables.

## Acceptance criteria
- All migrations run cleanly, in order, against a fresh Compose Postgres, and are reversible (`down` migrations work).
- Both booking partial unique indexes exist and are verified via `\d booking` / information_schema query in a test.
- `checkin_evidence` and `notification` unique constraints exist and are verified the same way.

## Required automated tests
A migration integration test that runs the full up/down cycle against the real Postgres and asserts the presence of both partial unique indexes and both dedup/idempotency unique constraints via a catalog query.

## Verification evidence
Migration run log (up + down) and the constraint-presence test output.

## Demo contribution
Supporting/foundation work, no direct demo step.
