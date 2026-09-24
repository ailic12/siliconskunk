# TASK-15: Minimal PoC Demo UI (Capability 1 presentation layer)

## Purpose
Make the already-delivered Capability 1 (Booking Creation) visible and understandable to a
non-technical Camp audience by adding a thin presentation layer on top of the existing,
proven API. This is a human-approved presentation-layer addition, not a fourth PoC
capability: it introduces no new business logic, no new domain rules, and no new
conflict-prevention or scheduling behaviour. Everything it shows is already implemented,
tested, and passing in TASK-04/TASK-05.

## Actual implementation context discovered
Inspected as of 2026-09-24, against the current repository state (not the original plan):

- TASK-01–05 are complete. `GET /availability` and `POST /bookings` are implemented in
  [src/modules/booking/booking.routes.ts](../../src/modules/booking/booking.routes.ts),
  backed by two partial unique indexes for atomic conflict prevention
  ([db/migrations/1790255843209_core-domain-schema.ts](../../db/migrations/1790255843209_core-domain-schema.ts)).
  Full suite passes: 40/40 tests, including 25 iterations each of two concurrency race
  scenarios with zero double-bookings.
- Identity is a seeded dev bearer token
  ([db/seed/employees.ts](../../db/seed/employees.ts)) resolved server-side
  ([src/shared/auth](../../src/shared/auth)) — a client-supplied `employeeId` is ignored.
- Only `Reserved` is ever produced by real code today. `CheckedIn`/`Released`/`Cancelled`
  exist in the `BookingStatus` type but no implemented code path sets them (TASK-06–12 are
  not yet built) — the UI must not simulate or imply these states.
- No CORS middleware is installed (checked `package.json` and `src/`) and no static-file
  serving exists yet.
- No `GET /offices` or `GET /bookings` (list-mine) endpoint exists. FR-04 (view/cancel) is
  explicitly out of scope per the approved PoC Selection (§4, C4 verdict) — this task must
  not add it.
- Repo has no frontend build tooling of any kind (no bundler, no framework, no design
  system) — confirmed via `package.json` dependencies.

## Dependencies
TASK-04, TASK-05. Does **not** depend on TASK-06–TASK-12 (check-in, release, notifications)
— none of that is implemented yet and this task must not anticipate it beyond leaving room
to extend later (see Scope).

## Existing APIs/contracts it consumes (verbatim, no changes)
- `GET /availability?officeId=<uuid>&resourceType=Desk|ParkingSpace&date=YYYY-MM-DD` →
  `200 { resources: [{ id, officeId, type, name, status }] }`
- `POST /bookings` with header `Authorization: Bearer <dev-token>`, body
  `{ resourceId, bookingDate }` →
  - `201` booking object (`id, resourceId, employeeId, bookingDate, resourceType, status: "Reserved", createdAt`)
  - `400 { error: "bad_request", message }`
  - `401 { error: "unauthorized", message }`
  - `404 { error: "not_found", message }`
  - `422 { error: "unprocessable_entity", reason: "resource_not_bookable" | "outside_booking_window", message }`
  - `409 { error: "conflict", reason: "resource_already_booked" | "employee_daily_limit_reached", message }`

