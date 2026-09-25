import PgBoss from "pg-boss";
import type { CheckInEvent } from "../../modules/checkin-contract";
import { parseCheckInEvent } from "../../modules/checkin-contract";

export const CHECKIN_EVENTS_QUEUE = "checkin-events";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and configure it.");
}

let boss: PgBoss | undefined;
let started: Promise<PgBoss> | undefined;

async function getQueue(): Promise<PgBoss> {
  if (!started) {
    boss = new PgBoss({ connectionString: process.env.DATABASE_URL });
    started = boss.start().then(async (started) => {
      await started.createQueue(CHECKIN_EVENTS_QUEUE);
      return started;
    });
  }
  return started;
}

export async function sendCheckinEvent(event: CheckInEvent): Promise<string | null> {
  const queue = await getQueue();
  return queue.send(CHECKIN_EVENTS_QUEUE, event);
}

/**
 * Subscribes a handler to CHECKIN_EVENTS_QUEUE. Each job's data is
 * re-validated through parseCheckInEvent before the handler runs — defense
 * in depth, since only the Ingress API (already validated) is expected to
 * enqueue onto this queue. A handler that throws leaves the job for pg-boss
 * to retry, rather than swallowing the failure.
 */
export async function workCheckinEvents(
  handler: (event: CheckInEvent) => Promise<void>,
): Promise<string> {
  const queue = await getQueue();
  return queue.work(CHECKIN_EVENTS_QUEUE, async (jobs) => {
    for (const job of jobs) {
      await handler(parseCheckInEvent(job.data));
    }
  });
}

export async function stopQueue(): Promise<void> {
  if (boss) {
    await boss.stop({ graceful: false });
    boss = undefined;
    started = undefined;
  }
}
