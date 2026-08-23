import { describe, expect, it } from "vitest";
import { getInferenceApiBaseUrl } from "./inferenceApi";

describe("configured inference API", () => {
  it("responds from the configured health endpoint", async () => {
    const baseUrl = process.env.VITE_INFERENCE_API_BASE;
    expect(baseUrl).toMatch(/^https:\/\//);
    const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(10_000) });
    expect(response.ok).toBe(true);
    const payload = await response.json() as { status?: string; model_loaded?: boolean };
    expect(payload.status).toBe("healthy");
    expect(payload.model_loaded).toBe(true);
  }, 15_000);

  it("uses the required public endpoint for the browser-side inference client", () => {
    expect(getInferenceApiBaseUrl()).toBe(process.env.VITE_INFERENCE_API_BASE);
  });
});
