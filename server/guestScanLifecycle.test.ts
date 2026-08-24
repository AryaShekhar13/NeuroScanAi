import { describe, expect, it } from "vitest";
import { canConsumeGuestScanAfterCompletion, getGuestScanStatus } from "./guestScanLifecycle";

describe("guest scan lifecycle", () => {
  it("keeps a first-time visitor eligible when a durable visitor record exists but no scan has completed", () => {
    expect(getGuestScanStatus(null)).toEqual({ guestScanCompleted: false, canStartGuestScan: true });
    expect(canConsumeGuestScanAfterCompletion(false, null)).toBe(false);
  });

  it("allows consumption only after a successful scan and preserves the completed state across later status checks", () => {
    const completedAt = new Date("2026-08-24T00:00:00.000Z");
    expect(canConsumeGuestScanAfterCompletion(true, null)).toBe(true);
    expect(getGuestScanStatus(completedAt)).toEqual({ guestScanCompleted: true, canStartGuestScan: false });
    expect(canConsumeGuestScanAfterCompletion(true, completedAt)).toBe(false);
  });
});
