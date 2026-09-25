import PgBoss from "pg-boss";
import type { CheckInEvent } from "../../modules/checkin-contract";

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

export async function stopQueue(): Promise<void> {
  if (boss) {
    await boss.stop({ graceful: false });
    boss = undefined;
    started = undefined;
  }
}
