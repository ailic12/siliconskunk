import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import supertest from "supertest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../../src/api/server";
import type { Clock } from "../../../src/shared/clock";
import { pool, withTransaction } from "../../../src/shared/db";
import { runReleaseSweep } from "../../../src/modules/release-engine";
import { runNotificationWorker, FakeNotificationChannel, claimNext, markSent } from "../../../src/modules/notification";
import { runSeed } from "../../../db/seed";
import { OFFICE_BELGRADE_ID } from "../../../db/seed/offices";
import { resources } from "../../../db/seed/resources";
import { employees } from "../../../db/seed/employees";

class FakeClock implements Clock {
  constructor(private readonly instant: Date) {}
  now(): Date {
    return this.instant;
  }
}

// Distinct dates from every other integration suite (notification-producer-
// wiring.test.ts documents June 1/2/3/10 as already claimed) — this file uses
// 2026-06-20 onward so its fixtures never cross-contaminate another suite's.
const FAILURE_ISOLATION_CREATE_CLOCK = new FakeClock(new Date("2026-06-18T08:00:00.000Z"));
const FAILURE_ISOLATION_DATE = "2026-06-20";

const CRASH_SIM_DATE = "2026-06-21";

const LIFECYCLE_CREATE_CLOCK = new FakeClock(new Date("2026-06-24T08:00:00.000Z"));
const LIFECYCLE_BOOKING_DATE = "2026-06-26";
// Default policy (ParkingSpace, no resource-type override): 10:00 local
// (Europe/Belgrade, CEST/UTC+2 in June) = 08:00 UTC deadline, same calendar
// day as the booking (mirrors notification-producer-wiring.test.ts).
const LIFECYCLE_RELEASE_CLOCK = new FakeClock(new Date("2026-06-26T09:00:00.000Z"));

const belgradeParking = resources.filter(
  (r) => r.officeId === OFFICE_BELGRADE_ID && r.type === "ParkingSpace",
);
const belgradeEmployees = employees.filter((e) => e.homeOfficeId === OFFICE_BELGRADE_ID);

const FAILURE_ISOLATION_RESOURCE = belgradeParking[2]!;
const FAILURE_ISOLATION_EMPLOYEE = belgradeEmployees[2]!;

const CRASH_SIM_RESOURCE = belgradeParking[3]!;
// Only 3 Belgrade employees are seeded — reuse [0]; this scenario's fixture
// date (CRASH_SIM_DATE) is unique across the repository so no active-booking
// uniqueness constraint is ever at risk of colliding with another suite.
const CRASH_SIM_EMPLOYEE = belgradeEmployees[0]!;

const LIFECYCLE_RESOURCE = belgradeParking[0]!;
const LIFECYCLE_EMPLOYEE = belgradeEmployees[1]!;

interface NotificationRow {
  id: string;
  booking_id: string;
  type: string;
  status: string;
  dedup_key: string;
}

interface BookingRow {
  id: string;
  status: string;
  resource_id: string;
  employee_id: string;
  booking_date: string;
}

async function notificationsFor(bookingId: string, type: string): Promise<NotificationRow[]> {
  const { rows } = await pool.query<NotificationRow>(
    `SELECT id, booking_id, type, status, dedup_key FROM notification WHERE booking_id = $1 AND type = $2`,
    [bookingId, type],
  );
  return rows;
}

async function bookingById(id: string): Promise<BookingRow> {
  const { rows } = await pool.query<BookingRow>(
    `SELECT id, status, resource_id, employee_id, booking_date FROM booking WHERE id = $1`,
    [id],
  );
  return rows[0]!;
}

async function insertReservedBooking(params: {
  resourceId: string;
  employeeId: string;
  bookingDate: string;
}): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO booking (id, resource_id, employee_id, booking_date, resource_type, status)
     VALUES ($1, $2, $3, $4, 'ParkingSpace', 'Reserved')`,
    [id, params.resourceId, params.employeeId, params.bookingDate],
  );
  return id;
}

async function insertPendingNotification(bookingId: string, type: string, dedupKey: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO notification (booking_id, type, channel, dedup_key, status)
     VALUES ($1, $2, 'Teams', $3, 'Pending')
     RETURNING id`,
    [bookingId, type, dedupKey],
  );
  return rows[0]!.id;
}

