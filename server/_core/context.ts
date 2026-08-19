import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { ClinicianAccount, User } from "../../drizzle/schema";
import { getClinicianById } from "../db";
import { readClinicianSession } from "../clinicalAuth";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  clinician: ClinicianAccount | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let clinician: ClinicianAccount | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  try {
    const session = await readClinicianSession(opts.req.headers.cookie);
    if (session) clinician = await getClinicianById(session.clinicianId) ?? null;
  } catch (error) {
    clinician = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    clinician,
  };
}
