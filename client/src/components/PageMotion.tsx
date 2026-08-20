import { PropsWithChildren, useEffect, useLayoutEffect, useRef } from "react";
import { useLocation } from "wouter";
import { getPageRevealDelay, PAGE_CONTENT_REVEAL_SELECTOR } from "@/lib/pageMotion";

/** Shared page entry and in-view content motion without intercepting native scroll input. */
export function PageMotion({ children }: PropsWithChildren) {
  const [location] = useLocation();
  const rootRef = useRef<HTMLDivElement>(null);
  const previousLocation = useRef(location);
  const cameFromHistory = useRef(false);

  useEffect(() => {
    const onPopState = () => { cameFromHistory.current = true; };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const routeChanged = previousLocation.current !== location;

    if (routeChanged && !cameFromHistory.current) window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    previousLocation.current = location;
    cameFromHistory.current = false;

    if (reducedMotion) return;
    root.classList.add("is-page-motion-ready");
    root.classList.remove("is-page-motion-visible");
    const frame = window.requestAnimationFrame(() => root.classList.add("is-page-motion-visible"));

    if (!("IntersectionObserver" in window)) return () => window.cancelAnimationFrame(frame);
    const targets = new Set<HTMLElement>();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-page-content-revealed");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -7% 0px", threshold: 0.1 });
    const enrollTargets = () => {
      root.querySelectorAll<HTMLElement>(PAGE_CONTENT_REVEAL_SELECTOR).forEach((target) => {
        if (targets.has(target)) return;
        target.style.setProperty("--page-reveal-delay", `${getPageRevealDelay(targets.size)}ms`);
        targets.add(target);
        observer.observe(target);
      });
    };
    enrollTargets();
    const mutations = new MutationObserver(enrollTargets);
    mutations.observe(root, { childList: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      mutations.disconnect();
      targets.forEach((target) => {
        target.classList.remove("is-page-content-revealed");
        target.style.removeProperty("--page-reveal-delay");
      });
    };
  }, [location]);

  return <div ref={rootRef} className="page-motion">{children}</div>;
}
