import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool } from "../../../src/shared/db";
import { sendCheckinEvent, stopQueue } from "../../../src/shared/queue";
import { registerCheckinGatewayWorker } from "../../../src/modules/checkin-gateway";
import type { CheckInEvent } from "../../../src/modules/checkin-contract";
import { runSeed } from "../../../db/seed";
import { OFFICE_BELGRADE_ID } from "../../../db/seed/offices";
import { resources } from "../../../db/seed/resources";
import { employees } from "../../../db/seed/employees";

const SOURCE_SYSTEM = "task08-test";

// Europe/Belgrade is UTC+1 in February (no DST), so 08:00Z is still the same
// calendar day office-local. Distinct from other integration suites' January
// dates/resource indices (booking-api.test.ts, booking-concurrency.test.ts)
// so this file never collides with their fixtures.
const MATCH_DATE = "2026-02-10";
const OCCURRED_AT = "2026-02-10T08:00:00.000Z";

const belgradeDesks = resources.filter(
  (r) => r.officeId === OFFICE_BELGRADE_ID && r.type === "Desk",
);
const belgradeParking = resources.filter(
  (r) => r.officeId === OFFICE_BELGRADE_ID && r.type === "ParkingSpace",
);
const belgradeEmployees = employees.filter((e) => e.homeOfficeId === OFFICE_BELGRADE_ID);

const MATCH_RESOURCE = belgradeDesks[8]!;
const UNMATCHED_RESOURCE = belgradeDesks[9]!;
const AMBIGUOUS_DESK = belgradeDesks[10]!;
const AMBIGUOUS_PARKING = belgradeParking[0]!;

const MATCH_EMPLOYEE = belgradeEmployees[0]!;
const UNMATCHED_EMPLOYEE = belgradeEmployees[1]!;
const AMBIGUOUS_EMPLOYEE = belgradeEmployees[2]!;

interface EvidenceRow {
  id: string;
  outcome: string;
  booking_id: string | null;
}

async function insertReservedBooking(params: {
  resourceId: string;
  employeeId: string;
  bookingDate: string;
  resourceType: "Desk" | "ParkingSpace";
}): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO booking (id, resource_id, employee_id, booking_date, resource_type, status)
     VALUES ($1, $2, $3, $4, $5, 'Reserved')`,
    [id, params.resourceId, params.employeeId, params.bookingDate, params.resourceType],
  );
  return id;
}

async function insertMapping(params: {
  entityType: "Resource" | "Employee";
  entityId: string;
  externalReference: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO external_mapping (entity_type, entity_id, source_system, external_reference)
     VALUES ($1, $2, $3, $4)`,
    [params.entityType, params.entityId, SOURCE_SYSTEM, params.externalReference],
  );
}

