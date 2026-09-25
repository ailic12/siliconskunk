import type { PoolClient } from "pg";
import { pool } from "../../shared/db";

export type NotificationStatus = "Pending" | "Sending" | "Sent" | "Failed";

export interface Notification {
  id: string;
  bookingId: string;
  type: string;
  channel: string;
  dedupKey: string;
  status: NotificationStatus;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  sentAt: string | null;
  attempts: number;
}

interface NotificationRow {
  id: string;
  booking_id: string;
  type: string;
  channel: string;
  dedup_key: string;
  status: NotificationStatus;
  lease_owner: string | null;
  lease_expires_at: string | null;
  sent_at: string | null;
  attempts: number;
}

function mapRow(row: NotificationRow): Notification {
  return {
    id: row.id,
    bookingId: row.booking_id,
    type: row.type,
    channel: row.channel,
    dedupKey: row.dedup_key,
    status: row.status,
    leaseOwner: row.lease_owner,
    leaseExpiresAt: row.lease_expires_at,
    sentAt: row.sent_at,
    attempts: row.attempts,
  };
}

/**
 * Transactional outbox write (TASK-11, HLD §5.5): the caller (booking
 * creation, release transition) inserts this row in the same DB transaction
 * as its own state change, so a notification intent is never lost even if
 * the process crashes immediately after commit. dedup_key is unique per
 * lifecycle event (one per booking per type), enforced by TASK-02's
 * constraint. `ON CONFLICT DO NOTHING` makes this call idempotent: a retried
 * or re-run same-event insert (e.g. a caller-level retry of the surrounding
 * transaction) must never raise a unique-violation that would roll back the
 * caller's own state-changing write — that would defeat the "notification
 * intent is never lost" guarantee for the booking/release side. Returns
 * `null` when the row already existed (no-op), rather than the existing row.
 */
export async function insertNotificationIntent(
  client: PoolClient,
  params: { bookingId: string; type: string; channel: string; dedupKey: string },
): Promise<Notification | null> {
  const { rows } = await client.query<NotificationRow>(
    `INSERT INTO notification (booking_id, type, channel, dedup_key, status)
     VALUES ($1, $2, $3, $4, 'Pending')
     ON CONFLICT (dedup_key) DO NOTHING
     RETURNING id, booking_id, type, channel, dedup_key, status, lease_owner, lease_expires_at, sent_at, attempts`,
    [params.bookingId, params.type, params.channel, params.dedupKey],
  );
  const row = rows[0];
  return row ? mapRow(row) : null;
}

/**
 * Claim/lease worker (TASK-11, HLD §5.5): claims at most one eligible row —
 * Pending and past its backoff gate (lease_expires_at reused as a "not
 * eligible before" marker while Pending), or Sending with an expired lease
 * (a prior worker died mid-send). The inner SELECT picks a candidate id; the
 * outer UPDATE re-checks the same eligibility condition at write time — the
 * same conditional-UPDATE idiom already proven safe under concurrency by
 * applyRelease/applyCheckIn (TASK-08/09/10), so two concurrent claimers can
 * race to the same candidate id and only one will actually update the row.
 */
export async function claimNext(
  client: PoolClient,
  params: { leaseOwner: string; leaseExpiresAt: Date; now: Date },
): Promise<Notification | null> {
  const { rows } = await client.query<NotificationRow>(
    `UPDATE notification
     SET status = 'Sending', lease_owner = $1, lease_expires_at = $2, attempts = attempts + 1
     WHERE id = (
       SELECT id FROM notification
       WHERE (status = 'Pending' AND (lease_expires_at IS NULL OR lease_expires_at <= $3))
          OR (status = 'Sending' AND lease_expires_at <= $3)
       ORDER BY id
       LIMIT 1
     )
     AND (
       (status = 'Pending' AND (lease_expires_at IS NULL OR lease_expires_at <= $3))
       OR (status = 'Sending' AND lease_expires_at <= $3)
     )
     RETURNING id, booking_id, type, channel, dedup_key, status, lease_owner, lease_expires_at, sent_at, attempts`,
    [params.leaseOwner, params.leaseExpiresAt.toISOString(), params.now.toISOString()],
  );
  const row = rows[0];
  return row ? mapRow(row) : null;
}

/**
 * Conditional on still holding the Sending lease this worker instance
 * claimed — guards against marking Sent after this lease has already
 * expired and been re-claimed by another worker (HLD §5.5's documented
 * duplicate window: the row may already be back in a new Sending cycle).
 */
export async function markSent(client: PoolClient, id: string, leaseOwner: string): Promise<void> {
  await client.query(
    `UPDATE notification
     SET status = 'Sent', sent_at = now()
     WHERE id = $1 AND status = 'Sending' AND lease_owner = $2`,
    [id, leaseOwner],
  );
}

/**
 * Booking-scoped notification read (TASK-18): plain lookup, ownership
 * enforcement is the caller's responsibility (booking.service.ts), mirroring
 * findBookingById's own division of concerns. A booking has at most two rows
 * (Confirmation, ReleaseNotice) — no ordering guarantee by insertion time
 * (notification has no created_at column), so callers must distinguish rows
 * by `type`, not array position.
 */
export async function findNotificationsByBookingId(bookingId: string): Promise<Notification[]> {
  const { rows } = await pool.query<NotificationRow>(
    `SELECT id, booking_id, type, channel, dedup_key, status, lease_owner, lease_expires_at, sent_at, attempts
     FROM notification
     WHERE booking_id = $1`,
    [bookingId],
  );
  return rows.map(mapRow);
}

/**
 * On failure: back to Pending with a backoff gate (lease_expires_at reused,
 * status stays claimable by any future worker — lease_owner is cleared), or
 * Failed once attempts has reached the cap. Conditional on still holding the
 * lease, mirroring markSent.
 */
export async function recordFailure(
  client: PoolClient,
  id: string,
  leaseOwner: string,
  params: { now: Date; backoffMs: number; maxAttempts: number },
): Promise<void> {
  await client.query(
    `UPDATE notification
     SET status = CASE WHEN attempts >= $4 THEN 'Failed' ELSE 'Pending' END,
         lease_owner = NULL,
         lease_expires_at = CASE WHEN attempts >= $4 THEN lease_expires_at ELSE $3 END
     WHERE id = $1 AND status = 'Sending' AND lease_owner = $2`,
    [id, leaseOwner, new Date(params.now.getTime() + params.backoffMs).toISOString(), params.maxAttempts],
  );
}
