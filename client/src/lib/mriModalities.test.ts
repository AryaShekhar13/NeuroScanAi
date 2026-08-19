import { describe, expect, it } from "vitest";
import { MRI_MODALITIES } from "./mriModalities";

describe("MRI modality tabs", () => {
  it("exposes the four requested MRI modality labels in clinical review order", () => {
    expect(MRI_MODALITIES.map((modality) => modality.label)).toEqual(["T1", "T1CE", "T2", "FLAIR"]);
  });

  it("keeps each tab associated with concise non-diagnostic review context", () => {
    expect(MRI_MODALITIES.every((modality) => modality.detail.length > 20)).toBe(true);
    expect(MRI_MODALITIES.some((modality) => /diagnos/i.test(modality.detail))).toBe(false);
  });
});