async function waitForEvidence(externalEventId: string, timeoutMs = 5000): Promise<EvidenceRow> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const { rows } = await pool.query<EvidenceRow>(
      `SELECT id, outcome, booking_id FROM checkin_evidence
       WHERE source_system = $1 AND external_event_id = $2`,
      [SOURCE_SYSTEM, externalEventId],
    );
    if (rows[0]) return rows[0];
    if (Date.now() > deadline) {
      throw new Error(
        `Timed out waiting for checkin_evidence(${SOURCE_SYSTEM}, ${externalEventId})`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function bookingStatus(bookingId: string): Promise<string> {
  const { rows } = await pool.query<{ status: string }>(
    `SELECT status FROM booking WHERE id = $1`,
    [bookingId],
  );
  return rows[0]!.status;
}

function buildEvent(externalEventId: string, subjectReference: string): CheckInEvent {
  return {
    sourceSystem: SOURCE_SYSTEM,
    externalEventId,
    subjectReference,
    occurredAt: OCCURRED_AT,
    receivedAt: new Date().toISOString(),
  };
}

describe("Check-in Gateway worker (TASK-08)", () => {
  let matchBookingId: string;
  let unmatchedBookingId: string;
  let ambiguousDeskBookingId: string;
  let ambiguousParkingBookingId: string;

  beforeAll(async () => {
    await runSeed();
    await registerCheckinGatewayWorker();

    matchBookingId = await insertReservedBooking({
      resourceId: MATCH_RESOURCE.id,
      employeeId: MATCH_EMPLOYEE.id,
      bookingDate: MATCH_DATE,
      resourceType: "Desk",
    });
    await insertMapping({
      entityType: "Resource",
      entityId: MATCH_RESOURCE.id,
      externalReference: "match-resource-ref",
    });

    unmatchedBookingId = await insertReservedBooking({
      resourceId: UNMATCHED_RESOURCE.id,
      employeeId: UNMATCHED_EMPLOYEE.id,
      bookingDate: MATCH_DATE,
      resourceType: "Desk",
    });
    // Deliberately no external_mapping row for "no-mapping-ref".

    ambiguousDeskBookingId = await insertReservedBooking({
      resourceId: AMBIGUOUS_DESK.id,
      employeeId: AMBIGUOUS_EMPLOYEE.id,
      bookingDate: MATCH_DATE,
      resourceType: "Desk",
    });
    ambiguousParkingBookingId = await insertReservedBooking({
      resourceId: AMBIGUOUS_PARKING.id,
      employeeId: AMBIGUOUS_EMPLOYEE.id,
      bookingDate: MATCH_DATE,
      resourceType: "ParkingSpace",
    });
    await insertMapping({
      entityType: "Employee",
      entityId: AMBIGUOUS_EMPLOYEE.id,
      externalReference: "ambiguous-employee-ref",
    });
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM checkin_evidence WHERE source_system = $1`, [SOURCE_SYSTEM]);
    await pool.query(`DELETE FROM external_mapping WHERE source_system = $1`, [SOURCE_SYSTEM]);
    await pool.query(`DELETE FROM booking WHERE id = ANY($1::uuid[])`, [
      [matchBookingId, unmatchedBookingId, ambiguousDeskBookingId, ambiguousParkingBookingId],
    ]);
    await stopQueue();
    await pool.end();
  });

  describe("first-delivery match (AC-1)", () => {
    it("applies CheckedIn to the single matching Reserved booking", async () => {
      const event = buildEvent("match-evt-1", "match-resource-ref");
      await sendCheckinEvent(event);

      const evidence = await waitForEvidence("match-evt-1");

      expect(evidence.outcome).toBe("Applied");
      expect(evidence.booking_id).toBe(matchBookingId);
      expect(await bookingStatus(matchBookingId)).toBe("CheckedIn");
    });
  });

  describe("duplicate delivery (AC-2)", () => {
    it("produces zero additional state change and no error on redelivery", async () => {
      const event = buildEvent("match-evt-1", "match-resource-ref");
      await expect(sendCheckinEvent(event)).resolves.not.toThrow();

      // Give the worker a moment to (not) reprocess, then assert nothing changed.
      await new Promise((resolve) => setTimeout(resolve, 500));

      const { rows } = await pool.query<{ count: string }>(
        `SELECT count(*) FROM checkin_evidence WHERE source_system = $1 AND external_event_id = $2`,
        [SOURCE_SYSTEM, "match-evt-1"],
      );
      expect(Number(rows[0]!.count)).toBe(1);
      expect(await bookingStatus(matchBookingId)).toBe("CheckedIn");
    });
  });

  describe("no mapping match (AC-3)", () => {
    it("records Unmatched and leaves the booking untouched", async () => {
      const event = buildEvent("unmatched-evt-1", "no-mapping-ref");
      await sendCheckinEvent(event);

      const evidence = await waitForEvidence("unmatched-evt-1");

      expect(evidence.outcome).toBe("Unmatched");
      expect(evidence.booking_id).toBeNull();
      expect(await bookingStatus(unmatchedBookingId)).toBe("Reserved");
    });
  });

  describe("ambiguous match (AC-3)", () => {
    it("records Unmatched and leaves both candidate bookings untouched", async () => {
      const event = buildEvent("ambiguous-evt-1", "ambiguous-employee-ref");
      await sendCheckinEvent(event);

      const evidence = await waitForEvidence("ambiguous-evt-1");

      expect(evidence.outcome).toBe("Unmatched");
      expect(evidence.booking_id).toBeNull();
      expect(await bookingStatus(ambiguousDeskBookingId)).toBe("Reserved");
      expect(await bookingStatus(ambiguousParkingBookingId)).toBe("Reserved");
    });
  });
});
