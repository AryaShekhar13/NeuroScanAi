export type InferenceModality = "t1" | "t1ce" | "t2" | "flair";
export type NiftiSegmentationResponse = {
  status: "success";
  input_shape?: [number, number, number];
  tumor_voxels?: { WT: number; TC: number; ET: number };
  segmentation_nifti: { file_name: string; content_type: "application/gzip" | "application/x-gzip"; base64: string };
};

const configuredBaseUrl = import.meta.env.VITE_INFERENCE_API_BASE?.replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 120_000;

export function getInferenceApiBaseUrl() { if (!configuredBaseUrl) throw new Error("The AI inference service is not configured."); return configuredBaseUrl; }

function isBase64(value: unknown): value is string { return typeof value === "string" && value.length > 0 && /^[A-Za-z0-9+/=]+$/.test(value); }
export function parseNiftiSegmentationResponse(value: unknown): NiftiSegmentationResponse {
  const result = value as Partial<NiftiSegmentationResponse>;
  if (result.status !== "success" || !result.segmentation_nifti || !result.segmentation_nifti.file_name.toLowerCase().endsWith(".nii.gz") || !isBase64(result.segmentation_nifti.base64) || !["application/gzip", "application/x-gzip"].includes(result.segmentation_nifti.content_type)) throw new Error("The AI inference service did not return an authoritative compressed NIfTI segmentation mask.");
  return result as NiftiSegmentationResponse;
}

export async function submitNiftiInference(files: Record<InferenceModality, File>, signal?: AbortSignal) {
  const body = new FormData(); body.append("t1", files.t1, files.t1.name); body.append("t1ce", files.t1ce, files.t1ce.name); body.append("t2", files.t2, files.t2.name); body.append("flair", files.flair, files.flair.name);
  const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]) : AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const response = await fetch(`${getInferenceApiBaseUrl()}/predict`, { method: "POST", body, signal: requestSignal });
  if (!response.ok) throw new Error(response.status >= 500 ? "The AI inference service is temporarily unavailable." : "The AI inference service could not accept this NIfTI study.");
  return parseNiftiSegmentationResponse(await response.json());
}
