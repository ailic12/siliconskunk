# TASK-17: Smart Office Demo UI — Check-in & Automatic Release (Capability 2 presentation layer)

## Correction history
**Revision 1 (2026-09-25)** — initial proposal, as assessed in the Phase 1–9 planning pass.

**Revision 2 (2026-09-25, human review correction, pre-implementation)** — two demo-scenario defects identified by human review, corrected before implementation begins:
1. **Scenario 1 (successful check-in) no longer books a same-day Belgrade Desk under the 00:05 demo-override deadline.** That combination risked the running scheduler (§ backend enablement item 3) releasing the booking before the live check-in could be submitted and verified — the deadline could already be in the past the moment the booking is created, depending purely on what wall-clock hour the demo happens to run at. Scenario 1 now books the office-local **next calendar day** instead of today (still trivially within the 14-day booking window), so its deadline is always more than 24 hours in the future relative to whatever moment the demo actually runs — genuinely deterministic, not merely "usually fine." Scenario 2 (automatic release) is unchanged and still deliberately exploits the same existing Belgrade-Desk 00:05 override on a **same-day** booking, so it reliably releases within one scheduler tick.
2. **The two scenarios now use two different seeded employees**, not one — a structural guarantee against violating BR-02 (`employee_id, booking_date, resource_type` daily-limit constraint) that holds regardless of which dates or resource types either scenario ends up using, rather than relying only on correction (1)'s date separation.
3. **The worker/scheduler wiring (backend enablement item 3) must be verified by actually starting the application**, not by calling the wiring functions directly in a test. Backend enablement item 3 and "Required automated tests" below are revised accordingly.

No scope, architecture, or UI-framework decision changes as a result of this revision — the same three human-approved backend enablement items stand; only the demo fixture design and the startup test strategy are corrected.

## Purpose
Extend the existing Capability 1 browser experience ([TASK-15](TASK-15-minimal-poc-demo-ui.md)) into one coherent Smart Office PoC application that also demonstrates the real, already-implemented Capability 2 (Automatic Release of Unconfirmed Bookings). This is a human-approved presentation-layer addition, not a fourth PoC capability: it introduces no new domain rules, no new state machine, and no new conflict/release/matching logic. Every lifecycle transition shown is produced by the real backend code from TASK-06–TASK-10, which is fully implemented and independently re-verified in this planning pass (`npm test` → 85/85 passing, `npm run lint` clean, run live against the real Docker Postgres on 2026-09-25).

## Actual implementation context discovered
Inspected as of 2026-09-25, against the current repository state, superseding assumptions from the original plan:

- **Capability 2 domain code is real and proven**, not just planned: canonical `CheckInEvent` contract + Ingress API ([ingress.routes.ts](../../src/modules/checkin-ingress/ingress.routes.ts)), two adapters (`app-qr`, `test-harness`), idempotent Check-in Gateway ([checkin-gateway.service.ts](../../src/modules/checkin-gateway/checkin-gateway.service.ts)), timezone-aware Release Engine ([release-engine.service.ts](../../src/modules/release-engine/release-engine.service.ts), [deadline.ts](../../src/modules/release-engine/deadline.ts)), and the TASK-10 reliability suite (duplicate check-in, sweep-retry-safety, late-check-in-non-restoration, availability-refresh) — all passing against the real DB+queue.
- **TASK-15/TASK-16 already exist** and were not previously reflected in `planning/poc-implementation-plan.md` (a pre-existing gap in that document, corrected alongside this task — see the plan update). TASK-15 delivered a single static `public/index.html`, vanilla JS, `fetch`-based, served by [demo-ui.routes.ts](../../src/demo-ui/demo-ui.routes.ts). **No frontend build tooling of any kind exists** — `package.json` has zero frontend dependencies.
- **Three genuine gaps stand between "domain logic is proven" and "a browser can watch it happen live"**, none of which involve new business logic:
  1. **No booking-status read API.** Only `GET /availability` and `POST /bookings` are registered anywhere in `src/` (grep-verified). There is no way to ask "what is booking X's status now?".
  2. **No `external_mapping` seed data.** `runSeed()` ([db/seed/index.ts](../../db/seed/index.ts)) seeds offices/resources/policies/employees only. Every existing gateway/reliability test inserts its own `external_mapping` row via raw SQL as test setup. Out of the box, a real check-in submitted through the `app-qr` adapter cannot match any real seeded resource — there is nothing to resolve `bookingReference` against.
  3. **No running consumer or scheduler.** `registerCheckinGatewayWorker()` and `runReleaseSweep()` are only ever invoked from test files; `src/api/server.ts` never calls either. A check-in submitted while `npm run start:api` is running today sits enqueued forever, and a passed deadline never actually releases anything, because nothing is watching.
