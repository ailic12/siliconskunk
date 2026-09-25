import { useEffect, useState } from "react";
import { getBooking } from "./api";
import type { BookingWithDeadline } from "./types";

export type PollState = "polling" | "settled" | "timeout" | "error";

export interface BookingPollResult {
  booking: BookingWithDeadline;
  pollState: PollState;
  errorMessage?: string;
  /** True while a status-refresh error is being retried (not yet given up). */
  retrying?: boolean;
}

const SETTLED_STATUSES = new Set(["CheckedIn", "Released"]);
const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * Bounded polling of GET /bookings/:id (TASK-17 §E): stops once a settled
 * state is observed from a live response, or after timeoutMs with no
 * settlement, whichever comes first. Every rendered field is the server's
 * own response body — nothing here is frontend-computed status.
 *
 * A failed status refresh (§G) is never silently swallowed — it is surfaced
 * immediately via errorMessage/retrying — but a single transient failure
 * does not permanently strand the card: up to MAX_CONSECUTIVE_FAILURES
 * consecutive failures are retried with linear backoff (intervalMs *
 * attempt) before polling gives up and settles into a terminal "error"
 * state. A successful refresh resets the failure count.
 */
export function useBookingPolling(
  bookingId: string,
  ownerToken: string,
  initial: BookingWithDeadline,
  options: { intervalMs?: number; timeoutMs?: number } = {},
): BookingPollResult {
  const intervalMs = options.intervalMs ?? 2000;
  const timeoutMs = options.timeoutMs ?? 30000;

  const [result, setResult] = useState<BookingPollResult>({
    booking: initial,
    pollState: SETTLED_STATUSES.has(initial.status) ? "settled" : "polling",
  });

  useEffect(() => {
    if (SETTLED_STATUSES.has(initial.status)) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const startedAt = Date.now();
    let consecutiveFailures = 0;

    const scheduleNext = (delayMs: number): void => {
      if (Date.now() - startedAt >= timeoutMs) {
        setResult((prev) => ({ ...prev, pollState: "timeout" }));
        return;
      }
      timer = setTimeout(() => void tick(), delayMs);
    };

    const handleFailure = (message: string): void => {
      consecutiveFailures += 1;
      const givingUp = consecutiveFailures >= MAX_CONSECUTIVE_FAILURES;
      setResult((prev) => ({
        ...prev,
        pollState: "error",
        errorMessage: message,
        retrying: !givingUp,
      }));
      if (givingUp) return;
      scheduleNext(intervalMs * consecutiveFailures);
    };

    const tick = async (): Promise<void> => {
      if (cancelled) return;
      try {
        const res = await getBooking(ownerToken, bookingId);
        if (cancelled) return;

        if (!res.ok) {
          handleFailure(res.body.message ?? `Status refresh failed (${res.status}).`);
          return;
        }

        consecutiveFailures = 0;

        if (SETTLED_STATUSES.has(res.body.status)) {
          setResult({ booking: res.body, pollState: "settled" });
          return;
        }

        setResult({ booking: res.body, pollState: "polling" });
        scheduleNext(intervalMs);
      } catch (err) {
        if (cancelled) return;
        handleFailure(err instanceof Error ? err.message : "Network error while polling.");
      }
    };

    timer = setTimeout(() => void tick(), intervalMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [bookingId, ownerToken, initial.status]);

  return result;
}
