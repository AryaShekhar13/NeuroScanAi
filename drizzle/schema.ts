import { index, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/** Legacy managed OAuth users retained for the existing platform integration. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/** Credential accounts for the NeuroScan clinical application. Passwords are stored only as salted hashes. */
export const clinicianAccounts = mysqlTable("clinicianAccounts", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["clinician", "admin"]).default("clinician").notNull(),
  fullName: varchar("fullName", { length: 160 }).notNull(),
  professionalRole: varchar("professionalRole", { length: 160 }).notNull(),
  institution: varchar("institution", { length: 200 }).notNull(),
  resetTokenHash: varchar("resetTokenHash", { length: 128 }),
  resetTokenExpiresAt: timestamp("resetTokenExpiresAt"),
  resetTokenUsedAt: timestamp("resetTokenUsedAt"),
  sessionVersion: int("sessionVersion").default(1).notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Singleton configuration. The configurable upstream MRI URL remains server-only. */
export const systemConfigurations = mysqlTable("systemConfigurations", {
  id: int("id").primaryKey(),
  inferenceApiBaseUrl: varchar("inferenceApiBaseUrl", { length: 512 }),
  lastApiCheckAt: timestamp("lastApiCheckAt"),
  lastApiCheckStatus: mysqlEnum("lastApiCheckStatus", ["unknown", "online", "offline"]).default("unknown").notNull(),
  lastApiCheckMessage: varchar("lastApiCheckMessage", { length: 240 }),
  modelName: varchar("modelName", { length: 160 }),
  modelVersion: varchar("modelVersion", { length: 100 }),
  updatedBy: int("updatedBy").references(() => clinicianAccounts.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const patients = mysqlTable("patients", {
  id: int("id").autoincrement().primaryKey(),
  createdBy: int("createdBy").notNull().references(() => clinicianAccounts.id, { onDelete: "cascade" }),
  patientReference: varchar("patientReference", { length: 80 }).notNull(),
  displayName: varchar("displayName", { length: 160 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("patients_owner_reference_idx").on(table.createdBy, table.patientReference)]);

export const studies = mysqlTable("studies", {
  id: int("id").autoincrement().primaryKey(),
  patientId: int("patientId").notNull().references(() => patients.id, { onDelete: "cascade" }),
  createdBy: int("createdBy").notNull().references(() => clinicianAccounts.id, { onDelete: "cascade" }),
  studyDate: timestamp("studyDate").notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["queued", "processing", "completed", "failed", "needs_review"]).default("queued").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("studies_owner_date_idx").on(table.createdBy, table.studyDate), index("studies_patient_idx").on(table.patientId)]);

export const studyFiles = mysqlTable("studyFiles", {
  id: int("id").autoincrement().primaryKey(),
  studyId: int("studyId").notNull().references(() => studies.id, { onDelete: "cascade" }),
  modality: mysqlEnum("modality", ["t1", "t1ce", "t2", "flair"]).notNull(),
  originalFilename: varchar("originalFilename", { length: 255 }).notNull(),
  storagePath: varchar("storagePath", { length: 512 }).notNull().unique(),
  fileSize: int("fileSize").notNull(),
  mimeType: varchar("mimeType", { length: 150 }).notNull(),
  checksum: varchar("checksum", { length: 64 }),
  relativePath: varchar("relativePath", { length: 512 }),
  uncompressedSize: int("uncompressedSize"),
  metadata: json("metadata"),
  uploadStatus: mysqlEnum("uploadStatus", ["uploaded", "failed"]).default("uploaded").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("studyFiles_study_idx").on(table.studyId)]);

export const analysisJobs = mysqlTable("analysisJobs", {
  id: int("id").autoincrement().primaryKey(),
  studyId: int("studyId").notNull().references(() => studies.id, { onDelete: "cascade" }),
  createdBy: int("createdBy").notNull().references(() => clinicianAccounts.id, { onDelete: "cascade" }),
  modelName: varchar("modelName", { length: 160 }).notNull(),
  modelVersion: varchar("modelVersion", { length: 100 }).notNull(),
  status: mysqlEnum("status", ["queued", "processing", "completed", "failed", "needs_review"]).default("queued").notNull(),
  isDemo: int("isDemo").default(1).notNull(),
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  errorMessage: text("errorMessage"),
}, (table) => [index("analysisJobs_owner_status_idx").on(table.createdBy, table.status)]);

export const analysisResults = mysqlTable("analysisResults", {
  id: int("id").autoincrement().primaryKey(),
  analysisJobId: int("analysisJobId").notNull().references(() => analysisJobs.id, { onDelete: "cascade" }),
  segmentationStoragePath: varchar("segmentationStoragePath", { length: 512 }),
  resultMetadata: json("resultMetadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => clinicianAccounts.id, { onDelete: "set null" }),
  action: varchar("action", { length: 120 }).notNull(),
  resourceType: varchar("resourceType", { length: 80 }).notNull(),
  resourceId: varchar("resourceId", { length: 80 }),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("auditLogs_user_createdAt_idx").on(table.userId, table.createdAt)]);

/** Hashed request-attempt counters prevent brute-force authentication without retaining raw identifiers. */
export const authRateLimits = mysqlTable("authRateLimits", {
  id: int("id").autoincrement().primaryKey(),
  scope: varchar("scope", { length: 64 }).notNull(),
  keyHash: varchar("keyHash", { length: 64 }).notNull(),
  attempts: int("attempts").default(0).notNull(),
  windowStartedAt: timestamp("windowStartedAt").defaultNow().notNull(),
  lockedUntil: timestamp("lockedUntil"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("authRateLimits_scope_key_idx").on(table.scope, table.keyHash)]);

/** A hashed, server-enforced allowance for one anonymous demonstration analysis per visitor. */
export const demoVisitors = mysqlTable("demoVisitors", {
  id: int("id").autoincrement().primaryKey(),
  tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
  ipHash: varchar("ipHash", { length: 64 }).notNull(),
  visitorBindingHash: varchar("visitorBindingHash", { length: 64 }).notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("demoVisitors_ip_createdAt_idx").on(table.ipHash, table.createdAt), index("demoVisitors_binding_createdAt_idx").on(table.visitorBindingHash, table.createdAt)]);

/** Public requests from the original landing experience. */
export const accessRequests = mysqlTable("accessRequests", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  company: varchar("company", { length: 160 }),
  message: text("message"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("accessRequests_createdAt_idx").on(table.createdAt)]);

/** Legacy workspace metadata; bytes remain in managed storage. */
export const workspaceFiles = mysqlTable("workspaceFiles", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
  fileKey: varchar("fileKey", { length: 512 }).notNull().unique(),
  url: varchar("url", { length: 768 }).notNull(),
  originalName: varchar("originalName", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 150 }).notNull(),
  sizeBytes: int("sizeBytes").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("workspaceFiles_owner_createdAt_idx").on(table.ownerId, table.createdAt)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type ClinicianAccount = typeof clinicianAccounts.$inferSelect;
export type StudyStatus = typeof studies.$inferSelect["status"];
