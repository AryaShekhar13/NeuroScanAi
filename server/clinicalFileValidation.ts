const MAX_CLINICAL_UPLOAD_BYTES = 8 * 1024 * 1024;
const supportedExtensions = [".dcm", ".nii", ".nii.gz"];

export type ClinicalUploadPayload = { fileName: string; mimeType: string; base64: string };

export function cleanClinicalFileName(fileName: string) {
  const cleaned = fileName.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return cleaned || "mri-upload";
}

export function decodeClinicalUpload(payload: ClinicalUploadPayload) {
  const name = cleanClinicalFileName(payload.fileName);
  const lowerName = name.toLowerCase();
  if (!supportedExtensions.some((extension) => lowerName.endsWith(extension))) {
    throw new Error("Upload a DICOM (.dcm) or NIfTI (.nii, .nii.gz) MRI file.");
  }
  if (!/^[A-Za-z0-9+/=]+$/.test(payload.base64)) throw new Error("The uploaded file payload is invalid.");
  const bytes = Buffer.from(payload.base64, "base64");
  if (!bytes.length || bytes.length > MAX_CLINICAL_UPLOAD_BYTES) {
    throw new Error("Each MRI upload must be between 1 byte and 8 MB.");
  }
  return { fileName: name, bytes };
}

export { MAX_CLINICAL_UPLOAD_BYTES };
