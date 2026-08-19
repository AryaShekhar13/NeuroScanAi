import { describe, expect, it } from "vitest";
import { verifyEmailTransport } from "./emailService";

describe("transactional email transport", () => {
  it("authenticates against the configured SMTP provider", async () => {
    await expect(verifyEmailTransport()).resolves.toBeUndefined();
  }, 20_000);
});
