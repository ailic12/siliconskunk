import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, withTransaction } from "../../../src/shared/db";
import { claimNext } from "../../../src/modules/notification";
import { runSeed } from "../../../db/seed";
import { OFFICE_BELGRADE_ID } from "../../../db/seed/offices";
import { resources } from "../../../db/seed/resources";
import { employees } from "../../../db/seed/employees";

// Distinct date/resource from every other notification/booking suite (see
// notification-producer-wiring.test.ts) — this file never creates a
// released/confirmed booking of its own, just an FK anchor for notification
// rows, so it deliberately never overlaps another suite's assertions.
const RACE_DATE = "2026-06-10";
const RACE_RESOURCE = resources.find(
  (r) => r.officeId === OFFICE_BELGRADE_ID && r.type === "ParkingSpace",
)!;
const RACE_EMPLOYEE = employees.find((e) => e.homeOfficeId === OFFICE_BELGRADE_ID)!;

// N=20+ per the established adversarial-race convention (TASK-05/TASK-10).
const RACE_ITERATIONS = 20;
const CONCURRENT_CLAIMERS = 5;

function assertEqual<T>(actual: T, expected: T, context: string): void {
  if (actual !== expected) {
    throw new Error(
      `${context}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function insertBookingFixture(): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO booking (id, resource_id, employee_id, booking_date, resource_type, status)
     VALUES ($1, $2, $3, $4, 'ParkingSpace', 'Reserved')`,
    [id, RACE_RESOURCE.id, RACE_EMPLOYEE.id, RACE_DATE],
  );
  return id;
}

async function insertPendingNotification(bookingId: string, dedupKey: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO notification (booking_id, type, channel, dedup_key, status)
     VALUES ($1, 'Confirmation', 'Teams', $2, 'Pending')
     RETURNING id`,
    [bookingId, dedupKey],
  );
  return rows[0]!.id;
}

interface NotificationRow {
  status: string;
  lease_owner: string | null;
}

async function notificationById(id: string): Promise<NotificationRow> {
  const { rows } = await pool.query<NotificationRow>(
    `SELECT status, lease_owner FROM notification WHERE id = $1`,
    [id],
  );
  return rows[0]!;
}

describe("Notification claim/lease mutual exclusion (TASK-11, AC-3)", () => {
  let bookingId: string;

  beforeAll(async () => {
    await runSeed();
    bookingId = await insertBookingFixture();
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM notification WHERE booking_id = $1`, [bookingId]);
    await pool.query(`DELETE FROM booking WHERE id = $1`, [bookingId]);
    await pool.end();
  });

  it(`never lets two of ${CONCURRENT_CLAIMERS} concurrent claimers hold the Sending lease on the same row, across ${RACE_ITERATIONS} iterations`, async () => {
    for (let i = 0; i < RACE_ITERATIONS; i++) {
      const notificationId = await insertPendingNotification(bookingId, `race-${i}-${randomUUID()}`);
      const now = new Date();

      // Fired without an intervening await — every claimer races against the
      // same real Postgres row before any of them commits its conditional
      // UPDATE, mirroring TASK-10's sweep-race convention.
      const results = await Promise.all(
        Array.from({ length: CONCURRENT_CLAIMERS }, (_, idx) => {
          const leaseOwner = `worker-${i}-${idx}`;
          return withTransaction((client) =>
            claimNext(client, {
              leaseOwner,
              leaseExpiresAt: new Date(now.getTime() + 30_000),
              now,
            }),
          ).then((claimed) => ({ leaseOwner, claimed }));
        }),
      );

      const winners = results.filter((r) => r.claimed?.id === notificationId);
      assertEqual(winners.length, 1, `iteration ${i}: expected exactly one successful claim`);

      const row = await notificationById(notificationId);
      assertEqual(row.status, "Sending", `iteration ${i}: notification status`);
      assertEqual(row.lease_owner, winners[0]!.leaseOwner, `iteration ${i}: lease owner`);

      await pool.query(`DELETE FROM notification WHERE id = $1`, [notificationId]);
    }
  });

  it("a retried claim on an expired lease can re-claim, but never while the lease is still valid", async () => {
    const notificationId = await insertPendingNotification(bookingId, `retry-${randomUUID()}`);
    const now = new Date();

    const first = await withTransaction((client) =>
      claimNext(client, { leaseOwner: "worker-A", leaseExpiresAt: new Date(now.getTime() + 30_000), now }),
    );
    expect(first?.id).toBe(notificationId);

    // Lease still valid: a second claimer must not re-claim it.
    const second = await withTransaction((client) =>
      claimNext(client, { leaseOwner: "worker-B", leaseExpiresAt: new Date(now.getTime() + 30_000), now }),
    );
    expect(second).toBeNull();

    // Lease expired: a retried claim now succeeds.
    const afterExpiry = new Date(now.getTime() + 60_000);
    const third = await withTransaction((client) =>
      claimNext(client, {
        leaseOwner: "worker-C",
        leaseExpiresAt: new Date(afterExpiry.getTime() + 30_000),
        now: afterExpiry,
      }),
    );
    expect(third?.id).toBe(notificationId);

    await pool.query(`DELETE FROM notification WHERE id = $1`, [notificationId]);
  });
});
