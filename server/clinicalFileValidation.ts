import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";

export const MRI_MODALITIES = ["t1", "t1ce", "t2", "flair"] as const;
export type MriModality = typeof MRI_MODALITIES[number];
export type ClinicalUploadPayload = { fileName: string; mimeType: string; base64: string; relativePath?: string };
export type NiftiSpatialMetadata = {
  format: "NIfTI-1";
  dimensions: [number, number, number];
  voxelSpacing: [number, number, number];
  orientation: "little-endian" | "big-endian";
  qformCode: number;
  sformCode: number;
  qformParameters: [number, number, number, number, number, number, number];
  sformRows: [number, number, number, number, number, number, number, number, number, number, number, number];
};

const FALLBACK_SINGLE_FILE_LIMIT = 8 * 1024 * 1024;
const FALLBACK_STUDY_LIMIT = 32 * 1024 * 1024;
const FALLBACK_FOLDER_LIMIT = 200;
/** A separate cap prevents gzip bombs while allowing valid compressed clinical volumes larger than their transport size. */
export const MAX_DECOMPRESSED_NIFTI_BYTES = 64 * 1024 * 1024;

function positiveEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function uploadLimits() {
  const configuredMegabytes = Number(process.env.MAX_MRI_UPLOAD_MB);
  const maxSingleFileSize = Number.isInteger(configuredMegabytes) && configuredMegabytes > 0 ? configuredMegabytes * 1024 * 1024 : positiveEnv("MAX_SINGLE_FILE_SIZE", FALLBACK_SINGLE_FILE_LIMIT);
  return {
    maxSingleFileSize,
    maxStudySize: positiveEnv("MAX_STUDY_SIZE", FALLBACK_STUDY_LIMIT),
    maxFolderFiles: positiveEnv("MAX_FOLDER_FILES", FALLBACK_FOLDER_LIMIT),
  };
}

export function cleanClinicalFileName(fileName: string) {
  const baseName = fileName.replace(/\\/g, "/").split("/").pop() || "";
  const cleaned = baseName.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return cleaned || "mri-upload.nii.gz";
}

export function cleanRelativePath(relativePath?: string) {
  if (!relativePath) return null;
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")) return null;
  return normalized.slice(0, 512) || null;
}

