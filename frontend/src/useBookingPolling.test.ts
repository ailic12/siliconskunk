import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useBookingPolling } from "./useBookingPolling";
import * as api from "./api";
import type { BookingWithDeadline } from "./types";

vi.mock("./api");

const RESERVED: BookingWithDeadline = {
  id: "booking-1",
  resourceId: "resource-1",
  employeeId: "employee-1",
  bookingDate: "2026-10-01",
  resourceType: "Desk",
  status: "Reserved",
  createdAt: "2026-09-25T00:00:00.000Z",
  checkInDeadline: "2026-10-02T08:00:00.000Z",
};

describe("useBookingPolling (TASK-17 §E, bounded polling timeout)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("stops polling and reports a distinct timeout state when the booking never settles in time", async () => {
    vi.mocked(api.getBooking).mockResolvedValue({ ok: true, status: 200, body: RESERVED });

    const { result } = renderHook(() =>
      useBookingPolling("booking-1", "dev-token-alice", RESERVED, {
        intervalMs: 5,
        timeoutMs: 15,
      }),
    );

    expect(result.current.pollState).toBe("polling");

    await waitFor(() => expect(result.current.pollState).toBe("timeout"), { timeout: 2000 });
    expect(result.current.booking.status).toBe("Reserved");
  });

  it("settles as soon as a live poll observes a terminal status, without waiting for the timeout", async () => {
    vi.mocked(api.getBooking).mockResolvedValue({
      ok: true,
      status: 200,
      body: { ...RESERVED, status: "CheckedIn" },
    });

    const { result } = renderHook(() =>
      useBookingPolling("booking-1", "dev-token-alice", RESERVED, {
        intervalMs: 5,
        timeoutMs: 5000,
      }),
    );

    await waitFor(() => expect(result.current.pollState).toBe("settled"), { timeout: 2000 });
    expect(result.current.booking.status).toBe("CheckedIn");
  });

  it("reports a distinct, retrying error state on a status-refresh failure, not a silent stop", async () => {
    vi.mocked(api.getBooking).mockResolvedValue({
      ok: false,
      status: 500,
      body: { error: "internal_error", message: "Unexpected server error." },
    });

    const { result } = renderHook(() =>
      useBookingPolling("booking-1", "dev-token-alice", RESERVED, {
        intervalMs: 100,
        timeoutMs: 5000,
      }),
    );

    await waitFor(() => expect(result.current.pollState).toBe("error"), {
      timeout: 2000,
      interval: 5,
    });
    expect(result.current.errorMessage).toMatch(/Unexpected server error/);
    expect(result.current.retrying).toBe(true);
  });

  it("recovers and resumes polling after a single transient failure (retry/backoff, §G)", async () => {
    vi.mocked(api.getBooking)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        body: { error: "internal_error", message: "Unexpected server error." },
      })
      .mockResolvedValue({ ok: true, status: 200, body: { ...RESERVED, status: "CheckedIn" } });

    const { result } = renderHook(() =>
      useBookingPolling("booking-1", "dev-token-alice", RESERVED, {
        intervalMs: 100,
        timeoutMs: 5000,
      }),
    );

    await waitFor(() => expect(result.current.pollState).toBe("error"), {
      timeout: 2000,
      interval: 5,
    });
    expect(result.current.retrying).toBe(true);

    await waitFor(() => expect(result.current.pollState).toBe("settled"), { timeout: 2000 });
    expect(result.current.booking.status).toBe("CheckedIn");
  });

  it("gives up (retrying: false) after repeated consecutive failures, without ever settling silently", async () => {
    vi.mocked(api.getBooking).mockResolvedValue({
      ok: false,
      status: 500,
      body: { error: "internal_error", message: "Unexpected server error." },
    });

    const { result } = renderHook(() =>
      useBookingPolling("booking-1", "dev-token-alice", RESERVED, {
        intervalMs: 30,
        timeoutMs: 5000,
      }),
    );

    await waitFor(() => expect(result.current.retrying).toBe(false), { timeout: 2000 });
    expect(result.current.pollState).toBe("error");
    expect(vi.mocked(api.getBooking).mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});
