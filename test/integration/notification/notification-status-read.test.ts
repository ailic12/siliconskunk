import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import supertest from "supertest";
import { buildApp } from "../../../src/api/server";
import type { Clock } from "../../../src/shared/clock";
import { pool } from "../../../src/shared/db";
import { runReleaseSweep } from "../../../src/modules/release-engine";
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

// July 2026 is unused by every other integration suite's booking-date
// fixtures (see notification-producer-wiring.test.ts's own ledger comment:
// Jan/Feb/Mar/Apr/May/Jun are all already claimed) — this file's booking
// creation never collides with theirs. The past-deadline release booking
// below uses 2020-01-01, same date startup.test.ts uses, but a different
// office/resource, so booking_resource_active_unique never collides either.
const clock = new FakeClock(new Date("2026-07-01T08:00:00.000Z"));

const belgradeDesks = resources.filter((r) => r.officeId === OFFICE_BELGRADE_ID && r.type === "Desk");
const belgradeEmployees = employees.filter((e) => e.homeOfficeId === OFFICE_BELGRADE_ID);

const CONFIRMATION_RESOURCE = belgradeDesks[8]!;
const CONFIRMATION_EMPLOYEE = belgradeEmployees[0]!;
const OTHER_EMPLOYEE = belgradeEmployees[1]!;

const RELEASE_RESOURCE = belgradeDesks[9]!;
const RELEASE_EMPLOYEE = belgradeEmployees[2]!;

const CONFIRMATION_DATE = "2026-07-03";
const RELEASE_DATE = "2026-07-04";

describe("GET /bookings/:id/notifications (TASK-18)", () => {
  let app: FastifyInstance;
  let confirmationBookingId: string;
  let releaseBookingId: string;

  beforeAll(async () => {
    await runSeed();
    app = buildApp(clock);
    await app.ready();

    const confirmationCreated = await supertest(app.server)
      .post("/bookings")
      .set("Authorization", `Bearer ${CONFIRMATION_EMPLOYEE.devToken}`)
      .send({ resourceId: CONFIRMATION_RESOURCE.id, bookingDate: CONFIRMATION_DATE });
    confirmationBookingId = confirmationCreated.body.id;

    const releaseCreated = await supertest(app.server)
      .post("/bookings")
      .set("Authorization", `Bearer ${RELEASE_EMPLOYEE.devToken}`)
      .send({ resourceId: RELEASE_RESOURCE.id, bookingDate: RELEASE_DATE });
    releaseBookingId = releaseCreated.body.id;

    // Force the release booking past its deadline without going through
    // createBooking's window validation — the same raw-SQL technique
    // startup.test.ts uses for its own release scenario. Its Confirmation
    // row (inserted transactionally by the POST above) is left untouched;
    // the sweep below adds a second, ReleaseNotice, row to the same booking.
    await pool.query(`UPDATE booking SET booking_date = '2020-01-01' WHERE id = $1`, [
      releaseBookingId,
    ]);
    const released = await runReleaseSweep(clock);
    expect(released.map((b) => b.id)).toContain(releaseBookingId);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM notification WHERE booking_id = ANY($1::uuid[])`, [
      [confirmationBookingId, releaseBookingId],
    ]);
    await pool.query(`DELETE FROM booking WHERE id = ANY($1::uuid[])`, [
      [confirmationBookingId, releaseBookingId],
    ]);
    await app.close();
    await pool.end();
  });

  it("rejects a request with no bearer token", async () => {
    const res = await supertest(app.server).get(`/bookings/${confirmationBookingId}/notifications`);
    expect(res.status).toBe(401);
  });

  it("rejects a request with an unknown bearer token", async () => {
    const res = await supertest(app.server)
      .get(`/bookings/${confirmationBookingId}/notifications`)
      .set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });

  it("returns 404 for a booking id that does not exist", async () => {
    const res = await supertest(app.server)
      .get(`/bookings/00000000-0000-4000-8000-000000000000/notifications`)
      .set("Authorization", `Bearer ${CONFIRMATION_EMPLOYEE.devToken}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 when the booking exists but belongs to a different employee (no cross-employee enumeration)", async () => {
    const res = await supertest(app.server)
      .get(`/bookings/${confirmationBookingId}/notifications`)
      .set("Authorization", `Bearer ${OTHER_EMPLOYEE.devToken}`);
    expect(res.status).toBe(404);
  });

  it("returns exactly one Confirmation row for a freshly created booking, excluding internal worker fields", async () => {
    const res = await supertest(app.server)
      .get(`/bookings/${confirmationBookingId}/notifications`)
      .set("Authorization", `Bearer ${CONFIRMATION_EMPLOYEE.devToken}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(1);
    const [notification] = res.body.notifications;
    expect(notification).toMatchObject({
      type: "Confirmation",
      channel: "Teams",
      status: "Pending",
      attempts: 0,
      sentAt: null,
    });
    expect(notification).not.toHaveProperty("leaseOwner");
    expect(notification).not.toHaveProperty("leaseExpiresAt");
    expect(notification).not.toHaveProperty("dedupKey");
    expect(notification).not.toHaveProperty("bookingId");
  });

  it("returns both Confirmation and ReleaseNotice rows after an automatic release", async () => {
    const res = await supertest(app.server)
      .get(`/bookings/${releaseBookingId}/notifications`)
      .set("Authorization", `Bearer ${RELEASE_EMPLOYEE.devToken}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(2);
    const types = res.body.notifications.map((n: { type: string }) => n.type).sort();
    expect(types).toEqual(["Confirmation", "ReleaseNotice"]);
    const releaseNotice = res.body.notifications.find((n: { type: string }) => n.type === "ReleaseNotice");
    expect(releaseNotice).toMatchObject({ status: "Pending", attempts: 0, sentAt: null });
  });
});
