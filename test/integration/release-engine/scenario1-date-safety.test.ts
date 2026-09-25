import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SystemClock } from "../../../src/shared/clock";
import { pool } from "../../../src/shared/db";
import { runReleaseSweep } from "../../../src/modules/release-engine";
import { runSeed } from "../../../db/seed";
import { OFFICE_BELGRADE_ID } from "../../../db/seed/offices";
import { resources } from "../../../db/seed/resources";
import { employees } from "../../../db/seed/employees";

/**
 * Regression test for the Revision 2 human-review correction (TASK-17): a
 * demo-scenario booking of a Belgrade Desk for TODAY, under the 00:05-local
 * demo-override deadline (db/seed/policies.ts), could already be past its
 * deadline the instant it is created — the running scheduler could release
 * it before a live check-in could be submitted. The fix is to book the
 * office-local NEXT calendar day instead, which is always more than 24h in
 * the future relative to whatever moment this test (or the live demo) runs
 * at. This guards exactly that: a Scenario-1-shaped booking (Belgrade Desk,
 * next calendar day, real SystemClock) must remain Reserved immediately
 * after a real sweep tick, regardless of what time of day this test runs.
 */

const belgradeDesks = resources.filter(
  (r) => r.officeId === OFFICE_BELGRADE_ID && r.type === "Desk",
);
const belgradeEmployees = employees.filter((e) => e.homeOfficeId === OFFICE_BELGRADE_ID);

// Distinct from every other suite's fixed Belgrade Desk indices
// (booking-api.test.ts: 0-4, booking-status.test.ts: 5, checkin-gateway: 8-10).
const SCENARIO_1_RESOURCE = belgradeDesks[6]!;
const SCENARIO_1_EMPLOYEE = belgradeEmployees[2]!;

function belgradeLocalDateOffsetFromToday(days: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Belgrade",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + days * 24 * 60 * 60 * 1000));
}

async function insertReservedBooking(params: {
  resourceId: string;
  employeeId: string;
  bookingDate: string;
}): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO booking (id, resource_id, employee_id, booking_date, resource_type, status)
     VALUES ($1, $2, $3, $4, 'Desk', 'Reserved')`,
    [id, params.resourceId, params.employeeId, params.bookingDate],
  );
  return id;
}

async function bookingStatus(bookingId: string): Promise<string> {
  const { rows } = await pool.query<{ status: string }>(
    `SELECT status FROM booking WHERE id = $1`,
    [bookingId],
  );
  return rows[0]!.status;
}

describe("Scenario 1 date-safety regression (TASK-17 Revision 2)", () => {
  let bookingId: string;

  beforeAll(async () => {
    await runSeed();
    bookingId = await insertReservedBooking({
      resourceId: SCENARIO_1_RESOURCE.id,
      employeeId: SCENARIO_1_EMPLOYEE.id,
      bookingDate: belgradeLocalDateOffsetFromToday(1),
    });
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM booking WHERE id = $1`, [bookingId]);
    await pool.end();
  });

  it("a next-calendar-day Belgrade Desk booking survives a real sweep tick under the real SystemClock", async () => {
    await runReleaseSweep(new SystemClock());
    expect(await bookingStatus(bookingId)).toBe("Reserved");
  });
});
