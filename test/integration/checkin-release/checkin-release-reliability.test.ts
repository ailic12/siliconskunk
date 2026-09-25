import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import supertest from "supertest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../../src/api/server";
import type { Clock } from "../../../src/shared/clock";
import { pool } from "../../../src/shared/db";
import { processCheckInEvent } from "../../../src/modules/checkin-gateway";
import { runReleaseSweep } from "../../../src/modules/release-engine";
import type { CheckInEvent } from "../../../src/modules/checkin-contract";
import { runSeed } from "../../../db/seed";
import { OFFICE_BELGRADE_ID } from "../../../db/seed/offices";
import { resources } from "../../../db/seed/resources";
import { employees } from "../../../db/seed/employees";

const SOURCE_SYSTEM = "task10-test";

class FakeClock implements Clock {
  constructor(private readonly instant: Date) {}
  now(): Date {
    return this.instant;
  }
}

const belgradeDesks = resources.filter(
  (r) => r.officeId === OFFICE_BELGRADE_ID && r.type === "Desk",
);
const belgradeParking = resources.filter(
  (r) => r.officeId === OFFICE_BELGRADE_ID && r.type === "ParkingSpace",
);
const belgradeEmployees = employees.filter((e) => e.homeOfficeId === OFFICE_BELGRADE_ID);

// All of April 2026 is fully within Europe/Belgrade's CEST (UTC+2) period
// (2026 DST starts 2026-03-29), so every deadline computation below is
// unambiguous. Dates are disjoint from every other integration suite's
// fixtures (Jan: booking-api/booking-concurrency; Feb: checkin-gateway; May:
// release-sweep).
//
// Cross-scenario sweep exposure: runReleaseSweep sweeps every still-Reserved
// booking office-wide, not just the calling scenario's own fixture, so every
// scenario's Reserved booking is visible to every sweep clock used in this
// file. Two things make that safe rather than merely date-coincidental:
// (1) SWEEP_RACE_NOW (2026-04-08) is chronologically earlier than every
// other scenario's deadline, so it can never reach them, regardless of
// execution order; (2) AVAILABILITY_SWEEP_NOW (2026-04-24) *is* chronologically
// late enough to reach scenario 1's and scenario 2's deadlines too if their
// bookings were still Reserved at that point — under this file's required
// sequential execution (never run with .only or a -t filter that skips
// earlier scenarios: same shared-DB-state requirement as this repo's
// `fileParallelism: false`, see vitest.config.ts) scenario 1 always leaves
// its booking CheckedIn and scenario 2 always leaves its booking Released
// before scenario 4 runs. The availability scenario additionally asserts
// this exclusivity directly (see "released resource reappears" below), so a
// violation of that ordering assumption fails loudly instead of passing
// silently.
const DUP_CHECKIN_DATE = "2026-04-15";
const DUP_CHECKIN_OCCURRED_AT = "2026-04-15T08:00:00.000Z"; // 10:00 local, same calendar day

const SWEEP_RACE_DATE = "2026-04-08"; // deadline (ParkingSpace, default policy 10:00 local): 08:00 UTC
const SWEEP_RACE_NOW = new Date("2026-04-08T09:00:00.000Z"); // 1h past deadline
const sweepRaceClock: Clock = new FakeClock(SWEEP_RACE_NOW);

const LATE_CHECKIN_DATE = "2026-04-20";
const LATE_CHECKIN_OCCURRED_AT = "2026-04-20T08:00:00.000Z";

const AVAILABILITY_DATE = "2026-04-24"; // deadline (Desk, demo-override policy 00:05 local): 2026-04-23T22:05 UTC
const AVAILABILITY_SWEEP_NOW = new Date("2026-04-24T06:00:00.000Z"); // well past deadline
const availabilitySweepClock: Clock = new FakeClock(AVAILABILITY_SWEEP_NOW);

const DUP_CHECKIN_RESOURCE = belgradeDesks[0]!;
const DUP_CHECKIN_EMPLOYEE = belgradeEmployees[0]!;

const SWEEP_RACE_RESOURCE = belgradeParking[0]!;
const SWEEP_RACE_EMPLOYEE = belgradeEmployees[0]!;

const LATE_CHECKIN_RESOURCE = belgradeDesks[1]!;
const LATE_CHECKIN_EMPLOYEE = belgradeEmployees[1]!;

const AVAILABILITY_RESOURCE = belgradeDesks[2]!;
const AVAILABILITY_EMPLOYEE = belgradeEmployees[2]!;

// N=20+ per the established adversarial-race convention (TASK-05's
// booking-concurrency suite) — enough iterations to make a false-negative
// pass from lucky scheduling very unlikely.
const RACE_ITERATIONS = 20;

/**
 * Throws a descriptive error identifying the failing iteration instead of a
 * bare assertion mismatch — the task's acceptance criterion requires the
 * suite to fail loudly if a guarantee is violated even once across repeated
 * runs, and a violation here must be immediately traceable to which
 * iteration produced it.
 */
