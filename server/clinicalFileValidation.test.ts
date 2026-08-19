import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { decodeClinicalUpload, detectMriModality, inspectClinicalUploads, MAX_DECOMPRESSED_NIFTI_BYTES } from "./clinicalFileValidation";

function niftiFixture() {
  const bytes = Buffer.alloc(352);
  bytes.writeInt32LE(348, 0);
  bytes.writeInt16LE(3, 40); bytes.writeInt16LE(64, 42); bytes.writeInt16LE(64, 44); bytes.writeInt16LE(32, 46);
  bytes.writeFloatLE(1, 80); bytes.writeFloatLE(1, 84); bytes.writeFloatLE(1.5, 88);
  bytes.write("n+1\0", 344, "latin1");
  return bytes;
}
function upload(name: string, bytes = niftiFixture()) { return { fileName: name, mimeType: "application/octet-stream", base64: bytes.toString("base64") }; }

describe("hardened clinical NIfTI validation", () => {
  it("validates an actual NIfTI header, calculates a checksum, and detects a tokenized modality", () => {
    const result = decodeClinicalUpload(upload("BraTS_001_t1.nii.gz", gzipSync(niftiFixture())));
    expect(result.modality).toBe("t1"); expect(result.checksum).toHaveLength(64); expect(result.metadata.dimensions).toEqual([64, 64, 32]);
  });
  it("accepts a bounded gzip-compressed NIfTI payload", () => {
    const bytes = gzipSync(niftiFixture()); const result = decodeClinicalUpload(upload("BRATS-001-T1ce.nii.gz", bytes));
    expect(result.modality).toBe("t1ce"); expect(result.uncompressedSize).toBe(352);
  });
  it("rejects a renamed executable, malformed header, and unrecognized modality", () => {
    expect(() => decodeClinicalUpload(upload("brain_t2.nii.gz", Buffer.from("not a gzip")))).toThrow("File validation failed");
    expect(() => decodeClinicalUpload(upload("brain_unknown.nii.gz", gzipSync(niftiFixture())))).toThrow("modality");
    expect(() => decodeClinicalUpload({ fileName: "malware.exe", mimeType: "application/octet-stream", base64: Buffer.from("MZ").toString("base64") })).toThrow("Unsupported file");
    expect(() => decodeClinicalUpload(upload("scan_t1.nii"))).toThrow("Unsupported file");
    expect(() => decodeClinicalUpload({ ...upload("scan_t1.nii.gz", gzipSync(niftiFixture())), mimeType: "application/x-msdownload" })).toThrow("File validation failed");
  });
  it("recognizes guarded naming aliases without naïve arbitrary substring matching", () => {
    expect(detectMriModality("scan_t2_flair.nii.gz")).toBe("flair"); expect(detectMriModality("patient_t1_gd.nii.gz")).toBe("t1ce"); expect(detectMriModality("att1ck.nii.gz")).toBeNull();
  });
  it("reports duplicate and missing modalities before a study is saved", () => {
    const result = inspectClinicalUploads([upload("a_t1.nii.gz", gzipSync(niftiFixture())), upload("b_t1.nii.gz", gzipSync(Buffer.concat([niftiFixture(), Buffer.from([1])]))), upload("a_t2.nii.gz", gzipSync(Buffer.concat([niftiFixture(), Buffer.from([2])])))]);
    expect(result.duplicates).toEqual(["t1"]); expect(result.missing).toEqual(["t1ce", "flair"]); expect(result.complete).toBe(false);
  });
  it("preserves nested folder context and rejects decompression payloads beyond the configured limit", () => {
    const nested = decodeClinicalUpload({ ...upload("BraTS_001_t2.nii.gz", gzipSync(niftiFixture())), relativePath: "study/session-01/BraTS_001_t2.nii.gz" });
    expect(nested.relativePath).toBe("study/session-01/BraTS_001_t2.nii.gz");
    const oversized = Buffer.alloc(MAX_DECOMPRESSED_NIFTI_BYTES + 1); oversized.writeInt32LE(348, 0); oversized.write("n+1\0", 344, "latin1");
    expect(() => decodeClinicalUpload(upload("large_flair.nii.gz", gzipSync(oversized)))).toThrow("File validation failed");
  });
});
