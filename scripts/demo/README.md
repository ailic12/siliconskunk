# TASK-13: End-to-end demo harness

Scripted CLI demo of the Smart Office PoC's coherent demo story (PoC Selection
§5, plan §8). Every script is a thin orchestration layer over already-tested
functionality from TASK-04/05/06/07/08/09/10/11/12 — no new business logic
lives here.

## Prerequisites

Postgres running (`docker compose up -d`), migrations applied (`npm run
migrate`). Each script seeds its own fixtures on startup and cleans up its
own rows afterward, so scripts can be re-run repeatedly.

## Running the demo

```bash
npm run demo:happy-path          # Step 1: Discover -> Reserve -> Confirm -> No-checkin -> Release -> Re-offer
npm run demo:race                # Step 2: concurrent booking race (resource-level + employee-level)
npm run demo:duplicate-checkin   # Step 2: duplicate check-in idempotency
npm run demo:late-checkin        # Step 2: late check-in after release never restores a booking
npm run demo:notification-failure # Step 2: notification provider failure never blocks booking/release
```

Each script exits `0` on pass and non-zero on any failed assertion, printing
a clear pass/fail line per step.

The happy-path narrative (Step 1) is also captured as an automated,
non-interactive test: [`test/e2e/demo-story.spec.ts`](../../test/e2e/demo-story.spec.ts),
run via `npm test`. It imports and drives the exact same
`runHappyPathScenario()` function this directory's `happy-path.ts` CLI script
uses — the orchestration exists exactly once.

## Step 3 — Adapter extensibility evidence

The PoC Selection requires evidence that a second check-in adapter can be
added without changing the Booking domain or the Check-in Gateway (FR-19/R-09,
validation item 8). This is not re-demonstrated by a script here — it is
already fully proven by two independent, already-passing test suites:

- [`test/contract/checkin-adapters/app-qr.adapter.test.ts`](../../test/contract/checkin-adapters/app-qr.adapter.test.ts)
  and [`test/contract/checkin-adapters/test-harness.adapter.test.ts`](../../test/contract/checkin-adapters/test-harness.adapter.test.ts)
  (TASK-07): two adapters with completely different payload shapes
  (`{ eventId, bookingReference, employeeBadge, scannedAt }` vs.
  `{ confirmationId, subjectRef, confirmedAt }`), each translating
  independently to the same canonical `CheckInEvent`, each registered under
  its own Ingress route (`POST /integrations/checkin/app-qr` and
  `POST /integrations/checkin/test-harness`) without modifying TASK-06's
  ingress mechanism.
- [`src/modules/checkin-gateway/checkin-gateway.service.ts`](../../src/modules/checkin-gateway/checkin-gateway.service.ts)
  (TASK-08): the Check-in Gateway worker imports only the canonical contract
  module from `checkin-contract` — nothing from
  `src/modules/checkin-ingress/adapters` — and is tested exclusively with
  hand-constructed canonical events (see
  [`test/integration/checkin-gateway/checkin-gateway.test.ts`](../../test/integration/checkin-gateway/checkin-gateway.test.ts)),
  never through an adapter. Adding, removing, or changing an adapter cannot
  touch this file.

Together: registering the second adapter (`test-harness`) required zero
changes to the Booking domain or the Check-in Gateway — only a new file under
`checkin-ingress/adapters/` plus one registration call, exactly like the
first adapter. This is the direct proof, not a claim.
