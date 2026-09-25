import { describe, expect, it } from "vitest";
import {
  parseCheckInEvent,
  isValidCheckInEvent,
  InvalidCheckInEventError,
} from "../../../src/modules/checkin-contract";

const VALID_EVENT = {
  sourceSystem: "app-qr",
  externalEventId: "evt-123",
  subjectReference: "booking-ref-456",
  occurredAt: "2026-01-10T08:00:00.000Z",
  receivedAt: "2026-01-10T08:00:01.000Z",
};

describe("CheckInEvent contract schema (AC-1)", () => {
  it("accepts a valid payload and returns the canonical shape", () => {
    const event = parseCheckInEvent(VALID_EVENT);
    expect(event).toEqual(VALID_EVENT);
    expect(isValidCheckInEvent(VALID_EVENT)).toBe(true);
  });

  it("rejects a non-object payload", () => {
    expect(() => parseCheckInEvent(null)).toThrow(InvalidCheckInEventError);
    expect(() => parseCheckInEvent("not-an-object")).toThrow(InvalidCheckInEventError);
    expect(isValidCheckInEvent(undefined)).toBe(false);
  });

  it.each([
    "sourceSystem",
    "externalEventId",
    "subjectReference",
    "occurredAt",
    "receivedAt",
  ] as const)("rejects a payload missing %s", (field) => {
    const rest: Record<string, string> = { ...VALID_EVENT };
    delete rest[field];
    expect(() => parseCheckInEvent(rest)).toThrow(InvalidCheckInEventError);
    expect(isValidCheckInEvent(rest)).toBe(false);
  });

  it("rejects a payload with a non-string field", () => {
    const invalid = { ...VALID_EVENT, sourceSystem: 42 };
    expect(() => parseCheckInEvent(invalid)).toThrow(InvalidCheckInEventError);
  });

  it("rejects a payload with an empty-string field", () => {
    const invalid = { ...VALID_EVENT, externalEventId: "" };
    expect(() => parseCheckInEvent(invalid)).toThrow(InvalidCheckInEventError);
  });

  it("rejects a payload with a non-timestamp occurredAt", () => {
    const invalid = { ...VALID_EVENT, occurredAt: "not-a-timestamp" };
    expect(() => parseCheckInEvent(invalid)).toThrow(InvalidCheckInEventError);
  });
});
