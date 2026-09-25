import { describe, expect, it } from "vitest";
import { testHarnessAdapter } from "../../../src/modules/checkin-ingress/adapters/test-harness.adapter";
import { InvalidCheckInEventError, isValidCheckInEvent } from "../../../src/modules/checkin-contract";

const VALID_PAYLOAD = {
  confirmationId: "confirmation-1",
  subjectRef: "resource-ref-321",
  confirmedAt: "2026-01-10T09:00:00.000Z",
};

describe("test-harness adapter contract (AC-3)", () => {
  it("translates a valid admin-confirmation payload into the canonical CheckInEvent shape", () => {
    const event = testHarnessAdapter.translate(VALID_PAYLOAD);

    expect(isValidCheckInEvent(event)).toBe(true);
    expect(event).toMatchObject({
      sourceSystem: "admin",
      externalEventId: VALID_PAYLOAD.confirmationId,
      subjectReference: VALID_PAYLOAD.subjectRef,
      occurredAt: VALID_PAYLOAD.confirmedAt,
    });
    expect(typeof event.receivedAt).toBe("string");
  });

  it.each(["confirmationId", "subjectRef", "confirmedAt"] as const)(
    "rejects a payload missing %s",
    (field) => {
      const payload: Record<string, string> = { ...VALID_PAYLOAD };
      delete payload[field];

      expect(() => testHarnessAdapter.translate(payload)).toThrow(InvalidCheckInEventError);
    },
  );

  it("validates its own demo credential independently of other adapters", () => {
    expect(testHarnessAdapter.validateCredential("test-harness-demo-secret")).toBe(true);
    expect(testHarnessAdapter.validateCredential("wrong-secret")).toBe(false);
    expect(testHarnessAdapter.validateCredential(undefined)).toBe(false);
  });
});
