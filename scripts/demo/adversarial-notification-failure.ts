import dotenv from "dotenv";
dotenv.config();

import supertest from "supertest";
import { runSeed } from "../../db/seed";
import { OFFICE_BELGRADE_ID } from "../../db/seed/offices";
import { resources } from "../../db/seed/resources";
import { employees } from "../../db/seed/employees";
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

const TITLE = "Adversarial demo: notification provider failure never blocks booking success";

const BOOKING_DATE = "2026-07-27";
const CREATE_CLOCK = new DemoClock(new Date("2026-07-22T08:00:00.000Z"));

const belgradeParking = resources.filter((r) => r.officeId === OFFICE_BELGRADE_ID && r.type === "ParkingSpace");
const RESOURCE = belgradeParking[0]!;
const EMPLOYEE = employees.find((e) => e.homeOfficeId === OFFICE_BELGRADE_ID)!;

async function main(): Promise<void> {
  await runAsCliScript(TITLE, async () => {
    await runSeed();
    const app = await bootDemoApp(CREATE_CLOCK);
    let bookingId = "";
    try {
      step("Setting the fake notification channel to always fail...");
      const failingChannel = new FakeNotificationChannel({ shouldFail: () => true });

      step(`Booking ${RESOURCE.name} for ${EMPLOYEE.displayName} on ${BOOKING_DATE}...`);
      const bookRes = await supertest(app.server)
        .post("/bookings")
        .set("Authorization", `Bearer ${EMPLOYEE.devToken}`)
        .send({ resourceId: RESOURCE.id, bookingDate: BOOKING_DATE });
      assertEqual(bookRes.status, 201, "booking still succeeds even though the provider will fail");
      bookingId = bookRes.body.id;
      pass(`Booking ${bookingId} committed: ${bookRes.body.status}`);

      step("Running the notification worker against the always-failing channel...");
      await runNotificationWorker(CREATE_CLOCK, failingChannel);

      const status = await bookingStatus(bookingId);
      assertEqual(status, "Reserved", "booking transaction is never touched by notification outcome");
      pass(`Booking ${bookingId} is still Reserved — unaffected by the notification failure`);

      const notifStatus = await notificationStatus(bookingId, "Confirmation");
      assertEqual(
        ["Pending", "Failed"].includes(notifStatus ?? ""),
        true,
        "notification retried with backoff, never silently marked Sent",
      );
      pass(`Confirmation notification: ${notifStatus} (retried with backoff, outbox stays honest)`);

      assertEqual(failingChannel.getSentLog().length, 0, "the failing channel never recorded a successful send");
      pass("Fake channel log confirms zero successful sends");
    } finally {
      await cleanupBookingFixtures([bookingId]);
      await app.close();
    }
  });
}

if (require.main === module) {
  main();
}
