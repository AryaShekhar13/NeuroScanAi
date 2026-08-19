import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import {
  checkAuthRateLimit,
  consumePasswordReset,
  createAccessRequest,
  createAuditLog,
  createClinician,
  createMockAnalysis,
  createPatient,
  createStudy,
  createWorkspaceFile,
  consumeDemoVisitor,
  getClinicianByEmail,
  getDashboardMetrics,
  getPatientOwned,
  getStudyOwned,
  invalidateClinicianSessions,
  listAnalysisJobs,
  listPatients,
  listStudies,
  listWorkspaceFiles,
  getOrCreateDemoVisitor,
  registerAuthRateAttempt,
  setPasswordReset,
  touchClinicianLogin,
  updateClinicianPasswordHash,
} from "./db";
import {
  clearClinicianSessionCookie,
  createClinicianSession,
  createDemoVisitorToken,
  createResetToken,
  hashPassword,
  hashRateLimitKey,
  hashDemoVisitorToken,
  hashResetToken,
  needsPasswordUpgrade,
  setClinicianSessionCookie,
  setDemoVisitorCookie,
  readDemoVisitorToken,
  verifyPassword,
} from "./clinicalAuth";
import { decodeClinicalUpload, inspectClinicalUploads } from "./clinicalFileValidation";
import { sendPasswordResetEmail } from "./emailService";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { clinicianProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { decodeUpload } from "./fileValidation";
import { storagePut } from "./storage";

const optionalShortText = (max: number) => z.string().trim().max(max).optional();
const passwordRule = z.string().min(10, "Password must be at least 10 characters.").max(128).regex(/[A-Za-z]/, "Password must contain a letter.").regex(/\d/, "Password must contain a number.");
const clinicianInput = z.object({ email: z.string().trim().email().max(320), password: passwordRule });
const clinicianProfileInput = clinicianInput.extend({ fullName: z.string().trim().min(2).max(160), professionalRole: z.string().trim().min(2).max(160), institution: z.string().trim().min(2).max(200) });
const clinicalFileInput = z.object({ modality: z.enum(["t1", "t1ce", "t2", "flair"]), fileName: z.string().trim().min(1).max(255), mimeType: z.string().trim().max(150).default("application/octet-stream"), base64: z.string().min(4).max(11_200_000), relativePath: z.string().max(512).optional() });

function clinicianView(clinician: { id: number; email: string; fullName: string; professionalRole: string; institution: string }) { return { id: clinician.id, email: clinician.email, fullName: clinician.fullName, professionalRole: clinician.professionalRole, institution: clinician.institution }; }
function requireFound<T>(value: T | undefined, resource = "Record"): T { if (!value) throw new TRPCError({ code: "NOT_FOUND", message: `${resource} not found or not authorized.` }); return value; }
function rateKey(scope: string, emailOrToken: string, ip: string | undefined) { return hashRateLimitKey(scope, `${emailOrToken}|${ip ?? "unknown"}`); }
function demoIpHash(ip: string | undefined) { return hashRateLimitKey("demo-ip", ip ?? "unknown"); }
function demoVisitorBindingHash(ip: string | undefined, userAgent: string | undefined) { return hashRateLimitKey("demo-visitor", `${ip ?? "unknown"}|${(userAgent ?? "unknown").slice(0, 512)}`); }

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }),
  }),
  clinicianAuth: router({
    me: publicProcedure.query(({ ctx }) => ctx.clinician ? clinicianView(ctx.clinician) : null),
    signup: publicProcedure.input(clinicianProfileInput).mutation(async ({ ctx, input }) => {
      const existing = await getClinicianByEmail(input.email);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists." });
      const clinician = await createClinician({ email: input.email, passwordHash: await hashPassword(input.password), fullName: input.fullName, professionalRole: input.professionalRole, institution: input.institution });
      setClinicianSessionCookie(ctx.res, await createClinicianSession(clinician.id, clinician.sessionVersion));
      return { clinician: clinicianView(clinician) };
    }),
    login: publicProcedure.input(clinicianInput).mutation(async ({ ctx, input }) => {
      const limitKey = rateKey("login", input.email, ctx.req.ip);
      try { await checkAuthRateLimit("login", limitKey); } catch (error) { throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: error instanceof Error ? error.message : "Too many attempts." }); }
      const clinician = await getClinicianByEmail(input.email);
      const valid = clinician ? await verifyPassword(input.password, clinician.passwordHash) : false;
      if (!clinician || !valid) { await registerAuthRateAttempt("login", limitKey, false); await createAuditLog(clinician?.id ?? null, "LOGIN_FAILURE", "authentication"); throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." }); }
      await registerAuthRateAttempt("login", limitKey, true); await touchClinicianLogin(clinician.id); await createAuditLog(clinician.id, "LOGIN_SUCCESS", "authentication");
      if (needsPasswordUpgrade(clinician.passwordHash)) await updateClinicianPasswordHash(clinician.id, await hashPassword(input.password));
      setClinicianSessionCookie(ctx.res, await createClinicianSession(clinician.id, clinician.sessionVersion));
      return { clinician: clinicianView(clinician) };
    }),
    logout: clinicianProcedure.mutation(async ({ ctx }) => { await invalidateClinicianSessions(ctx.clinician.id); await createAuditLog(ctx.clinician.id, "LOGOUT", "authentication"); clearClinicianSessionCookie(ctx.res); return { success: true } as const; }),
    forgotPassword: publicProcedure.input(z.object({ email: z.string().trim().email().max(320) })).mutation(async ({ ctx, input }) => {
      const limitKey = rateKey("forgot-password", input.email, ctx.req.ip);
      try { await checkAuthRateLimit("forgot-password", limitKey); } catch { return { success: true } as const; }
      const clinician = await getClinicianByEmail(input.email);
      if (clinician) {
        const token = createResetToken(); const expiresMinutes = 30;
        await setPasswordReset(clinician.email, hashResetToken(token), new Date(Date.now() + expiresMinutes * 60 * 1000));
        const baseUrl = process.env.APP_URL;
        if (!baseUrl) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Password reset email is unavailable. Please try again later." });
        try {
          await sendPasswordResetEmail({ recipient: clinician.email, resetUrl: new URL(`/reset-password?token=${encodeURIComponent(token)}`, baseUrl).toString(), expiresMinutes });
          await createAuditLog(clinician.id, "PASSWORD_RESET_REQUESTED", "authentication");
        } catch {
          await createAuditLog(clinician.id, "PASSWORD_RESET_DELIVERY_FAILED", "authentication");
        }
      }
      await registerAuthRateAttempt("forgot-password", limitKey, false);
      return { success: true } as const;
    }),
    resetPassword: publicProcedure.input(z.object({ token: z.string().min(20), password: passwordRule })).mutation(async ({ ctx, input }) => {
      const limitKey = rateKey("reset-password", input.token, ctx.req.ip);
      try { await checkAuthRateLimit("reset-password", limitKey); } catch (error) { throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: error instanceof Error ? error.message : "Too many attempts." }); }
      const clinician = await consumePasswordReset(hashResetToken(input.token), await hashPassword(input.password));
      if (!clinician) { await registerAuthRateAttempt("reset-password", limitKey, false); throw new TRPCError({ code: "BAD_REQUEST", message: "That password reset link is invalid, used, or expired." }); }
      await registerAuthRateAttempt("reset-password", limitKey, true);
      return { success: true } as const;
    }),
  }),
  demo: router({
    status: publicProcedure.query(async ({ ctx }) => {
      const token = readDemoVisitorToken(ctx.req.headers.cookie) ?? createDemoVisitorToken();
      if (!readDemoVisitorToken(ctx.req.headers.cookie)) setDemoVisitorCookie(ctx.res, token);
      const visitor = await getOrCreateDemoVisitor(hashDemoVisitorToken(token), demoIpHash(ctx.req.ip), demoVisitorBindingHash(ctx.req.ip, ctx.req.headers["user-agent"]));
      return { used: Boolean(visitor.usedAt) };
    }),
    run: publicProcedure.input(z.object({ files: z.array(clinicalFileInput).min(1).max(4).superRefine((files, issue) => { if (new Set(files.map((file) => file.modality)).size !== files.length) issue.addIssue({ code: "custom", message: "Each MRI modality can only be uploaded once." }); }) })).mutation(async ({ ctx, input }) => {
      const token = readDemoVisitorToken(ctx.req.headers.cookie) ?? createDemoVisitorToken();
      if (!readDemoVisitorToken(ctx.req.headers.cookie)) setDemoVisitorCookie(ctx.res, token);
      const tokenHash = hashDemoVisitorToken(token);
      const ipHash = demoIpHash(ctx.req.ip);
      const bindingHash = demoVisitorBindingHash(ctx.req.ip, ctx.req.headers["user-agent"]);
      const visitor = await getOrCreateDemoVisitor(tokenHash, ipHash, bindingHash);
      if (visitor.usedAt) throw new TRPCError({ code: "FORBIDDEN", message: "Your free analysis has been used. Create an account to continue using NeuroScan AI." });
      let inspection;
      try { inspection = inspectClinicalUploads(input.files); } catch { throw new TRPCError({ code: "BAD_REQUEST", message: "File validation failed. The selected file could not be verified as a supported compressed MRI file." }); }
      if (!inspection.complete) throw new TRPCError({ code: "BAD_REQUEST", message: "This MRI study is incomplete. Add missing modalities and resolve duplicate selections before running the demo." });
      if (!await consumeDemoVisitor(tokenHash, bindingHash)) throw new TRPCError({ code: "FORBIDDEN", message: "Your free analysis has been used. Create an account to continue using NeuroScan AI." });
      await createAuditLog(null, "DEMO_ANALYSIS_COMPLETED", "demoVisitor", String(visitor.id), { modalityCount: inspection.files.length, totalBytes: inspection.totalBytes });
      return { used: true, notice: "Demo analysis complete. This demonstration does not provide a clinical diagnosis or inference result.", detected: inspection.files.map((file) => ({ modality: file.modality, fileName: file.fileName, metadata: file.metadata })) };
    }),
  }),
  dashboard: router({ summary: clinicianProcedure.query(async ({ ctx }) => ({ metrics: await getDashboardMetrics(ctx.clinician.id), recentStudies: (await listStudies(ctx.clinician.id)).slice(0, 5) })) }),
  patients: router({
    list: clinicianProcedure.input(z.object({ search: z.string().trim().max(160).optional() }).optional()).query(({ ctx, input }) => listPatients(ctx.clinician.id, input?.search)),
    create: clinicianProcedure.input(z.object({ patientReference: z.string().trim().min(2).max(80), displayName: z.string().trim().min(2).max(160) })).mutation(async ({ ctx, input }) => ({ patient: await createPatient(ctx.clinician.id, input) })),
    get: clinicianProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => ({ patient: requireFound(await getPatientOwned(ctx.clinician.id, input.id), "Patient") })),
  }),
  studies: router({
    list: clinicianProcedure.query(({ ctx }) => listStudies(ctx.clinician.id)),
    get: clinicianProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => ({ study: requireFound(await getStudyOwned(ctx.clinician.id, input.id), "Study") })),
    inspect: clinicianProcedure.input(z.object({ files: z.array(clinicalFileInput).min(1).max(200) })).mutation(async ({ input }) => {
      try {
        const inspection = inspectClinicalUploads(input.files);
        return {
          complete: inspection.complete,
          duplicates: inspection.duplicates,
          duplicateChecksums: inspection.duplicateChecksums.length,
          missing: inspection.missing,
          totalBytes: inspection.totalBytes,
          files: inspection.files.map((file) => ({ fileName: file.fileName, relativePath: file.relativePath, modality: file.modality, checksum: file.checksum, uncompressedSize: file.uncompressedSize })),
        };
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error && error.message.startsWith("This MRI") ? error.message : "File validation failed. The selected file could not be verified as a supported MRI file." });
      }
    }),
    create: clinicianProcedure.input(z.object({ patientId: z.number().int().positive(), studyDate: z.date(), description: z.string().trim().max(2000).optional(), files: z.array(clinicalFileInput).min(1).max(4).superRefine((files, issue) => { if (new Set(files.map((file) => file.modality)).size !== files.length) issue.addIssue({ code: "custom", message: "Each MRI modality can only be uploaded once." }); }) })).mutation(async ({ ctx, input }) => {
      requireFound(await getPatientOwned(ctx.clinician.id, input.patientId), "Patient");
      let inspection;
      try { inspection = inspectClinicalUploads(input.files); } catch (error) { await createAuditLog(ctx.clinician.id, "FILE_VALIDATION_FAILED", "study"); throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error && error.message.startsWith("This MRI") ? error.message : "File validation failed. The selected file could not be verified as a supported MRI file." }); }
      if (!inspection.complete) throw new TRPCError({ code: "BAD_REQUEST", message: "This study is incomplete. Add missing modalities and resolve duplicate selections before confirming." });
      const storedFiles: Array<{ modality: "t1" | "t1ce" | "t2" | "flair"; originalFilename: string; storagePath: string; fileSize: number; mimeType: string; checksum: string; relativePath: string | null; uncompressedSize: number; metadata: Record<string, unknown> }> = [];
      for (let index = 0; index < input.files.length; index += 1) {
        const file = input.files[index]!;
        await createAuditLog(ctx.clinician.id, "FILE_UPLOAD_STARTED", "studyFile", undefined, { modality: file.modality });
        try {
          const decoded = inspection.files[index] ?? decodeClinicalUpload(file);
          if (decoded.modality !== file.modality) throw new Error("File validation failed.");
          const storageKey = `clinical/${ctx.clinician.id}/mri/${Date.now()}-${decoded.checksum.slice(0, 12)}-${decoded.fileName}`;
          const stored = await storagePut(storageKey, decoded.bytes, "application/octet-stream");
          storedFiles.push({ modality: decoded.modality, originalFilename: decoded.fileName, storagePath: stored.key, fileSize: decoded.bytes.byteLength, mimeType: "application/octet-stream", checksum: decoded.checksum, relativePath: decoded.relativePath, uncompressedSize: decoded.uncompressedSize, metadata: decoded.metadata });
          await createAuditLog(ctx.clinician.id, "FILE_UPLOAD_COMPLETED", "studyFile", undefined, { modality: decoded.modality, checksum: decoded.checksum });
        } catch (error) {
          await createAuditLog(ctx.clinician.id, "FILE_UPLOAD_REJECTED", "studyFile", undefined, { modality: file.modality });
          await createAuditLog(ctx.clinician.id, "FILE_VALIDATION_FAILED", "studyFile", undefined, { modality: file.modality });
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error && error.message.startsWith("This MRI") ? error.message : "File validation failed. The selected file could not be verified as a supported MRI file." });
        }
      }
      return { study: await createStudy(ctx.clinician.id, { patientId: input.patientId, studyDate: input.studyDate, description: input.description, files: storedFiles }) };
    }),
  }),
  analysis: router({ list: clinicianProcedure.query(({ ctx }) => listAnalysisJobs(ctx.clinician.id)), submitMock: clinicianProcedure.input(z.object({ studyId: z.number().int().positive() })).mutation(async ({ ctx, input }) => ({ job: await createMockAnalysis(ctx.clinician.id, input.studyId), notice: "Demo / mock analysis only. No clinical inference has been performed." })) }),
  accessRequests: router({ create: publicProcedure.input(z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(320), company: optionalShortText(160), message: optionalShortText(2000) })).mutation(async ({ input }) => { await createAccessRequest(input); return { success: true } as const; }) }),
  workspaceFiles: router({
    list: protectedProcedure.query(({ ctx }) => listWorkspaceFiles(ctx.user.id)),
    upload: protectedProcedure.input(z.object({ fileName: z.string().trim().min(1).max(255), mimeType: z.string().trim().min(1).max(150), base64: z.string().min(4).max(11_200_000) })).mutation(async ({ ctx, input }) => { const decoded = decodeUpload(input); const stored = await storagePut(`workspace/${ctx.user.id}/${Date.now()}-${decoded.fileName}`, decoded.bytes, input.mimeType); await createWorkspaceFile({ ownerId: ctx.user.id, fileKey: stored.key, url: stored.url, originalName: decoded.fileName, mimeType: input.mimeType, sizeBytes: decoded.bytes.byteLength }); return { success: true, file: { url: stored.url, name: decoded.fileName } } as const; }),
  }),
});

export type AppRouter = typeof appRouter;
