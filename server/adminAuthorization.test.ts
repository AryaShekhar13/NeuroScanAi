import { describe, expect, it, vi } from "vitest";

vi.mock("./db", () => {
  const empty = async () => undefined;
  return {
    checkAuthRateLimit: empty, consumeDemoVisitor: empty, consumePasswordReset: empty, createAccessRequest: empty, createAuditLog: empty, createClinician: empty, createMockAnalysis: empty, createPatient: empty, createStudy: empty, createWorkspaceFile: empty, ensureInitialAdminAccount: empty, getAdminSystemOverview: empty, getClinicianByEmail: empty, getDashboardMetrics: empty, getOrCreateDemoVisitor: empty, getPatientOwned: empty, getStudyOwned: empty, getSystemConfiguration: empty, invalidateClinicianSessions: empty, listAnalysisJobs: empty, listPatients: empty, listStudies: empty, listWorkspaceFiles: empty, recordAuthoritativeNiftiSegmentation: empty, recordSystemApiCheck: empty, registerAuthRateAttempt: empty, setPasswordReset: empty, touchClinicianLogin: empty, updateClinicianPasswordHash: empty, updateSystemConfiguration: empty,
  };
});

import { appRouter } from "./routers";

describe("administrator authorization", () => {
  it("denies a normal clinician access to server-side administrator procedures", async () => {
    const caller = appRouter.createCaller({ clinician: { id: 2, email: "clinician@example.test", role: "clinician", fullName: "Clinician", professionalRole: "Radiologist", institution: "Clinic", passwordHash: "hash", resetTokenHash: null, resetTokenExpiresAt: null, resetTokenUsedAt: null, sessionVersion: 1, lastSignedIn: new Date(), createdAt: new Date(), updatedAt: new Date() }, user: null, req: {} as never, res: {} as never });
    await expect(caller.admin.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
