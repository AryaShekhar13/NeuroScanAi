import { describe, expect, it } from "vitest";
import { REFERENCE_MRI_VOLUMES, clampSliceIndex, neighboringSliceIndices, nextSliceIndex, previousSliceIndex, referenceSliceBackground, sliceIndexForKey } from "./mriVolume";

describe("reference NIfTI MRI volume previews", () => {
  it("derives a shared 155-slice axial volume from the supplied study dimensions", () => {
    expect(Object.values(REFERENCE_MRI_VOLUMES).map((volume) => volume.totalSlices)).toEqual([155, 155, 155, 155]);
    expect(Object.values(REFERENCE_MRI_VOLUMES).map((volume) => volume.sourceDimensions)).toEqual([[240, 240, 155], [240, 240, 155], [240, 240, 155], [240, 240, 155]]);
    expect(REFERENCE_MRI_VOLUMES.t1.spriteUrl).toContain("brats-001-t1-axial-sprite_");
  });

  it("creates valid sprite positions for the first, representative, and final derived slice", () => {
    expect(referenceSliceBackground(REFERENCE_MRI_VOLUMES.t1, 0).backgroundPosition).toBe("0% 0%");
    expect(referenceSliceBackground(REFERENCE_MRI_VOLUMES.t1, 77).backgroundPosition).toBe("50% 50%");
    expect(referenceSliceBackground(REFERENCE_MRI_VOLUMES.t1, 154).backgroundPosition).toBe("100% 100%");
  });

  it("clamps button and keyboard navigation to the first and last slice", () => {
    expect(previousSliceIndex(0, 155)).toBe(0);
    expect(nextSliceIndex(154, 155)).toBe(154);
    expect(clampSliceIndex(-4, 155)).toBe(0);
    expect(clampSliceIndex(181, 155)).toBe(154);
    expect(sliceIndexForKey("Home", 77, 155)).toBe(0);
    expect(sliceIndexForKey("End", 77, 155)).toBe(154);
  });

  it("returns only the current and immediate neighboring slices for preload", () => {
    expect(neighboringSliceIndices(0, 155)).toEqual([0, 1]);
    expect(neighboringSliceIndices(77, 155)).toEqual([76, 77, 78]);
    expect(neighboringSliceIndices(154, 155)).toEqual([153, 154]);
  });
});
