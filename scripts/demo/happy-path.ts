import dotenv from "dotenv";
dotenv.config();

import supertest from "supertest";
import type { FastifyInstance } from "fastify";
import type { Clock } from "../../src/shared/clock";
import { runSeed } from "../../db/seed";
import { OFFICE_BELGRADE_ID } from "../../db/seed/offices";
import { resources } from "../../db/seed/resources";
import { employees } from "../../db/seed/employees";
import { runReleaseSweep } from "../../src/modules/release-engine";
import { runNotificationWorker, FakeNotificationChannel } from "../../src/modules/notification";
import {
  DemoClock,
  bootDemoApp,
  step,
  pass,
  bookingStatus,
  notificationStatus,
  cleanupBookingFixtures,
  assertEqual,
  runAsCliScript,
} from "./_shared";

const TITLE = "Happy path: Discover -> Reserve -> Confirm -> No-checkin -> Release -> Re-offer";

export const BOOKING_DATE = "2026-07-15";
// Belgrade Desk demo-override policy (db/seed/policies.ts
// POLICY_BELGRADE_DEMO_OVERRIDE_ID) has a release deadline of 00:05 local —
// paired here with an injected Clock rather than a real-time wait.
export const CREATE_CLOCK: Clock = new DemoClock(new Date("2026-07-10T08:00:00.000Z"));
// Deadline for booking_date 2026-07-15 at Belgrade's CEST (UTC+2 in July)
// 00:05 local is 2026-07-14T22:05:00Z; this clock is comfortably past it.
export const RELEASE_CLOCK: Clock = new DemoClock(new Date("2026-07-15T06:00:00.000Z"));

const belgradeDesks = resources.filter((r) => r.officeId === OFFICE_BELGRADE_ID && r.type === "Desk");
export const RESOURCE = belgradeDesks[0]!;
export const EMPLOYEE = employees.find((e) => e.homeOfficeId === OFFICE_BELGRADE_ID)!;

export interface HappyPathResult {
  availabilityBefore: boolean;
  bookingId: string;
  reservedStatus: string;
  confirmationStatus: string | undefined;
  releasedStatus: string | undefined;
  releaseNoticeStatus: string | undefined;
  availabilityAfter: boolean;
}

async function searchAvailability(app: FastifyInstance): Promise<boolean> {
  const res = await supertest(app.server)
    .get("/availability")
    .set("Authorization", `Bearer ${EMPLOYEE.devToken}`)
    .query({ officeId: OFFICE_BELGRADE_ID, resourceType: "Desk", date: BOOKING_DATE });
  assertEqual(res.status, 200, "availability search status");
  return (res.body.resources as Array<{ id: string }>).some((r) => r.id === RESOURCE.id);
}

/**
 * Pure orchestration over already-tested code paths (TASK-04/09/11): this
 * function contains no business logic of its own, only the demo narrative's
 * sequencing. Exported so both this file's CLI main() (console pass/fail)
 * and test/e2e/demo-story.spec.ts (vitest expect) drive the exact same
 * steps — the orchestration exists exactly once.
 */
export async function runHappyPathScenario(
  app: FastifyInstance,
  log: (message: string) => void = () => {},
): Promise<HappyPathResult> {
  log("Searching availability before booking...");
  const availabilityBefore = await searchAvailability(app);

  log(`Booking ${RESOURCE.name} for ${EMPLOYEE.displayName} on ${BOOKING_DATE}...`);
  const bookRes = await supertest(app.server)
    .post("/bookings")
    .set("Authorization", `Bearer ${EMPLOYEE.devToken}`)
    .send({ resourceId: RESOURCE.id, bookingDate: BOOKING_DATE });
  assertEqual(bookRes.status, 201, "booking creation status");
  const bookingId = bookRes.body.id as string;
  const reservedStatus = bookRes.body.status as string;

  log("Dispatching the Confirmation notification...");
  const channel = new FakeNotificationChannel();
  await runNotificationWorker(CREATE_CLOCK, channel);
  const confirmationStatus = await notificationStatus(bookingId, "Confirmation");

  log("Not checking in. Letting the demo-scoped deadline pass, then sweeping for release...");
  const released = await runReleaseSweep(RELEASE_CLOCK);
  assertEqual(released.some((b) => b.id === bookingId), true, "booking released by sweep");
  const releasedStatus = await bookingStatus(bookingId);

  log("Dispatching the ReleaseNotice notification...");
  await runNotificationWorker(RELEASE_CLOCK, channel);
  const releaseNoticeStatus = await notificationStatus(bookingId, "ReleaseNotice");

  log("Re-running availability search after release...");
  const availabilityAfter = await searchAvailability(app);

  return {
    availabilityBefore,
    bookingId,
    reservedStatus,
    confirmationStatus,
    releasedStatus,
    releaseNoticeStatus,
    availabilityAfter,
  };
}

async function main(): Promise<void> {
  await runAsCliScript(TITLE, async () => {
    await runSeed();
    const app = await bootDemoApp(CREATE_CLOCK);
    let bookingId = "";
    try {
      const result = await runHappyPathScenario(app, step);
      bookingId = result.bookingId;

      assertEqual(result.availabilityBefore, true, "resource available before booking");
      pass(`${RESOURCE.name} was available on ${BOOKING_DATE}`);

      assertEqual(result.reservedStatus, "Reserved", "booking status after creation");
      pass(`Booking ${bookingId} created: Reserved`);

      assertEqual(result.confirmationStatus, "Sent", "Confirmation notification status");
      pass("Confirmation notification: Sent");

      assertEqual(result.releasedStatus, "Released", "booking status after sweep");
      pass(`Booking ${bookingId} auto-released (no check-in before the deadline): Released`);

      assertEqual(result.releaseNoticeStatus, "Sent", "ReleaseNotice notification status");
      pass("ReleaseNotice notification: Sent");

      assertEqual(result.availabilityAfter, true, "resource reappears after release");
      pass(`${RESOURCE.name} is available again on ${BOOKING_DATE}`);
    } finally {
      await cleanupBookingFixtures([bookingId]);
      await app.close();
    }
  });
}

if (require.main === module) {
  main();
}
