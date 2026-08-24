import { describe, expect, it } from "vitest";
import { completeGuestScanAfterSuccessfulInference } from "./guestScanFlow";

describe("guest scan completion handoff", () => {
  it("records completion only after inference succeeds", async () => {
    const events: string[] = [];
    const result = await completeGuestScanAfterSuccessfulInference(async () => { events.push("inference"); return { mask: "prediction.nii.gz" }; }, async () => { events.push("completion"); });
    expect(result).toEqual({ mask: "prediction.nii.gz" });
    expect(events).toEqual(["inference", "completion"]);
  });

  it("does not consume guest access if inference fails", async () => {
    const completion = async () => { throw new Error("must not execute"); };
    await expect(completeGuestScanAfterSuccessfulInference(async () => { throw new Error("inference unavailable"); }, completion)).rejects.toThrow("inference unavailable");
  });
});
