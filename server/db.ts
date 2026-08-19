import { and, count, desc, eq, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  accessRequests,
  analysisJobs,
  auditLogs,
  clinicianAccounts,
  InsertUser,
  patients,
  studies,
  studyFiles,
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

export async function createClinician(input: { email: string; passwordHash: string; fullName: string; professionalRole: string; institution: string }) {
  const db = requireDb(await getDb());
  const result = await db.insert(clinicianAccounts).values({ ...input, email: input.email.toLowerCase() });
  const id = Number(result[0].insertId);
  await createAuditLog(id, "account.created", "clinicianAccount", String(id));
  return (await getClinicianById(id))!;
}

export async function touchClinicianLogin(id: number) {
  const db = requireDb(await getDb());
  await db.update(clinicianAccounts).set({ lastSignedIn: new Date() }).where(eq(clinicianAccounts.id, id));
}

export async function setPasswordReset(email: string, tokenHash: string, expiresAt: Date) {
  const db = requireDb(await getDb());
  await db.update(clinicianAccounts).set({ resetTokenHash: tokenHash, resetTokenExpiresAt: expiresAt }).where(eq(clinicianAccounts.email, email.toLowerCase()));
}

export async function consumePasswordReset(tokenHash: string, nextPasswordHash: string) {
  const db = requireDb(await getDb());
  const accounts = await db.select().from(clinicianAccounts).where(eq(clinicianAccounts.resetTokenHash, tokenHash)).limit(1);
  const account = accounts[0];
  if (!account?.resetTokenExpiresAt || account.resetTokenExpiresAt.getTime() < Date.now()) return undefined;
  await db.update(clinicianAccounts).set({ passwordHash: nextPasswordHash, resetTokenHash: null, resetTokenExpiresAt: null }).where(eq(clinicianAccounts.id, account.id));
  await createAuditLog(account.id, "account.password_reset", "clinicianAccount", String(account.id));
  return getClinicianById(account.id);
}

export async function createAuditLog(userId: number | null, action: string, resourceType: string, resourceId?: string, metadata?: Record<string, unknown>) {
  const db = requireDb(await getDb());
  await db.insert(auditLogs).values({ userId, action, resourceType, resourceId: resourceId ?? null, metadata: metadata ?? null });
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
  await createAuditLog(ownerId, "patient.created", "patient", String(id));
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
  return { ...record, files, jobs };
}

export async function createStudy(ownerId: number, input: { patientId: number; studyDate: Date; description?: string; files: Array<{ modality: "t1" | "t1ce" | "t2" | "flair"; originalFilename: string; storagePath: string; fileSize: number; mimeType: string }> }) {
  const db = requireDb(await getDb());
  const patient = await getPatientOwned(ownerId, input.patientId);
  if (!patient) throw new Error("Patient not found or not authorized.");
  const result = await db.insert(studies).values({ patientId: input.patientId, createdBy: ownerId, studyDate: input.studyDate, description: input.description || null, status: "queued" });
  const studyId = Number(result[0].insertId);
  if (input.files.length) await db.insert(studyFiles).values(input.files.map((file) => ({ ...file, studyId })));
  await createAuditLog(ownerId, "study.created", "study", String(studyId), { fileCount: input.files.length });
  return getStudyOwned(ownerId, studyId);
}

export async function createMockAnalysis(ownerId: number, studyId: number) {
  const db = requireDb(await getDb());
  const study = await getStudyOwned(ownerId, studyId);
  if (!study) throw new Error("Study not found or not authorized.");
  const result = await db.insert(analysisJobs).values({ studyId, createdBy: ownerId, modelName: "MockSegmentationService", modelVersion: "demo-1", status: "queued", isDemo: 1 });
  const id = Number(result[0].insertId);
  await db.update(studies).set({ status: "queued" }).where(eq(studies.id, studyId));
  await createAuditLog(ownerId, "analysis.mock_submitted", "analysisJob", String(id), { studyId });
  return (await db.select().from(analysisJobs).where(eq(analysisJobs.id, id)).limit(1))[0];
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
