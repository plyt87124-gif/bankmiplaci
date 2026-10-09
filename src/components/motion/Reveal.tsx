"use client";

import { createElement, type CSSProperties, type ReactNode } from "react";
import { useInView } from "@/hooks/useInView";

type RevealTag = "div" | "section" | "article" | "aside" | "ul" | "ol" | "li";

/**
 * Fade + 8 px rise when a section scrolls into view (once). ONLY for blocks
 * BELOW the first screen of the home page: never hero/LCP, FAQ, articles,
 * legal pages, result lists or admin (design spec section 6).
 *
 * The children are always in the server HTML and fully visible there: the
 * hiding rule (`opacity: 0`) lives in motion.css under `.motion-ok
 * [data-reveal]`, a class the <head> script adds only when reduced motion is
 * NOT requested. No JS or reduced motion = plain visible content; and CSS has
 * a 2.5 s failsafe in case the observer never fires.
 *
 * `index` staggers siblings by 40 ms, wrapping every 6 (max 200 ms delay).
 */
export function Reveal({
  children,
  index = 0,
  as = "div",
  className,
  id
}: {
  children: ReactNode;
  index?: number;
  as?: RevealTag;
  className?: string;
  id?: string;
}) {
  const [ref, inView] = useInView<HTMLElement>();
  const step = Number.isFinite(index) ? Math.abs(Math.trunc(index)) % 6 : 0;

  return createElement(
    as,
    {
      ref,
      id,
      className,
      "data-reveal": "",
      "data-in": inView ? "" : undefined,
      style: { "--reveal-i": step } as CSSProperties
    },
    children
  );
}
