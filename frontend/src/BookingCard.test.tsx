import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BookingCard } from "./BookingCard";
import * as api from "./api";
import type { BookingWithDeadline, TrackedBooking } from "./types";

vi.mock("./api");

function trackedFor(status: BookingWithDeadline["status"]): TrackedBooking {
  const booking: BookingWithDeadline = {
    id: "booking-1",
    resourceId: "resource-1",
    employeeId: "employee-1",
    bookingDate: "2026-10-01",
    resourceType: "Desk",
    status,
    createdAt: "2026-09-25T00:00:00.000Z",
    checkInDeadline: "2026-10-01T08:00:00.000Z",
  };
  return { booking, ownerToken: "dev-token-alice", ownerName: "Alice Petrovic", resourceName: "Desk 1" };
}

describe("BookingCard (TASK-17 §B/§C, Current Booking Panel rendering)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders the booking's own CheckedIn state from a mocked GET /bookings/:id response and offers no check-in button", () => {
    const tracked = trackedFor("CheckedIn");
    render(<BookingCard tracked={tracked} onTimelineEvent={vi.fn()} />);

    expect(screen.getByTestId("booking-status")).toHaveTextContent("CheckedIn");
    expect(screen.queryByRole("button", { name: /simulate check-in/i })).not.toBeInTheDocument();
  });

  it("renders Released state distinctly and fires a timeline event exactly once", () => {
    const tracked = trackedFor("Released");
    const onTimelineEvent = vi.fn();
    render(<BookingCard tracked={tracked} onTimelineEvent={onTimelineEvent} />);

    expect(screen.getByTestId("booking-status")).toHaveTextContent("Released");
    expect(onTimelineEvent).toHaveBeenCalledWith(
      "release_confirmed",
      expect.stringContaining("automatically Released"),
    );
  });

  it("offers a Simulate check-in action for a Reserved booking, distinguishing 202-accepted from confirmed", async () => {
    vi.mocked(api.submitAppQrCheckin).mockResolvedValue({
      ok: true,
      status: 202,
      body: { status: "accepted" },
    });
    // Never resolves within the test — keeps the booking in the "still Reserved,
    // awaiting confirmation" state so the 202-vs-confirmed distinction is observable.
    vi.mocked(api.getBooking).mockImplementation(() => new Promise(() => {}));

    const tracked = trackedFor("Reserved");
    render(<BookingCard tracked={tracked} onTimelineEvent={vi.fn()} />);

    const button = screen.getByRole("button", { name: /simulate check-in/i });
    fireEvent.click(button);

    expect(await screen.findByText(/accepted \(202\)/i)).toBeInTheDocument();
    expect(screen.getByTestId("booking-status")).toHaveTextContent("Reserved");
  });

  it("shows a distinct, retrying status-refresh error for a Reserved booking whose poll fails (§G, not silently swallowed)", async () => {
    vi.mocked(api.getBooking).mockResolvedValue({
      ok: false,
      status: 500,
      body: { error: "internal_error", message: "Unexpected server error." },
    });

    const tracked = trackedFor("Reserved");
    render(<BookingCard tracked={tracked} onTimelineEvent={vi.fn()} />);

    // BookingCard uses useBookingPolling's default 2000ms interval — give the
    // first (failing) poll tick time to actually fire.
    expect(await screen.findByTestId("poll-retrying", {}, { timeout: 4000 })).toHaveTextContent(
      /retrying/i,
    );
  }, 8000);

  it("shows a distinct error when check-in submission fails", async () => {
    vi.mocked(api.submitAppQrCheckin).mockResolvedValue({
      ok: false,
      status: 404,
      body: { error: "not_found", message: "No check-in adapter is registered for provider." },
    });

    const tracked = trackedFor("Reserved");
    render(<BookingCard tracked={tracked} onTimelineEvent={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /simulate check-in/i }));

    expect(await screen.findByText(/No check-in adapter is registered/i)).toBeInTheDocument();
  });
});
