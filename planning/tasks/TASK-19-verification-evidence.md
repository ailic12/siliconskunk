# TASK-19 — Manual Verification Evidence

Recorded per [TASK-17-capability2-demo-ui.md](TASK-17-capability2-demo-ui.md)'s
"Verification evidence" section, mirroring [TASK-16](TASK-16-verification-evidence.md)'s
format. Run twice, 2026-09-25, against a live `npm run start:api` instance
(via `startApp()`, the same bootstrap used by `npm run start:api`) backed by
the local dev Postgres, seeded via `npm run seed`, driven through an actual
browser session (Claude Code's preview/browser tooling). The second run is
the one whose exact timestamps/ids are recorded below, captured after the
Independent Review fix pass (retry/backoff, timeline-event-kind cleanup); the
first run (pre-fix-pass) produced functionally identical results.

## Automated evidence

- `npm run lint` — PASSED, no output, repo-wide (including `frontend/`).
- `npx tsc --project tsconfig.base.json --noEmit` — PASSED, backend typecheck clean.
- `npx tsc --project frontend/tsconfig.json` — PASSED, frontend typecheck clean.
- `npx vite build` — PASSED, SPA builds cleanly into `public/`.
- `npm test` — PASSED, 18 files / 95 tests (85 pre-existing + 10 new: `booking-status.test.ts`,
  extended `seed.test.ts`, `startup.test.ts`, `scenario1-date-safety.test.ts`), against the real
  Docker Postgres (`siliconskunk-postgres-1`), including the unmodified 25-iteration concurrency
  race suites (TASK-05) and the unmodified migration/seed/booking-API suites (TASK-01–04/08/09/10).
- `npm run test:frontend` — PASSED, 3 files / 14 tests (`SearchPanel.test.tsx`,
  `BookingCard.test.tsx`, `useBookingPolling.test.ts`), covering booking creation
  success/error rendering, Current Booking Panel state rendering from a mocked
  `GET /bookings/:id`, polling timeout behaviour, and the retry/backoff behaviour
  on a failed status refresh added during the Independent Review fix pass.

## API contracts consumed (verbatim, per the task's own "API contracts consumed" section)

- `GET /availability?officeId=&resourceType=&date=` → `200 { resources: [...] }` (TASK-04, reused as-is from TASK-15).
- `POST /bookings` → `201` booking object / `400`/`401`/`404`/`409`/`422` (TASK-04, reused as-is from TASK-15).
- `POST /integrations/checkin/app-qr` with header `x-provider-api-key: app-qr-demo-secret`, body
  `{ eventId, bookingReference, scannedAt }` → `202 { status: "accepted" }` / `400`/`401`/`404` (TASK-06/07).
- `GET /bookings/:id` (new, this task) → `200`/`401`/`404`.

## Manual checklist (browser-driven, live requests/responses observed via `preview_network`/`preview_snapshot`)

Both scenarios were run in the same browser session, in the order below, with no reload between
them, demonstrating AC-10 (both scenarios work independently within one session, no BR-02
conflict) directly rather than only structurally.

| # | Scenario | Action | Observed result |
|---|---|---|---|
| 1 | Scenario 1 setup (AC-4, AC-10) | Clicked "Run Scenario 1 (book)" — books Alice Petrovic a Belgrade Desk for the office-local next calendar day | `GET /availability?...date=2026-09-26` → `200`; `POST /bookings` → `201`; timeline: "11:56:08 AM — Scenario 1: Alice Petrovic booked Desk 1 for 2026-09-26 — Reserved." |
| 2 | Confirm still `Reserved` immediately before check-in (AC-4 explicit requirement) | Inspected the booking card before clicking "Simulate check-in" | Card showed `Status: Reserved`, `Check-in deadline: 2026-09-25T22:05:00.000Z` (still in the future at the moment of inspection) — booking id `a4dce9b7-545c-436b-ad7d-516d7856e95c` |
| 3 | Simulate check-in (AC-4, AC-5) | Clicked "Simulate check-in" on Alice's card | `POST /integrations/checkin/app-qr` → `202 Accepted`; UI immediately showed "Check-in accepted (202) — awaiting confirmation…", distinct from a confirmed state; timeline: "11:56:35 AM — Check-in submitted... 202 accepted, awaiting processing (not yet confirmed)." |
| 4 | Real check-in confirmed (AC-6) | Waited, observed polling | Repeated live `GET /bookings/a4dce9b7-...` → `200` responses; card transitioned to `Status: CheckedIn` at 11:56:38 AM (3s after submission) — observed via a live `GET /bookings/:id` response, not frontend-assumed; timeline: "11:56:38 AM — ...is now CheckedIn — observed via GET /bookings/a4dce9b7-...". |
| 5 | Scenario 2 setup (AC-7, AC-10) | Clicked "Run Scenario 2 (book, do not check in)" — books Bojan Jovanovic (different employee from Scenario 1) a different Belgrade Desk booking for today (office-local), deliberately not checked in | `GET /availability?...date=2026-09-25` → `200`; `POST /bookings` → `201`; timeline: "11:56:57 AM — Scenario 2: Bojan Jovanovic booked Desk 1 for 2026-09-25 — Reserved." — booking id `bcebac99-2a5a-49e9-8428-cc8b5eecddaf`, distinct from Scenario 1's booking id and date |
| 6 | Automatic release observed (AC-7, AC-8) | Did not check in; waited for the real running scheduler | Repeated live `GET /bookings/bcebac99-...` → `200` responses; card transitioned to `Status: Released` at 11:57:01 AM — 4 seconds after booking, within the default 5s sweep interval; deadline shown was `2026-09-24T22:05:00.000Z`, already in the past at booking time (the deliberately-exploited same-day demo-override policy); timeline: "11:57:01 AM — ...was automatically Released — observed via GET /bookings/bcebac99-...". Release was performed by the real Release Engine's `runReleaseSweep`, triggered by `startApp()`'s `setInterval` — not simulated in the frontend. |
| 7 | Resource reappears (AC-9) | Re-ran "Search availability" for Belgrade HQ / Desk / 2026-09-25 as Alice | `GET /availability?...date=2026-09-25` → `200`; "Desk 1" reappeared in the results table with `Status: Available` |
| 8 | Both scenarios coexist, no BR-02 conflict (AC-10) | Both booking cards ("Desk 1 — Bojan Jovanovic", `Released`) and ("Desk 1 — Alice Petrovic", `CheckedIn`) rendered simultaneously in "My bookings (this session)" throughout | Two separate bookings, two separate employees, two separate dates, two separate booking IDs — no conflict, no interference, confirmed by the timeline's interleaved-but-consistent event log above |
| 9 | Distinct pending vs. settled vs. timeout vs. error states (AC-11, §G) | Covered by automated tests, not re-driven manually in this session | `BookingCard.test.tsx` (CheckedIn/Released rendering, 202-vs-confirmed, check-in failure), `useBookingPolling.test.ts` (timeout state, settled state, retrying-error state, gives-up-after-repeated-failures state) — 14/14 passing |
| 10 | 401 / cross-employee 404 boundary (§G, security) | Covered by automated tests, not re-driven manually in this session | `test/integration/booking/booking-status.test.ts`: no token → `401`; unknown token → `401`; nonexistent booking id → `404`; booking owned by a different employee → `404` (identical shape to nonexistent, no enumeration) — 6/6 passing |
| 11 | Search/booking error mapping preserved from TASK-15 (AC-1) | Covered by automated tests (`SearchPanel.test.tsx`) plus the unmodified `demo-ui.test.ts` | 400/409/network-failure cases render distinct, mapped messages (not raw dumps); title, 200, and 401-boundary checks from TASK-15's own suite still pass unmodified |

Browser console: no JavaScript errors observed during either session (`preview_console_logs`). Server
logs: no errors (`preview_logs`).

## Environment notes (non-application, for reproducibility)

- Run against `.claude/launch.json`'s existing `api` configuration (`npm run start:api`, i.e.
  `startApp()`), unchanged from the version already in the repository.
- `npm run seed` was run against the local dev Postgres beforehand; idempotent, modified no
  repository file. Seeded `external_mapping` rows (TASK-17's new fixture, one `app-qr` row per
  resource) are what let the real Ingress adapter resolve Scenario 1's check-in payload.
- The two demo booking rows created during each manual pass were deleted afterward (direct SQL,
  including their `checkin_evidence` row) so the local dev database is left in the same seeded-only
  state the automated test suite expects; this is routine manual-testing cleanup, not a repository
  file change.
