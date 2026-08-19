import { describe, expect, it } from "vitest";
import { decodeClinicalUpload } from "./clinicalFileValidation";

describe("clinical MRI upload validation", () => {
  it("accepts a supported DICOM payload without persisting bytes in the database", () => {
    const result = decodeClinicalUpload({ fileName: "study-001.dcm", mimeType: "application/dicom", base64: Buffer.from("MRI").toString("base64") });
    expect(result.fileName).toBe("study-001.dcm");
    expect(result.bytes.toString()).toBe("MRI");
  });

  it("rejects non-MRI file extensions", () => {
    expect(() => decodeClinicalUpload({ fileName: "report.pdf", mimeType: "application/pdf", base64: Buffer.from("not-mri").toString("base64") })).toThrow("DICOM");
  });
});
