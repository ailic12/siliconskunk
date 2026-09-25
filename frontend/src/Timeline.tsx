import type { ReactElement } from "react";
import type { TimelineEvent } from "./types";

interface TimelineProps {
  events: TimelineEvent[];
}

export function Timeline({ events }: TimelineProps): ReactElement {
  return (
    <fieldset>
      <legend>Demo activity timeline</legend>
      <p className="hint">
        Observed this session only — not a persisted audit trail. Notification status is
        observed via GET /bookings/:id/notifications, never implied by booking success.
      </p>
      {events.length === 0 ? (
        <p>No activity yet.</p>
      ) : (
        <ol data-testid="timeline">
          {events
            .slice()
            .reverse()
            .map((event) => (
              <li key={event.id} data-kind={event.kind}>
                <time>{event.at}</time> — {event.message}
              </li>
            ))}
        </ol>
      )}
    </fieldset>
  );
}
