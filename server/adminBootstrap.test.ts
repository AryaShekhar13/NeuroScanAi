import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ input: null as { email: string; passwordHash: string } | null }));

vi.mock("./db", () => ({
  ensureInitialAdminAccount: async (input: { email: string; passwordHash: string }) => {
    state.input = input;
    return { account: { id: 1 }, created: true };
  },
}));

import { initializeAdministratorFromEnvironment } from "./adminBootstrap";
import { verifyPassword } from "./clinicalAuth";

describe("administrator bootstrap secrets", () => {
  it("uses the injected secret only to create a salted password hash", async () => {
    const result = await initializeAdministratorFromEnvironment();
    expect(result.configured).toBe(true);
    expect(state.input?.email).toBe("neurscanai.project@gmail.com");
    expect(state.input?.passwordHash).toMatch(/^\$2/);
    expect(state.input?.passwordHash).not.toBe(process.env.ADMIN_INITIAL_PASSWORD);
    await expect(verifyPassword(process.env.ADMIN_INITIAL_PASSWORD ?? "", state.input?.passwordHash ?? "")).resolves.toBe(true);
  });
});
