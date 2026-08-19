import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import {
  consumePasswordReset,
  createClinician,
  createMockAnalysis,
  createPatient,
  createStudy,
  getClinicianByEmail,
  getDashboardMetrics,
  getPatientOwned,
  getStudyOwned,
  listAnalysisJobs,
  listPatients,
  listStudies,
  setPasswordReset,
  touchClinicianLogin,
} from "./db";
import {
  clearClinicianSessionCookie,
  createClinicianSession,
  createResetToken,
  hashPassword,
  hashResetToken,
  setClinicianSessionCookie,
  verifyPassword,
} from "./clinicalAuth";
import { decodeClinicalUpload } from "./clinicalFileValidation";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { systemRouter } from "./_core/systemRouter";
import { clinicianProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { decodeUpload } from "./fileValidation";
import { createAccessRequest, createWorkspaceFile, listWorkspaceFiles } from "./db";
import { storagePut } from "./storage";

const optionalShortText = (max: number) => z.string().trim().max(max).optional();
const clinicianInput = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8, "Password must be at least 8 characters.").max(128),
});
const clinicianProfileInput = clinicianInput.extend({
  fullName: z.string().trim().min(2).max(160),
  professionalRole: z.string().trim().min(2).max(160),
  institution: z.string().trim().min(2).max(200),
});
const clinicalFileInput = z.object({
  modality: z.enum(["t1", "t1ce", "t2", "flair"]),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().max(150).default("application/octet-stream"),
  base64: z.string().min(4).max(11_200_000),
});

function clinicianView(clinician: { id: number; email: string; fullName: string; professionalRole: string; institution: string }) {
  return { id: clinician.id, email: clinician.email, fullName: clinician.fullName, professionalRole: clinician.professionalRole, institution: clinician.institution };
}

function requireFound<T>(value: T | undefined, resource = "Record"): T {
  if (!value) throw new TRPCError({ code: "NOT_FOUND", message: `${resource} not found or not authorized.` });
  return value;
}

