import { describe, expect, it } from "vitest";
import { getRevealDelay } from "./scrollReveal";

describe("getRevealDelay", () => {
  it("accepts safe non-negative millisecond values", () => {
    expect(getRevealDelay("140")).toBe(140);
  });

  it("normalizes invalid and excessive values", () => {
    expect(getRevealDelay("-4")).toBe(0);
    expect(getRevealDelay(undefined)).toBe(0);
    expect(getRevealDelay("900")).toBe(600);
  });
});
