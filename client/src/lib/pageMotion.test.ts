import { describe, expect, it } from "vitest";
import { getPageRevealDelay, PAGE_CONTENT_REVEAL_SELECTOR } from "./pageMotion";

describe("page motion helpers", () => {
  it("limits reveal delays to a short, performance-conscious stagger", () => {
    expect(getPageRevealDelay(0)).toBe(0);
    expect(getPageRevealDelay(2)).toBe(110);
    expect(getPageRevealDelay(99)).toBe(220);
  });

  it("targets shared public, authentication, protected, and fallback page content", () => {
    expect(PAGE_CONTENT_REVEAL_SELECTOR).toContain(".clinical-main > *");
    expect(PAGE_CONTENT_REVEAL_SELECTOR).toContain(".dashboard-main > *");
    expect(PAGE_CONTENT_REVEAL_SELECTOR).toContain(".not-found-page > *");
  });
});
