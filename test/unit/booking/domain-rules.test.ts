import { describe, expect, it } from "vitest";
import type { Clock } from "../../../src/shared/clock";
import {
  isBookableResourceStatus,
  isValidBookingDate,
  isWithinBookingWindow,
  officeLocalToday,
} from "../../../src/modules/booking/domain-rules";

class FakeClock implements Clock {
  constructor(private readonly instant: Date) {}
  now(): Date {
    return this.instant;
  }
}

describe("BR-01: bookings are for exactly one working day", () => {
  it("accepts a well-formed single calendar date", () => {
    expect(isValidBookingDate("2026-10-01")).toBe(true);
  });

  it.each([
    ["a date range", "2026-10-01/2026-10-05"],
    ["an empty string", ""],
    ["a non-date string", "not-a-date"],
    ["a malformed month", "2026-13-01"],
    ["a non-string value", 20261001],
    ["undefined", undefined],
    ["null", null],
  ])("rejects %s", (_label, value) => {
    expect(isValidBookingDate(value)).toBe(false);
  });
});

describe("BR-04: resource-status gating", () => {
  it("allows booking an Available resource", () => {
    expect(isBookableResourceStatus("Available")).toBe(true);
  });

  it.each(["Unavailable", "UnderMaintenance"] as const)("rejects a %s resource", (status) => {
    expect(isBookableResourceStatus(status)).toBe(false);
  });
});

describe("BR-03: booking window enforcement", () => {
  it("computes the office-local calendar date from the injected Clock", () => {
    // 2026-01-01T23:30:00Z is already 2026-01-02 in Europe/Belgrade (UTC+1 in winter).
    const clock = new FakeClock(new Date("2026-01-01T23:30:00.000Z"));
    expect(officeLocalToday(clock, "Europe/Belgrade")).toBe("2026-01-02");
    expect(officeLocalToday(clock, "UTC")).toBe("2026-01-01");
  });

  it("accepts today (the floor of the window)", () => {
    expect(isWithinBookingWindow("2026-10-01", "2026-10-01", 14)).toBe(true);
  });

  it("accepts the final day of the window (inclusive ceiling)", () => {
    expect(isWithinBookingWindow("2026-10-15", "2026-10-01", 14)).toBe(true);
  });

  it("rejects a date one day past the window", () => {
    expect(isWithinBookingWindow("2026-10-16", "2026-10-01", 14)).toBe(false);
  });

  it("rejects a date in the past relative to office-local today", () => {
    expect(isWithinBookingWindow("2026-09-30", "2026-10-01", 14)).toBe(false);
  });
});
