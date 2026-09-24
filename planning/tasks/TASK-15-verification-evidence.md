# TASK-15 — Manual Verification Evidence

Recorded per [TASK-15-minimal-poc-demo-ui.md](TASK-15-minimal-poc-demo-ui.md)'s
"Verification evidence" section. Run once, 2026-09-24, against a live
`npm run start:api` instance backed by the local dev Postgres, seeded via
`npm run seed`, driven through an actual browser session.

## Automated evidence

- `npm run lint` — PASSED, no output.
- `npm test` — PASSED, 7 files / 43 tests (40 pre-existing + 3 new in
  `test/integration/demo-ui/demo-ui.test.ts`), including the unmodified
  25-iteration concurrency race suites (TASK-05) and the unmodified
  migration/seed/booking-API suites (TASK-01–04).

## Manual checklist (browser-driven, live requests/responses observed)

| # | Scenario | Action | Observed result |
|---|---|---|---|
| 1 | Page load, no token | `GET /` | `200`, HTML rendered; network log confirms no `Authorization` header sent for this request |
| 2 | Availability search (AC-1) | Search Belgrade HQ / Desk / 2026-09-25 as Alice Petrovic | Table shows exactly the 12 `Available` desks `GET /availability` returned; no client-side filtering |
| 3 | Happy-path booking (AC-2) | Alice books Desk 1 | UI shows "Reserved:" panel with the full returned `201` booking object, `status: "Reserved"` |
| 4 | `resource_already_booked` (AC-3) | Bojan attempts to book the same Desk 1 (same date) | "Someone already booked that resource for this date." — 409, `reason: resource_already_booked` |
| 5 | `employee_daily_limit_reached` (AC-3) | Bojan books Desk 2, then attempts Desk 3, same date | Second attempt: "This employee already has a booking of this resource type for this date." — 409, `reason: employee_daily_limit_reached` |
| 6 | `outside_booking_window` (AC-3) | Bojan attempts a desk for 2026-12-01 (beyond the 14-day window) | "That date is outside the allowed booking window." — 422, `reason: outside_booking_window` |
| 7 | `resource_not_bookable` | Catalina attempts a resource manually set to `UnderMaintenance` | "This resource cannot be booked right now (not in a bookable state)." — 422, `reason: resource_not_bookable`; resource status reverted to `Available` immediately after |
| 8 | `not_found` | Attempt to book a syntactically-valid but nonexistent resource UUID | "Resource ... was not found." — 404 |
| 9 | Invalid bearer token (AC-4) | Search with a fabricated, non-seeded token | "Unauthorized: no valid bearer token was accepted (401)." |
| 10 | Missing bearer token (AC-4) | Automated: `GET /availability` / `POST /bookings` with no `Authorization` header | `401` (also covered by `test/integration/demo-ui/demo-ui.test.ts`) |
| 11 | Same-origin (AC-5) | All of the above | No CORS errors in the browser console; page and API share one origin/port by construction (single Fastify app, single port) |
| 12 | Concurrent-booking demo | Sequential same-resource attempt by two different employees (row 3 then row 4 above) | One success ("Reserved"), one clean rejection ("already booked") shown in the UI — reuses TASK-05's proven atomic-conflict guarantee (unmodified 25-iteration concurrency tests, still passing); not re-tested at the race level here, per the task's own scope note |

Browser console: no JavaScript errors observed during the session.

## Environment notes (non-application, for reproducibility)

- `.claude/launch.json` was added this session as local dev-tooling config
  (analogous to a `.vscode/launch.json`) to run `npm run start:api` for this
  manual walkthrough. It is not application code and contains only the same
  placeholder local dev DB URL already public in `.env.example` /
  `docker-compose.yml`.
- `npm run seed` was run against the local dev Postgres to populate the
  employee/office/resource fixtures this checklist exercises. It is
  idempotent (`ON CONFLICT ... DO NOTHING` in `db/seed/employees.ts` and
  `db/seed/offices.ts`) and modified no repository file.
