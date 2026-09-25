import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import supertest from "supertest";
import { startApp } from "../../../src/api/server";
import { pool } from "../../../src/shared/db";
import { stopQueue } from "../../../src/shared/queue";
import { runSeed } from "../../../db/seed";
import { OFFICE_SINGAPORE_ID } from "../../../db/seed/offices";
import { resources } from "../../../db/seed/resources";
import { employees } from "../../../db/seed/employees";

/**
 * Black-box evidence (TASK-17, Revision-2-corrected requirement): calling
 * registerCheckinGatewayWorker()/runReleaseSweep() directly, as every other
 * suite does, only proves those functions work — it does not prove anything
 * actually wires them into a running process. This suite instead starts the
 * real startApp() bootstrap (the same one `npm run start:api` uses) and
 * drives it purely over real HTTP, so a passing result proves the started
 * application itself consumes the check-in queue and runs the release sweep.
 */

const PORT = 3211;
const SWEEP_INTERVAL_MS = 300;

// Singapore fixtures are not touched by any other integration suite, so this
// file can never collide with another file's fixed employee/resource/date
// choices even though it runs against the real wall-clock, not a FakeClock.
const singaporeDesks = resources.filter(
  (r) => r.officeId === OFFICE_SINGAPORE_ID && r.type === "Desk",
);
const singaporeEmployees = employees.filter((e) => e.homeOfficeId === OFFICE_SINGAPORE_ID);

const CHECKIN_RESOURCE = singaporeDesks[0]!;
const CHECKIN_EMPLOYEE = singaporeEmployees[0]!;
const RELEASE_RESOURCE = singaporeDesks[1]!;
const RELEASE_EMPLOYEE = singaporeEmployees[1]!;

function tomorrowIsoDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function insertPastDeadlineReservedBooking(params: {
  resourceId: string;
  employeeId: string;
}): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO booking (id, resource_id, employee_id, booking_date, resource_type, status)
     VALUES ($1, $2, $3, '2020-01-01', 'Desk', 'Reserved')`,
    [id, params.resourceId, params.employeeId],
  );
  return id;
}

async function pollBookingStatus(params: {
  app: FastifyInstance;
  bookingId: string;
  token: string;
  expectedStatus: string;
  timeoutMs?: number;
}): Promise<void> {
  const deadline = Date.now() + (params.timeoutMs ?? 8000);
  for (;;) {
    const res = await supertest(params.app.server)
      .get(`/bookings/${params.bookingId}`)
      .set("Authorization", `Bearer ${params.token}`);
    if (res.status === 200 && res.body.status === params.expectedStatus) return;
    if (Date.now() > deadline) {
      throw new Error(
        `Timed out waiting for booking ${params.bookingId} to reach status ` +
          `"${params.expectedStatus}" (last observed: ${res.status} ${JSON.stringify(res.body)})`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

describe("Application startup wiring (TASK-17, black-box)", () => {
  let app: FastifyInstance;
  let checkinBookingId: string;
  let releaseBookingId: string;

  beforeAll(async () => {
    await runSeed();
    app = await startApp({ port: PORT, sweepIntervalMs: SWEEP_INTERVAL_MS });

    const created = await supertest(app.server)
      .post("/bookings")
      .set("Authorization", `Bearer ${CHECKIN_EMPLOYEE.devToken}`)
      .send({ resourceId: CHECKIN_RESOURCE.id, bookingDate: tomorrowIsoDate() });
    checkinBookingId = created.body.id;

    releaseBookingId = await insertPastDeadlineReservedBooking({
      resourceId: RELEASE_RESOURCE.id,
      employeeId: RELEASE_EMPLOYEE.id,
    });
  }, 15000);

  afterAll(async () => {
    await pool.query(`DELETE FROM checkin_evidence WHERE external_event_id = $1`, [
      `startup-checkin-${checkinBookingId}`,
    ]);
    // TASK-11: every booking now has a same-transaction notification row
    // (notification.booking_id has no cascading delete), so it must be
    // cleared before the booking rows it references can be deleted.
    await pool.query(`DELETE FROM notification WHERE booking_id = ANY($1::uuid[])`, [
      [checkinBookingId, releaseBookingId],
    ]);
    await pool.query(`DELETE FROM booking WHERE id = ANY($1::uuid[])`, [
      [checkinBookingId, releaseBookingId],
    ]);
    await stopQueue();
    await app.close();
    await pool.end();
  });

  it("the started application itself consumes a real check-in submitted through the app-qr Ingress route", async () => {
    const submit = await supertest(app.server)
      .post("/integrations/checkin/app-qr")
      .set("x-provider-api-key", "app-qr-demo-secret")
      .send({
        eventId: `startup-checkin-${checkinBookingId}`,
        bookingReference: CHECKIN_RESOURCE.id,
        scannedAt: `${tomorrowIsoDate()}T09:00:00.000Z`,
      });
    expect(submit.status).toBe(202);

    await pollBookingStatus({
      app,
      bookingId: checkinBookingId,
      token: CHECKIN_EMPLOYEE.devToken,
      expectedStatus: "CheckedIn",
    });
  }, 15000);

  it("the started application itself runs the release sweep and releases a past-deadline booking", async () => {
    await pollBookingStatus({
      app,
      bookingId: releaseBookingId,
      token: RELEASE_EMPLOYEE.devToken,
      expectedStatus: "Released",
    });
  }, 15000);
});
