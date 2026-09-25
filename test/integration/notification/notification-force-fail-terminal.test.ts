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
 * Black-box, real-worker-tick evidence for TASK-18 Scenario D (terminal
 * failure does not recover) — deliberately a separate file from the
 * recovery test above, on its own booking, per the task file's explicit
 * "never interleaved with Scenario C's recovery pass" requirement. Uses a
 * short notificationWorkerIntervalMs override for test speed only; the real
 * backoff formula (attempts * DEFAULT_BACKOFF_UNIT_MS) and
 * DEFAULT_MAX_ATTEMPTS (5) are untouched production constants, so reaching
 * Failed takes real wall-clock time (~2+4+6+8s of cumulative backoff).
 */
const PORT_FAILING = 3223;
const PORT_RESTORED = 3224;
const WORKER_INTERVAL_MS = 300;

const singaporeDesks = resources.filter(
  (r) => r.officeId === OFFICE_SINGAPORE_ID && r.type === "Desk",
);
const singaporeEmployees = employees.filter((e) => e.homeOfficeId === OFFICE_SINGAPORE_ID);
const TERMINAL_RESOURCE = singaporeDesks[3]!;
const TERMINAL_EMPLOYEE = singaporeEmployees[1]!;

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
    await new Promise((resolve) => setTimeout(resolve, 150));
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

describe("Notification provider force-fail terminal state (TASK-18 Scenario D, DI-driven)", () => {
  let failingApp: FastifyInstance;
  let restoredApp: FastifyInstance;
  let bookingId: string;

  afterAll(async () => {
    if (bookingId) {
      await pool.query(`DELETE FROM notification WHERE booking_id = $1`, [bookingId]);
      await pool.query(`DELETE FROM booking WHERE id = $1`, [bookingId]);
    }
    await stopQueue();
    await failingApp?.close();
    await restoredApp?.close();
    await pool.end();
  }, 20000);

  it(
    "a row driven through DEFAULT_MAX_ATTEMPTS reaches Failed and stays Failed once the provider is restored",
    async () => {
      await runSeed();
      failingApp = await startApp({
        port: PORT_FAILING,
        notificationWorkerIntervalMs: WORKER_INTERVAL_MS,
        forceNotificationFailure: true,
      });

      const created = await supertest(failingApp.server)
        .post("/bookings")
        .set("Authorization", `Bearer ${TERMINAL_EMPLOYEE.devToken}`)
        .send({ resourceId: TERMINAL_RESOURCE.id, bookingDate: tomorrowIsoDate() });
      expect(created.status).toBe(201);
      bookingId = created.body.id;

      // Real cumulative backoff to reach attempts=5 (2s+4s+6s+8s worth of
      // gates between attempts): a genuinely slow, real-time wait, not
      // shortcut — the DEFAULT_MAX_ATTEMPTS/backoff constants are untouched.
      await pollUntil(async () => {
        const row = await fetchConfirmation(bookingId);
        return row.status === "Failed";
      }, 40000);

      const terminal = await fetchConfirmation(bookingId);
      expect(terminal.status).toBe("Failed");
      expect(terminal.attempts).toBe(5);

      // Restore the provider (a second, healthy process) and confirm the
      // Failed row is never reclaimed — claimNext only ever matches
      // Pending/Sending rows, so this is the retry policy's own boundary.
      restoredApp = await startApp({
        port: PORT_RESTORED,
        notificationWorkerIntervalMs: WORKER_INTERVAL_MS,
      });
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const stillFailed = await fetchConfirmation(bookingId);
      expect(stillFailed.status).toBe("Failed");
      expect(stillFailed.attempts).toBe(5);
    },
    55000,
  );
});