export function isNiftiFilename(fileName: string) {
  return fileName.toLowerCase().endsWith(".nii.gz");
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

export function parseNiftiMetadata(bytes: Buffer): NiftiSpatialMetadata {
  const littleEndian = bytes.readInt32LE(0) === 348;
  const readInt16 = (offset: number) => littleEndian ? bytes.readInt16LE(offset) : bytes.readInt16BE(offset);
  const readFloat = (offset: number) => littleEndian ? bytes.readFloatLE(offset) : bytes.readFloatBE(offset);
  const dimensions = [readInt16(42), readInt16(44), readInt16(46)] as [number, number, number];
  const voxelSpacing = [readFloat(80), readFloat(84), readFloat(88)] as [number, number, number];
  if (dimensions.some((value) => value <= 0) || voxelSpacing.some((value) => !Number.isFinite(value) || value <= 0)) throw new Error("File validation failed.");
  const qformParameters = [readFloat(256), readFloat(260), readFloat(264), readFloat(268), readFloat(272), readFloat(276), readFloat(76)] as NiftiSpatialMetadata["qformParameters"];
  const sformRows = Array.from({ length: 12 }, (_, index) => readFloat(280 + index * 4)) as NiftiSpatialMetadata["sformRows"];
  if ([...qformParameters, ...sformRows].some((value) => !Number.isFinite(value))) throw new Error("File validation failed.");
  return { format: "NIfTI-1", dimensions, voxelSpacing, orientation: littleEndian ? "little-endian" : "big-endian", qformCode: readInt16(252), sformCode: readInt16(254), qformParameters, sformRows };
}

function decodeCompressedNifti(payload: Pick<ClinicalUploadPayload, "fileName" | "mimeType" | "base64">) {
  const fileName = cleanClinicalFileName(payload.fileName);
  if (!isNiftiFilename(fileName)) throw new Error("Unsupported file. Only compressed NIfTI (.nii.gz) files are accepted.");
  const allowedMimeTypes = new Set(["", "application/octet-stream", "application/x-nifti", "application/gzip", "application/x-gzip"]);
  if (!allowedMimeTypes.has(payload.mimeType.toLowerCase()) || !/^[A-Za-z0-9+/=]+$/.test(payload.base64)) throw new Error("File validation failed.");
  const compressedBytes = Buffer.from(payload.base64, "base64");
  const { maxSingleFileSize } = uploadLimits();
  if (!compressedBytes.length) throw new Error("File validation failed.");
  if (compressedBytes.length > maxSingleFileSize) throw new Error("This MRI file exceeds the maximum allowed upload size.");
  if (compressedBytes[0] !== 0x1f || compressedBytes[1] !== 0x8b) throw new Error("File validation failed.");
  let niftiBytes: Uint8Array;
  try { niftiBytes = gunzipSync(compressedBytes, { maxOutputLength: MAX_DECOMPRESSED_NIFTI_BYTES }); } catch { throw new Error("File validation failed."); }
  const validationBytes = Buffer.from(niftiBytes);
  if (validationBytes.length > MAX_DECOMPRESSED_NIFTI_BYTES || !isNiftiHeader(validationBytes)) throw new Error("File validation failed.");
  return { fileName, compressedBytes, validationBytes, checksum: createHash("sha256").update(compressedBytes).digest("hex"), metadata: parseNiftiMetadata(validationBytes) };
}

export function decodeClinicalUpload(payload: ClinicalUploadPayload) {
  const decoded = decodeCompressedNifti(payload);
  const { fileName, compressedBytes, validationBytes, checksum, metadata } = decoded;
  const modality = detectMriModality(fileName);
  if (!modality) throw new Error("Unsupported file. A T1, T1CE, T2, or FLAIR modality name is required.");
  return {
    fileName,
    modality,
    bytes: compressedBytes,
    checksum,
    uncompressedSize: validationBytes.byteLength,
    relativePath: cleanRelativePath(payload.relativePath),
    metadata,
  };
}

export function decodeSegmentationNifti(payload: Pick<ClinicalUploadPayload, "fileName" | "mimeType" | "base64">) {
  const decoded = decodeCompressedNifti(payload);
  return { fileName: decoded.fileName, bytes: decoded.compressedBytes, checksum: decoded.checksum, uncompressedSize: decoded.validationBytes.byteLength, metadata: decoded.metadata };
}

function closeEnough(left: number, right: number) { return Math.abs(left - right) <= 0.0001; }

export function assertNiftiSpatialCompatibility(input: NiftiSpatialMetadata, mask: NiftiSpatialMetadata) {
  const sameDimensions = input.dimensions.every((value, index) => value === mask.dimensions[index]);
  const sameSpacing = input.voxelSpacing.every((value, index) => closeEnough(value, mask.voxelSpacing[index]));
  const sameQform = input.qformCode === mask.qformCode && input.qformParameters.every((value, index) => closeEnough(value, mask.qformParameters[index]));
  const sameSform = input.sformCode === mask.sformCode && input.sformRows.every((value, index) => closeEnough(value, mask.sformRows[index]));
  if (!sameDimensions || !sameSpacing || input.orientation !== mask.orientation || !sameQform || !sameSform) throw new Error("The segmentation mask does not match the input MRI spatial grid or orientation.");
  return true;
}

export function isNiftiSpatialMetadata(value: unknown): value is NiftiSpatialMetadata {
  if (!value || typeof value !== "object") return false;
  const metadata = value as Partial<NiftiSpatialMetadata>;
  return metadata.format === "NIfTI-1" && Array.isArray(metadata.dimensions) && metadata.dimensions.length === 3 && metadata.dimensions.every((item) => Number.isInteger(item) && item > 0)
    && Array.isArray(metadata.voxelSpacing) && metadata.voxelSpacing.length === 3 && metadata.voxelSpacing.every((item) => typeof item === "number" && Number.isFinite(item) && item > 0)
    && (metadata.orientation === "little-endian" || metadata.orientation === "big-endian") && typeof metadata.qformCode === "number" && typeof metadata.sformCode === "number"
    && Array.isArray(metadata.qformParameters) && metadata.qformParameters.length === 7 && Array.isArray(metadata.sformRows) && metadata.sformRows.length === 12;
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
