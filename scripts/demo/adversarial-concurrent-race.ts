import dotenv from "dotenv";
dotenv.config();

import supertest from "supertest";
import { runSeed } from "../../db/seed";
import { OFFICE_BELGRADE_ID } from "../../db/seed/offices";
import { resources } from "../../db/seed/resources";
import { employees } from "../../db/seed/employees";
import {
  DemoClock,
  bootDemoApp,
  banner,
  step,
  pass,
  assertEqual,
  cleanupBookingFixtures,
  runAsCliScript,
} from "./_shared";

const TITLE = "Adversarial demo: concurrent booking race";

const CREATE_CLOCK = new DemoClock(new Date("2026-07-15T08:00:00.000Z"));
const RESOURCE_RACE_DATE = "2026-07-20";
const EMPLOYEE_RACE_DATE = "2026-07-21";

const belgradeDesks = resources.filter((r) => r.officeId === OFFICE_BELGRADE_ID && r.type === "Desk");
const belgradeEmployees = employees.filter((e) => e.homeOfficeId === OFFICE_BELGRADE_ID);

const RESOURCE_RACE_TARGET = belgradeDesks[6]!.id;
const EMPLOYEE_RACE_RESOURCE_A = belgradeDesks[7]!.id;
const EMPLOYEE_RACE_RESOURCE_B = belgradeDesks[8]!.id;

const EMPLOYEE_ONE = belgradeEmployees[0]!;
const EMPLOYEE_TWO = belgradeEmployees[1]!;
const EMPLOYEE_THREE = belgradeEmployees[2]!;

async function main(): Promise<void> {
  await runAsCliScript(TITLE, async () => {
    await runSeed();
    const app = await bootDemoApp(CREATE_CLOCK);
    const bookingIds: string[] = [];
    try {
      banner("Case 1: two different employees race for the same resource/date");
      step(
        `${EMPLOYEE_ONE.displayName} and ${EMPLOYEE_TWO.displayName} both request the same desk on ${RESOURCE_RACE_DATE}, fired at the same instant...`,
      );
      const [respA, respB] = await Promise.all([
        supertest(app.server)
          .post("/bookings")
          .set("Authorization", `Bearer ${EMPLOYEE_ONE.devToken}`)
          .send({ resourceId: RESOURCE_RACE_TARGET, bookingDate: RESOURCE_RACE_DATE }),
        supertest(app.server)
          .post("/bookings")
          .set("Authorization", `Bearer ${EMPLOYEE_TWO.devToken}`)
          .send({ resourceId: RESOURCE_RACE_TARGET, bookingDate: RESOURCE_RACE_DATE }),
      ]);
      const statuses = [respA.status, respB.status].sort((a, b) => a - b);
      assertEqual(
        JSON.stringify(statuses),
        JSON.stringify([201, 409]),
        "resource race: exactly one 201 and one 409",
      );
      const winner = [respA, respB].find((r) => r.status === 201)!;
      const loser = [respA, respB].find((r) => r.status === 409)!;
      bookingIds.push(winner.body.id);
      pass(`Winner: 201 Reserved (booking ${winner.body.id})`);
      pass(`Loser: 409 ${loser.body.reason}`);

      banner("Case 2: the same employee races for two different resources/same date");
      step(
        `${EMPLOYEE_THREE.displayName} requests two different desks on ${EMPLOYEE_RACE_DATE}, fired at the same instant...`,
      );
      const [respC, respD] = await Promise.all([
        supertest(app.server)
          .post("/bookings")
          .set("Authorization", `Bearer ${EMPLOYEE_THREE.devToken}`)
          .send({ resourceId: EMPLOYEE_RACE_RESOURCE_A, bookingDate: EMPLOYEE_RACE_DATE }),
        supertest(app.server)
          .post("/bookings")
          .set("Authorization", `Bearer ${EMPLOYEE_THREE.devToken}`)
          .send({ resourceId: EMPLOYEE_RACE_RESOURCE_B, bookingDate: EMPLOYEE_RACE_DATE }),
      ]);
      const statuses2 = [respC.status, respD.status].sort((a, b) => a - b);
      assertEqual(
        JSON.stringify(statuses2),
        JSON.stringify([201, 409]),
        "employee race: exactly one 201 and one 409",
      );
      const winner2 = [respC, respD].find((r) => r.status === 201)!;
      const loser2 = [respC, respD].find((r) => r.status === 409)!;
      bookingIds.push(winner2.body.id);
      pass(`Winner: 201 Reserved (booking ${winner2.body.id})`);
      pass(`Loser: 409 ${loser2.body.reason}`);
    } finally {
      await cleanupBookingFixtures(bookingIds);
      await app.close();
    }
  });
}

if (require.main === module) {
  main();
}
