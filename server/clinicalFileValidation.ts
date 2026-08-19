import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";

export const MRI_MODALITIES = ["t1", "t1ce", "t2", "flair"] as const;
export type MriModality = typeof MRI_MODALITIES[number];
export type ClinicalUploadPayload = { fileName: string; mimeType: string; base64: string; relativePath?: string };

const FALLBACK_SINGLE_FILE_LIMIT = 8 * 1024 * 1024;
const FALLBACK_STUDY_LIMIT = 32 * 1024 * 1024;
const FALLBACK_FOLDER_LIMIT = 200;

function positiveEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function uploadLimits() {
  return {
    maxSingleFileSize: positiveEnv("MAX_SINGLE_FILE_SIZE", FALLBACK_SINGLE_FILE_LIMIT),
    maxStudySize: positiveEnv("MAX_STUDY_SIZE", FALLBACK_STUDY_LIMIT),
    maxFolderFiles: positiveEnv("MAX_FOLDER_FILES", FALLBACK_FOLDER_LIMIT),
  };
}

export function cleanClinicalFileName(fileName: string) {
  const baseName = fileName.replace(/\\/g, "/").split("/").pop() || "";
  const cleaned = baseName.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return cleaned || "mri-upload.nii";
}

export function cleanRelativePath(relativePath?: string) {
  if (!relativePath) return null;
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")) return null;
  return normalized.slice(0, 512) || null;
}

export function isNiftiFilename(fileName: string) {
  const lower = fileName.toLowerCase();
  return lower.endsWith(".nii") || lower.endsWith(".nii.gz");
}

export function detectMriModality(fileName: string): MriModality | null {
  const withoutExtension = fileName.toLowerCase().replace(/\.nii(?:\.gz)?$/, "");
  const tokens = withoutExtension.split(/[^a-z0-9]+/).filter(Boolean);
  const has = (value: string) => tokens.includes(value);
  if (has("flair") || (has("t2") && has("flair"))) return "flair";
  if (has("t1ce") || has("t1c") || has("t1gd") || (has("t1") && (has("gd") || has("ce")))) return "t1ce";
  if (has("t2") || has("t2w") || (has("t2") && has("weighted"))) return "t2";
  if (has("t1") || has("t1w") || (has("t1") && has("weighted"))) return "t1";
  return null;
}

function isNiftiHeader(bytes: Buffer) {
  if (bytes.length < 352) return false;
  const littleEndian = bytes.readInt32LE(0) === 348;
  const bigEndian = bytes.readInt32BE(0) === 348;
  if (!littleEndian && !bigEndian) return false;
  const magic = bytes.subarray(344, 348).toString("latin1");
  return magic.startsWith("n+1") || magic.startsWith("ni1");
}

function parseNiftiMetadata(bytes: Buffer) {
  const littleEndian = bytes.readInt32LE(0) === 348;
  const readInt16 = (offset: number) => littleEndian ? bytes.readInt16LE(offset) : bytes.readInt16BE(offset);
  const readFloat = (offset: number) => littleEndian ? bytes.readFloatLE(offset) : bytes.readFloatBE(offset);
  const dimensions = [readInt16(42), readInt16(44), readInt16(46)].filter((value) => value > 0);
  const voxelSpacing = [readFloat(80), readFloat(84), readFloat(88)].filter((value) => Number.isFinite(value) && value > 0);
  return { format: "NIfTI-1", dimensions, voxelSpacing, orientation: littleEndian ? "little-endian" : "big-endian" };
}

export function decodeClinicalUpload(payload: ClinicalUploadPayload) {
  const fileName = cleanClinicalFileName(payload.fileName);
  if (!isNiftiFilename(fileName)) throw new Error("Unsupported file. Only NIfTI (.nii, .nii.gz) MRI files are accepted.");
  const allowedMimeTypes = new Set(["", "application/octet-stream", "application/x-nifti", "application/gzip", "application/x-gzip"]);
  if (!allowedMimeTypes.has(payload.mimeType.toLowerCase())) throw new Error("File validation failed.");
  if (!/^[A-Za-z0-9+/=]+$/.test(payload.base64)) throw new Error("File validation failed.");
  const compressedBytes = Buffer.from(payload.base64, "base64");
  const { maxSingleFileSize } = uploadLimits();
  if (!compressedBytes.length || compressedBytes.length > maxSingleFileSize) throw new Error("This MRI file exceeds the configured upload limit.");
  const compressed = fileName.toLowerCase().endsWith(".nii.gz");
  let niftiBytes: Uint8Array = compressedBytes;
  try {
    if (compressed) {
      if (compressedBytes[0] !== 0x1f || compressedBytes[1] !== 0x8b) throw new Error("not gzip");
      niftiBytes = gunzipSync(compressedBytes, { maxOutputLength: maxSingleFileSize });
    }
  } catch {
    throw new Error("File validation failed.");
  }
  const validationBytes = Buffer.from(niftiBytes);
  if (validationBytes.length > maxSingleFileSize || !isNiftiHeader(validationBytes)) throw new Error("File validation failed.");
  const modality = detectMriModality(fileName);
  if (!modality) throw new Error("Unsupported file. A T1, T1CE, T2, or FLAIR modality name is required.");
  return {
    fileName,
    modality,
    bytes: compressedBytes,
    checksum: createHash("sha256").update(compressedBytes).digest("hex"),
    uncompressedSize: validationBytes.byteLength,
    relativePath: cleanRelativePath(payload.relativePath),
    metadata: parseNiftiMetadata(validationBytes),
  };
}

export function inspectClinicalUploads(files: ClinicalUploadPayload[]) {
  const { maxFolderFiles, maxStudySize } = uploadLimits();
  if (files.length > maxFolderFiles) throw new Error("This MRI study exceeds the configured folder file limit.");
  const detected = files.map((file) => decodeClinicalUpload(file));
  const totalBytes = detected.reduce((total, file) => total + file.bytes.byteLength, 0);
  if (totalBytes > maxStudySize) throw new Error("This MRI study exceeds the configured upload limit.");
  const grouped = MRI_MODALITIES.map((modality) => ({ modality, files: detected.filter((file) => file.modality === modality) }));
  const duplicates = grouped.filter((group) => group.files.length > 1).map((group) => group.modality);
  const missing = grouped.filter((group) => group.files.length === 0).map((group) => group.modality);
  const duplicateChecksums = Array.from(new Set(detected.filter((file, index) => detected.findIndex((candidate) => candidate.checksum === file.checksum) !== index).map((file) => file.checksum)));
  return { files: detected, totalBytes, duplicates, duplicateChecksums, missing, complete: !duplicates.length && !duplicateChecksums.length && !missing.length };
}
