import { ENV } from "./_core/env";
import { hashPassword } from "./clinicalAuth";
import { ensureInitialAdminAccount } from "./db";

export async function initializeAdministratorFromEnvironment() {
  if (!ENV.adminEmail || !ENV.adminInitialPassword) return { configured: false, created: false } as const;
  const result = await ensureInitialAdminAccount({ email: ENV.adminEmail, passwordHash: await hashPassword(ENV.adminInitialPassword) });
  return { configured: true, created: result.created } as const;
}
