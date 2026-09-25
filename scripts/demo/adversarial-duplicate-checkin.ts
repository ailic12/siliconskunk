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

const TITLE = "Adversarial demo: duplicate check-in idempotency";

const CHECKIN_DATE = "2026-07-25";
const SCANNED_AT = "2026-07-25T08:00:00.000Z";

const belgradeDesks = resources.filter((r) => r.officeId === OFFICE_BELGRADE_ID && r.type === "Desk");
const RESOURCE = belgradeDesks[9]!;
const EMPLOYEE = employees.find((e) => e.homeOfficeId === OFFICE_BELGRADE_ID)!;

async function insertReservedBooking(): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO booking (id, resource_id, employee_id, booking_date, resource_type, status)
     VALUES ($1, $2, $3, $4, 'Desk', 'Reserved')`,
    [id, RESOURCE.id, EMPLOYEE.id, CHECKIN_DATE],
  );
  return id;
}

async function evidenceCount(externalEventId: string): Promise<number> {
  const { rows } = await pool.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM checkin_evidence WHERE source_system = 'app-qr' AND external_event_id = $1`,
    [externalEventId],
  );
  return rows[0]!.count;
}

async function main(): Promise<void> {
  await runAsCliScript(TITLE, async () => {
    await runSeed();
    let bookingId = "";
    let externalEventId = "";
    try {
      bookingId = await insertReservedBooking();
      pass(`Reserved booking ${bookingId} created for ${EMPLOYEE.displayName} on ${CHECKIN_DATE}`);

      externalEventId = `demo-duplicate-checkin-${randomUUID()}`;
      // "Through the app/QR adapter" per plan §8 Step 2: the same payload is
      // translated by the real app-qr adapter (TASK-07) into the canonical
      // event, then applied by the real Check-in Gateway (TASK-08) — direct
      // calls rather than the HTTP+queue transport, mirroring TASK-10's own
      // reliability suite exactly, so this reuses the identical
      // already-tested idempotency guarantee instead of reimplementing it.
      const event = appQrAdapter.translate({
        eventId: externalEventId,
        // The pre-seeded app-qr external_mapping keys every resource by its
        // own id (db/seed/external-mappings.ts) — no new fixture needed.
        bookingReference: RESOURCE.id,
        employeeBadge: "demo-badge",
        scannedAt: SCANNED_AT,
      });

      step("Sending the same check-in payload twice, concurrently, through the app-qr adapter...");
      await Promise.all([processCheckInEvent(event), processCheckInEvent(event)]);

      const count = await evidenceCount(externalEventId);
      assertEqual(count, 1, "exactly one evidence row for the duplicated event");
      pass(`Exactly one evidence row recorded for external event ${externalEventId}`);

      const status = await bookingStatus(bookingId);
      assertEqual(status, "CheckedIn", "booking checked in exactly once, no error on redelivery");
      pass(`Booking ${bookingId}: CheckedIn (no error on redelivery)`);
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
