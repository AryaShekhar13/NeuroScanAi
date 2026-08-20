export const SCROLL_REVEAL_SELECTOR = "[data-scroll-reveal]";

export function getRevealDelay(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.min(parsed, 600) : 0;
}
