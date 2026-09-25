import { useState, type ReactElement } from "react";
import { BookingCard } from "./BookingCard";
import { DemoScenarios } from "./DemoScenarios";
import { SearchPanel } from "./SearchPanel";
import { Timeline } from "./Timeline";
import type { TimelineEvent, TimelineEventKind, TrackedBooking } from "./types";

export function App(): ReactElement {
  const [tracked, setTracked] = useState<TrackedBooking[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);

  function addTimelineEvent(kind: TimelineEventKind, message: string): void {
    setEvents((prev) => [
      ...prev,
      { id: crypto.randomUUID(), kind, message, at: new Date().toLocaleTimeString() },
    ]);
  }

  function trackBooking(next: TrackedBooking): void {
    setTracked((prev) => [...prev.filter((t) => t.booking.id !== next.booking.id), next]);
  }

  return (
    <main>
      <h1>Smart Office — Booking &amp; Check-in Demo</h1>
      <p>
        A thin visual layer over the real backend. Every result shown is exactly what the
        server returned — nothing about booking, check-in, or release status is computed or
        simulated client-side.
      </p>

      <SearchPanel onBooked={trackBooking} onTimelineEvent={addTimelineEvent} />

      <DemoScenarios onBooked={trackBooking} onTimelineEvent={addTimelineEvent} />

      <fieldset>
        <legend>My bookings (this session)</legend>
        {tracked.length === 0 ? (
          <p>No bookings yet — search and book above, or run a demo scenario.</p>
        ) : (
          tracked
            .slice()
            .reverse()
            .map((t) => (
              <BookingCard key={t.booking.id} tracked={t} onTimelineEvent={addTimelineEvent} />
            ))
        )}
      </fieldset>

      <Timeline events={events} />
    </main>
  );
}
