"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/** Fires when ~15 % is visible and the element is 8 % of the viewport above the bottom edge. */
export const IN_VIEW_OPTIONS = { threshold: 0.15, rootMargin: "0px 0px -8% 0px" } as const;

/**
 * Calls `onEnter` ONCE, when `el` first scrolls into view, then stops
 * observing. Without IntersectionObserver (very old browsers) it calls
 * `onEnter` straight away, so nothing stays hidden. Returns a cleanup.
 */
export function observeOnce(el: Element, onEnter: () => void, options: IntersectionObserverInit = IN_VIEW_OPTIONS): () => void {
  if (typeof IntersectionObserver === "undefined") {
    onEnter();
    return () => {};
  }
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      observer.disconnect();
      onEnter();
    }
  }, options);
  observer.observe(el);
  return () => observer.disconnect();
}

/**
 * `const [ref, inView] = useInView<HTMLDivElement>()` - `inView` flips to true
 * the first time the element enters the viewport and stays true. Starts as
 * false on server and client alike, so the first render always matches the SSR HTML.
 */
export function useInView<T extends Element = HTMLElement>(
  threshold: number = IN_VIEW_OPTIONS.threshold,
  rootMargin: string = IN_VIEW_OPTIONS.rootMargin
): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return observeOnce(el, () => setInView(true), { threshold, rootMargin });
  }, [threshold, rootMargin]);

  return [ref, inView];
}
