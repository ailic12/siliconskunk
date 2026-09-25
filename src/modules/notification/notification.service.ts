import { randomUUID } from "crypto";
import type { Clock } from "../../shared/clock";
import { withTransaction } from "../../shared/db";
import { claimNext, markSent, recordFailure, type Notification } from "./notification.repository";
import type { NotificationChannel } from "./notification-channel";

export interface NotificationWorkerOptions {
  leaseDurationMs?: number;
  backoffUnitMs?: number;
  maxAttempts?: number;
}

const DEFAULT_LEASE_DURATION_MS = 30_000;
const DEFAULT_BACKOFF_UNIT_MS = 2_000;
const DEFAULT_MAX_ATTEMPTS = 5;

/**
 * Notification worker (TASK-11, HLD §5.5): claims and processes every
 * currently eligible row (Pending past backoff, or Sending with an expired
 * lease) one at a time, each in its own transaction — mirrors the Release
 * Engine sweep's per-candidate transaction style (TASK-09). A channel
 * failure never lets a row reach Sent; it goes back to Pending with backoff,
 * or Failed once attempts reaches the cap (§9 max-attempts/backoff, plan §9
 * item 6 — exact constants are a delegated implementation choice).
 */
export async function runNotificationWorker(
  clock: Clock,
  channel: NotificationChannel,
  options: NotificationWorkerOptions = {},
): Promise<Notification[]> {
  const leaseDurationMs = options.leaseDurationMs ?? DEFAULT_LEASE_DURATION_MS;
  const backoffUnitMs = options.backoffUnitMs ?? DEFAULT_BACKOFF_UNIT_MS;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  const processed: Notification[] = [];

  for (;;) {
    const leaseOwner = randomUUID();
    const now = clock.now();

    const claimed = await withTransaction((client) =>
      claimNext(client, {
        leaseOwner,
        leaseExpiresAt: new Date(now.getTime() + leaseDurationMs),
        now,
      }),
    );
    if (!claimed) break;

    try {
      await channel.send({
        notificationId: claimed.id,
        bookingId: claimed.bookingId,
        type: claimed.type,
        channel: claimed.channel,
      });
      await withTransaction((client) => markSent(client, claimed.id, leaseOwner));
      processed.push({ ...claimed, status: "Sent" });
    } catch {
      const failedOut = claimed.attempts >= maxAttempts;
      await withTransaction((client) =>
        recordFailure(client, claimed.id, leaseOwner, {
          now: clock.now(),
          backoffMs: claimed.attempts * backoffUnitMs,
          maxAttempts,
        }),
      );
      processed.push({ ...claimed, status: failedOut ? "Failed" : "Pending" });
    }
  }

  return processed;
}
