# TASK-11: Notification outbox, claim/lease worker & mocked channel

## Purpose
Deliver the third selected functionality: a transactional outbox that guarantees no lost notification intent and no double-send from concurrent/retried workers, dispatched through a mocked channel so booking/release logic is never coupled to a real external dependency.

## Approved requirements / validation criteria
FR-18, R-05, NFR-03 (this task's slice); validation items 9 and 10 (partially — full crash-window proof is TASK-12).

## Dependencies
TASK-04, TASK-09 (producer wiring needs both event sources — a booking creation and a release — though the claim/lease worker and fake channel mechanics only need TASK-03's schema and can be built ahead of these two landing, per plan §5).

## Scope
- Producer wiring: this task extends TASK-04's booking-insert transaction to also insert a `Confirmation` notification row in the **same transaction**; this task also extends TASK-09's release-transition transaction to insert a `ReleaseNotice` row in the same transaction as the release `UPDATE`. TASK-09 itself performs only the state transition and owns no outbox logic — this task owns both hand-offs. Both intents use a `dedup_key` unique per lifecycle event.
- Claim/lease worker: `UPDATE notification SET status='Sending', lease_owner=?, lease_expires_at=? WHERE status='Pending' OR (status='Sending' AND lease_expires_at < now())`, using the injected `Clock`.
- Fake `NotificationChannel`: records "sent" messages (queryable log, for demo visibility) and accepts test-controlled latency/failure injection.
- On send success: `status='Sent'`. On failure: back to `Pending` (or `Failed` after a max-attempts cap) with backoff.

## Explicit out of scope
Real Microsoft Graph/Teams/Email integration (explicitly out of scope per PoC Selection §4 Functionality 3); notification preference/channel-selection UI.

## Acceptance criteria
- Creating a booking results in exactly one `Confirmation` row, sent via the fake channel.
- A release results in exactly one `ReleaseNotice` row, sent via the fake channel.
- Two concurrent worker instances (or a retried claim) never both hold the `Sending` lease for the same row simultaneously.
- A failed send returns the row to `Pending`/backoff, not `Sent`.
- TASK-09's code is not modified to add outbox logic directly — this task extends the transaction boundary from the caller side (e.g. wrapping/composing TASK-09's transition function), keeping TASK-09 itself notification-agnostic.

## Required automated tests
Integration tests for producer wiring (booking → Confirmation row; release → ReleaseNotice row) and for the claim/lease mutual-exclusion guarantee under concurrent claim attempts.

## Verification evidence
Test output for producer wiring and claim/lease exclusivity.

## Demo contribution
Feeds TASK-13 Step 1 (notification intents visible in the fake channel log).
