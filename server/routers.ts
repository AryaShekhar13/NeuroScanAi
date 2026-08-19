import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { createAccessRequest, createWorkspaceFile, listWorkspaceFiles } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { decodeUpload } from "./fileValidation";
import { storagePut } from "./storage";

const optionalShortText = (max: number) => z.string().trim().max(max).optional();

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  accessRequests: router({
    create: publicProcedure
      .input(z.object({
        name: z.string().trim().min(2).max(120),
        email: z.string().trim().email().max(320),
        company: optionalShortText(160),
        message: optionalShortText(2000),
      }))
      .mutation(async ({ input }) => {
        await createAccessRequest(input);
        return { success: true } as const;
      }),
  }),
  workspaceFiles: router({
    list: protectedProcedure.query(({ ctx }) => listWorkspaceFiles(ctx.user.id)),
    upload: protectedProcedure
      .input(z.object({
        fileName: z.string().trim().min(1).max(255),
        mimeType: z.string().trim().min(1).max(150),
        base64: z.string().min(4).max(11_200_000),
      }))
      .mutation(async ({ ctx, input }) => {
        const decoded = decodeUpload(input);
        const stored = await storagePut(
          `workspace/${ctx.user.id}/${Date.now()}-${decoded.fileName}`,
          decoded.bytes,
          input.mimeType,
        );
        await createWorkspaceFile({
          ownerId: ctx.user.id,
          fileKey: stored.key,
          url: stored.url,
          originalName: decoded.fileName,
          mimeType: input.mimeType,
          sizeBytes: decoded.bytes.byteLength,
        });
        return { success: true, file: { url: stored.url, name: decoded.fileName } } as const;
      }),
  }),
});

export type AppRouter = typeof appRouter;
