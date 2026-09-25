import { describe, expect, it } from "vitest";
import { appQrAdapter } from "../../../src/modules/checkin-ingress/adapters/app-qr.adapter";
import { InvalidCheckInEventError, isValidCheckInEvent } from "../../../src/modules/checkin-contract";

const VALID_PAYLOAD = {
  eventId: "app-qr-evt-1",
  bookingReference: "booking-ref-789",
  employeeBadge: "badge-42",
  scannedAt: "2026-01-10T08:00:00.000Z",
};

describe("app-qr adapter contract (AC-3)", () => {
  it("translates a valid app/QR payload into the canonical CheckInEvent shape", () => {
    const event = appQrAdapter.translate(VALID_PAYLOAD);

    expect(isValidCheckInEvent(event)).toBe(true);
    expect(event).toMatchObject({
      sourceSystem: "app-qr",
      externalEventId: VALID_PAYLOAD.eventId,
      subjectReference: VALID_PAYLOAD.bookingReference,
      occurredAt: VALID_PAYLOAD.scannedAt,
    });
    expect(typeof event.receivedAt).toBe("string");
  });

  it.each(["eventId", "bookingReference", "scannedAt"] as const)(
    "rejects a payload missing %s",
    (field) => {
      const payload: Record<string, string> = { ...VALID_PAYLOAD };
      delete payload[field];

      expect(() => appQrAdapter.translate(payload)).toThrow(InvalidCheckInEventError);
    },
  );

  it("validates its own demo credential independently of other adapters", () => {
    expect(appQrAdapter.validateCredential("app-qr-demo-secret")).toBe(true);
    expect(appQrAdapter.validateCredential("wrong-secret")).toBe(false);
    expect(appQrAdapter.validateCredential(undefined)).toBe(false);
  });
});
