import { and, count, desc, eq, gt, isNull, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  accessRequests,
  analysisJobs,
  analysisResults,
  auditLogs,
  authRateLimits,
  clinicianAccounts,
  demoVisitors,
  InsertUser,
  patients,
  studies,
  studyFiles,
  systemConfigurations,
  users,
  workspaceFiles,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); }
    catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}

function requireDb(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) throw new Error("The database is unavailable. Please try again shortly.");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId, lastSignedIn: new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: new Date() };
  (["name", "email", "loginMethod"] as const).forEach((field) => {
    if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; }
  });
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb(); if (!db) return undefined;
  return (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0];
}

export async function getClinicianById(id: number) {
  const db = await getDb(); if (!db) return undefined;
  return (await db.select().from(clinicianAccounts).where(eq(clinicianAccounts.id, id)).limit(1))[0];
}

export async function getClinicianByEmail(email: string) {
  const db = await getDb(); if (!db) return undefined;
  return (await db.select().from(clinicianAccounts).where(eq(clinicianAccounts.email, email.toLowerCase())).limit(1))[0];
}

export async function createClinician(input: { email: string; passwordHash: string; fullName: string; professionalRole: string; institution: string; role?: "clinician" | "admin" }) {
  const db = requireDb(await getDb());
  const result = await db.insert(clinicianAccounts).values({ ...input, email: input.email.toLowerCase() });
  const id = Number(result[0].insertId);
  await createAuditLog(id, "account.created", "clinicianAccount", String(id));
  return (await getClinicianById(id))!;
}

export async function ensureInitialAdminAccount(input: { email: string; passwordHash: string }) {
  const existing = await getClinicianByEmail(input.email);
  const db = requireDb(await getDb());
  if (existing) {
    if (existing.role !== "admin") await db.update(clinicianAccounts).set({ role: "admin" }).where(eq(clinicianAccounts.id, existing.id));
    return { account: await getClinicianById(existing.id), created: false };
  }
  const result = await db.insert(clinicianAccounts).values({ email: input.email.toLowerCase(), passwordHash: input.passwordHash, role: "admin", fullName: "NeuroScan Administrator", professionalRole: "System Administrator", institution: "NeuroScan AI" });
  const id = Number(result[0].insertId);
  await createAuditLog(id, "ADMIN_ACCOUNT_INITIALIZED", "clinicianAccount", String(id));
  return { account: await getClinicianById(id), created: true };
}

export async function getSystemConfiguration() {
  const db = requireDb(await getDb());
  await db.insert(systemConfigurations).values({ id: 1 }).onDuplicateKeyUpdate({ set: { id: 1 } });
  return (await db.select().from(systemConfigurations).where(eq(systemConfigurations.id, 1)).limit(1))[0]!;
}

export async function updateSystemConfiguration(adminId: number, inferenceApiBaseUrl: string) {
  const db = requireDb(await getDb());
  await getSystemConfiguration();
  await db.update(systemConfigurations).set({ inferenceApiBaseUrl, lastApiCheckStatus: "unknown", lastApiCheckAt: null, lastApiCheckMessage: null, modelName: null, modelVersion: null, updatedBy: adminId }).where(eq(systemConfigurations.id, 1));
  await createAuditLog(adminId, "MRI_API_URL_UPDATED", "systemConfiguration", "1");
  return getSystemConfiguration();
}

export async function recordSystemApiCheck(adminId: number, input: { status: "online" | "offline"; message: string; modelName?: string | null; modelVersion?: string | null }) {
  const db = requireDb(await getDb());
  await getSystemConfiguration();
  await db.update(systemConfigurations).set({ lastApiCheckAt: new Date(), lastApiCheckStatus: input.status, lastApiCheckMessage: input.message.slice(0, 240), modelName: input.modelName ?? null, modelVersion: input.modelVersion ?? null, updatedBy: adminId }).where(eq(systemConfigurations.id, 1));
  await createAuditLog(adminId, "MRI_API_CONNECTION_TESTED", "systemConfiguration", "1", { status: input.status });
  return getSystemConfiguration();
}

export async function touchClinicianLogin(id: number) {
  const db = requireDb(await getDb());
  await db.update(clinicianAccounts).set({ lastSignedIn: new Date() }).where(eq(clinicianAccounts.id, id));
}

