export type InferenceModality = "t1" | "t1ce" | "t2" | "flair";
export type InferenceJob = { job_id: string; status: string; message?: string };
export type InferenceStatus = InferenceJob & { result?: unknown; elapsed_seconds?: number | null };

const configuredBaseUrl = import.meta.env.VITE_INFERENCE_API_BASE?.replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 10 * 60_000;

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
  } catch { /* Use the clinical-safe fallback below when no JSON error body is available. */ }
  return new Error("The AI inference service could not accept this MRI study. Confirm all four compressed files are valid and try again.");
}

async function request(url: string, init?: RequestInit, timeout = REQUEST_TIMEOUT_MS) {
  const signal = init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout);
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") throw new Error("The AI inference service is taking longer than expected. Please try again later.");
    throw error;
  }
  if (!response.ok) throw await serviceError(response);
  return response;
}

export async function submitInference(files: Record<InferenceModality, File>, signal?: AbortSignal) {
  const body = new FormData();
  body.append("t1ce", files.t1ce, files.t1ce.name);
  body.append("t1", files.t1, files.t1.name);
  body.append("t2", files.t2, files.t2.name);
  body.append("flair", files.flair, files.flair.name);
  const response = await request(`${getInferenceApiBaseUrl()}/infer`, { method: "POST", body, signal });
  const job = await response.json() as InferenceJob;
  if (!job.job_id) throw new Error("The AI inference service did not return a valid job identifier.");
  return job;
}

export async function getInferenceStatus(jobId: string, signal?: AbortSignal) {
  const response = await request(`${getInferenceApiBaseUrl()}/status/${encodeURIComponent(jobId)}`, { signal }, 30_000);
  return response.json() as Promise<InferenceStatus>;
}

function waitFor(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, milliseconds);
    signal?.addEventListener("abort", () => { window.clearTimeout(timer); reject(new DOMException("The inference request was cancelled.", "AbortError")); }, { once: true });
  });
}

export async function waitForInferenceStatus(jobId: string, onStatus: (status: InferenceStatus) => void, signal?: AbortSignal) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    if (signal?.aborted) throw new DOMException("The inference request was cancelled.", "AbortError");
    const status = await getInferenceStatus(jobId, signal);
    onStatus(status);
    if (status.status === "completed") return status;
    if (status.status === "failed" || status.status === "error") throw new Error("AI segmentation could not be completed for this MRI study. Please try again.");
    await waitFor(POLL_INTERVAL_MS, signal);
  }
  throw new Error("AI segmentation is taking longer than expected. Please try again later.");
}

export async function getInferenceVisualization(jobId: string, slice?: number, signal?: AbortSignal) {
  const parameters = new URLSearchParams();
  if (slice !== undefined) parameters.set("slice", String(slice));
  const suffix = parameters.size ? `?${parameters.toString()}` : "";
  const response = await request(`${getInferenceApiBaseUrl()}/visualize/${encodeURIComponent(jobId)}${suffix}`, { signal }, 60_000);
  const image = await response.blob();
  if (!image.type.startsWith("image/")) throw new Error("The AI inference service did not return a visualization image.");
  return URL.createObjectURL(image);
}

export async function getNiftiAxialSliceCount(file: File) {
  if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot inspect compressed MRI metadata. Please use a current browser and try again.");
  const decompressed = file.stream().pipeThrough(new DecompressionStream("gzip"));
  const header = new Uint8Array(await new Response(decompressed).arrayBuffer());
  if (header.byteLength < 352) throw new Error("The selected MRI file could not be verified as a NIfTI volume.");
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  const littleEndian = view.getInt32(0, true) === 348;
  const bigEndian = view.getInt32(0, false) === 348;
  if (!littleEndian && !bigEndian) throw new Error("The selected MRI file could not be verified as a NIfTI volume.");
  const sliceCount = view.getInt16(46, littleEndian);
  if (!Number.isInteger(sliceCount) || sliceCount < 1) throw new Error("The selected MRI file does not include valid axial slice metadata.");
  return sliceCount;
}
