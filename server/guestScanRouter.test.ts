import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ visitors: new Map<string, { id: number; usedAt: Date | null }>(), nextId: 1 }));

vi.mock("./db", () => {
  const empty = async () => undefined;
  return {
    checkAuthRateLimit: empty, consumePasswordReset: empty, createAccessRequest: empty, createAuditLog: empty, createClinician: empty, createMockAnalysis: empty, recordAuthoritativeNiftiSegmentation: empty, createPatient: empty, createStudy: empty, createWorkspaceFile: empty,
    consumeDemoVisitor: async (tokenHash: string) => { const visitor = state.visitors.get(tokenHash); if (!visitor || visitor.usedAt) return false; visitor.usedAt = new Date(); return true; },
    getClinicianByEmail: empty, getDashboardMetrics: empty, getPatientOwned: empty, getStudyOwned: empty, invalidateClinicianSessions: empty, listAnalysisJobs: empty, listPatients: empty, listStudies: empty, listWorkspaceFiles: empty,
    getOrCreateDemoVisitor: async (tokenHash: string) => { const existing = state.visitors.get(tokenHash); if (existing) return existing; const visitor = { id: state.nextId++, usedAt: null }; state.visitors.set(tokenHash, visitor); return visitor; },
    registerAuthRateAttempt: empty, setPasswordReset: empty, touchClinicianLogin: empty, updateClinicianPasswordHash: empty,
  };
});

vi.mock("./clinicalAuth", () => ({
  clearClinicianSessionCookie: vi.fn(), createClinicianSession: vi.fn(), createDemoVisitorToken: () => "guest-token-created-for-test-000000000000", createResetToken: vi.fn(), hashPassword: vi.fn(), hashRateLimitKey: (scope: string, value: string) => `${scope}:${value}`, hashDemoVisitorToken: (token: string) => token, hashResetToken: vi.fn(), needsPasswordUpgrade: vi.fn(), setClinicianSessionCookie: vi.fn(), setDemoVisitorCookie: vi.fn(), readDemoVisitorToken: (cookie?: string) => cookie?.match(/neuroscan_demo_visitor=([^;]+)/)?.[1] ?? null, verifyPassword: vi.fn(),
}));

import { appRouter } from "./routers";

function contextFor(token: string) {
  return { clinician: null, user: null, req: { ip: "127.0.0.1", headers: { cookie: `neuroscan_demo_visitor=${token}`, "user-agent": "guest-router-test" } }, res: { cookie: vi.fn(), clearCookie: vi.fn() } } as never;
}

describe("demo router guest completion lifecycle", () => {
  it("keeps one persistent guest token eligible through status and preparation, then blocks it only after completion", async () => {
    state.visitors.clear(); state.nextId = 1;
    const caller = appRouter.createCaller(contextFor("persistent-guest-token-1234567890"));
    await expect(caller.demo.status()).resolves.toMatchObject({ used: false, guestScanCompleted: false, canStartGuestScan: true });
    await expect(caller.demo.readyForReal({ files: [{ modality: "t1", fileName: "t1.nii.gz" }, { modality: "t1ce", fileName: "t1ce.nii.gz" }, { modality: "t2", fileName: "t2.nii.gz" }, { modality: "flair", fileName: "flair.nii.gz" }] })).resolves.toMatchObject({ ready: true });
    await expect(caller.demo.status()).resolves.toMatchObject({ used: false, guestScanCompleted: false, canStartGuestScan: true });
    await expect(caller.demo.completeReal({ files: [{ modality: "t1", fileName: "t1.nii.gz" }, { modality: "t1ce", fileName: "t1ce.nii.gz" }, { modality: "t2", fileName: "t2.nii.gz" }, { modality: "flair", fileName: "flair.nii.gz" }] })).resolves.toMatchObject({ used: true });
    await expect(caller.demo.status()).resolves.toMatchObject({ used: true, guestScanCompleted: true, canStartGuestScan: false });
  });
});
