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

class FakeClock implements Clock {
  constructor(private readonly instant: Date) {}
  now(): Date {
    return this.instant;
  }
}

// Fixed virtual "today" so BR-03's 14-day window is deterministic regardless
// of when this suite runs. 08:00 UTC in January is still 2026-01-05 in
// Europe/Belgrade (UTC+1, no DST in winter).
const FAKE_TODAY = "2026-01-05";
const clock = new FakeClock(new Date("2026-01-05T08:00:00.000Z"));

const belgradeDesks = resources.filter(
  (r) => r.officeId === OFFICE_BELGRADE_ID && r.type === "Desk",
);
const RESOURCE_CONFLICT_TARGET = belgradeDesks[0]!.id;
const EMPLOYEE_CONFLICT_RESOURCE_A = belgradeDesks[1]!.id;
const EMPLOYEE_CONFLICT_RESOURCE_B = belgradeDesks[2]!.id;
const UNBOOKABLE_RESOURCE = belgradeDesks[3]!.id;
const AVAILABILITY_RESOURCE = belgradeDesks[4]!.id;

const belgradeEmployees = employees.filter((e) => e.homeOfficeId === OFFICE_BELGRADE_ID);
const EMPLOYEE_A = belgradeEmployees[0]!;
const EMPLOYEE_B = belgradeEmployees[1]!;
const EMPLOYEE_C = belgradeEmployees[2]!;

const HAPPY_PATH_DATE = "2026-01-10";
const OUT_OF_WINDOW_DATE = "2026-01-25";
// Distinct dates per conflict scenario so one employee's booking in an
// earlier test can never collide with BR-02's daily limit in a later one.
const RESOURCE_CONFLICT_DATE = "2026-01-11";
const IMPERSONATION_DATE = "2026-01-12";
const EMPLOYEE_CONFLICT_DATE = "2026-01-13";

