import { useEffect, useRef, type ReactElement } from "react";
import { useNotificationPolling } from "./useNotificationPolling";
import type { BookingStatus } from "./types";

interface NotificationPanelProps {
  bookingId: string;
  ownerToken: string;
  bookingStatus: BookingStatus;
  onTerminalObserved: (message: string) => void;
  /** Test-only override for the underlying hook's poll interval/timeout. */
  pollOptions?: { intervalMs?: number; timeoutMs?: number };
}

/**
 * Notification Status Panel (TASK-18 §E). Every row is copied verbatim from
 * GET /bookings/:id/notifications — never computed or implied client-side.
 * Rendered inside BookingCard, alongside (not merged into) booking status,
 * per the requirement that booking success and notification delivery status
 * stay visually and textually separate.
 */
export function NotificationPanel({
  bookingId,
  ownerToken,
  bookingStatus,
  onTerminalObserved,
  pollOptions,
}: NotificationPanelProps): ReactElement {
  const { notifications, pollState, errorMessage, retrying, refresh } = useNotificationPolling(
    bookingId,
    ownerToken,
    bookingStatus,
    pollOptions,
  );
  const emittedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const n of notifications) {
      if (n.status !== "Sent" && n.status !== "Failed") continue;
      const key = `${n.id}:${n.status}`;
      if (emittedRef.current.has(key)) continue;
      emittedRef.current.add(key);
      const outcome = n.status === "Sent" ? "sent by the mocked provider" : "Failed";
      onTerminalObserved(
        `${n.type} notification observed ${outcome} (attempts: ${n.attempts}) — observed via ` +
          `GET /bookings/${bookingId}/notifications.`,
      );
    }
  }, [notifications, bookingId, onTerminalObserved]);

  return (
    <fieldset className="notification-panel">
      <legend>Notification status</legend>

      {notifications.length === 0 && pollState === "polling" && (
        <p className="pending">Checking notification status…</p>
      )}

      {notifications.length > 0 && (
        <table data-testid="notification-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Status</th>
              <th>Attempts</th>
              <th>Sent at</th>
            </tr>
          </thead>
          <tbody>
            {notifications.map((n) => (
              <tr key={n.id} data-testid={`notification-row-${n.type}`}>
                <td>{n.type}</td>
                <td
                  className={
                    n.status === "Sent" ? "success" : n.status === "Failed" ? "error" : "pending"
                  }
                  data-testid={`notification-status-${n.type}`}
                >
                  {n.status}
                </td>
                <td>{n.attempts}</td>
                <td>{n.sentAt ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {pollState === "error" && retrying && (
        <p className="pending">Notification refresh error: {errorMessage} — retrying…</p>
      )}
      {pollState === "error" && !retrying && (
        <p className="error">
          Notification refresh error: {errorMessage} — gave up after repeated failures.
        </p>
      )}
      {pollState === "timeout" && (
        <>
          <p className="pending">Timed out waiting for a notification status change.</p>
          <button type="button" onClick={refresh} data-testid="refresh-notifications">
            Refresh notifications
          </button>
        </>
      )}

      <p className="hint">
        Status reflects the mocked provider only — "Sent" means the fake channel accepted the
        message, never a guarantee of external delivery.
      </p>
    </fieldset>
  );
}
