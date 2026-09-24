import { afterAll, beforeAll, describe, it } from "vitest";
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

// Same fixed virtual "today" convention as booking-api.test.ts, so BR-03's
// 14-day window is deterministic regardless of when this suite runs.
const FAKE_TODAY = "2026-01-05";
const clock = new FakeClock(new Date(`${FAKE_TODAY}T08:00:00.000Z`));

// Dedicated fixtures, disjoint from booking-api.test.ts's (which uses
// belgradeDesks[0..4] and dates 2026-01-10..2026-01-13), so this file can
// never collide with that suite's rows under fileParallelism: false.
const belgradeDesks = resources.filter(
  (r) => r.officeId === OFFICE_BELGRADE_ID && r.type === "Desk",
);
const RESOURCE_RACE_TARGET = belgradeDesks[5]!.id; // Desk 6
const EMPLOYEE_RACE_RESOURCE_A = belgradeDesks[6]!.id; // Desk 7
const EMPLOYEE_RACE_RESOURCE_B = belgradeDesks[7]!.id; // Desk 8

const belgradeEmployees = employees.filter((e) => e.homeOfficeId === OFFICE_BELGRADE_ID);
const EMPLOYEE_ONE = belgradeEmployees[0]!;
const EMPLOYEE_TWO = belgradeEmployees[1]!;
const EMPLOYEE_THREE = belgradeEmployees[2]!;

const RESOURCE_RACE_DATE = "2026-01-16";
const EMPLOYEE_RACE_DATE = "2026-01-17";

// "e.g. N=20+" per the task's scope — 25 gives comfortable margin against a
// false-negative pass from lucky scheduling.
const ITERATIONS = 25;

/**
 * Throws a descriptive error identifying the failing iteration instead of a
 * bare assertion mismatch — AC-3 requires the suite to fail loudly, and a
 * double-booking here must be immediately traceable to which of the N runs
 * produced it.
 */
function assertEqual<T>(actual: T, expected: T, context: string): void {
  if (actual !== expected) {
    throw new Error(`${context}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

async function countActiveBookings(where: string, params: unknown[]): Promise<number> {
  const { rows } = await pool.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM booking WHERE ${where} AND status IN ('Reserved','CheckedIn')`,
    params,
  );
  return rows[0]!.count;
}

describe("Booking concurrency adversarial tests (TASK-05)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Idempotent (TASK-03); guarantees the employee/token/resource fixtures
    // this suite depends on exist regardless of test run order.
    await runSeed();
    app = buildApp(clock);
    await app.ready();
  });

  afterAll(async () => {
    await pool.query(
      `DELETE FROM booking WHERE resource_id = ANY($1::uuid[]) AND booking_date >= $2`,
      [[RESOURCE_RACE_TARGET, EMPLOYEE_RACE_RESOURCE_A, EMPLOYEE_RACE_RESOURCE_B], FAKE_TODAY],
    );
    await app.close();
    await pool.end();
  });

  describe("resource-level race: two different employees, same resource/date (AC-1)", () => {
    it(`allows exactly one winner per iteration across ${ITERATIONS} genuinely concurrent runs, with zero double-bookings`, async () => {
      for (let i = 0; i < ITERATIONS; i++) {
        // Fired without an intervening await — both requests are in flight
        // simultaneously against the real Compose Postgres, not sequenced.
        const [respA, respB] = await Promise.all([
          supertest(app.server)
            .post("/bookings")
            .set("Authorization", `Bearer ${EMPLOYEE_ONE.devToken}`)
            .send({ resourceId: RESOURCE_RACE_TARGET, bookingDate: RESOURCE_RACE_DATE }),
          supertest(app.server)
            .post("/bookings")
            .set("Authorization", `Bearer ${EMPLOYEE_TWO.devToken}`)
            .send({ resourceId: RESOURCE_RACE_TARGET, bookingDate: RESOURCE_RACE_DATE }),
        ]);

        const statuses = [respA.status, respB.status].sort((a, b) => a - b);
        assertEqual(
          JSON.stringify(statuses),
          JSON.stringify([201, 409]),
          `iteration ${i}: expected exactly one 201 and one 409, got statuses ${JSON.stringify([respA.status, respB.status])}`,
        );

        const winner = [respA, respB].find((r) => r.status === 201)!;
        const loser = [respA, respB].find((r) => r.status === 409)!;
        assertEqual(winner.body.status, "Reserved", `iteration ${i}: winner booking status`);
        assertEqual(
          loser.body.reason,
          "resource_already_booked",
          `iteration ${i}: loser conflict reason`,
        );

        const activeCount = await countActiveBookings("resource_id = $1 AND booking_date = $2", [
          RESOURCE_RACE_TARGET,
          RESOURCE_RACE_DATE,
        ]);
        assertEqual(
          activeCount,
          1,
          `iteration ${i}: expected exactly 1 active DB row for the contended resource/date, found ${activeCount}`,
        );

        // Free the slot for the next iteration without touching the
        // partial-index-scoped statuses ('Reserved'/'CheckedIn').
        await pool.query(
          `UPDATE booking SET status = 'Cancelled' WHERE resource_id = $1 AND booking_date = $2`,
          [RESOURCE_RACE_TARGET, RESOURCE_RACE_DATE],
        );
      }
    });
  });

  describe("employee-level race: same employee, two different resources/same date (AC-2)", () => {
    it(`allows exactly one winner per iteration across ${ITERATIONS} genuinely concurrent runs, with zero double-bookings`, async () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const [respA, respB] = await Promise.all([
          supertest(app.server)
            .post("/bookings")
            .set("Authorization", `Bearer ${EMPLOYEE_THREE.devToken}`)
            .send({ resourceId: EMPLOYEE_RACE_RESOURCE_A, bookingDate: EMPLOYEE_RACE_DATE }),
          supertest(app.server)
            .post("/bookings")
            .set("Authorization", `Bearer ${EMPLOYEE_THREE.devToken}`)
            .send({ resourceId: EMPLOYEE_RACE_RESOURCE_B, bookingDate: EMPLOYEE_RACE_DATE }),
        ]);

        const statuses = [respA.status, respB.status].sort((a, b) => a - b);
        assertEqual(
          JSON.stringify(statuses),
          JSON.stringify([201, 409]),
          `iteration ${i}: expected exactly one 201 and one 409, got statuses ${JSON.stringify([respA.status, respB.status])}`,
        );

        const winner = [respA, respB].find((r) => r.status === 201)!;
        const loser = [respA, respB].find((r) => r.status === 409)!;
        assertEqual(winner.body.status, "Reserved", `iteration ${i}: winner booking status`);
        assertEqual(
          loser.body.reason,
          "employee_daily_limit_reached",
          `iteration ${i}: loser conflict reason`,
        );

        const activeCount = await countActiveBookings(
          "employee_id = $1 AND booking_date = $2 AND resource_type = $3",
          [EMPLOYEE_THREE.id, EMPLOYEE_RACE_DATE, "Desk"],
        );
        assertEqual(
          activeCount,
          1,
          `iteration ${i}: expected exactly 1 active DB row for the contended employee/date/type, found ${activeCount}`,
        );

        await pool.query(
          `UPDATE booking SET status = 'Cancelled' WHERE employee_id = $1 AND booking_date = $2 AND resource_type = $3`,
          [EMPLOYEE_THREE.id, EMPLOYEE_RACE_DATE, "Desk"],
        );
      }
    });
  });
});
