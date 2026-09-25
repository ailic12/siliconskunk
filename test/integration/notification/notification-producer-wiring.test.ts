import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import supertest from "supertest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../../src/api/server";
import type { Clock } from "../../../src/shared/clock";
import { pool } from "../../../src/shared/db";
import { runReleaseSweep } from "../../../src/modules/release-engine";
import { runNotificationWorker, FakeNotificationChannel } from "../../../src/modules/notification";
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

// June 2026 is unused by every other integration suite's booking-date
// fixtures (Jan: booking-api/booking-concurrency; Feb: checkin-gateway;
// April: checkin-release-reliability; May: release-sweep) — so this file's
// booking-creation and release-sweep calls never cross-contaminate theirs,
// and vice versa (runReleaseSweep sweeps every office's Reserved bookings).
const createClock = new FakeClock(new Date("2026-05-30T08:00:00.000Z"));

const CONFIRMATION_DATE = "2026-06-01";

// Default policy (ParkingSpace, no resource-type override): 10:00 local
// (Europe/Belgrade, CEST/UTC+2 in June) = 08:00 UTC deadline.
const RELEASE_DATE = "2026-06-02";
const RELEASE_SWEEP_NOW = new Date("2026-06-02T09:00:00.000Z");
const releaseSweepClock = new FakeClock(RELEASE_SWEEP_NOW);

const belgradeParking = resources.filter(
  (r) => r.officeId === OFFICE_BELGRADE_ID && r.type === "ParkingSpace",
);
const belgradeEmployees = employees.filter((e) => e.homeOfficeId === OFFICE_BELGRADE_ID);

const CONFIRMATION_RESOURCE = belgradeParking[0]!;
const CONFIRMATION_EMPLOYEE = belgradeEmployees[0]!;

const RELEASE_RESOURCE = belgradeParking[1]!;
const RELEASE_EMPLOYEE = belgradeEmployees[1]!;

interface NotificationRow {
  id: string;
  booking_id: string;
  type: string;
  status: string;
}

async function notificationsFor(bookingId: string, type: string): Promise<NotificationRow[]> {
  const { rows } = await pool.query<NotificationRow>(
    `SELECT id, booking_id, type, status FROM notification WHERE booking_id = $1 AND type = $2`,
    [bookingId, type],
  );
  return rows;
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

describe("Notification outbox producer wiring (TASK-11)", () => {
  let app: FastifyInstance;
  let confirmationBookingId: string;
  let releaseBookingId: string;

  beforeAll(async () => {
    await runSeed();
    app = buildApp(createClock);
    await app.ready();
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM notification WHERE booking_id = ANY($1::uuid[])`, [
      [confirmationBookingId, releaseBookingId].filter(Boolean),
    ]);
    await pool.query(`DELETE FROM booking WHERE id = ANY($1::uuid[])`, [
      [confirmationBookingId, releaseBookingId].filter(Boolean),
    ]);
    await app.close();
    await pool.end();
  });

  it("creating a booking results in exactly one Confirmation row, sent via the fake channel (AC-1)", async () => {
    const res = await supertest(app.server)
      .post("/bookings")
      .set("Authorization", `Bearer ${CONFIRMATION_EMPLOYEE.devToken}`)
      .send({ resourceId: CONFIRMATION_RESOURCE.id, bookingDate: CONFIRMATION_DATE });

    expect(res.status).toBe(201);
    confirmationBookingId = res.body.id;

    const pending = await notificationsFor(confirmationBookingId, "Confirmation");
    expect(pending).toHaveLength(1);
    expect(pending[0]!.status).toBe("Pending");

    const channel = new FakeNotificationChannel();
    await runNotificationWorker(createClock, channel);

    const sent = await notificationsFor(confirmationBookingId, "Confirmation");
    expect(sent).toHaveLength(1);
    expect(sent[0]!.status).toBe("Sent");
    expect(channel.getSentLog().some((m) => m.bookingId === confirmationBookingId)).toBe(true);
  });

  it("a release results in exactly one ReleaseNotice row, sent via the fake channel (AC-2)", async () => {
    releaseBookingId = await insertReservedBooking({
      resourceId: RELEASE_RESOURCE.id,
      employeeId: RELEASE_EMPLOYEE.id,
      bookingDate: RELEASE_DATE,
    });

    const released = await runReleaseSweep(releaseSweepClock);
    expect(released.map((b) => b.id)).toContain(releaseBookingId);

    const pending = await notificationsFor(releaseBookingId, "ReleaseNotice");
    expect(pending).toHaveLength(1);
    expect(pending[0]!.status).toBe("Pending");

    const channel = new FakeNotificationChannel();
    await runNotificationWorker(releaseSweepClock, channel);

    const sent = await notificationsFor(releaseBookingId, "ReleaseNotice");
    expect(sent).toHaveLength(1);
    expect(sent[0]!.status).toBe("Sent");
    expect(channel.getSentLog().some((m) => m.bookingId === releaseBookingId)).toBe(true);
  });

  it("a failed send returns the row to Pending/backoff, not Sent (AC-4)", async () => {
    const bookingId = await insertReservedBooking({
      resourceId: RELEASE_RESOURCE.id,
      employeeId: RELEASE_EMPLOYEE.id,
      bookingDate: "2026-06-03",
    });
    await pool.query(
      `INSERT INTO notification (booking_id, type, channel, dedup_key, status)
       VALUES ($1, 'Confirmation', 'Teams', $2, 'Pending')`,
      [bookingId, `Confirmation:${bookingId}`],
    );

    const failingChannel = new FakeNotificationChannel({ shouldFail: () => true });
    await runNotificationWorker(createClock, failingChannel);

    const rows = await notificationsFor(bookingId, "Confirmation");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).not.toBe("Sent");
    expect(["Pending", "Failed"]).toContain(rows[0]!.status);

    await pool.query(`DELETE FROM notification WHERE booking_id = $1`, [bookingId]);
    await pool.query(`DELETE FROM booking WHERE id = $1`, [bookingId]);
  });
});
