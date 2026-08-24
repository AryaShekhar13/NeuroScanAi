import { describe, expect, it } from "vitest";
import { encodeNiftiForServer, parseNiftiSegmentationResponse } from "./inferenceApi";

describe("server-managed inference contract", () => {
  it("serializes NIfTI bytes for the application server without exposing an upstream URL", async () => {
    const encoded = await encodeNiftiForServer(new File([new Uint8Array([1, 2, 3])], "study.nii.gz", { type: "application/gzip" }));
    expect(encoded).toEqual({ fileName: "study.nii.gz", mimeType: "application/gzip", base64: "AQID" });
  });

  it("requires a compressed NIfTI mask payload and never accepts a PNG visualization as the authoritative result", () => {
    const result = parseNiftiSegmentationResponse({ status: "success", segmentation_nifti: { file_name: "prediction.nii.gz", content_type: "application/gzip", base64: "H4sIAAAAAAAA" } });
    expect(result.segmentation_nifti.file_name).toBe("prediction.nii.gz");
    expect(() => parseNiftiSegmentationResponse({ status: "success", visualization: { data_url: "data:image/png;base64,AAAA" } })).toThrow("authoritative compressed NIfTI");
  });
});