function assertEqual<T>(actual: T, expected: T, context: string): void {
  if (actual !== expected) {
    throw new Error(
      `${context}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

interface EvidenceRow {
  outcome: string;
  booking_id: string | null;
}

async function insertBooking(params: {
  resourceId: string;
  employeeId: string;
  bookingDate: string;
  resourceType: "Desk" | "ParkingSpace";
  status?: "Reserved" | "Released";
}): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO booking (id, resource_id, employee_id, booking_date, resource_type, status)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      params.resourceId,
      params.employeeId,
      params.bookingDate,
      params.resourceType,
      params.status ?? "Reserved",
    ],
  );
  return id;
}

async function insertMapping(params: {
  resourceId: string;
  externalReference: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO external_mapping (entity_type, entity_id, source_system, external_reference)
     VALUES ('Resource', $1, $2, $3)`,
    [params.resourceId, SOURCE_SYSTEM, params.externalReference],
  );
}

async function setBookingStatus(bookingId: string, status: string): Promise<void> {
  await pool.query(`UPDATE booking SET status = $2 WHERE id = $1`, [bookingId, status]);
}

async function bookingStatus(bookingId: string): Promise<string> {
  const { rows } = await pool.query<{ status: string }>(
    `SELECT status FROM booking WHERE id = $1`,
    [bookingId],
  );
  return rows[0]!.status;
}

async function evidenceFor(externalEventId: string): Promise<EvidenceRow[]> {
  const { rows } = await pool.query<EvidenceRow>(
    `SELECT outcome, booking_id FROM checkin_evidence
     WHERE source_system = $1 AND external_event_id = $2`,
    [SOURCE_SYSTEM, externalEventId],
  );
  return rows;
}

function buildEvent(
  externalEventId: string,
  subjectReference: string,
  occurredAt: string,
): CheckInEvent {
  return {
    sourceSystem: SOURCE_SYSTEM,
    externalEventId,
    subjectReference,
    occurredAt,
    // Fixed literal rather than a live clock read: receivedAt is an audit
    // column only (never read by matching/deadline logic, which uses
    // occurredAt), but keeping it deterministic matches this file's
    // clock-injection discipline everywhere else.
    receivedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("Check-in/Release reliability test suite (TASK-10)", () => {
  let app: FastifyInstance;

  let dupCheckinBookingId: string;
  let sweepRaceBookingId: string;
  let lateCheckinBookingId: string;
  let availabilityBookingId: string;

  beforeAll(async () => {
    await runSeed();
    app = buildApp();
    await app.ready();

    dupCheckinBookingId = await insertBooking({
      resourceId: DUP_CHECKIN_RESOURCE.id,
      employeeId: DUP_CHECKIN_EMPLOYEE.id,
      bookingDate: DUP_CHECKIN_DATE,
      resourceType: "Desk",
    });
    await insertMapping({
      resourceId: DUP_CHECKIN_RESOURCE.id,
      externalReference: "dup-resource-ref",
    });

    sweepRaceBookingId = await insertBooking({
      resourceId: SWEEP_RACE_RESOURCE.id,
      employeeId: SWEEP_RACE_EMPLOYEE.id,
      bookingDate: SWEEP_RACE_DATE,
      resourceType: "ParkingSpace",
    });

    lateCheckinBookingId = await insertBooking({
      resourceId: LATE_CHECKIN_RESOURCE.id,
      employeeId: LATE_CHECKIN_EMPLOYEE.id,
      bookingDate: LATE_CHECKIN_DATE,
      resourceType: "Desk",
      status: "Released",
    });
    await insertMapping({
      resourceId: LATE_CHECKIN_RESOURCE.id,
      externalReference: "late-resource-ref",
    });

    availabilityBookingId = await insertBooking({
      resourceId: AVAILABILITY_RESOURCE.id,
      employeeId: AVAILABILITY_EMPLOYEE.id,
      bookingDate: AVAILABILITY_DATE,
      resourceType: "Desk",
    });
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM checkin_evidence WHERE source_system = $1`, [SOURCE_SYSTEM]);
    await pool.query(`DELETE FROM external_mapping WHERE source_system = $1`, [SOURCE_SYSTEM]);
    // TASK-11: every booking now has a same-transaction notification row
    // (notification.booking_id has no cascading delete), so it must be
    // cleared before the booking rows it references can be deleted.
    await pool.query(`DELETE FROM notification WHERE booking_id = ANY($1::uuid[])`, [
      [dupCheckinBookingId, sweepRaceBookingId, lateCheckinBookingId, availabilityBookingId],
    ]);
    await pool.query(`DELETE FROM booking WHERE id = ANY($1::uuid[])`, [
      [dupCheckinBookingId, sweepRaceBookingId, lateCheckinBookingId, availabilityBookingId],
    ]);
    await app.close();
    await pool.end();
  });

  describe("duplicate check-in idempotency under a genuine redelivery race (AC-1a)", () => {
    it(`applies exactly one effect per iteration across ${RACE_ITERATIONS} genuinely concurrent redeliveries`, async () => {
      for (let i = 0; i < RACE_ITERATIONS; i++) {
        await setBookingStatus(dupCheckinBookingId, "Reserved");
        const externalEventId = `dup-race-evt-${i}`;
        const event = buildEvent(externalEventId, "dup-resource-ref", DUP_CHECKIN_OCCURRED_AT);

        // Fired without an intervening await — both deliveries are in flight
        // simultaneously against the real Postgres transaction/constraint,
        // not sequenced like a simple resend-after-completion would be.
        await Promise.all([processCheckInEvent(event), processCheckInEvent(event)]);

        const evidenceRows = await evidenceFor(externalEventId);
        assertEqual(evidenceRows.length, 1, `iteration ${i}: expected exactly 1 evidence row`);
        assertEqual(evidenceRows[0]!.outcome, "Applied", `iteration ${i}: evidence outcome`);
        assertEqual(
          evidenceRows[0]!.booking_id,
          dupCheckinBookingId,
          `iteration ${i}: evidence booking_id`,
        );
        assertEqual(
          await bookingStatus(dupCheckinBookingId),
          "CheckedIn",
          `iteration ${i}: booking status`,
        );
      }
    });
  });

  describe("release-sweep retry-safety under overlapping triggers (AC-1b)", () => {
    it(`never double-releases across ${RACE_ITERATIONS} genuinely concurrent overlapping sweeps`, async () => {
      for (let i = 0; i < RACE_ITERATIONS; i++) {
        await setBookingStatus(sweepRaceBookingId, "Reserved");

        // Two overlapping sweep passes fired without an intervening await —
        // both read the same 'Reserved' candidate before either commits its
        // conditional UPDATE.
        const [releasedA, releasedB] = await Promise.all([
          runReleaseSweep(sweepRaceClock),
          runReleaseSweep(sweepRaceClock),
        ]);

        const winners = [...releasedA, ...releasedB].filter((b) => b.id === sweepRaceBookingId);
        assertEqual(
          winners.length,
          1,
          `iteration ${i}: expected exactly one sweep to win the release`,
        );
        assertEqual(
          await bookingStatus(sweepRaceBookingId),
          "Released",
          `iteration ${i}: booking status`,
        );
      }
    });
  });

  describe("late check-in after release never restores the booking (AC-1c)", () => {
    it("stays Released, records evidence Unmatched, and never checks the booking back in", async () => {
      const event = buildEvent("late-checkin-evt-1", "late-resource-ref", LATE_CHECKIN_OCCURRED_AT);

      await processCheckInEvent(event);

      const evidenceRows = await evidenceFor("late-checkin-evt-1");
      expect(evidenceRows).toHaveLength(1);
      expect(evidenceRows[0]!.outcome).toBe("Unmatched");
      expect(evidenceRows[0]!.booking_id).toBeNull();
      expect(await bookingStatus(lateCheckinBookingId)).toBe("Released");
    });
  });

  describe("released resource reappears in availability search (AC-1d)", () => {
    it("is absent while Reserved and reappears immediately after the release sweep, with no manual step", async () => {
      const before = await supertest(app.server)
        .get("/availability")
        .set("Authorization", `Bearer ${AVAILABILITY_EMPLOYEE.devToken}`)
        .query({ officeId: OFFICE_BELGRADE_ID, resourceType: "Desk", date: AVAILABILITY_DATE });

      expect(before.status).toBe(200);
      expect(before.body.resources.map((r: { id: string }) => r.id)).not.toContain(
        AVAILABILITY_RESOURCE.id,
      );

      const released = await runReleaseSweep(availabilitySweepClock);
      const releasedIds = released.map((b) => b.id);
      expect(releasedIds).toContain(availabilityBookingId);
      expect(await bookingStatus(availabilityBookingId)).toBe("Released");

      // Exclusivity guard: this sweep clock is late enough to also reach
      // scenario 1's and scenario 2's booking dates (see the file-level
      // isolation comment above), so this must not have released either of
      // their fixtures. This is what makes the required sequential-execution
      // assumption fail loudly rather than pass silently if ever violated.
      expect(releasedIds).not.toContain(dupCheckinBookingId);
      expect(releasedIds).not.toContain(sweepRaceBookingId);
      expect(await bookingStatus(dupCheckinBookingId)).toBe("CheckedIn");
      expect(await bookingStatus(sweepRaceBookingId)).toBe("Released");

      const after = await supertest(app.server)
        .get("/availability")
        .set("Authorization", `Bearer ${AVAILABILITY_EMPLOYEE.devToken}`)
        .query({ officeId: OFFICE_BELGRADE_ID, resourceType: "Desk", date: AVAILABILITY_DATE });

      expect(after.status).toBe(200);
      expect(after.body.resources.map((r: { id: string }) => r.id)).toContain(
        AVAILABILITY_RESOURCE.id,
      );
    });
  });
});
