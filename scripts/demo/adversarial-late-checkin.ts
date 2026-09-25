import dotenv from "dotenv";
dotenv.config();

import { randomUUID } from "crypto";
import { pool } from "../../src/shared/db";
import { runSeed } from "../../db/seed";
import { OFFICE_BELGRADE_ID } from "../../db/seed/offices";
import { resources } from "../../db/seed/resources";
import { employees } from "../../db/seed/employees";
import { processCheckInEvent } from "../../src/modules/checkin-gateway";
import { appQrAdapter } from "../../src/modules/checkin-ingress/adapters/app-qr.adapter";
import {
  step,
  pass,
  bookingStatus,
  cleanupBookingFixtures,
  assertEqual,
  runAsCliScript,
} from "./_shared";

const TITLE = "Adversarial demo: late check-in after release never restores a booking";

const CHECKIN_DATE = "2026-07-26";
const SCANNED_AT = "2026-07-26T08:00:00.000Z";

const belgradeDesks = resources.filter((r) => r.officeId === OFFICE_BELGRADE_ID && r.type === "Desk");
const RESOURCE = belgradeDesks[10]!;
const EMPLOYEE = employees.find((e) => e.homeOfficeId === OFFICE_BELGRADE_ID)!;

async function insertReleasedBooking(): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO booking (id, resource_id, employee_id, booking_date, resource_type, status)
     VALUES ($1, $2, $3, $4, 'Desk', 'Released')`,
    [id, RESOURCE.id, EMPLOYEE.id, CHECKIN_DATE],
  );
  return id;
}

async function evidenceOutcome(externalEventId: string): Promise<string | undefined> {
  const { rows } = await pool.query<{ outcome: string }>(
    `SELECT outcome FROM checkin_evidence WHERE source_system = 'app-qr' AND external_event_id = $1`,
    [externalEventId],
  );
  return rows[0]?.outcome;
}

async function main(): Promise<void> {
  await runAsCliScript(TITLE, async () => {
    await runSeed();
    let bookingId = "";
    let externalEventId = "";
    try {
      bookingId = await insertReleasedBooking();
      pass(`Booking ${bookingId} is already Released (an earlier sweep already passed its deadline)`);

      externalEventId = `demo-late-checkin-${randomUUID()}`;
      const event = appQrAdapter.translate({
        eventId: externalEventId,
        bookingReference: RESOURCE.id,
        employeeBadge: "demo-badge",
        scannedAt: SCANNED_AT,
      });

      step("Sending a check-in for the now-released booking, through the app-qr adapter...");
      await processCheckInEvent(event);

      const outcome = await evidenceOutcome(externalEventId);
      assertEqual(outcome, "Unmatched", "late check-in is recorded Unmatched, never guessed");
      pass("Evidence outcome: Unmatched");

      const status = await bookingStatus(bookingId);
      assertEqual(status, "Released", "booking stays Released, never silently restored");
      pass(`Booking ${bookingId}: still Released (never silently restored)`);
    } finally {
      if (externalEventId) {
        await pool
          .query(
            `DELETE FROM checkin_evidence WHERE source_system = 'app-qr' AND external_event_id = $1`,
            [externalEventId],
          )
          .catch(() => undefined);
      }
      await cleanupBookingFixtures([bookingId]);
    }
  });
}

if (require.main === module) {
  main();
}
