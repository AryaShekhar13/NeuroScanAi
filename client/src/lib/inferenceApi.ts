export type InferenceModality = "t1" | "t1ce" | "t2" | "flair";
export type NiftiSegmentationResponse = {
  status: "success";
  input_shape?: [number, number, number];
  tumor_voxels?: { WT: number; TC: number; ET: number };
  segmentation_nifti: { file_name: string; content_type: "application/gzip" | "application/x-gzip"; base64: string };
};

function isBase64(value: unknown): value is string { return typeof value === "string" && value.length > 0 && /^[A-Za-z0-9+/=]+$/.test(value); }
export function parseNiftiSegmentationResponse(value: unknown): NiftiSegmentationResponse {
  const result = value as Partial<NiftiSegmentationResponse>;
  if (result.status !== "success" || !result.segmentation_nifti || !result.segmentation_nifti.file_name.toLowerCase().endsWith(".nii.gz") || !isBase64(result.segmentation_nifti.base64) || !["application/gzip", "application/x-gzip"].includes(result.segmentation_nifti.content_type)) throw new Error("The AI inference service did not return an authoritative compressed NIfTI segmentation mask.");
  return result as NiftiSegmentationResponse;
}

export async function encodeNiftiForServer(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...Array.from(bytes.subarray(index, index + 0x8000)));
  return { fileName: file.name, mimeType: file.type || "application/gzip", base64: btoa(binary) };
}
