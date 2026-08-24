import { describe, expect, it } from "vitest";
import { normalizeMriApiBaseUrl } from "./mriApiConfig";

describe("MRI API configuration", () => {
  it("normalizes a configured HTTPS tunnel URL without retaining query or fragment values", () => {
    expect(normalizeMriApiBaseUrl("https://current-tunnel.trycloudflare.com///?token=discard#discard")).toBe("https://current-tunnel.trycloudflare.com");
  });

  it("rejects non-HTTPS, credentialed, and malformed upstream URLs", () => {
    expect(() => normalizeMriApiBaseUrl("http://example.test")).toThrow("valid HTTPS");
    expect(() => normalizeMriApiBaseUrl("https://user:pass@example.test")).toThrow("valid HTTPS");
    expect(() => normalizeMriApiBaseUrl("not a URL")).toThrow("valid HTTPS");
  });
});