export async function updateClinicianPasswordHash(id: number, passwordHash: string) {
  const db = requireDb(await getDb());
  await db.update(clinicianAccounts).set({ passwordHash }).where(eq(clinicianAccounts.id, id));
}

export async function setPasswordReset(email: string, tokenHash: string, expiresAt: Date) {
  const db = requireDb(await getDb());
  await db.update(clinicianAccounts).set({ resetTokenHash: tokenHash, resetTokenExpiresAt: expiresAt, resetTokenUsedAt: null }).where(eq(clinicianAccounts.email, email.toLowerCase()));
}

export async function consumePasswordReset(tokenHash: string, nextPasswordHash: string) {
  const db = requireDb(await getDb());
  const accounts = await db.select().from(clinicianAccounts).where(and(eq(clinicianAccounts.resetTokenHash, tokenHash), isNull(clinicianAccounts.resetTokenUsedAt))).limit(1);
  const account = accounts[0];
  if (!account?.resetTokenExpiresAt || account.resetTokenExpiresAt.getTime() < Date.now()) return undefined;
  await db.update(clinicianAccounts).set({ passwordHash: nextPasswordHash, resetTokenHash: null, resetTokenExpiresAt: null, resetTokenUsedAt: new Date(), sessionVersion: sql`${clinicianAccounts.sessionVersion} + 1` }).where(eq(clinicianAccounts.id, account.id));
  await createAuditLog(account.id, "PASSWORD_RESET_COMPLETED", "clinicianAccount", String(account.id));
  return getClinicianById(account.id);
}

export async function invalidateClinicianSessions(id: number) {
  const db = requireDb(await getDb());
  await db.update(clinicianAccounts).set({ sessionVersion: sql`${clinicianAccounts.sessionVersion} + 1` }).where(eq(clinicianAccounts.id, id));
}

const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export async function checkAuthRateLimit(scope: string, keyHash: string) {
  const db = requireDb(await getDb());
  const record = (await db.select().from(authRateLimits).where(and(eq(authRateLimits.scope, scope), eq(authRateLimits.keyHash, keyHash))).orderBy(desc(authRateLimits.updatedAt)).limit(1))[0];
  if (!record) return;
  if (record.lockedUntil && record.lockedUntil.getTime() > Date.now()) {
    throw new Error("Too many attempts. Please wait before trying again.");
  }
}

export async function registerAuthRateAttempt(scope: string, keyHash: string, success: boolean) {
  const db = requireDb(await getDb());
  const record = (await db.select().from(authRateLimits).where(and(eq(authRateLimits.scope, scope), eq(authRateLimits.keyHash, keyHash))).orderBy(desc(authRateLimits.updatedAt)).limit(1))[0];
  if (success) {
    if (record) await db.update(authRateLimits).set({ attempts: 0, lockedUntil: null, windowStartedAt: new Date() }).where(eq(authRateLimits.id, record.id));
    return;
  }
  const windowExpired = !record || Date.now() - record.windowStartedAt.getTime() > RATE_WINDOW_MS;
  const attempts = windowExpired ? 1 : record.attempts + 1;
  const lockMinutes = attempts >= MAX_ATTEMPTS ? Math.min(60, 2 ** (attempts - MAX_ATTEMPTS)) : 0;
  const values = { attempts, windowStartedAt: windowExpired ? new Date() : record.windowStartedAt, lockedUntil: lockMinutes ? new Date(Date.now() + lockMinutes * 60_000) : null };
  if (record) await db.update(authRateLimits).set(values).where(eq(authRateLimits.id, record.id));
  else await db.insert(authRateLimits).values({ scope, keyHash, ...values });
}

export async function createAuditLog(userId: number | null, action: string, resourceType: string, resourceId?: string, metadata?: Record<string, unknown>) {
  const db = requireDb(await getDb());
  await db.insert(auditLogs).values({ userId, action, resourceType, resourceId: resourceId ?? null, metadata: metadata ?? null });
}

export async function getOrCreateDemoVisitor(tokenHash: string, ipHash: string, visitorBindingHash: string) {
  const db = requireDb(await getDb());
  const existing = (await db.select().from(demoVisitors).where(eq(demoVisitors.tokenHash, tokenHash)).limit(1))[0];
  if (existing) return existing;
  try {
    const result = await db.insert(demoVisitors).values({ tokenHash, ipHash, visitorBindingHash });
    return (await db.select().from(demoVisitors).where(eq(demoVisitors.id, Number(result[0].insertId))).limit(1))[0]!;
  } catch (error) {
    const concurrent = (await db.select().from(demoVisitors).where(eq(demoVisitors.tokenHash, tokenHash)).limit(1))[0];
    if (concurrent) return concurrent;
    throw error;
  }
}

