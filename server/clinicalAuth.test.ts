import { describe, expect, it } from "vitest";
import { hashPassword, hashResetToken, verifyPassword } from "./clinicalAuth";

describe("clinical credential security", () => {
  it("stores a salted password hash and verifies only the correct password", async () => {
    const hash = await hashPassword("SecurePassword8!");
    expect(hash).not.toContain("SecurePassword8!");
    await expect(verifyPassword("SecurePassword8!", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("creates one-way reset token hashes", () => {
    expect(hashResetToken("reset-token-value")).not.toBe("reset-token-value");
    expect(hashResetToken("reset-token-value")).toBe(hashResetToken("reset-token-value"));
  });
});
