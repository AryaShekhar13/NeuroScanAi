export const PAGE_CONTENT_REVEAL_SELECTOR = [
  ".clinical-main > *",
  ".app-main > *",
  ".dashboard-main > *",
  ".demo-page > *",
  ".auth-main > *",
  ".workspace-main > *",
  ".not-found-page > *",
].join(", ");

export function getPageRevealDelay(index: number) {
  return Math.min(Math.max(index, 0) * 55, 220);
}