export async function consumeDemoVisitor(tokenHash: string) {
  const db = requireDb(await getDb());
  const result = await db.update(demoVisitors).set({ usedAt: new Date() }).where(and(eq(demoVisitors.tokenHash, tokenHash), isNull(demoVisitors.usedAt)));
  return Number(result[0].affectedRows) === 1;
}

export async function listPatients(ownerId: number, search?: string) {
  const db = requireDb(await getDb());
  const base = eq(patients.createdBy, ownerId);
  const filter = search?.trim()
    ? and(base, or(like(patients.displayName, `%${search.trim()}%`), like(patients.patientReference, `%${search.trim()}%`)))
    : base;
  return db.select().from(patients).where(filter).orderBy(desc(patients.updatedAt));
}

export async function getPatientOwned(ownerId: number, patientId: number) {
  const db = requireDb(await getDb());
  return (await db.select().from(patients).where(and(eq(patients.id, patientId), eq(patients.createdBy, ownerId))).limit(1))[0];
}

export async function createPatient(ownerId: number, input: { patientReference: string; displayName: string }) {
  const db = requireDb(await getDb());
  const result = await db.insert(patients).values({ createdBy: ownerId, ...input });
  const id = Number(result[0].insertId);
  await createAuditLog(ownerId, "PATIENT_CREATED", "patient", String(id));
  return getPatientOwned(ownerId, id);
}

export async function listStudies(ownerId: number) {
  const db = requireDb(await getDb());
  return db.select({ study: studies, patient: patients }).from(studies).innerJoin(patients, eq(studies.patientId, patients.id)).where(eq(studies.createdBy, ownerId)).orderBy(desc(studies.studyDate));
}

export async function getStudyOwned(ownerId: number, studyId: number) {
  const db = requireDb(await getDb());
  const record = (await db.select({ study: studies, patient: patients }).from(studies).innerJoin(patients, eq(studies.patientId, patients.id)).where(and(eq(studies.id, studyId), eq(studies.createdBy, ownerId))).limit(1))[0];
  if (!record) return undefined;
  const files = await db.select().from(studyFiles).where(eq(studyFiles.studyId, studyId));
  const jobs = await db.select().from(analysisJobs).where(eq(analysisJobs.studyId, studyId)).orderBy(desc(analysisJobs.submittedAt));
  const results = await db.select().from(analysisResults).innerJoin(analysisJobs, eq(analysisResults.analysisJobId, analysisJobs.id)).where(eq(analysisJobs.studyId, studyId)).orderBy(desc(analysisResults.createdAt));
  return { ...record, files, jobs, results };
}

export async function createStudy(ownerId: number, input: { patientId: number; studyDate: Date; description?: string; files: Array<{ modality: "t1" | "t1ce" | "t2" | "flair"; originalFilename: string; storagePath: string; fileSize: number; mimeType: string; checksum: string; relativePath: string | null; uncompressedSize: number; metadata: Record<string, unknown> }> }) {
  const db = requireDb(await getDb());
  const patient = await getPatientOwned(ownerId, input.patientId);
  if (!patient) throw new Error("Patient not found or not authorized.");
  const result = await db.insert(studies).values({ patientId: input.patientId, createdBy: ownerId, studyDate: input.studyDate, description: input.description || null, status: "queued" });
  const studyId = Number(result[0].insertId);
  if (input.files.length) await db.insert(studyFiles).values(input.files.map((file) => ({ ...file, studyId })));
  await createAuditLog(ownerId, "STUDY_CREATED", "study", String(studyId), { fileCount: input.files.length });
  return getStudyOwned(ownerId, studyId);
}

export async function createMockAnalysis(ownerId: number, studyId: number) {
  const db = requireDb(await getDb());
  const study = await getStudyOwned(ownerId, studyId);
  if (!study) throw new Error("Study not found or not authorized.");
  const result = await db.insert(analysisJobs).values({ studyId, createdBy: ownerId, modelName: "MockSegmentationService", modelVersion: "demo-1", status: "queued", isDemo: 1 });
  const id = Number(result[0].insertId);
  await db.update(studies).set({ status: "queued" }).where(eq(studies.id, studyId));
  await createAuditLog(ownerId, "ANALYSIS_MOCK_SUBMITTED", "analysisJob", String(id), { studyId });
  return (await db.select().from(analysisJobs).where(eq(analysisJobs.id, id)).limit(1))[0];
}

