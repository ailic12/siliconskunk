import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import supertest from "supertest";
import { buildApp } from "../../../src/api/server";
import type { Clock } from "../../../src/shared/clock";
import { pool } from "../../../src/shared/db";
import { runSeed } from "../../../db/seed";
import { OFFICE_BELGRADE_ID } from "../../../db/seed/offices";
import { resources } from "../../../db/seed/resources";
import { employees } from "../../../db/seed/employees";
import { computeEffectiveDeadline } from "../../../src/modules/release-engine/deadline";

class FakeClock implements Clock {
  constructor(private readonly instant: Date) {}
  now(): Date {
    return this.instant;
  }
}

const clock = new FakeClock(new Date("2026-01-05T08:00:00.000Z"));

const belgradeDesks = resources.filter(
  (r) => r.officeId === OFFICE_BELGRADE_ID && r.type === "Desk",
);
const STATUS_RESOURCE = belgradeDesks[5]!.id;

const belgradeEmployees = employees.filter((e) => e.homeOfficeId === OFFICE_BELGRADE_ID);
const OWNER = belgradeEmployees[0]!;
const OTHER_EMPLOYEE = belgradeEmployees[1]!;

const BOOKING_DATE = "2026-01-14";
// Belgrade Desk bookings resolve to the demo-override policy (00:05:00
// local, db/seed/policies.ts) rather than the office default — the read
// endpoint must expose whatever the Release Engine's own deadline
// computation actually resolves to, not a hardcoded value.
const EXPECTED_DEADLINE = computeEffectiveDeadline(
  BOOKING_DATE,
  "00:05:00",
  "Europe/Belgrade",
).toISOString();

describe("GET /bookings/:id (TASK-17)", () => {
  let app: FastifyInstance;
  let bookingId: string;

  beforeAll(async () => {
    await runSeed();
    app = buildApp(clock);
    await app.ready();

    const created = await supertest(app.server)
      .post("/bookings")
      .set("Authorization", `Bearer ${OWNER.devToken}`)
      .send({ resourceId: STATUS_RESOURCE, bookingDate: BOOKING_DATE });
    bookingId = created.body.id;
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM booking WHERE resource_id = $1 AND booking_date = $2`, [
      STATUS_RESOURCE,
      BOOKING_DATE,
    ]);
    await app.close();
    await pool.end();
  });

  it("rejects a request with no bearer token", async () => {
    const res = await supertest(app.server).get(`/bookings/${bookingId}`);
    expect(res.status).toBe(401);
  });

  it("rejects a request with an unknown bearer token", async () => {
    const res = await supertest(app.server)
      .get(`/bookings/${bookingId}`)
      .set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });

  it("returns 404 for a booking id that does not exist", async () => {
    const res = await supertest(app.server)
      .get(`/bookings/00000000-0000-4000-8000-000000000000`)
      .set("Authorization", `Bearer ${OWNER.devToken}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for a non-UUID id, not a 500", async () => {
    const res = await supertest(app.server)
      .get(`/bookings/not-a-uuid`)
      .set("Authorization", `Bearer ${OWNER.devToken}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 when the booking exists but belongs to a different employee (no cross-employee enumeration)", async () => {
    const res = await supertest(app.server)
      .get(`/bookings/${bookingId}`)
      .set("Authorization", `Bearer ${OTHER_EMPLOYEE.devToken}`);
    expect(res.status).toBe(404);
  });

  it("returns the booking's own state and a derived checkInDeadline for its owner", async () => {
    const res = await supertest(app.server)
      .get(`/bookings/${bookingId}`)
      .set("Authorization", `Bearer ${OWNER.devToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: bookingId,
      resourceId: STATUS_RESOURCE,
      employeeId: OWNER.id,
      bookingDate: BOOKING_DATE,
      resourceType: "Desk",
      status: "Reserved",
      checkInDeadline: EXPECTED_DEADLINE,
    });
  });
});