- **A reusable "fast deadline" fixture already exists in seed data**: `POLICY_BELGRADE_DEMO_OVERRIDE_ID` gives Belgrade **Desk** bookings a `00:05:00` local release deadline ([db/seed/policies.ts](../../db/seed/policies.ts)) — a Desk booked for *today* in Belgrade is already past-deadline the instant a sweep runs. No new policy or clock manipulation is needed for Scenario 2 below; only gap #3 (something must actually run the sweep) blocks it.
- These three gaps, and the React/Vite adoption decision, were surfaced to the human reviewer and **approved during this planning session (2026-09-25)** before this task was finalized — recorded in full below and in the plan's Revision 4 entry. They are bundled into this task's scope (not spun off as a separate task number) because each is a few lines of wiring/fixture data with no independent value or business logic of its own, and all three exist solely to let this UI observe real backend state.

## Approved requirements / validation criteria
FR-09 (Automatic Release), FR-10 (availability refresh), FR-19/R-09 (adapter extensibility — optional secondary evidence only, per PoC Selection §4 Functionality 2); R-02/R-03/R-04/R-05, BR-05/06/07/08 (idempotent, order-tolerant processing); validation items 4, 5, 6, 7. This task adds no new requirement — it makes requirements already satisfied by TASK-06–10 observable in a browser.

## Dependencies
- [TASK-15](TASK-15-minimal-poc-demo-ui.md) — the existing Capability 1 UI this task extends (not replaces the intent of, though the underlying vanilla-JS page is fully rewritten as React — see Scope).
- TASK-08, TASK-09, TASK-10 — completed and independently re-verified Capability 2 implementation and reliability evidence.
- Does **not** depend on TASK-11/TASK-12 (Notification Dispatch — unimplemented; no `notification` module exists in `src/modules/` today). Capability 3 stays entirely out of this task's scope.

## Human-approved backend enablement (dependency work bundled into this task)
Approved by human review on 2026-09-25, in response to gaps #1–#3 above. Each item is minimal, reuses existing tested logic, and carries no independent business value:

1. **`GET /bookings/:id`** — new read-only route in [booking.routes.ts](../../src/modules/booking/booking.routes.ts), registered inside the same authenticated child context as `POST /bookings`.
   - `200` → the same booking shape `POST /bookings` already returns (`id, resourceId, employeeId, bookingDate, resourceType, status, createdAt`), plus a derived `checkInDeadline` (ISO 8601 UTC instant) computed by reusing the existing `getEffectivePolicy` + `computeEffectiveDeadline` utilities — no new deadline logic, just exposing the Release Engine's own computation.
   - `404` if the booking does not exist **or** does not belong to the requesting identity's `employeeId` (no cross-employee enumeration — mirrors the existing no-list-mine boundary from TASK-15/PoC Selection C4).
   - `401` on missing/invalid bearer token, identical to existing routes.
   - This is deliberately narrower than FR-04 ("View & Cancel Bookings", explicitly not selected per PoC Selection §2 C4 verdict): it is a single-record status read for a booking ID the browser already holds from its own `POST /bookings` response, not a list/history/cancel capability.
2. **`db/seed/external-mappings.ts`** (new seed file, wired into `runSeed()`) — one deterministic `external_mapping` row per seeded resource: `entity_type='Resource', entity_id=resource.id, source_system='app-qr', external_reference=resource.id`. Pure fixture data, `ON CONFLICT DO NOTHING` idempotent like every other seed file; no schema change (the `external_mapping` table already exists from TASK-02).
3. **In-process worker/scheduler wiring**, structured as a single exported bootstrap function (e.g. `startApp()`) in [src/api/server.ts](../../src/api/server.ts) that builds the app, starts listening, calls `registerCheckinGatewayWorker()` once, and starts a `setInterval` calling `runReleaseSweep(new SystemClock())` on a short interval (proposed: every 5–10 seconds, tunable) for the lifetime of the process. The existing `if (require.main === module)` block calls this same `startApp()` — it does not contain separate inline wiring logic, so there is exactly one code path for "the application starts," used identically by `npm run start:api` and by the black-box integration test in "Required automated tests" below. `buildApp()` alone (used by every existing test) remains unchanged and still does not register the worker or the sweep — only `startApp()` does. No new business logic — this wires two already-implemented, already-tested functions into the running process for the first time. This is a deliberate PoC-scoped simplification of the original plan's separate `api`/`worker` process split (§1 decision 11) — documented here rather than silently substituted, since a two-day Camp PoC does not need two processes for one demo instance.