export async function recordAuthoritativeNiftiSegmentation(ownerId: number, input: { studyId: number; segmentationStoragePath: string; resultMetadata: Record<string, unknown> }) {
  const db = requireDb(await getDb());
  const study = await getStudyOwned(ownerId, input.studyId);
  if (!study) throw new Error("Study not found or not authorized.");
  const now = new Date();
  const inserted = await db.insert(analysisJobs).values({ studyId: input.studyId, createdBy: ownerId, modelName: "ExternalNiftiSegmentation", modelVersion: "api-contract-pending", status: "completed", isDemo: 0, submittedAt: now, startedAt: now, completedAt: now });
  const analysisJobId = Number(inserted[0].insertId);
  const result = await db.insert(analysisResults).values({ analysisJobId, segmentationStoragePath: input.segmentationStoragePath, resultMetadata: input.resultMetadata });
  await db.update(studies).set({ status: "completed" }).where(eq(studies.id, input.studyId));
  await createAuditLog(ownerId, "NIFTI_SEGMENTATION_STORED", "analysisJob", String(analysisJobId), { studyId: input.studyId });
  return { jobId: analysisJobId, resultId: Number(result[0].insertId) };
}

export async function listAnalysisJobs(ownerId: number) {
  const db = requireDb(await getDb());
  return db.select({ job: analysisJobs, study: studies, patient: patients }).from(analysisJobs).innerJoin(studies, eq(analysisJobs.studyId, studies.id)).innerJoin(patients, eq(studies.patientId, patients.id)).where(eq(analysisJobs.createdBy, ownerId)).orderBy(desc(analysisJobs.submittedAt));
}

export async function getDashboardMetrics(ownerId: number) {
  const db = requireDb(await getDb());
  const [patientCount] = await db.select({ value: count() }).from(patients).where(eq(patients.createdBy, ownerId));
  const [studyCount] = await db.select({ value: count() }).from(studies).where(eq(studies.createdBy, ownerId));
  const [completedCount] = await db.select({ value: count() }).from(analysisJobs).where(and(eq(analysisJobs.createdBy, ownerId), eq(analysisJobs.status, "completed")));
  const [needsReviewCount] = await db.select({ value: count() }).from(studies).where(and(eq(studies.createdBy, ownerId), eq(studies.status, "needs_review")));
  return { patients: patientCount?.value ?? 0, studies: studyCount?.value ?? 0, completed: completedCount?.value ?? 0, needsReview: needsReviewCount?.value ?? 0 };
}

export async function getAdminSystemOverview() {
  const db = requireDb(await getDb());
  const [clinicianCount] = await db.select({ value: count() }).from(clinicianAccounts);
  const [studyCount] = await db.select({ value: count() }).from(studies);
  const [jobCount] = await db.select({ value: count() }).from(analysisJobs);
  const [errorCount] = await db.select({ value: count() }).from(analysisJobs).where(eq(analysisJobs.status, "failed"));
  const recentJobs = await db.select().from(analysisJobs).orderBy(desc(analysisJobs.submittedAt)).limit(8);
  return { clinicians: clinicianCount?.value ?? 0, studies: studyCount?.value ?? 0, jobs: jobCount?.value ?? 0, failedJobs: errorCount?.value ?? 0, recentJobs };
}

export async function createAccessRequest(input: { name: string; email: string; company?: string; message?: string }) {
  const db = requireDb(await getDb());
  await db.insert(accessRequests).values({ name: input.name, email: input.email, company: input.company || null, message: input.message || null });
}

export async function createWorkspaceFile(input: { ownerId: number; fileKey: string; url: string; originalName: string; mimeType: string; sizeBytes: number }) {
  const db = requireDb(await getDb()); await db.insert(workspaceFiles).values(input);
}

export async function listWorkspaceFiles(ownerId: number) {
  const db = requireDb(await getDb()); return db.select().from(workspaceFiles).where(eq(workspaceFiles.ownerId, ownerId)).orderBy(desc(workspaceFiles.createdAt));
}
