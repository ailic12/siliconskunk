import { useEffect, useRef, useState, type ReactElement } from "react";
import { submitAppQrCheckin } from "./api";
import { describeApiError } from "./error-messages";
import { useBookingPolling } from "./useBookingPolling";
import type { TimelineEventKind, TrackedBooking } from "./types";

interface BookingCardProps {
  tracked: TrackedBooking;
  onTimelineEvent: (kind: TimelineEventKind, message: string) => void;
}

type CheckinState = "idle" | "submitting" | "submitted" | "error";

export function BookingCard({ tracked, onTimelineEvent }: BookingCardProps): ReactElement {
  const { booking, pollState, errorMessage, retrying } = useBookingPolling(
    tracked.booking.id,
    tracked.ownerToken,
    tracked.booking,
  );

  const [checkinState, setCheckinState] = useState<CheckinState>("idle");
  const [checkinError, setCheckinError] = useState<string | undefined>();
  const emittedSettleRef = useRef<string | null>(null);

  useEffect(() => {
    if (pollState !== "settled") return;
    const key = `${booking.id}:${booking.status}`;
    if (emittedSettleRef.current === key) return;
    emittedSettleRef.current = key;

    if (booking.status === "CheckedIn") {
      onTimelineEvent(
        "checkin_confirmed",
        `${tracked.ownerName}'s ${tracked.resourceName} booking (${booking.bookingDate}) is now CheckedIn — observed via GET /bookings/${booking.id}.`,
      );
    } else if (booking.status === "Released") {
      onTimelineEvent(
        "release_confirmed",
        `${tracked.ownerName}'s ${tracked.resourceName} booking (${booking.bookingDate}) was automatically Released — observed via GET /bookings/${booking.id}.`,
      );
    }
  }, [pollState, booking.status, booking.id, booking.bookingDate, onTimelineEvent, tracked.ownerName, tracked.resourceName]);

  async function simulateCheckin(): Promise<void> {
    setCheckinState("submitting");
    setCheckinError(undefined);
    try {
      const scannedAt = `${booking.bookingDate}T09:00:00.000Z`;
      const res = await submitAppQrCheckin(booking.resourceId, scannedAt);
      if (!res.ok) {
        setCheckinState("error");
        setCheckinError(describeApiError(res.status, res.body));
        onTimelineEvent(
          "error",
          `Check-in submission failed for ${tracked.resourceName}: ${describeApiError(res.status, res.body)}`,
        );
        return;
      }
      setCheckinState("submitted");
      onTimelineEvent(
        "checkin_submitted",
        `Check-in submitted for ${tracked.ownerName}'s ${tracked.resourceName} booking — 202 accepted, awaiting processing (not yet confirmed).`,
      );
    } catch (err) {
      setCheckinState("error");
      const message = err instanceof Error ? err.message : "Network error.";
      setCheckinError(message);
      onTimelineEvent("error", `Check-in submission failed for ${tracked.resourceName}: ${message}`);
    }
  }

  return (
    <div className="booking-card" data-status={booking.status}>
      <h3>
        {tracked.resourceName} — {tracked.ownerName}
      </h3>
      <dl>
        <dt>Booking date</dt>
        <dd>{booking.bookingDate}</dd>
        <dt>Status</dt>
        <dd data-testid="booking-status">{booking.status}</dd>
        <dt>Check-in deadline</dt>
        <dd>{booking.checkInDeadline}</dd>
      </dl>

      {pollState === "polling" && <p className="pending">Still processing — refreshing live status…</p>}
      {pollState === "timeout" && (
        <p className="pending">Timed out waiting for a status change. Refresh manually to check again.</p>
      )}
      {pollState === "error" && retrying && (
        <p className="pending" data-testid="poll-retrying">
          Status refresh error: {errorMessage} — retrying…
        </p>
      )}
      {pollState === "error" && !retrying && (
        <p className="error" data-testid="poll-error">
          Status refresh error: {errorMessage} — gave up after repeated failures.
        </p>
      )}

      {booking.status === "Reserved" && checkinState !== "submitted" && (
        <button
          type="button"
          onClick={() => void simulateCheckin()}
          disabled={checkinState === "submitting"}
          data-testid="simulate-checkin"
        >
          {checkinState === "submitting" ? "Submitting…" : "Simulate check-in"}
        </button>
      )}
      {checkinState === "submitted" && booking.status === "Reserved" && (
        <p className="pending">Check-in accepted (202) — awaiting confirmation…</p>
      )}
      {checkinState === "error" && <p className="error">{checkinError}</p>}
    </div>
  );
}
