import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { NotificationPanel } from "./NotificationPanel";
import * as api from "./api";
import type { NotificationSummary } from "./types";

vi.mock("./api");

function notification(overrides: Partial<NotificationSummary> = {}): NotificationSummary {
  return {
    id: "notif-1",
    type: "Confirmation",
    channel: "Teams",
    status: "Pending",
    attempts: 0,
    sentAt: null,
    ...overrides,
  };
}

describe("NotificationPanel (TASK-18 §E)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders Pending status from a mocked GET /bookings/:id/notifications response", async () => {
    vi.mocked(api.getBookingNotifications).mockResolvedValue({
      ok: true,
      status: 200,
      body: { notifications: [notification({ status: "Pending" })] },
    });

    render(
      <NotificationPanel
        bookingId="booking-1"
        ownerToken="dev-token-alice"
        bookingStatus="Reserved"
        onTerminalObserved={vi.fn()}
      />,
    );

    expect(await screen.findByTestId("notification-status-Confirmation")).toHaveTextContent(
      "Pending",
    );
  });

  it("renders Sending status distinctly, with the real attempts count", async () => {
    vi.mocked(api.getBookingNotifications).mockResolvedValue({
      ok: true,
      status: 200,
      body: { notifications: [notification({ status: "Sending", attempts: 2 })] },
    });

    render(
      <NotificationPanel
        bookingId="booking-1"
        ownerToken="dev-token-alice"
        bookingStatus="Reserved"
        onTerminalObserved={vi.fn()}
      />,
    );

    expect(await screen.findByTestId("notification-status-Confirmation")).toHaveTextContent(
      "Sending",
    );
    expect(screen.getByTestId("notification-table")).toHaveTextContent("2");
  });

  it("renders Sent status and fires onTerminalObserved exactly once", async () => {
    vi.mocked(api.getBookingNotifications).mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        notifications: [notification({ status: "Sent", attempts: 1, sentAt: "2026-09-25T08:00:00.000Z" })],
      },
    });

    const onTerminalObserved = vi.fn();
    render(
      <NotificationPanel
        bookingId="booking-1"
        ownerToken="dev-token-alice"
        bookingStatus="Reserved"
        onTerminalObserved={onTerminalObserved}
      />,
    );

    expect(await screen.findByTestId("notification-status-Confirmation")).toHaveTextContent("Sent");
    await waitFor(() => expect(onTerminalObserved).toHaveBeenCalledTimes(1));
    expect(onTerminalObserved).toHaveBeenCalledWith(expect.stringContaining("sent by the mocked provider"));
  });

  it("renders Failed status distinctly and fires onTerminalObserved", async () => {
    vi.mocked(api.getBookingNotifications).mockResolvedValue({
      ok: true,
      status: 200,
      body: { notifications: [notification({ status: "Failed", attempts: 5 })] },
    });

    const onTerminalObserved = vi.fn();
    render(
      <NotificationPanel
        bookingId="booking-1"
        ownerToken="dev-token-alice"
        bookingStatus="Reserved"
        onTerminalObserved={onTerminalObserved}
      />,
    );

    expect(await screen.findByTestId("notification-status-Confirmation")).toHaveTextContent(
      "Failed",
    );
    await waitFor(() => expect(onTerminalObserved).toHaveBeenCalledWith(expect.stringContaining("Failed")));
  });

  it("shows a manual refresh control once polling times out, and re-fetches and updates status on click", async () => {
    vi.mocked(api.getBookingNotifications).mockResolvedValue({
      ok: true,
      status: 200,
      body: { notifications: [notification({ status: "Pending" })] },
    });

    render(
      <NotificationPanel
        bookingId="booking-1"
        ownerToken="dev-token-alice"
        bookingStatus="Reserved"
        onTerminalObserved={vi.fn()}
        pollOptions={{ intervalMs: 5, timeoutMs: 15 }}
      />,
    );

    const refreshButton = await screen.findByTestId("refresh-notifications", {}, { timeout: 2000 });
    expect(screen.getByTestId("notification-status-Confirmation")).toHaveTextContent("Pending");

    vi.mocked(api.getBookingNotifications).mockResolvedValue({
      ok: true,
      status: 200,
      body: { notifications: [notification({ status: "Sent", attempts: 1 })] },
    });

    refreshButton.click();

    await waitFor(() =>
      expect(screen.getByTestId("notification-status-Confirmation")).toHaveTextContent("Sent"),
    );
    expect(screen.queryByTestId("refresh-notifications")).not.toBeInTheDocument();
  });
});
