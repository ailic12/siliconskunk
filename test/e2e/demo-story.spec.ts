import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { pool } from "../../src/shared/db";
import { runSeed } from "../../db/seed";
import { runHappyPathScenario, CREATE_CLOCK } from "../../scripts/demo/happy-path";
import { bootDemoApp, cleanupBookingFixtures } from "../../scripts/demo/_shared";

describe(
  "End-to-end demo story (TASK-13): Discover -> Reserve -> Confirm -> No-checkin -> Release -> Re-offer",
  () => {
    let app: FastifyInstance;
    let bookingId: string;

    beforeAll(async () => {
      await runSeed();
      app = await bootDemoApp(CREATE_CLOCK);
    });

    afterAll(async () => {
      await cleanupBookingFixtures([bookingId]);
      await app.close();
      await pool.end();
    });

    it("asserts each transition of the happy-path narrative non-interactively", async () => {
      const result = await runHappyPathScenario(app);
      bookingId = result.bookingId;

      expect(result.availabilityBefore).toBe(true);
      expect(result.reservedStatus).toBe("Reserved");
      expect(result.confirmationStatus).toBe("Sent");
      expect(result.releasedStatus).toBe("Released");
      expect(result.releaseNoticeStatus).toBe("Sent");
      expect(result.availabilityAfter).toBe(true);
    });
  },
);
