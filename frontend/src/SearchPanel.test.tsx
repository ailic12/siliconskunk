import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SearchPanel } from "./SearchPanel";
import * as api from "./api";
import type { Booking, BookingWithDeadline, Resource } from "./types";

vi.mock("./api");

const RESOURCE: Resource = {
  id: "resource-1",
  officeId: "00000000-0000-4000-8000-000000000001",
  type: "Desk",
  name: "Desk 1",
  status: "Available",
};

const BOOKING: Booking = {
  id: "booking-1",
  resourceId: RESOURCE.id,
  employeeId: "employee-1",
  bookingDate: "2026-10-01",
  resourceType: "Desk",
  status: "Reserved",
  createdAt: "2026-09-25T00:00:00.000Z",
};

const BOOKING_WITH_DEADLINE: BookingWithDeadline = {
  ...BOOKING,
  checkInDeadline: "2026-10-01T08:00:00.000Z",
};

describe("SearchPanel (TASK-17 §A, booking creation rendering)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders an error message when availability search fails", async () => {
    vi.mocked(api.getAvailability).mockResolvedValue({
      ok: false,
      status: 400,
      body: { error: "bad_request", message: "date must be an ISO calendar date (YYYY-MM-DD)." },
    });

    render(<SearchPanel onBooked={vi.fn()} onTimelineEvent={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /search availability/i }));

    expect(await screen.findByText(/date must be an ISO calendar date/i)).toBeInTheDocument();
  });

  it("renders available resources and lets the presenter book one, reporting success", async () => {
    vi.mocked(api.getAvailability).mockResolvedValue({
      ok: true,
      status: 200,
      body: { resources: [RESOURCE] },
    });
    vi.mocked(api.createBooking).mockResolvedValue({ ok: true, status: 201, body: BOOKING });
    vi.mocked(api.getBooking).mockResolvedValue({
      ok: true,
      status: 200,
      body: BOOKING_WITH_DEADLINE,
    });

    const onBooked = vi.fn();
    render(<SearchPanel onBooked={onBooked} onTimelineEvent={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /search availability/i }));

    expect(await screen.findByText("Desk 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /book/i }));

    expect(await screen.findByText(/Reserved: Desk 1/i)).toBeInTheDocument();
    await waitFor(() => expect(onBooked).toHaveBeenCalledWith(
      expect.objectContaining({ booking: BOOKING_WITH_DEADLINE, resourceName: "Desk 1" }),
    ));
  });

  it("maps a booking conflict (409) to the existing distinguishable error message, not a raw dump", async () => {
    vi.mocked(api.getAvailability).mockResolvedValue({
      ok: true,
      status: 200,
      body: { resources: [RESOURCE] },
    });
    vi.mocked(api.createBooking).mockResolvedValue({
      ok: false,
      status: 409,
      body: {
        error: "conflict",
        reason: "resource_already_booked",
        message: "This resource already has an active booking for that date.",
      },
    });

    render(<SearchPanel onBooked={vi.fn()} onTimelineEvent={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /search availability/i }));
    expect(await screen.findByText("Desk 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /book/i }));

    expect(
      await screen.findByText(/Someone already booked that resource for this date/i),
    ).toBeInTheDocument();
  });

  it("shows a distinct message when the backend is unreachable (network failure)", async () => {
    vi.mocked(api.getAvailability).mockRejectedValue(new TypeError("Failed to fetch"));

    render(<SearchPanel onBooked={vi.fn()} onTimelineEvent={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /search availability/i }));

    expect(await screen.findByText(/Backend unavailable/i)).toBeInTheDocument();
  });
});
