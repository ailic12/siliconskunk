import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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

// Parking spaces (not Desks) at Belgrade so the office-wide default policy
// (10:00 local, no resource-type override) applies rather than the
// Desk-only demo-override policy (00:05) — see db/seed/policies.ts.
const belgradeParking = resources.filter(
  (r) => r.officeId === OFFICE_BELGRADE_ID && r.type === "ParkingSpace",
);
const belgradeEmployees = employees.filter((e) => e.homeOfficeId === OFFICE_BELGRADE_ID);

const DUE_RESOURCE = belgradeParking[0]!;
const NOT_DUE_RESOURCE = belgradeParking[1]!;
const DUE_EMPLOYEE = belgradeEmployees[0]!;
const NOT_DUE_EMPLOYEE = belgradeEmployees[1]!;

// May is fully within Europe/Belgrade's CEST (UTC+2) with no DST transition
// nearby, so the 10:00-local default deadline is unambiguously 08:00 UTC —
// distinct dates from every other integration suite's fixtures (TASK-04/05/08
// use January/February) so this file never collides with theirs.
const DUE_DATE = "2026-05-05"; // deadline: 2026-05-05T08:00:00Z
const NOT_DUE_DATE = "2026-05-06"; // deadline: 2026-05-06T08:00:00Z

// One hour after DUE_DATE's deadline, one day before NOT_DUE_DATE's deadline.
const NOW = new Date("2026-05-05T09:00:00.000Z");
const clock: Clock = new FakeClock(NOW);

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

async function bookingStatus(bookingId: string): Promise<string> {
  const { rows } = await pool.query<{ status: string }>(
    `SELECT status FROM booking WHERE id = $1`,
    [bookingId],
  );
  return rows[0]!.status;
}

describe("Release Engine sweep (TASK-09)", () => {
  let dueBookingId: string;
  let notDueBookingId: string;

  beforeAll(async () => {
    await runSeed();

    dueBookingId = await insertReservedBooking({
      resourceId: DUE_RESOURCE.id,
      employeeId: DUE_EMPLOYEE.id,
      bookingDate: DUE_DATE,
    });
    notDueBookingId = await insertReservedBooking({
      resourceId: NOT_DUE_RESOURCE.id,
      employeeId: NOT_DUE_EMPLOYEE.id,
      bookingDate: NOT_DUE_DATE,
    });
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM booking WHERE id = ANY($1::uuid[])`, [
      [dueBookingId, notDueBookingId],
    ]);
    await pool.end();
  });

  it("releases a Reserved booking past its office-local deadline (AC-1)", async () => {
    const released = await runReleaseSweep(clock);

    expect(released.map((b) => b.id)).toContain(dueBookingId);
    expect(await bookingStatus(dueBookingId)).toBe("Released");
  });

  it("leaves a Reserved booking not yet past its deadline untouched (AC-2)", async () => {
    expect(await bookingStatus(notDueBookingId)).toBe("Reserved");
  });

  it("running the sweep again is a no-op for an already-released booking (AC-4 basic case)", async () => {
    const released = await runReleaseSweep(clock);

    expect(released.map((b) => b.id)).not.toContain(dueBookingId);
    expect(await bookingStatus(dueBookingId)).toBe("Released");
    expect(await bookingStatus(notDueBookingId)).toBe("Reserved");
  });
});