describe("Notification reliability (TASK-12, HLD §5.5)", () => {
  let app: FastifyInstance;
  let failureIsolationBookingId: string;
  let crashSimBookingId: string;
  let lifecycleBookingId: string;

  beforeAll(async () => {
    await runSeed();
    app = buildApp(FAILURE_ISOLATION_CREATE_CLOCK);
    await app.ready();
  });

  afterAll(async () => {
    const bookingIds = [failureIsolationBookingId, crashSimBookingId, lifecycleBookingId].filter(Boolean);
    await pool.query(`DELETE FROM notification WHERE booking_id = ANY($1::uuid[])`, [bookingIds]);
    await pool.query(`DELETE FROM booking WHERE id = ANY($1::uuid[])`, [bookingIds]);
    await app.close();
    await pool.end();
  });

  it("a failing channel never affects booking commit — the booking transaction still succeeds and stays committed regardless of notification outcome", async () => {
    const res = await supertest(app.server)
      .post("/bookings")
      .set("Authorization", `Bearer ${FAILURE_ISOLATION_EMPLOYEE.devToken}`)
      .send({ resourceId: FAILURE_ISOLATION_RESOURCE.id, bookingDate: FAILURE_ISOLATION_DATE });

    expect(res.status).toBe(201);
    failureIsolationBookingId = res.body.id;

    const committed = await bookingById(failureIsolationBookingId);
    expect(committed).toBeDefined();
    expect(committed.status).toBe("Reserved");

    const pending = await notificationsFor(failureIsolationBookingId, "Confirmation");
    expect(pending).toHaveLength(1);
    expect(pending[0]!.status).toBe("Pending");

    // The channel fails/times out on every send — this must never reach back
    // into the booking transaction, which already committed independently.
    const alwaysFailingChannel = new FakeNotificationChannel({ shouldFail: () => true });
    await runNotificationWorker(FAILURE_ISOLATION_CREATE_CLOCK, alwaysFailingChannel);

    const afterWorker = await bookingById(failureIsolationBookingId);
    expect(afterWorker).toEqual(committed);

    const afterSend = await notificationsFor(failureIsolationBookingId, "Confirmation");
    expect(afterSend).toHaveLength(1);
    expect(afterSend[0]!.status).not.toBe("Sent");
    expect(["Pending", "Failed"]).toContain(afterSend[0]!.status);
    expect(alwaysFailingChannel.getSentLog()).toHaveLength(0);

    // claimNext/runNotificationWorker operate over the whole outbox table,
    // not scoped to a booking — clean up this scenario's now-eligible-again
    // Pending/Failed row immediately so it can never be picked up by another
    // scenario's claim in this file (booking row itself is left for afterAll).
    await pool.query(`DELETE FROM notification WHERE booking_id = $1`, [failureIsolationBookingId]);
  });

  it("a crash between provider-ack and status commit confines the one documented duplicate to that window and never corrupts booking state", async () => {
    crashSimBookingId = await insertReservedBooking({
      resourceId: CRASH_SIM_RESOURCE.id,
      employeeId: CRASH_SIM_EMPLOYEE.id,
      bookingDate: CRASH_SIM_DATE,
    });
    const dedupKey = `Confirmation:${crashSimBookingId}`;
    const notificationId = await insertPendingNotification(crashSimBookingId, "Confirmation", dedupKey);
    const bookingBefore = await bookingById(crashSimBookingId);

    const channel = new FakeNotificationChannel();
    const cycle1Now = new Date("2026-06-21T08:00:00.000Z");

    // Worker instance 1: claims, successfully calls the channel, then
    // "crashes" before committing status='Sent' — exactly HLD §5.5's
    // documented window (design/smart-office-hld.md:392-400).
    const claimed1 = await withTransaction((client) =>
      claimNext(client, {
        leaseOwner: "worker-crashed",
        leaseExpiresAt: new Date(cycle1Now.getTime() + 5_000),
        now: cycle1Now,
      }),
    );
    expect(claimed1?.id).toBe(notificationId);
    await channel.send({
      notificationId: claimed1!.id,
      bookingId: claimed1!.bookingId,
      type: claimed1!.type,
      channel: claimed1!.channel,
    });
    // Deliberately no markSent() call here — this is the simulated crash.

    // Lease expiry: a fresh worker instance re-claims and resends. This is
    // the one documented duplicate the outbox honestly does not prevent.
    const cycle2Now = new Date(cycle1Now.getTime() + 10_000);
    const claimed2 = await withTransaction((client) =>
      claimNext(client, {
        leaseOwner: "worker-recovered",
        leaseExpiresAt: new Date(cycle2Now.getTime() + 30_000),
        now: cycle2Now,
      }),
    );
    expect(claimed2?.id).toBe(notificationId);
    await channel.send({
      notificationId: claimed2!.id,
      bookingId: claimed2!.bookingId,
      type: claimed2!.type,
      channel: claimed2!.channel,
    });
    await withTransaction((client) => markSent(client, claimed2!.id, "worker-recovered"));

    // Exactly one duplicate external send — never zero, never more than one extra.
    const sentForThis = channel.getSentLog().filter((m) => m.notificationId === notificationId);
    expect(sentForThis).toHaveLength(2);

    // Still exactly one outbox row for this dedup_key — the duplicate exists
    // only in the external channel's log, never as a second DB row.
    const { rows: dedupRows } = await pool.query(`SELECT id FROM notification WHERE dedup_key = $1`, [dedupKey]);
    expect(dedupRows).toHaveLength(1);

    const rowAfterRecovery = await notificationsFor(crashSimBookingId, "Confirmation");
    expect(rowAfterRecovery).toHaveLength(1);
    expect(rowAfterRecovery[0]!.status).toBe("Sent");

    // Booking state was never touched by any of the above.
    const bookingAfter = await bookingById(crashSimBookingId);
    expect(bookingAfter).toEqual(bookingBefore);

    // A subsequent healthy claim cycle never reclaims this row again — it is
    // already Sent, so it is not eligible, regardless of how far the clock
    // advances. The duplicate is confined to the one crash window and never
    // recurs. (Using claimNext directly, not runNotificationWorker, keeps
    // this assertion scoped to this test's own notification id — the worker
    // drains the whole outbox table and would also touch unrelated rows left
    // Pending by other scenarios in this file.)
    const reclaimAttempt = await withTransaction((client) =>
      claimNext(client, {
        leaseOwner: "worker-healthy-cycle",
        leaseExpiresAt: new Date(cycle2Now.getTime() + 120_000),
        now: new Date(cycle2Now.getTime() + 60_000),
      }),
    );
    expect(reclaimAttempt?.id).not.toBe(notificationId);
    const sentAfterHealthyCycle = channel.getSentLog().filter((m) => m.notificationId === notificationId);
    expect(sentAfterHealthyCycle).toHaveLength(2);
  });

  it("a full booking→release lifecycle under normal operation produces exactly one Sent Confirmation and one Sent ReleaseNotice", async () => {
    const lifecycleApp = buildApp(LIFECYCLE_CREATE_CLOCK);
    await lifecycleApp.ready();
    try {
      const res = await supertest(lifecycleApp.server)
        .post("/bookings")
        .set("Authorization", `Bearer ${LIFECYCLE_EMPLOYEE.devToken}`)
        .send({ resourceId: LIFECYCLE_RESOURCE.id, bookingDate: LIFECYCLE_BOOKING_DATE });
      expect(res.status).toBe(201);
      lifecycleBookingId = res.body.id;
    } finally {
      await lifecycleApp.close();
    }

    const released = await runReleaseSweep(LIFECYCLE_RELEASE_CLOCK);
    expect(released.map((b) => b.id)).toContain(lifecycleBookingId);

    const channel = new FakeNotificationChannel();
    await runNotificationWorker(LIFECYCLE_RELEASE_CLOCK, channel);

    const confirmations = await notificationsFor(lifecycleBookingId, "Confirmation");
    expect(confirmations).toHaveLength(1);
    expect(confirmations[0]!.status).toBe("Sent");

    const releaseNotices = await notificationsFor(lifecycleBookingId, "ReleaseNotice");
    expect(releaseNotices).toHaveLength(1);
    expect(releaseNotices[0]!.status).toBe("Sent");
  });
});
