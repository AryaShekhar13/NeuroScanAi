import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, decodeUpload, sanitizeFileName } from "./fileValidation";

describe("file upload validation", () => {
  it("retains a readable safe filename and decodes a supported text upload", () => {
    const result = decodeUpload({
      fileName: "Q3 research brief!.md",
      mimeType: "text/markdown",
      base64: Buffer.from("Dala source material").toString("base64"),
    });

    expect(result.fileName).toBe("Q3-research-brief-.md");
    expect(result.bytes.toString()).toBe("Dala source material");
  });

  it("rejects a file type outside the workspace allow-list", () => {
    expect(() =>
      decodeUpload({
        fileName: "archive.zip",
        mimeType: "application/zip",
        base64: Buffer.from("archive").toString("base64"),
      }),
    ).toThrow("Unsupported file type");
  });

  it("rejects decoded payloads larger than the configured size limit", () => {
    expect(() =>
      decodeUpload({
        fileName: "oversized.txt",
        mimeType: "text/plain",
        base64: Buffer.alloc(MAX_UPLOAD_BYTES + 1).toString("base64"),
      }),
    ).toThrow("Files must be between 1 byte and 8 MB");
  });

  it("normalizes dangerous path separators", () => {
    expect(sanitizeFileName("../../meeting notes.pdf")).toBe("..-..-meeting-notes.pdf");
  });
});
