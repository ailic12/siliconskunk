import dotenv from "dotenv";
dotenv.config();

import type { FastifyInstance } from "fastify";
import type { Clock } from "../../src/shared/clock";
import { pool } from "../../src/shared/db";
import { buildApp } from "../../src/api/server";

const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";

/**
 * Demo-only Clock (TASK-13): every demo script pairs a short/early policy
 * deadline (e.g. POLICY_BELGRADE_DEMO_OVERRIDE_ID) with an injected instant
 * like this instead of a real-time wait, mirroring TASK-05/10/12's own
 * FakeClock test convention so a live presenter never has to wait for a
 * deadline to pass in wall-clock time.
 */
export class DemoClock implements Clock {
  constructor(private readonly instant: Date) {}
  now(): Date {
    return this.instant;
  }
}

export function banner(title: string): void {
  console.log(`\n${CYAN}=== ${title} ===${RESET}`);
}

export function step(message: string): void {
  console.log(`${YELLOW}→ ${message}${RESET}`);
}

export function pass(message: string): void {
  console.log(`${GREEN}✔ ${message}${RESET}`);
}

export function fail(message: string): void {
  console.error(`${RED}✘ ${message}${RESET}`);
}

/**
 * Throws a descriptive error identifying exactly what failed instead of a
 * bare assertion mismatch, matching TASK-05/10's established convention so a
 * demo script fails loudly rather than silently continuing.
 */
export function assertEqual<T>(actual: T, expected: T, context: string): void {
  if (actual !== expected) {
    throw new Error(
      `${context}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

export async function bootDemoApp(clock?: Clock): Promise<FastifyInstance> {
  const app = buildApp(clock);
  await app.ready();
  return app;
}

export async function bookingStatus(bookingId: string): Promise<string | undefined> {
  const { rows } = await pool.query<{ status: string }>(
    `SELECT status FROM booking WHERE id = $1`,
    [bookingId],
  );
  return rows[0]?.status;
}

export async function notificationStatus(bookingId: string, type: string): Promise<string | undefined> {
  const { rows } = await pool.query<{ status: string }>(
    `SELECT status FROM notification WHERE booking_id = $1 AND type = $2`,
    [bookingId, type],
  );
  return rows[0]?.status;
}

/**
 * Mirrors every existing integration test's afterAll cleanup discipline
 * (notification rows first: notification.booking_id has no cascading
 * delete) so each demo script can be re-run live without colliding with its
 * own previous run.
 */
export async function cleanupBookingFixtures(bookingIds: string[]): Promise<void> {
  const ids = bookingIds.filter(Boolean);
  if (ids.length === 0) return;
  await pool.query(`DELETE FROM notification WHERE booking_id = ANY($1::uuid[])`, [ids]);
  await pool.query(`DELETE FROM booking WHERE id = ANY($1::uuid[])`, [ids]);
}

/**
 * Standard CLI entry point for a standalone demo script: prints a banner,
 * runs the scenario, prints a final pass/fail line legible to a live
 * audience, closes the shared DB pool exactly once, and sets the process
 * exit code so a failure is never silently swallowed.
 */
export async function runAsCliScript(title: string, scenario: () => Promise<void>): Promise<void> {
  banner(title);
  try {
    await scenario();
    pass(`${title}: PASSED`);
    await pool.end();
    process.exit(0);
  } catch (err) {
    fail(`${title}: FAILED`);
    console.error(err);
    await pool.end().catch(() => undefined);
    process.exit(1);
  }
}
