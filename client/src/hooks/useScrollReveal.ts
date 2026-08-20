import { useEffect, useRef } from "react";
import { getRevealDelay, SCROLL_REVEAL_SELECTOR } from "@/lib/scrollReveal";

/** Reveals marked landing-page content once as it enters the viewport. */
export function useScrollReveal<T extends HTMLElement>() {
  const rootRef = useRef<T>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement>(SCROLL_REVEAL_SELECTOR));
    if (!targets.length) return;

    targets.forEach((target) => target.style.setProperty("--reveal-delay", `${getRevealDelay(target.dataset.revealDelay)}ms`));
    root.classList.add("is-reveal-ready");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-revealed");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });

    targets.forEach((target) => observer.observe(target));
    return () => {
      observer.disconnect();
      root.classList.remove("is-reveal-ready");
      targets.forEach((target) => {
        target.classList.remove("is-revealed");
        target.style.removeProperty("--reveal-delay");
      });
    };
  }, []);

  return rootRef;
}
