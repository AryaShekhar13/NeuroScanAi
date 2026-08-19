import { describe, expect, it } from "vitest";
import { SYNTHETIC_DEMO_SLICE_URLS, clampSliceIndex, neighboringSliceIndices, nextSliceIndex, previousSliceIndex, sliceIndexForKey } from "./mriVolume";

describe("synthetic MRI slice volume", () => {
  it("keeps the supplied sequence in strict numeric order from 001 through 060", () => {
    expect(SYNTHETIC_DEMO_SLICE_URLS).toHaveLength(60);
    expect(new Set(SYNTHETIC_DEMO_SLICE_URLS)).toHaveLength(60);
    expect(SYNTHETIC_DEMO_SLICE_URLS.every((url) => /^\/manus-storage\/slice_\d{3}_[a-f0-9]{8}\.png$/.test(url))).toBe(true);
    expect(SYNTHETIC_DEMO_SLICE_URLS[0]).toContain("slice_001_");
    expect(SYNTHETIC_DEMO_SLICE_URLS[52]).toBe("/manus-storage/slice_053_89b0a804.png");
    expect(SYNTHETIC_DEMO_SLICE_URLS[59]).toContain("slice_060_");
    expect(SYNTHETIC_DEMO_SLICE_URLS.map((url) => Number(url.match(/slice_(\d{3})_/)?.[1]))).toEqual(Array.from({ length: 60 }, (_, index) => index + 1));
  });

  it("clamps button and keyboard navigation to the first and last slice", () => {
    expect(previousSliceIndex(0, 60)).toBe(0);
    expect(nextSliceIndex(59, 60)).toBe(59);
    expect(clampSliceIndex(-4, 60)).toBe(0);
    expect(clampSliceIndex(81, 60)).toBe(59);
    expect(sliceIndexForKey("Home", 22, 60)).toBe(0);
    expect(sliceIndexForKey("End", 22, 60)).toBe(59);
  });

  it("returns only the current and immediate neighboring slices for preload", () => {
    expect(neighboringSliceIndices(0, 60)).toEqual([0, 1]);
    expect(neighboringSliceIndices(24, 60)).toEqual([23, 24, 25]);
    expect(neighboringSliceIndices(59, 60)).toEqual([58, 59]);
  });
});
