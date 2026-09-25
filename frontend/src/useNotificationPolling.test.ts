import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useNotificationPolling } from "./useNotificationPolling";
import * as api from "./api";
import type { NotificationSummary } from "./types";

vi.mock("./api");

const SENT_CONFIRMATION: NotificationSummary = {
  id: "notif-1",
  type: "Confirmation",
  channel: "Teams",
  status: "Sent",
  attempts: 1,
  sentAt: "2026-09-25T08:00:00.000Z",
};

const PENDING_RELEASE_NOTICE: NotificationSummary = {
  id: "notif-2",
  type: "ReleaseNotice",
  channel: "Teams",
  status: "Pending",
  attempts: 0,
  sentAt: null,
};

const SENT_RELEASE_NOTICE: NotificationSummary = { ...PENDING_RELEASE_NOTICE, status: "Sent" };

describe("useNotificationPolling (TASK-18 §E)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it(
    "resumes polling when bookingStatus transitions to Released, even after already settling on Sent — " +
      "and renders the newly-created ReleaseNotice row once the backend reports it",
    async () => {
      vi.mocked(api.getBookingNotifications).mockResolvedValue({
        ok: true,
        status: 200,
        body: { notifications: [SENT_CONFIRMATION] },
      });

      interface Props {
        bookingStatus: "Reserved" | "Released";
      }

      const { result, rerender } = renderHook(
        ({ bookingStatus }: Props) =>
          useNotificationPolling("booking-1", "dev-token-alice", bookingStatus, {
            intervalMs: 5,
            timeoutMs: 500,
          }),
        { initialProps: { bookingStatus: "Reserved" } as Props },
      );

      await waitFor(() => expect(result.current.pollState).toBe("settled"));
      expect(result.current.notifications).toEqual([SENT_CONFIRMATION]);

      // The tracked booking's own poll (useBookingPolling) now reports
      // Released — the release sweep has just created the ReleaseNotice row.
      vi.mocked(api.getBookingNotifications).mockResolvedValue({
        ok: true,
        status: 200,
        body: { notifications: [SENT_CONFIRMATION, PENDING_RELEASE_NOTICE] },
      });

      rerender({ bookingStatus: "Released" });

      await waitFor(() =>
        expect(result.current.notifications).toEqual([SENT_CONFIRMATION, PENDING_RELEASE_NOTICE]),
      );
      expect(result.current.pollState).toBe("polling");

      vi.mocked(api.getBookingNotifications).mockResolvedValue({
        ok: true,
        status: 200,
        body: { notifications: [SENT_CONFIRMATION, SENT_RELEASE_NOTICE] },
      });

      await waitFor(() => expect(result.current.pollState).toBe("settled"));
      expect(result.current.notifications).toEqual([SENT_CONFIRMATION, SENT_RELEASE_NOTICE]);
    },
  );

  it("the manual refresh() control forces a fetch and updates status after a timeout", async () => {
    vi.mocked(api.getBookingNotifications).mockResolvedValue({
      ok: true,
      status: 200,
      body: { notifications: [PENDING_RELEASE_NOTICE] },
    });

    const { result } = renderHook(() =>
      useNotificationPolling("booking-2", "dev-token-alice", "Reserved", {
        intervalMs: 5,
        timeoutMs: 15,
      }),
    );

    await waitFor(() => expect(result.current.pollState).toBe("timeout"), { timeout: 2000 });
    expect(result.current.notifications).toEqual([PENDING_RELEASE_NOTICE]);

    vi.mocked(api.getBookingNotifications).mockResolvedValue({
      ok: true,
      status: 200,
      body: { notifications: [{ ...PENDING_RELEASE_NOTICE, status: "Sent" }] },
    });

    result.current.refresh();

    await waitFor(() =>
      expect(result.current.notifications).toEqual([{ ...PENDING_RELEASE_NOTICE, status: "Sent" }]),
    );
    expect(result.current.pollState).toBe("settled");
  });
});