describe("Booking creation API", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Idempotent (TASK-03); guarantees the employee/token/office/resource
    // fixtures this suite depends on exist regardless of which other
    // integration test file ran last (e.g. the schema migration down/up
    // cycle, or db/seed.test.ts's own cleanup, both of which can empty
    // these tables).
    await runSeed();
    app = buildApp(clock);
    await app.ready();
  });

  afterAll(async () => {
    await pool.query(
      `DELETE FROM booking WHERE resource_id = ANY($1::uuid[]) AND booking_date >= $2`,
      [
        [
          RESOURCE_CONFLICT_TARGET,
          EMPLOYEE_CONFLICT_RESOURCE_A,
          EMPLOYEE_CONFLICT_RESOURCE_B,
          UNBOOKABLE_RESOURCE,
          AVAILABILITY_RESOURCE,
        ],
        FAKE_TODAY,
      ],
    );
    await pool.query(`UPDATE resource SET status = 'Available' WHERE id = $1`, [
      UNBOOKABLE_RESOURCE,
    ]);
    await app.close();
    await pool.end();
  });

  describe("authorization", () => {
    it("rejects a request with no bearer token", async () => {
      const res = await supertest(app.server)
        .post("/bookings")
        .send({ resourceId: RESOURCE_CONFLICT_TARGET, bookingDate: HAPPY_PATH_DATE });

      expect(res.status).toBe(401);
    });

    it("rejects a request with an unknown bearer token", async () => {
      const res = await supertest(app.server)
        .post("/bookings")
        .set("Authorization", "Bearer not-a-real-token")
        .send({ resourceId: RESOURCE_CONFLICT_TARGET, bookingDate: HAPPY_PATH_DATE });

      expect(res.status).toBe(401);
    });
  });

  describe("malformed identifiers", () => {
    it("rejects a non-UUID resourceId with 400, not a 500", async () => {
      const res = await supertest(app.server)
        .post("/bookings")
        .set("Authorization", `Bearer ${EMPLOYEE_A.devToken}`)
        .send({ resourceId: "not-a-uuid", bookingDate: HAPPY_PATH_DATE });

      expect(res.status).toBe(400);
    });

    it("rejects a non-UUID officeId with 400, not a 500", async () => {
      const res = await supertest(app.server)
        .get("/availability")
        .set("Authorization", `Bearer ${EMPLOYEE_A.devToken}`)
        .query({ officeId: "not-a-uuid", resourceType: "Desk", date: HAPPY_PATH_DATE });

      expect(res.status).toBe(400);
    });
  });

  describe("happy path (AC-1)", () => {
    it("creates a Reserved booking and returns 201", async () => {
      const res = await supertest(app.server)
        .post("/bookings")
        .set("Authorization", `Bearer ${EMPLOYEE_A.devToken}`)
        .send({ resourceId: AVAILABILITY_RESOURCE, bookingDate: HAPPY_PATH_DATE });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        resourceId: AVAILABILITY_RESOURCE,
        employeeId: EMPLOYEE_A.id,
        bookingDate: HAPPY_PATH_DATE,
        resourceType: "Desk",
        status: "Reserved",
      });
    });
  });

  describe("availability search (FR-01)", () => {
    it("excludes a resource that now has an active booking on that date", async () => {
      const res = await supertest(app.server)
        .get("/availability")
        .set("Authorization", `Bearer ${EMPLOYEE_A.devToken}`)
        .query({ officeId: OFFICE_BELGRADE_ID, resourceType: "Desk", date: HAPPY_PATH_DATE });

      expect(res.status).toBe(200);
      const ids = res.body.resources.map((r: { id: string }) => r.id);
      expect(ids).not.toContain(AVAILABILITY_RESOURCE);
    });
  });

  describe("resource-state gating (BR-04, AC-2)", () => {
    it("rejects a booking for an UnderMaintenance resource without a 500 or silent success", async () => {
      await pool.query(`UPDATE resource SET status = 'UnderMaintenance' WHERE id = $1`, [
        UNBOOKABLE_RESOURCE,
      ]);

      const res = await supertest(app.server)
        .post("/bookings")
        .set("Authorization", `Bearer ${EMPLOYEE_A.devToken}`)
        .send({ resourceId: UNBOOKABLE_RESOURCE, bookingDate: HAPPY_PATH_DATE });

      expect(res.status).toBe(422);
      expect(res.body.reason).toBe("resource_not_bookable");

      const { rows } = await pool.query(
        `SELECT 1 FROM booking WHERE resource_id = $1 AND booking_date = $2`,
        [UNBOOKABLE_RESOURCE, HAPPY_PATH_DATE],
      );
      expect(rows).toHaveLength(0);
    });
  });

  describe("booking window enforcement (BR-03, AC-3)", () => {
    it("rejects a date beyond the policy's booking window", async () => {
      const res = await supertest(app.server)
        .post("/bookings")
        .set("Authorization", `Bearer ${EMPLOYEE_A.devToken}`)
        .send({ resourceId: RESOURCE_CONFLICT_TARGET, bookingDate: OUT_OF_WINDOW_DATE });

      expect(res.status).toBe(422);
      expect(res.body.reason).toBe("outside_booking_window");
    });
  });

  describe("resource-level conflict (AC-4)", () => {
    it("lets the first request win and returns a distinguishable 409 for the second", async () => {
      const first = await supertest(app.server)
        .post("/bookings")
        .set("Authorization", `Bearer ${EMPLOYEE_B.devToken}`)
        .send({ resourceId: RESOURCE_CONFLICT_TARGET, bookingDate: RESOURCE_CONFLICT_DATE });
      expect(first.status).toBe(201);

      const second = await supertest(app.server)
        .post("/bookings")
        .set("Authorization", `Bearer ${EMPLOYEE_C.devToken}`)
        .send({ resourceId: RESOURCE_CONFLICT_TARGET, bookingDate: RESOURCE_CONFLICT_DATE });

      expect(second.status).toBe(409);
      expect(second.body.reason).toBe("resource_already_booked");
    });
  });

  describe("employee-level daily-limit conflict (BR-02, AC-4)", () => {
    it("rejects a second active Desk booking for the same employee/day with a distinguishable 409", async () => {
      const first = await supertest(app.server)
        .post("/bookings")
        .set("Authorization", `Bearer ${EMPLOYEE_C.devToken}`)
        .send({ resourceId: EMPLOYEE_CONFLICT_RESOURCE_A, bookingDate: EMPLOYEE_CONFLICT_DATE });
      expect(first.status).toBe(201);

      const second = await supertest(app.server)
        .post("/bookings")
        .set("Authorization", `Bearer ${EMPLOYEE_C.devToken}`)
        .send({ resourceId: EMPLOYEE_CONFLICT_RESOURCE_B, bookingDate: EMPLOYEE_CONFLICT_DATE });

      expect(second.status).toBe(409);
      expect(second.body.reason).toBe("employee_daily_limit_reached");
    });
  });

  describe("authorization: cannot book on behalf of another employee (AC-5)", () => {
    it("ignores a client-supplied employeeId and books for the token's own identity", async () => {
      const res = await supertest(app.server)
        .post("/bookings")
        .set("Authorization", `Bearer ${EMPLOYEE_B.devToken}`)
        .send({
          resourceId: RESOURCE_CONFLICT_TARGET,
          bookingDate: IMPERSONATION_DATE,
          employeeId: EMPLOYEE_A.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.employeeId).toBe(EMPLOYEE_B.id);
      expect(res.body.employeeId).not.toBe(EMPLOYEE_A.id);
    });
  });
});
