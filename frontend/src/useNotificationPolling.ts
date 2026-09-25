import { useCallback, useEffect, useRef, useState } from "react";
import { getBookingNotifications } from "./api";
import type { BookingStatus, NotificationSummary } from "./types";

export type NotificationPollState = "polling" | "settled" | "timeout" | "error";

export interface NotificationPollResult {
  notifications: NotificationSummary[];
  pollState: NotificationPollState;
  errorMessage?: string;
  /** True while a status-refresh error is being retried (not yet given up). */
  retrying?: boolean;
  /** Forces one fetch and re-evaluates settle state — used once pollState is
   * "timeout", so a slow Scenario C/D process-restart procedure that outlasts
   * this hook's own bounded poll can still be observed without a page
   * reload (which would lose App.tsx's in-memory tracked-booking session). */
  refresh: () => void;
}

const TERMINAL_STATUSES = new Set<NotificationSummary["status"]>(["Sent", "Failed"]);
const MAX_CONSECUTIVE_FAILURES = 3;

function isSettled(notifications: NotificationSummary[]): boolean {
  return notifications.length > 0 && notifications.every((n) => TERMINAL_STATUSES.has(n.status));
}

/**
 * Bounded polling of GET /bookings/:id/notifications (TASK-18 §E). Every
 * rendered field is the server's own response body — nothing here is
 * frontend-computed status.
 *
 * Settle condition: every currently-known row is Sent or Failed. Resume on
 * booking-status change: `bookingStatus` is an input dependency — whenever
 * it transitions to "Released", the hook resets its own settle tracking
 * (keyed per booking status) and polls again, even if it had already
 * settled on an earlier status (the common case: Confirmation reaches Sent
 * well before release, long before the ReleaseNotice row is even created).
 * Rows are matched by `type`, not array position (no ordering guarantee).
 */
export function useNotificationPolling(
  bookingId: string,
  ownerToken: string,
  bookingStatus: BookingStatus,
  options: { intervalMs?: number; timeoutMs?: number } = {},
): NotificationPollResult {
  const intervalMs = options.intervalMs ?? 2000;
  const timeoutMs = options.timeoutMs ?? 30000;

  const [notifications, setNotifications] = useState<NotificationSummary[]>([]);
  const [pollState, setPollState] = useState<NotificationPollState>("polling");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [retrying, setRetrying] = useState<boolean | undefined>();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const settledForStatusRef = useRef<BookingStatus | null>(null);

  const refresh = useCallback(() => setRefreshNonce((n) => n + 1), []);

  useEffect(() => {
    if (settledForStatusRef.current === bookingStatus) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const startedAt = Date.now();
    let consecutiveFailures = 0;

    setPollState("polling");

    const scheduleNext = (delayMs: number): void => {
      if (Date.now() - startedAt >= timeoutMs) {
        setPollState("timeout");
        return;
      }
      timer = setTimeout(() => void tick(), delayMs);
    };

    const handleFailure = (message: string): void => {
      consecutiveFailures += 1;
      const givingUp = consecutiveFailures >= MAX_CONSECUTIVE_FAILURES;
      setPollState("error");
      setErrorMessage(message);
      setRetrying(!givingUp);
      if (givingUp) return;
      scheduleNext(intervalMs * consecutiveFailures);
    };

    const tick = async (): Promise<void> => {
      if (cancelled) return;
      try {
        const res = await getBookingNotifications(ownerToken, bookingId);
        if (cancelled) return;

        if (!res.ok) {
          handleFailure(res.body.message ?? `Notification refresh failed (${res.status}).`);
          return;
        }

        consecutiveFailures = 0;
        setNotifications(res.body.notifications);

        if (isSettled(res.body.notifications)) {
          settledForStatusRef.current = bookingStatus;
          setPollState("settled");
          return;
        }

        setPollState("polling");
        scheduleNext(intervalMs);
      } catch (err) {
        if (cancelled) return;
        handleFailure(
          err instanceof Error ? err.message : "Network error while polling notifications.",
        );
      }
    };

    void tick();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [bookingId, ownerToken, bookingStatus, refreshNonce, intervalMs, timeoutMs]);

  return { notifications, pollState, errorMessage, retrying, refresh };
}
