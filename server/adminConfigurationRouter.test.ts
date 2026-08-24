import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ configuration: { id: 1, inferenceApiBaseUrl: null as string | null, lastApiCheckAt: null as Date | null, lastApiCheckStatus: "unknown" as "unknown" | "online" | "offline", lastApiCheckMessage: null as string | null, modelName: null as string | null, modelVersion: null as string | null, updatedBy: null as number | null, createdAt: new Date(), updatedAt: new Date() } }));

vi.mock("./db", () => {
  const empty = async () => undefined;
  return {
    checkAuthRateLimit: empty, consumeDemoVisitor: empty, consumePasswordReset: empty, createAccessRequest: empty, createAuditLog: empty, createClinician: empty, createMockAnalysis: empty, createPatient: empty, createStudy: empty, createWorkspaceFile: empty, ensureInitialAdminAccount: empty, getAdminSystemOverview: async () => ({ clinicians: 1, studies: 0, jobs: 0, failedJobs: 0, recentJobs: [] }), getClinicianByEmail: empty, getDashboardMetrics: empty, getOrCreateDemoVisitor: empty, getPatientOwned: empty, getStudyOwned: empty, getSystemConfiguration: async () => state.configuration, invalidateClinicianSessions: empty, listAnalysisJobs: empty, listPatients: empty, listStudies: empty, listWorkspaceFiles: empty, recordAuthoritativeNiftiSegmentation: empty, recordSystemApiCheck: async (adminId: number, result: { status: "online" | "offline"; message: string; modelName?: string | null; modelVersion?: string | null }) => { Object.assign(state.configuration, { lastApiCheckAt: new Date(), lastApiCheckStatus: result.status, lastApiCheckMessage: result.message, modelName: result.modelName ?? null, modelVersion: result.modelVersion ?? null, updatedBy: adminId }); return state.configuration; }, registerAuthRateAttempt: empty, setPasswordReset: empty, touchClinicianLogin: empty, updateClinicianPasswordHash: empty, updateSystemConfiguration: async (adminId: number, url: string) => { Object.assign(state.configuration, { inferenceApiBaseUrl: url, lastApiCheckStatus: "unknown", updatedBy: adminId }); return state.configuration; },
  };
});

vi.mock("./mriApiConfig", () => ({
  normalizeMriApiBaseUrl: (url: string) => new URL(url).toString().replace(/\/$/, ""),
  testMriApiConnection: async () => ({ status: "online" as const, message: "Health check succeeded.", modelName: "SegResNet", modelVersion: "v1" }),
  runConfiguredMriInference: vi.fn(),
}));

import { appRouter } from "./routers";

function adminCaller() {
  return appRouter.createCaller({ clinician: { id: 7, email: "admin@example.test", role: "admin", fullName: "Admin", professionalRole: "Administrator", institution: "NeuroScan", passwordHash: "hash", resetTokenHash: null, resetTokenExpiresAt: null, resetTokenUsedAt: null, sessionVersion: 1, lastSignedIn: new Date(), createdAt: new Date(), updatedAt: new Date() }, user: null, req: {} as never, res: {} as never });
}

describe("administrator configuration router", () => {
  it("saves the server-side MRI API URL and records tested health and model metadata", async () => {
    state.configuration.inferenceApiBaseUrl = null; state.configuration.lastApiCheckStatus = "unknown"; state.configuration.modelName = null;
    const caller = adminCaller();
    await expect(caller.admin.updateApiUrl({ apiUrl: "https://mri-api.example.test/" })).resolves.toMatchObject({ configuration: { inferenceApiBaseUrl: "https://mri-api.example.test" } });
    await expect(caller.admin.testApiConnection()).resolves.toMatchObject({ configuration: { lastApiCheckStatus: "online", modelName: "SegResNet", modelVersion: "v1" } });
  });
});