export const appRouter = router({
  system: systemRouter,
  // Legacy platform OAuth endpoints remain isolated from the clinician credential application.
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  clinicianAuth: router({
    me: publicProcedure.query(({ ctx }) => ctx.clinician ? clinicianView(ctx.clinician) : null),
    signup: publicProcedure.input(clinicianProfileInput).mutation(async ({ ctx, input }) => {
      const existing = await getClinicianByEmail(input.email);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists." });
      const clinician = await createClinician({
        email: input.email,
        passwordHash: await hashPassword(input.password),
        fullName: input.fullName,
        professionalRole: input.professionalRole,
        institution: input.institution,
      });
      setClinicianSessionCookie(ctx.res, await createClinicianSession(clinician.id));
      return { clinician: clinicianView(clinician) };
    }),
    login: publicProcedure.input(clinicianInput).mutation(async ({ ctx, input }) => {
      const clinician = await getClinicianByEmail(input.email);
      const valid = clinician ? await verifyPassword(input.password, clinician.passwordHash) : false;
      if (!clinician || !valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
      await touchClinicianLogin(clinician.id);
      setClinicianSessionCookie(ctx.res, await createClinicianSession(clinician.id));
      return { clinician: clinicianView(clinician) };
    }),
    logout: clinicianProcedure.mutation(async ({ ctx }) => {
      clearClinicianSessionCookie(ctx.res);
      return { success: true } as const;
    }),
    forgotPassword: publicProcedure.input(z.object({ email: z.string().trim().email().max(320) })).mutation(async ({ input }) => {
      const clinician = await getClinicianByEmail(input.email);
      let developmentResetToken: string | undefined;
      if (clinician) {
        const token = createResetToken();
        await setPasswordReset(clinician.email, hashResetToken(token), new Date(Date.now() + 60 * 60 * 1000));
        if (!ENV.isProduction) developmentResetToken = token;
      }
      return { success: true, developmentResetToken };
    }),
    resetPassword: publicProcedure.input(z.object({ token: z.string().min(20), password: z.string().min(8, "Password must be at least 8 characters.").max(128) })).mutation(async ({ ctx, input }) => {
      const clinician = await consumePasswordReset(hashResetToken(input.token), await hashPassword(input.password));
      if (!clinician) throw new TRPCError({ code: "BAD_REQUEST", message: "That password reset link is invalid or has expired." });
      setClinicianSessionCookie(ctx.res, await createClinicianSession(clinician.id));
      return { clinician: clinicianView(clinician) };
    }),
  }),
  dashboard: router({
    summary: clinicianProcedure.query(async ({ ctx }) => ({
      metrics: await getDashboardMetrics(ctx.clinician.id),
      recentStudies: (await listStudies(ctx.clinician.id)).slice(0, 5),
    })),
  }),
  patients: router({
    list: clinicianProcedure.input(z.object({ search: z.string().trim().max(160).optional() }).optional()).query(({ ctx, input }) => listPatients(ctx.clinician.id, input?.search)),
    create: clinicianProcedure.input(z.object({ patientReference: z.string().trim().min(2).max(80), displayName: z.string().trim().min(2).max(160) })).mutation(async ({ ctx, input }) => ({ patient: await createPatient(ctx.clinician.id, input) })),
    get: clinicianProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => ({ patient: requireFound(await getPatientOwned(ctx.clinician.id, input.id), "Patient") })),
  }),
  studies: router({
    list: clinicianProcedure.query(({ ctx }) => listStudies(ctx.clinician.id)),
    get: clinicianProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => ({ study: requireFound(await getStudyOwned(ctx.clinician.id, input.id), "Study") })),
    create: clinicianProcedure.input(z.object({
      patientId: z.number().int().positive(),
      studyDate: z.date(),
      description: z.string().trim().max(2000).optional(),
      files: z.array(clinicalFileInput).min(1).max(4).superRefine((files, issue) => {
        if (new Set(files.map((file) => file.modality)).size !== files.length) issue.addIssue({ code: "custom", message: "Each MRI modality can only be uploaded once." });
      }),
    })).mutation(async ({ ctx, input }) => {
      requireFound(await getPatientOwned(ctx.clinician.id, input.patientId), "Patient");
      const storedFiles = [] as Array<{ modality: "t1" | "t1ce" | "t2" | "flair"; originalFilename: string; storagePath: string; fileSize: number; mimeType: string }>;
      for (const file of input.files) {
        const decoded = decodeClinicalUpload(file);
        const stored = await storagePut(`clinical/${ctx.clinician.id}/mri/${Date.now()}-${file.modality}-${decoded.fileName}`, decoded.bytes, file.mimeType || "application/octet-stream");
        storedFiles.push({ modality: file.modality, originalFilename: decoded.fileName, storagePath: stored.key, fileSize: decoded.bytes.byteLength, mimeType: file.mimeType || "application/octet-stream" });
      }
      return { study: await createStudy(ctx.clinician.id, { patientId: input.patientId, studyDate: input.studyDate, description: input.description, files: storedFiles }) };
    }),
  }),
  analysis: router({
    list: clinicianProcedure.query(({ ctx }) => listAnalysisJobs(ctx.clinician.id)),
    submitMock: clinicianProcedure.input(z.object({ studyId: z.number().int().positive() })).mutation(async ({ ctx, input }) => ({ job: await createMockAnalysis(ctx.clinician.id, input.studyId), notice: "Demo / mock analysis only. No clinical inference has been performed." })),
  }),
  accessRequests: router({
    create: publicProcedure.input(z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(320), company: optionalShortText(160), message: optionalShortText(2000) })).mutation(async ({ input }) => { await createAccessRequest(input); return { success: true } as const; }),
  }),
  // Legacy research workspace API retained for the existing project integration.
  workspaceFiles: router({
    list: protectedProcedure.query(({ ctx }) => listWorkspaceFiles(ctx.user.id)),
    upload: protectedProcedure.input(z.object({ fileName: z.string().trim().min(1).max(255), mimeType: z.string().trim().min(1).max(150), base64: z.string().min(4).max(11_200_000) })).mutation(async ({ ctx, input }) => {
      const decoded = decodeUpload(input);
      const stored = await storagePut(`workspace/${ctx.user.id}/${Date.now()}-${decoded.fileName}`, decoded.bytes, input.mimeType);
      await createWorkspaceFile({ ownerId: ctx.user.id, fileKey: stored.key, url: stored.url, originalName: decoded.fileName, mimeType: input.mimeType, sizeBytes: decoded.bytes.byteLength });
      return { success: true, file: { url: stored.url, name: decoded.fileName } } as const;
    }),
  }),
});

export type AppRouter = typeof appRouter;
