import { scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { hashPassword, hashResetToken, verifyPassword } from "./clinicalAuth";

describe("clinical credential security", () => {
  it("stores a salted password hash and verifies only the correct password", async () => {
    const hash = await hashPassword("SecurePassword8!");
    expect(hash).not.toContain("SecurePassword8!");
    await expect(verifyPassword("SecurePassword8!", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("accepts a legacy salted scrypt hash only for safe one-time bcrypt migration", async () => {
    const scrypt = promisify(scryptCallback);
    const salt = "legacy-test-salt";
    const derived = (await scrypt("LegacyPassword8!", salt, 64)) as Buffer;
    const legacyHash = `scrypt$${salt}$${derived.toString("hex")}`;
    await expect(verifyPassword("LegacyPassword8!", legacyHash)).resolves.toBe(true);
    await expect(verifyPassword("incorrect", legacyHash)).resolves.toBe(false);
  });

  it("creates one-way reset token hashes", () => {
    expect(hashResetToken("reset-token-value")).not.toBe("reset-token-value");
    expect(hashResetToken("reset-token-value")).toBe(hashResetToken("reset-token-value"));
  });
});
