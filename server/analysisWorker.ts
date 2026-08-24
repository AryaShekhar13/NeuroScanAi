import { assertNiftiSpatialCompatibility, decodeClinicalUpload, decodeSegmentationNifti, inspectClinicalUploads, isNiftiSpatialMetadata } from "./clinicalFileValidation";
import { claimQueuedDurableAnalysisJob, completeDurableAnalysisJob, getDurableAnalysisJobForWorker, getSystemConfiguration, recoverExpiredDurableAnalysisLeases, transitionDurableAnalysisJob } from "./db";
import { runConfiguredMriInference } from "./mriApiConfig";
import { storageGetSignedUrl, storagePut } from "./storage";

const WORKER_INTERVAL_MS = 3_000;
let timer: ReturnType<typeof setInterval> | undefined;
let processing = false;

async function loadValidatedSources(files: Array<{ originalFilename: string; mimeType: string; storagePath: string }>) {
  const uploads = await Promise.all(files.map(async (file) => {
    const response = await fetch(await storageGetSignedUrl(file.storagePath), { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error("SOURCE_STORAGE_UNAVAILABLE");
    const bytes = Buffer.from(await response.arrayBuffer());
    return { fileName: file.originalFilename, mimeType: file.mimeType, base64: bytes.toString("base64") };
  }));
  const inspected = inspectClinicalUploads(uploads);
  if (!inspected.complete) throw new Error("SOURCE_STUDY_INCOMPLETE");
  return { inspected, uploads };
}

export function classifyAnalysisWorkerFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown worker error.";
  if (message === "SOURCE_STORAGE_UNAVAILABLE") return { code: message, message: "Original MRI source retrieval from persistent storage failed." };
  if (message === "SOURCE_STUDY_INCOMPLETE") return { code: message, message: "The stored MRI study no longer contains a complete four-modality NIfTI set." };
  if (message === "PERSISTENT_UPLOAD_FAILED") return { code: message, message: "Segmentation completed, but the authoritative NIfTI could not be uploaded to persistent storage. The job can be retried." };
  if (message === "DATABASE_FINALIZATION_FAILED") return { code: message, message: "The authoritative NIfTI was saved, but final result registration failed. Resume the job to finalize the existing result without rerunning inference." };
  if (message.includes("segmentation mask")) return { code: "MASK_SPATIAL_MISMATCH", message: "The returned segmentation mask did not match the stored MRI spatial grid." };
  return { code: "INFERENCE_OR_STORAGE_FAILED", message: "Processing could not complete. The job is retryable without starting a duplicate scan." };
}

async function processOneJob() {
  if (processing) return;
  const configuration = await getSystemConfiguration();
  if (!configuration.inferenceApiBaseUrl) return;
  processing = true;
  try {
    await recoverExpiredDurableAnalysisLeases();
    const claimed = await claimQueuedDurableAnalysisJob();
    if (!claimed) return;
    let stage = "validating";
    try {
      const context = await getDurableAnalysisJobForWorker(claimed.id);
      if (!context) throw new Error("SOURCE_STUDY_INCOMPLETE");
      const { inspected, uploads } = await loadValidatedSources(context.files);
      await transitionDurableAnalysisJob(claimed.id, { status: "uploading", message: "Preparing validated NIfTI volumes for the configured GPU service.", workerLeaseUntil: new Date(Date.now() + 10 * 60_000) });
      stage = "processing";
      await transitionDurableAnalysisJob(claimed.id, { status: "processing", message: "Running AI-assisted segmentation.", workerLeaseUntil: new Date(Date.now() + 10 * 60_000) });
      const response = await runConfiguredMriInference(configuration.inferenceApiBaseUrl, uploads.map((upload) => ({ modality: decodeClinicalUpload(upload).modality, ...upload })));
      stage = "generating_report";
      await transitionDurableAnalysisJob(claimed.id, { status: "generating_report", message: "Checking for a backend-supplied AI report artifact.", workerLeaseUntil: new Date(Date.now() + 10 * 60_000) });
      stage = "saving";
      await transitionDurableAnalysisJob(claimed.id, { status: "saving", message: "No report artifact was supplied; validating segmentation alignment and saving authoritative results.", workerLeaseUntil: new Date(Date.now() + 10 * 60_000), modelName: configuration.modelName ?? undefined, modelVersion: configuration.modelVersion ?? undefined });
      const segmentation = decodeSegmentationNifti({ fileName: response.segmentation_nifti.file_name, mimeType: response.segmentation_nifti.content_type, base64: response.segmentation_nifti.base64 });
      for (const source of inspected.files) {
        if (!isNiftiSpatialMetadata(source.metadata)) throw new Error("SOURCE_STUDY_INCOMPLETE");
        assertNiftiSpatialCompatibility(source.metadata, segmentation.metadata);
      }
      let stored: { key: string };
      try { stored = await storagePut(`clinical/analysis/${claimed.jobKey}/prediction.nii.gz`, segmentation.bytes, segmentation.fileName.endsWith(".nii.gz") ? "application/gzip" : "application/octet-stream"); }
      catch { throw new Error("PERSISTENT_UPLOAD_FAILED"); }
      const resultMetadata = { authoritativeFormat: "NIfTI-1 .nii.gz", filename: segmentation.fileName, checksum: segmentation.checksum, uncompressedSize: segmentation.uncompressedSize, spatialMetadata: segmentation.metadata, sourceModalities: inspected.files.map((file) => file.modality), tumorVoxels: response.tumor_voxels ?? null, previewPolicy: "Derived browser preview only; authoritative segmentation is the stored NIfTI mask." };
      try {
        await transitionDurableAnalysisJob(claimed.id, { status: "saving", message: "Authoritative segmentation saved; finalizing database record.", resultCheckpointPath: stored.key, resultCheckpointMetadata: resultMetadata, cleanupStatus: "not_required", cleanupMessage: "The configured API returned the prediction inline; no external temporary artifact was reported.", workerLeaseUntil: new Date(Date.now() + 2 * 60_000) });
        await completeDurableAnalysisJob(claimed.id, { segmentationStoragePath: stored.key, modelName: configuration.modelName ?? undefined, modelVersion: configuration.modelVersion ?? undefined, resultMetadata });
      } catch { throw new Error("DATABASE_FINALIZATION_FAILED"); }
    } catch (error) {
      const failure = classifyAnalysisWorkerFailure(error);
      await transitionDurableAnalysisJob(claimed.id, { status: "retryable", message: failure.message, failureCode: failure.code, failureStage: stage, errorMessage: failure.message });
    }
  } finally {
    processing = false;
  }
}

export function startDurableAnalysisWorker() {
  if (timer) return;
  void processOneJob().catch((error) => console.error("[MRI worker] initial cycle failed", error));
  timer = setInterval(() => void processOneJob().catch((error) => console.error("[MRI worker] cycle failed", error)), WORKER_INTERVAL_MS);
}
