import { describe, expect, it } from "vitest";
import { createDerivedPngArtifact } from "./niftiPreview";

describe("derived NIfTI PNG preview contract", () => {
  it("encodes an exported PNG only from a canvas artifact and marks it as derived", () => {
    const artifact = createDerivedPngArtifact({ toDataURL: (type) => { expect(type).toBe("image/png"); return "data:image/png;base64,AAAA"; } }, "subject_t1.nii.gz", 14);
    expect(artifact).toEqual({ dataUrl: "data:image/png;base64,AAAA", fileName: "derived-subject_t1-slice-15.png", mediaType: "image/png", provenance: "derived-from-nifti" });
  });

  it("rejects a non-PNG canvas export rather than mislabeling it as a preview", () => {
    expect(() => createDerivedPngArtifact({ toDataURL: () => "data:image/jpeg;base64,AAAA" }, "subject_t1.nii.gz", 0)).toThrow("could not create a PNG");
  });
});