None of the three items are exposed as unrestricted production endpoints beyond what already exists in this local-only, no-cloud PoC (per plan §1 decisions 3/8) — they carry the same trust model as every other route in this app today.

## API contracts consumed (existing, verbatim, no changes)
- `GET /availability?officeId=&resourceType=&date=` → `200 { resources: [...] }` (TASK-04, reused as-is from TASK-15).
- `POST /bookings` → `201` booking object / `400`/`401`/`404`/`409`/`422` (TASK-04, reused as-is from TASK-15).
- `POST /integrations/checkin/app-qr` with header `x-provider-api-key: app-qr-demo-secret`, body `{ eventId, bookingReference, scannedAt }` → `202 { status: "accepted" }` / `400`/`401`/`404` (TASK-06/07). **`bookingReference` must be the resource's own ID**, per the new seed mapping above — the UI constructs this payload itself using the resource ID already known from the current booking, it is never typed by the demo presenter.
- `GET /bookings/:id` (new, this task, human-approved) → `200`/`401`/`404`.

## Scope

**A. Existing Booking Experience (preserved, ported to React)**
Re-implement TASK-15's existing employee/office/resource-type/date selection, availability search, and booking creation as React components consuming the same two existing endpoints with no re-implementation of server-side validation logic client-side. Existing error message mapping (five `reason` cases) is preserved.

**B. Current Booking Panel**
After a booking is created, poll `GET /bookings/:id` (see §E) and render resource name/type, office, booking date, `status`, and `checkInDeadline` — all backend-sourced. No frontend-computed or frontend-assumed status.

