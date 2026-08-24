export function normalizeMriApiBaseUrl(value: string) {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error("Enter a valid HTTPS MRI API URL."); }
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password) throw new Error("Enter a valid HTTPS MRI API URL.");
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export async function testMriApiConnection(baseUrl: string) {
  const response = await fetch(new URL("/health", `${baseUrl}/`), { signal: AbortSignal.timeout(8_000), headers: { accept: "application/json" } });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) return { status: "offline" as const, message: `Health check returned HTTP ${response.status}.`, modelName: null, modelVersion: null };
  const modelName = typeof payload.model === "string" ? payload.model : typeof payload.model_name === "string" ? payload.model_name : null;
  const modelVersion = typeof payload.version === "string" ? payload.version : typeof payload.model_version === "string" ? payload.model_version : null;
  return { status: "online" as const, message: "Health check succeeded.", modelName, modelVersion };
}

type InferenceFile = { modality: "t1" | "t1ce" | "t2" | "flair"; fileName: string; mimeType: string; base64: string };
export type ServerNiftiSegmentationResponse = { status: "success"; input_shape?: [number, number, number]; tumor_voxels?: { WT: number; TC: number; ET: number }; segmentation_nifti: { file_name: string; content_type: "application/gzip" | "application/x-gzip"; base64: string } };

function assertAuthoritativeMask(value: unknown): ServerNiftiSegmentationResponse {
  const result = value as { status?: unknown; segmentation_nifti?: { file_name?: unknown; content_type?: unknown; base64?: unknown } };
  const mask = result.segmentation_nifti;
  if (result.status !== "success" || !mask || typeof mask.file_name !== "string" || !mask.file_name.toLowerCase().endsWith(".nii.gz") || !["application/gzip", "application/x-gzip"].includes(String(mask.content_type)) || typeof mask.base64 !== "string" || !/^[A-Za-z0-9+/=]+$/.test(mask.base64)) throw new Error("Invalid inference response.");
  return value as ServerNiftiSegmentationResponse;
}

export async function runConfiguredMriInference(baseUrl: string, files: InferenceFile[]) {
  const body = new FormData();
  files.forEach((file) => body.append(file.modality, new Blob([Buffer.from(file.base64, "base64")], { type: file.mimeType || "application/gzip" }), file.fileName));
  const response = await fetch(new URL("/predict", `${baseUrl}/`), { method: "POST", body, signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error("Inference request failed.");
  return assertAuthoritativeMask(await response.json());
}
