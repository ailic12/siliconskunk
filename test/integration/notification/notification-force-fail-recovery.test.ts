import { afterAll, describe, expect, it } from "vitest";
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
 * Black-box, real-worker-tick evidence for TASK-18 Scenario C (deterministic
 * provider recovery) — mirrors startup.test.ts's own "call startApp(), assert
 * via real HTTP + real ticks, don't call the wiring function directly"
 * pattern, extended to StartAppOptions.forceNotificationFailure instead of
 * process.env mutation.
 *
 * Timing is deliberately, not probabilistically, deterministic: app1 (the
 * always-failing provider) is given a slow 2500ms worker interval, so after
 * its first failure at ~t=2.5s the row's backoff gate opens at ~t=4.5s, and
 * app1's own *next* tick does not occur until ~t=5s — leaving an exclusive
 * ~500ms window in which only app2 (started once the first failure is
 * observed, ticking every 100ms) can claim and successfully send the row.
 */
const PORT_FAILING = 3221;
const PORT_RECOVERED = 3222;
const FAILING_INTERVAL_MS = 2500;
const RECOVERED_INTERVAL_MS = 100;

const singaporeDesks = resources.filter(
  (r) => r.officeId === OFFICE_SINGAPORE_ID && r.type === "Desk",
);
const singaporeEmployees = employees.filter((e) => e.homeOfficeId === OFFICE_SINGAPORE_ID);
const RECOVERY_RESOURCE = singaporeDesks[2]!;
const RECOVERY_EMPLOYEE = singaporeEmployees[0]!;

function tomorrowIsoDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function pollUntil(check: () => Promise<boolean>, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await check()) return;
    if (Date.now() > deadline) {
      throw new Error(`pollUntil: condition not met within ${timeoutMs}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

interface NotificationRow {
  status: string;
  attempts: number;
}

async function fetchConfirmation(bookingId: string): Promise<NotificationRow> {
  const { rows } = await pool.query<NotificationRow>(
    `SELECT status, attempts FROM notification WHERE booking_id = $1 AND type = 'Confirmation'`,
    [bookingId],
  );
  return rows[0]!;
}

describe("Notification provider force-fail recovery (TASK-18 Scenario C, DI-driven)", () => {
  let failingApp: FastifyInstance;
  let recoveredApp: FastifyInstance;
  let bookingId: string;

  afterAll(async () => {
    if (bookingId) {
      await pool.query(`DELETE FROM notification WHERE booking_id = $1`, [bookingId]);
      await pool.query(`DELETE FROM booking WHERE id = $1`, [bookingId]);
    }
    await stopQueue();
    await failingApp?.close();
    await recoveredApp?.close();
    await pool.end();
  }, 15000);

  it(
    "a row left Pending with attempts < DEFAULT_MAX_ATTEMPTS by a failing provider reaches Sent once a real worker without the flag claims it",
    async () => {
      await runSeed();
      failingApp = await startApp({
        port: PORT_FAILING,
        notificationWorkerIntervalMs: FAILING_INTERVAL_MS,
        forceNotificationFailure: true,
      });

      const created = await supertest(failingApp.server)
        .post("/bookings")
        .set("Authorization", `Bearer ${RECOVERY_EMPLOYEE.devToken}`)
        .send({ resourceId: RECOVERY_RESOURCE.id, bookingDate: tomorrowIsoDate() });
      expect(created.status).toBe(201);
      bookingId = created.body.id;

      // Wait for the failing provider's first attempt: attempts === 1,
      // still Pending (requeued by recordFailure), and — the AC-8 evidence
      // point — strictly below DEFAULT_MAX_ATTEMPTS (5).
      await pollUntil(async () => {
        const row = await fetchConfirmation(bookingId);
        return row.attempts >= 1;
      }, 8000);
      const atRestart = await fetchConfirmation(bookingId);
      expect(atRestart.status).toBe("Pending");
      expect(atRestart.attempts).toBeGreaterThanOrEqual(1);
      expect(atRestart.attempts).toBeLessThan(5);

      // "Restart": a second, healthy process starts polling for the same
      // still-Pending row without stopping the first (mirrors the real
      // demo procedure's process restart closely enough to prove the
      // claim/backoff mechanics; failingApp's own slow interval cannot win
      // the race for the reasons in the file-level comment above).
      recoveredApp = await startApp({
        port: PORT_RECOVERED,
        notificationWorkerIntervalMs: RECOVERED_INTERVAL_MS,
      });

      await pollUntil(async () => {
        const row = await fetchConfirmation(bookingId);
        return row.status === "Sent";
      }, 10000);

      const final = await fetchConfirmation(bookingId);
      expect(final.status).toBe("Sent");
    },
    25000,
  );
});
