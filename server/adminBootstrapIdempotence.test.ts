import { describe, expect, it } from "vitest";
import { initializeAdministratorFromEnvironment } from "./adminBootstrap";
import { getClinicianByEmail } from "./db";

describe("existing administrator initialization", () => {
  it("does not overwrite the existing administrator password hash", async () => {
    const before = await getClinicianByEmail("neurscanai.project@gmail.com");
    expect(before?.role).toBe("admin");
    const result = await initializeAdministratorFromEnvironment();
    const after = await getClinicianByEmail("neurscanai.project@gmail.com");
    expect(result).toEqual({ configured: true, created: false });
    expect(after?.passwordHash).toBe(before?.passwordHash);
  });
});