Reference data the UI needs but that has no API (use the existing seed constants directly,
do not add new backend endpoints for these):
- Office list: `db/seed/offices.ts` (`OFFICE_BELGRADE_ID`, `OFFICE_SINGAPORE_ID`, names, timezones).
- Employee/dev-token list: `db/seed/employees.ts` (`displayName`, `devToken`).
- Resource type enum: `Desk | ParkingSpace` (already used by the API's own validation).

## Scope
- A single static, same-origin page (or very small set of pages) served by the existing
  Fastify app (e.g. `@fastify/static` or one inline route returning HTML) — avoids any CORS
  setup and any new frontend build system. Plain HTML/CSS/vanilla JS (or minimal TS compiled
  with the existing `tsconfig`) `fetch`-calling the two existing endpoints directly.
- "Act as" selector: a dropdown of the seeded employees (display name), storing the
  corresponding dev bearer token client-side and sending it as `Authorization: Bearer <token>`
  on every request — this **is** the mocked identity mechanism, reused as-is.
- Office selector: hardcoded from `db/seed/offices.ts` constants.
- Resource-type selector: `Desk` / `ParkingSpace`.
- Date picker for the booking date.
- "Search availability" action calling `GET /availability` and rendering the returned
  resource list.
- "Book" action per listed resource calling `POST /bookings`.
- Clear, distinct rendering of:
  - success (`201`, `status: "Reserved"`) — show the returned booking object.
  - each error case listed above, using the `reason` field to show a specific, human-readable
    message per case (not a generic "error occurred").
- Structured so a later task can add, without redesigning this page: a status/history area
  for `CheckedIn`/`Released` once TASK-06–10 exist, and a notification-log panel once
  TASK-11/12 exist — e.g. leave a placeholder section or a simple state-list data structure
  that's easy to extend, but build nothing for those states now.

## Explicit out of scope
- No real authentication / no Entra ID.
- No admin UI or admin role handling (no admin identity is even seeded).
- No new backend endpoints, no new backend business rules, no changes to
  `src/modules/booking/**`, `src/modules/resource-policy/**`, or the migrations.
- No duplication of BR-01/BR-03/BR-04 or conflict-prevention logic in client-side JS — all
  validation feedback comes from the server's actual response, never a client-side guess.
- No "my bookings" / booking history / cancel UI (FR-04 stays out of scope, per the approved
  PoC Selection).
- No check-in, release, or notification UI — those capabilities are not implemented.
- No design system, CSS framework, or JS framework/bundler introduction.
- No external services, no analytics, no persistence beyond what the API already provides.
- Does not modify TASK-13's planned scripted CLI/API demo harness — this is an additional,
  parallel presentation surface for Capability 1 specifically, not a replacement.

## Acceptance criteria
- Opening the page in a browser and selecting an office/resource type/date shows the same
  available resources `GET /availability` returns, with no client-side re-filtering logic.
- Selecting an "act as" employee and booking a listed resource shows a clear "Reserved"
  confirmation matching the `201` response body.
- Attempting to book an already-booked resource, a resource beyond the booking window, or a
  second resource of the same type same day as the same employee, each shows a distinct,
  readable message tied to the actual `reason` returned — not a generic failure.
- No bearer token, or an invalid one, is never silently accepted — the UI reflects the `401`.
- The page is served from the same origin as the API (no CORS configuration is needed to
  make it work).
- No file under `src/modules/`, `db/migrations/`, or `db/seed/` is modified by this task.

## Required automated tests
- Existing automated suite (40 tests) continues to pass unmodified — this task adds a UI
  layer, it does not touch tested domain/API code.
- A minimal smoke test (Supertest or equivalent) asserting the new static-serving route
  returns `200` with HTML content-type, added under `test/integration/`.
- Given hackathon time constraints, full browser/e2e UI test automation is not required;
  manual verification against the checklist below is acceptable and expected.

## Verification evidence
- Test run output showing the existing 40 tests still pass plus the new smoke test.
- A short manual verification checklist, run once and recorded (e.g. as a demo dry-run note):
  happy-path booking shown as Reserved; each of the five error cases reproduced and clearly
  displayed; a live two-tab/two-browser concurrent-booking attempt on the same resource shown
  resolving to one success/one clean rejection in the UI (reusing TASK-05's proven guarantee,
  not re-testing it).

## Demo contribution
Gives the Camp audience a visual, clickable way to see Capability 1's story (search →
reserve → conflict/error handling) without reading API responses — directly supports the
open, non-blocking "demo modality" item recorded in
[planning/poc-implementation-plan.md §9 item 1](../poc-implementation-plan.md#9-risks-blockers-and-human-decisions-required).
Does not replace or alter TASK-13's full scripted demo harness (which will still cover all
three capabilities end-to-end); this is a Capability-1-only visual complement usable as soon
as this task lands, independent of whether TASK-06–12 are done yet.

## Recommended position in the dependency graph
Depends only on **TASK-04 → TASK-05**. Runs independently in parallel with Track B
(TASK-06–08) and Track C (TASK-09–12) — it touches none of that code. Does not block and is
not blocked by TASK-13 or TASK-14. Suggested backlog placement: alongside TASK-06 as an
optional parallel stream once TASK-05 lands, picked up by whichever implementer is free
first, since it has no cross-dependency with the check-in/release/notification tracks.
