# TASK-06: Canonical `CheckInEvent` contract + Check-in Ingress API

## Purpose
Establish the vendor-neutral boundary the rest of Automatic Release is built on: a shared canonical event type, and the public Ingress API that authenticates a provider, validates its payload, translates it to that canonical shape, and enqueues it — before any adapter or the Gateway exists.

## Approved requirements / validation criteria
FR-19/R-09 (vendor-neutral interface), scaffolding for FR-08; validation item 8 (contract shared across adapters, no Booking-domain coupling).

## Dependencies
TASK-03.

## Scope
- `CheckInEvent { source_system, external_event_id, subject_reference, occurred_at, received_at }` as a shared type + runtime schema, per HLD §7.1, living in a module with **no dependency on any adapter or on the Booking module**.
- `POST /integrations/checkin/{provider}` Ingress route: per-provider credential check (a simple shared-secret/API-key check is sufficient for the PoC — no need for mTLS/OAuth2 complexity), payload-shape validation is delegated to whichever adapter registers under `{provider}` (TASK-07), translation to the canonical contract, enqueue onto pg-boss, `202 Accepted` response.
- The route registration mechanism must allow a new adapter to be added by registering a new `{provider}` route without modifying this task's code (proven in TASK-07/TASK-13).

## Explicit out of scope
The adapters themselves (TASK-07) — this task defines the contract and the ingress mechanics an adapter plugs into, but ships with zero adapters wired. The Check-in Gateway (TASK-08) — this task only enqueues, it does not consume.

## Acceptance criteria
- The canonical `CheckInEvent` type/schema exists and is independently unit-tested (valid/invalid payload shapes).
- The Ingress route rejects a request with a missing/invalid provider credential.
- A hand-constructed valid canonical event, submitted through a minimal stub provider registration, is enqueued and the route returns `202`.

## Required automated tests
Unit tests for the contract schema; an integration test proving a stub payload reaches the queue via the Ingress route.

## Verification evidence
Test output for schema validation and the enqueue-and-202 integration test.

## Demo contribution
Supporting/foundation work for TASK-13; the contract itself is what TASK-13 Step 3 points to as the adapter-extensibility evidence anchor.
