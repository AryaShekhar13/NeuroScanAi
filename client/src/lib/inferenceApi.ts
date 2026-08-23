export type InferenceModality = "t1" | "t1ce" | "t2" | "flair";
export type PredictResult = {
  status: "success";
  input_shape: [number, number, number];
  tumor_voxels: { WT: number; TC: number; ET: number };
};

const configuredBaseUrl = import.meta.env.VITE_INFERENCE_API_BASE?.replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 120_000;

export function getInferenceApiBaseUrl() {
  if (!configuredBaseUrl) throw new Error("The AI inference service is not configured.");
  return configuredBaseUrl;
}

async function serviceError(response: Response) {
  if (response.status === 413) return new Error("The MRI upload is too large for the inference service. Choose a smaller compressed study.");
  if (response.status >= 500) return new Error("The AI inference service is temporarily unavailable. Please try again shortly.");
  try {
    const body = await response.json() as { detail?: unknown; message?: unknown };
    const detail = typeof body.detail === "string" ? body.detail : typeof body.message === "string" ? body.message : null;
    if (detail && detail.length <= 220 && !/[\\/]|checkpoint|model|path/i.test(detail)) return new Error(detail);
  } catch { /* Use the clinical-safe fallback when no JSON error body is available. */ }
  return new Error("The AI inference service could not accept this MRI study. Confirm all four compressed files are valid and try again.");
}

async function request(url: string, init?: RequestInit, timeout = REQUEST_TIMEOUT_MS) {
  const signal = init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout);
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal });
  } catch (error) {
    if (typeof error === "object" && error !== null && "name" in error && error.name === "TimeoutError") throw new Error("The AI inference service is taking longer than expected. Please try again later.");
    throw error;
  }
  if (!response.ok) throw await serviceError(response);
  return response;
}

export async function submitInference(files: Record<InferenceModality, File>, signal?: AbortSignal) {
  const body = new FormData();
  body.append("t1", files.t1, files.t1.name);
  body.append("t1ce", files.t1ce, files.t1ce.name);
  body.append("t2", files.t2, files.t2.name);
  body.append("flair", files.flair, files.flair.name);
  const response = await request(`${getInferenceApiBaseUrl()}/predict`, { method: "POST", body, signal });
  const result = await response.json() as Partial<PredictResult>;
  const hasVoxelSummary = result.tumor_voxels && ["WT", "TC", "ET"].every((key) => Number.isFinite(result.tumor_voxels?.[key as keyof PredictResult["tumor_voxels"]]));
  if (result.status !== "success" || !Array.isArray(result.input_shape) || result.input_shape.length !== 3 || !hasVoxelSummary) throw new Error("The AI inference service did not return a complete segmentation summary.");
  return result as PredictResult;
}