**C. Successful Check-in**
Booked as Scenario 1 (§H): Belgrade HQ, Desk, booked for the **office-local next calendar day** (not today) — see §H for why. A "Simulate check-in" button constructs an `app-qr` payload (`bookingReference` = the booked resource's ID, `scannedAt` = a timestamp on that same *booking date*, not literal wall-clock "now" — the Gateway matches on the event's `occurredAt` calendar date per office-local timezone, exactly as [checkin-gateway.service.ts](../../src/modules/checkin-gateway/checkin-gateway.service.ts)'s own existing comment documents; this is the same technique the TASK-10 reliability suite already uses, not a new mechanism) and calls the real Ingress API. UI states, in order: submitting → `202` accepted ("submitted, awaiting processing") → polling `GET /bookings/:id` → `CheckedIn` observed (success) or timeout (see §E/§G). The `202` response is never presented as a completed transition. Because the deadline is >24h in the future at every point the demo can run, the running scheduler cannot release this booking out from under the presenter mid-demo.

**D. Automatic Release**
Booked as Scenario 2 (§H): Belgrade HQ, Desk, booked for **today** (office-local), by a **different** employee than Scenario 1 — deliberately exploiting the existing Belgrade-Desk demo-override policy (`00:05:00` local), whose deadline for a same-day booking has already passed by any reasonable demo time. The booking is deliberately not checked in. With the worker/scheduler wiring above running, the next sweep tick (≤10s) releases it for real. UI polls `GET /bookings/:id`, observes `Reserved → Released`, then re-runs `GET /availability` and shows the same resource reappearing. No frontend-simulated release, no direct DB mutation from the browser, no new manual-release control.

**E. Booking State Visibility**
Bounded polling of `GET /bookings/:id` (e.g. every 2s, timeout ~30s) while a booking is in a state that can still change (`Reserved`); stops polling once `CheckedIn`/`Released` is observed or the timeout is reached, showing a clear "still processing" vs. "timed out, refresh manually" state. No WebSockets, no new infrastructure.

**F. Demo Activity Timeline**
A session-local (not persisted) list of observed events: booking created, Reserved confirmed (from the `POST` response), check-in submitted (202 observed), CheckedIn confirmed (from a poll), deadline passed / release observed (from a poll), resource available again (from an availability re-search). Explicitly labelled in the UI as "observed this session," never implying a persisted audit trail (none exists — Audit Module is out of PoC scope per plan §1 decision 13) or that a notification was sent (Capability 3 is unimplemented).

**G. Error Handling**
Invalid/missing bearer token (401, reused from TASK-15), missing booking (404 from the new endpoint), failed check-in submission (400/401/404 from Ingress), accepted-but-not-yet-processed (202 + polling timeout, shown distinctly from both success and failure), backend unavailable (network/fetch failure), failed status refresh (polling error, retry/backoff shown, not silently swallowed).

**H. Two Independent Demo Scenarios**
Implemented as two separate bookings, by two separate seeded employees, on two separate dates, so they can never interfere with each other or collide against BR-02 (an employee may hold at most one active booking per resource type per day):
- **Scenario 1 (Successful check-in):** *Employee A* (e.g. Alice Petrovic) books a Belgrade Desk for **the office-local next calendar day** → confirm Reserved → submit check-in (payload's `scannedAt` dated on that same future booking date, §C) → poll → confirm CheckedIn. The next-day date choice is what guarantees the deadline can't have already passed, regardless of demo timing (see Correction history, Revision 2).
- **Scenario 2 (Automatic release):** *Employee B* (e.g. Bojan Jovanovic, different from Employee A) books a *different* Belgrade Desk for **today** → do not check in → wait for the sweep tick → confirm Released → re-search availability → confirm the same resource reappears.
Each scenario is independently repeatable within a session because each creates its own new booking, and the two can be run in either order, interleaved, or repeated without one affecting the other's employee/date/resource combination.

## Explicit out of scope
Everything listed in the brief's Phase 4, verbatim: new business capabilities beyond what TASK-06–10 already implement; real Entra ID/authentication; real hardware/QR/access-card integration; a new booking state machine; changes to conflict-prevention rules (TASK-04/05 untouched); manual administrative release (the sweep is the only release path, triggered by the scheduler, never a UI button that directly flips status); an admin UI; a production observability dashboard; a notification dispatch UI (Capability 3 — unimplemented, no `notification` module exists); any new external service; replacing the existing backend architecture; rewriting TASK-05/TASK-10/TASK-12's existing integration test suites (all remain unmodified and passing). TASK-13's planned scripted CLI/API demo harness and TASK-14's final verification bundle are **not** modified or replaced by this task — this is an additional, parallel, browser-driven presentation surface for Capabilities 1+2, complementing (not superseding) TASK-13/14's scripted evidence once those are built.

## Acceptance criteria
1. Existing Capability 1 behaviour (search, book, all five error cases, 401 handling, same-origin serving) is preserved after the React rewrite — verified against TASK-15's own manual checklist, re-run.
2. A booking can be created from the browser (existing `POST /bookings`, unchanged).
3. The browser displays confirmed `Reserved` state from the `POST /bookings` response.
4. A simulated check-in can be submitted through the real `app-qr` adapter (`POST /integrations/checkin/app-qr`) — depends on the new `external_mapping` seed rows (§ Human-approved backend enablement, item 2). Scenario 1's booking (next-calendar-day) must still be `Reserved` at the moment check-in is submitted — i.e. it must not have been released by the scheduler first.
5. The browser distinguishes `202` acceptance from completed processing (never shows "checked in" on `202` alone).
6. The booking's real `CheckedIn` state is observed via `GET /bookings/:id` — depends on new endpoint (item 1) and the worker wiring actually consuming the queue (item 3), verified by actually starting the application (not by calling the wiring functions directly in a test — see "Required automated tests").
7. Automatic release is performed by the existing Release Engine, triggered by the new scheduler (item 3) — not simulated in the frontend — and is likewise verified against the actually-running application.
8. The resulting `Released` state is observed via `GET /bookings/:id` (item 1).
9. The resource becomes available again via the existing `GET /availability` (unchanged).
10. Both demo scenarios (§H) work independently within one session and in either order, using separate bookings, separate employees, and separate dates, with no BR-02 conflict possible between them.
11. Errors and pending/processing states (§G) are displayed distinctly from success states.
12. No new backend business logic or duplicate domain rules are introduced — the three backend additions are a read projection, fixture data, and process wiring only; every state transition still originates from TASK-08/09's existing conditional-`UPDATE` code paths.

All twelve criteria are implementable with the human-approved backend enablement above; none is blocked pending further decisions.

## Required automated tests
- Full existing suite (85 tests as of this assessment) continues to pass unmodified, including TASK-05's concurrency races and TASK-10's reliability suite.
- New integration test(s) for `GET /bookings/:id`: `200` with correct shape + `checkInDeadline`, `404` for a nonexistent or not-owned booking, `401` for missing/invalid token — added under `test/integration/booking/`.
- New integration/unit test confirming the seed script inserts the expected `external_mapping` rows idempotently (`ON CONFLICT DO NOTHING`, re-run safe) — added under `test/integration/db/`.
- **New black-box application-startup integration test** (this is the corrected item from Revision 2 — calling `registerCheckinGatewayWorker()`/`runReleaseSweep()` directly in a test is explicitly **not** sufficient evidence here): the test calls the same exported `startApp()` bootstrap used by `npm run start:api` (not `buildApp()` alone, and without calling either wiring function itself), then, using only real HTTP requests against the started server:
  1. submits a real check-in via `POST /integrations/checkin/app-qr` for a `Reserved` fixture booking, then polls `GET /bookings/:id` until it observes `CheckedIn` — proving the started application itself consumed the queue, not the test;
  2. separately, inserts a fixture booking already past its deadline (or uses a `FakeClock`-backed policy fixture) and polls `GET /bookings/:id` until it observes `Released` within a small bounded number of scheduler ticks — proving the started application itself is running the sweep, not the test.
- **New regression test for the Revision 2 date-safety fix**: create a Scenario-1-shaped booking (Belgrade Desk, office-local next calendar day) against a running scheduler (or one directly-invoked `runReleaseSweep` tick using `SystemClock`, immediately after creation) and assert the booking remains `Reserved` — guards against exactly the premature-release defect this correction fixes, added under `test/integration/release-engine/` or alongside the new startup test.
- Focused React component tests (e.g. Vitest + Testing Library) for: booking creation success/error rendering, the Current Booking Panel's state rendering from a mocked `GET /bookings/:id` response, and the polling component's timeout behaviour — only where they provide meaningful coverage beyond what manual verification already covers; no large browser-automation framework is introduced.
- Given the two-day Camp timeline, full end-to-end browser automation remains out of scope (consistent with TASK-15's own precedent) — manual verification against the checklist below is the primary evidence for the two live scenarios.

## Verification evidence
- Test run output showing the full suite (existing + new, including the black-box startup test and the date-safety regression test) passing.
- Screenshots or a short recording of both complete demo scenarios (§H), start to finish, including the browser's own timeline/polling UI mid-flight (not just the final state), explicitly showing Scenario 1 and Scenario 2 use different employees and different booking dates.
- Explicit confirmation, captured in the recording or checklist, that Scenario 1's booking is still `Reserved` immediately before check-in is submitted (i.e. the scheduler has not prematurely released it).
- A concise demo checklist (mirroring [TASK-16](TASK-16-verification-evidence.md)'s format) covering: happy-path check-in, automatic release, both error-state families (§G), and confirmation that displayed lifecycle states came from a live `GET /bookings/:id` response (e.g. via the browser network tab), not frontend-only state.
- A list of the exact API contracts consumed (this document's own "API contracts consumed" section, reproduced verbatim in the evidence file).
- This document itself, recording the human-approved deviations from the original TASK-15-era assumption that "no check-in/release UI exists" and from the plan's original api/worker process split (§1 decision 11).

## Demo contribution
Closes the loop the PoC Selection's own demo story (§5) describes — *Discover → Reserve → Confirm → (Use or Don't) → Reclaim → Re-offer* — as something a non-technical Camp audience can watch happen live in a browser, not just read from test output or a scripted CLI log. Directly extends TASK-15's Capability 1 story with the two riskiest, highest-value guarantees the HLD's own §17 assessment flags (idempotent check-in, safe automatic release) made visible rather than asserted. Complements, and does not replace, TASK-13's planned scripted adversarial demo (duplicate check-in races, late-check-in-after-release, concurrent booking races) — this UI shows the calm happy-path and single-release story for a live audience; TASK-13 remains the vehicle for the adversarial/statistical evidence that isn't legible as a one-shot browser click.

## Risks and human decisions (resolved during this planning session, 2026-09-25)
- **React/Vite/TypeScript adoption** — approved. Recommendation was a full rewrite of the existing small vanilla-JS page (low risk given its size), not a second competing frontend; approved as-is.
- **New `GET /bookings/:id` read endpoint** — approved, scoped deliberately narrower than the not-selected FR-04.
- **New `external_mapping` seed data** — approved, pure fixture data.
- **In-process worker/scheduler wiring at boot** — approved, as a documented PoC-scoped simplification of the original planned `api`/`worker` process split.

No open/unresolved decisions remain blocking this task's execution.

## Recommended position in the dependency graph
Depends on **TASK-15** (existing UI) and **TASK-08 → TASK-09 → TASK-10** (completed, re-verified Capability 2 backend). Does not depend on and does not block TASK-11/TASK-12 (Notification Dispatch, unimplemented) or TASK-13/TASK-14 (which retain their own independent scripted-harness scope). Suggested backlog placement: next task picked up once a human confirms this proposal, since all of its blocking decisions were resolved in this session.
