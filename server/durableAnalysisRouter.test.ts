import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const job = { id: 42, jobKey: "a".repeat(32), studyId: 12, createdBy: 7, modelName: "MRI API awaiting configuration", modelVersion: "unconfigured", status: "retryable", isDemo: 0, attemptCount: 1, remoteJobId: null, workerLeaseUntil: null, progressMessage: "Storage retry is available.", failureCode: "STORAGE_FAILED", failureStage: "saving", resultCheckpointPath: null, submittedAt: new Date(), startedAt: new Date(), completedAt: null, errorMessage: "Storage failed." };
  const spatialMetadata = { format: "NIfTI-1" as const, dimensions: [64, 64, 32] as [number, number, number], voxelSpacing: [1, 1, 1] as [number, number, number], orientation: "little-endian" as const, qformCode: 0, sformCode: 0, qformParameters: [0, 0, 0, 0, 0, 0, 0] as [number, number, number, number, number, number, number], sformRows: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] as [number, number, number, number, number, number, number, number, number, number, number, number] };
  return { job, spatialMetadata, transition: vi.fn(async () => undefined), create: vi.fn(async () => ({ job, created: true })) };
});

vi.mock("./db", () => {
  const empty = async () => undefined;
  const study = { study: { id: 12 }, patient: { id: 2 }, files: ["t1", "t1ce", "t2", "flair"].map((modality, index) => ({ id: index + 1, modality, uploadStatus: "uploaded", metadata: state.spatialMetadata, storagePath: `file-${modality}`, originalFilename: `${modality}.nii.gz`, mimeType: "application/gzip" })), jobs: [], results: [] };
  return { checkAuthRateLimit: empty, consumeDemoVisitor: empty, consumePasswordReset: empty, createAccessRequest: empty, createAuditLog: empty, createClinician: empty, createMockAnalysis: empty, createPatient: empty, createStudy: empty, createWorkspaceFile: empty, createDurableAnalysisJob: state.create, finalizeDurableResultCheckpoint: async () => false, getDurableAnalysisJobOwned: async () => ({ job: state.job, events: [], results: [] }), getAdminSystemOverview: empty, getClinicianByEmail: empty, getDashboardMetrics: empty, getOrCreateDemoVisitor: empty, getPatientOwned: empty, getStudyOwned: async () => study, getSystemConfiguration: empty, invalidateClinicianSessions: empty, listAnalysisJobs: empty, listDurableAnalysisJobsOwned: async () => [state.job], listPatients: empty, listStudies: empty, listWorkspaceFiles: empty, recordAuthoritativeNiftiSegmentation: empty, recordSystemApiCheck: empty, registerAuthRateAttempt: empty, setPasswordReset: empty, touchClinicianLogin: empty, transitionDurableAnalysisJob: state.transition, updateClinicianPasswordHash: empty, updateSystemConfiguration: empty };
});

vi.mock("./mriApiConfig", () => ({ normalizeMriApiBaseUrl: (url: string) => url, runConfiguredMriInference: vi.fn(), testMriApiConnection: vi.fn() }));
vi.mock("./storage", () => ({ storageGetSignedUrl: vi.fn(), storagePut: vi.fn() }));

import { appRouter } from "./routers";

function clinicianCaller() {
  return appRouter.createCaller({ clinician: { id: 7, email: "clinician@example.test", role: "clinician", fullName: "Clinician", professionalRole: "Radiologist", institution: "NeuroScan", passwordHash: "hash", resetTokenHash: null, resetTokenExpiresAt: null, resetTokenUsedAt: null, sessionVersion: 1, lastSignedIn: new Date(), createdAt: new Date(), updatedAt: new Date() }, user: null, req: { headers: {} } as never, res: {} as never });
}

describe("durable analysis router", () => {
  it("creates or recovers one owner-scoped job and only queues a retry from a retryable job", async () => {
    const caller = clinicianCaller();
    await expect(caller.analysis.startDurable({ studyId: 12 })).resolves.toMatchObject({ created: true, job: { jobKey: state.job.jobKey } });
    await expect(caller.analysis.durableJob({ jobKey: state.job.jobKey })).resolves.toMatchObject({ job: { job: { id: 42, status: "retryable" } } });
    await caller.analysis.retryDurable({ jobKey: state.job.jobKey });
    expect(state.transition).toHaveBeenCalledWith(42, expect.objectContaining({ status: "queued" }));
  });
});
