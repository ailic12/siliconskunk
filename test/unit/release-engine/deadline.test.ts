import { describe, expect, it } from "vitest";
import { computeEffectiveDeadline } from "../../../src/modules/release-engine/deadline";

describe("Release Engine: effective deadline computation (AC-3)", () => {
  it("computes the UTC instant for a fixed-offset zone with no DST (Asia/Singapore, UTC+8)", () => {
    const deadline = computeEffectiveDeadline("2026-01-10", "10:00:00", "Asia/Singapore");
    expect(deadline.toISOString()).toBe("2026-01-10T02:00:00.000Z");
  });

  it("computes the UTC instant for UTC itself (zero offset)", () => {
    const deadline = computeEffectiveDeadline("2026-01-10", "10:00:00", "UTC");
    expect(deadline.toISOString()).toBe("2026-01-10T10:00:00.000Z");
  });

  it("uses the CET offset (UTC+1) the day before Europe/Belgrade's 2026 spring-forward", () => {
    // 2026-03-29 is the last Sunday of March: Europe/Belgrade switches from
    // CET (UTC+1) to CEST (UTC+2) at 01:00 UTC that day. The day before is
    // still CET.
    const deadline = computeEffectiveDeadline("2026-03-28", "10:00:00", "Europe/Belgrade");
    expect(deadline.toISOString()).toBe("2026-03-28T09:00:00.000Z");
  });

  it("uses the CEST offset (UTC+2) on Europe/Belgrade's 2026 spring-forward date itself", () => {
    // Same office-local deadline of 10:00, but the transition to CEST has
    // already happened earlier that morning (01:00 UTC), so the effective
    // deadline instant is one hour earlier in UTC than the day before.
    const deadline = computeEffectiveDeadline("2026-03-29", "10:00:00", "Europe/Belgrade");
    expect(deadline.toISOString()).toBe("2026-03-29T08:00:00.000Z");
  });

  it("uses the CEST offset (UTC+2) well after the spring-forward, in summer", () => {
    const deadline = computeEffectiveDeadline("2026-07-15", "10:00:00", "Europe/Belgrade");
    expect(deadline.toISOString()).toBe("2026-07-15T08:00:00.000Z");
  });

  it("correctly computes the demo-scoped short deadline (00:05:00)", () => {
    const deadline = computeEffectiveDeadline("2026-01-10", "00:05:00", "Europe/Belgrade");
    expect(deadline.toISOString()).toBe("2026-01-09T23:05:00.000Z");
  });
});
