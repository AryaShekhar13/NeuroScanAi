import { describe, expect, it } from "vitest";
import { getInferenceApiBaseUrl } from "./inferenceApi";

describe("configured inference API", () => {
  it("provides an HTTPS inference base URL", () => {
    const baseUrl = process.env.VITE_INFERENCE_API_BASE;
    expect(baseUrl).toMatch(/^https:\/\//);
  });

  it("uses the required public endpoint for the browser-side inference client", () => {
    expect(getInferenceApiBaseUrl()).toBe(process.env.VITE_INFERENCE_API_BASE);
  });
});
