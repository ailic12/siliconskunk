import type { PoolClient } from "pg";
import type { CheckInEvent } from "../checkin-contract";

/**
 * Idempotency boundary (R-03/R-04, HLD §5.3): ON CONFLICT DO NOTHING on the
 * (source_system, external_event_id) unique constraint makes a duplicate
 * delivery a silent no-op — returns null rather than throwing. outcome
 * defaults to 'Unmatched' (the schema's safe default per the ERD's
 * "Applied, Unmatched, Rejected" enum, HLD §4) and is only flipped to
 * 'Applied' once a single Reserved booking is actually checked in.
 */
export async function insertPendingEvidence(
  client: PoolClient,
  event: CheckInEvent,
): Promise<string | null> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO checkin_evidence (source_system, external_event_id, occurred_at, received_at, outcome)
     VALUES ($1, $2, $3, $4, 'Unmatched')
     ON CONFLICT (source_system, external_event_id) DO NOTHING
     RETURNING id`,
    [event.sourceSystem, event.externalEventId, event.occurredAt, event.receivedAt],
  );
  return rows[0]?.id ?? null;
}

export async function markEvidenceApplied(
  client: PoolClient,
  evidenceId: string,
  bookingId: string,
): Promise<void> {
  await client.query(
    `UPDATE checkin_evidence SET outcome = 'Applied', booking_id = $2 WHERE id = $1`,
    [evidenceId, bookingId],
  );
}
