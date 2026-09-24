# TASK-07: Simulated check-in adapters (app/QR + test-harness)

## Purpose
Deliver the two simulated check-in adapters required by the approved PoC Selection: a primary app/QR adapter for the main demo flow, and a minimal second test-harness adapter whose sole purpose is evidencing FR-19 extensibility.

## Approved requirements / validation criteria
FR-19/R-09, PoC Selection §4 Functionality 2's "second adapter requirement"; validation item 8.

## Dependencies
TASK-06.

## Scope
- App/QR adapter: registers under TASK-06's Ingress route mechanism, accepts a plausible app/QR-style payload (e.g. `{ bookingReference, employeeBadge, scannedAt }`), translates it to the canonical `CheckInEvent`.
- Test-harness adapter: a deliberately different payload shape (e.g. a bare admin-confirmation-style webhook), registered the same way, with zero shared code beyond the canonical contract from TASK-06.
- Contract tests for each adapter, run independently of the Booking module and of each other — each test only asserts "adapter payload in → correct canonical `CheckInEvent` out."

## Explicit out of scope
Any real vendor/hardware integration (A-06) — both remain software-only test harnesses. The Check-in Gateway (TASK-08) does not depend on this task — see plan §1 decision 12.

## Acceptance criteria
- Both adapters are reachable via distinct Ingress routes registered without modifying TASK-06's code.
- Each adapter's contract test passes independently — killing/removing one adapter does not break the other's test or TASK-06/TASK-08.
- Submitting a payload through either adapter results in a correctly-shaped canonical `CheckInEvent` on the queue.

## Required automated tests
One contract test per adapter (two total), each isolated to that adapter's translation logic.

## Verification evidence
Contract test output for both adapters, referenced directly by TASK-13 Step 3 as the extensibility evidence.

## Demo contribution
Feeds TASK-13 Step 1 (primary app/QR flow) and Step 3 (second-adapter extensibility evidence, non-centrepiece).
