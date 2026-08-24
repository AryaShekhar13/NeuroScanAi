import { describe, expect, it } from "vitest";
import { getInferenceApiBaseUrl, parseNiftiSegmentationResponse } from "./inferenceApi";

describe("configured inference API", () => {
  it("provides an HTTPS inference base URL", () => {
    const baseUrl = process.env.VITE_INFERENCE_API_BASE;
    expect(baseUrl).toMatch(/^https:\/\//);
  });

  it("derives the documented health endpoint without requiring a live service", () => {
    const baseUrl = process.env.VITE_INFERENCE_API_BASE;
    expect(new URL("/health", baseUrl).toString()).toMatch(/^https:\/\/.+\/health$/);
  });

  it("uses the required public endpoint for the browser-side inference client", () => {
    expect(getInferenceApiBaseUrl()).toBe(process.env.VITE_INFERENCE_API_BASE);
  });

  it("requires a compressed NIfTI mask payload and never accepts a PNG visualization as the authoritative result", () => {
    const result = parseNiftiSegmentationResponse({ status: "success", segmentation_nifti: { file_name: "prediction.nii.gz", content_type: "application/gzip", base64: "H4sIAAAAAAAA" } });
    expect(result.segmentation_nifti.file_name).toBe("prediction.nii.gz");
    expect(() => parseNiftiSegmentationResponse({ status: "success", visualization: { data_url: "data:image/png;base64,AAAA" } })).toThrow("authoritative compressed NIfTI");
  });
});
