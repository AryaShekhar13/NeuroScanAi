export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const supportedMimeTypes = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export type UploadPayload = {
  fileName: string;
  mimeType: string;
  base64: string;
};

export function isSupportedMimeType(mimeType: string) {
  return supportedMimeTypes.has(mimeType);
}

export function sanitizeFileName(fileName: string) {
  const normalized = fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "untitled-file";
}

export function decodeUpload(payload: UploadPayload) {
  if (!isSupportedMimeType(payload.mimeType)) {
    throw new Error("Unsupported file type. Upload a PDF, DOCX, TXT, Markdown, or CSV file.");
  }

  const decoded = Buffer.from(payload.base64, "base64");
  if (!decoded.length || decoded.length > MAX_UPLOAD_BYTES) {
    throw new Error("Files must be between 1 byte and 8 MB.");
  }

  return {
    fileName: sanitizeFileName(payload.fileName),
    bytes: decoded,
  };
}
