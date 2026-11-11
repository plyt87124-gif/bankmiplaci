"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { browserCountUpEnv, PENDING_ATTRIBUTE, startCountUp } from "./countUpController";
import { COUNT_UP_HERO_MS } from "./easing";
import { formatCountValue, type CountFormat } from "./format";

/**
 * Count-up for AGGREGATES only (the "N aktualnych promocji" figure in the
 * home hero, the lifetime total in "Moje konto"). NEVER for bonuses, fees,
 * ratings or any other number a decision rests on (design spec section 6).
 *
 * - Server HTML, no-JS and reduced motion: the FINAL value, always.
 * - Assistive tech reads the FINAL value from a visually-hidden text; the
 *   animated text is `aria-hidden`, so intermediate numbers are never heard and
 *   the number stays plain text inside a sentence (no `role="img"`).
 * - It counts 0 -> value in 1875 ms (2.5 x the old 750 ms; owner, 2026-11-11), not
 *   linearly: it slows down over the last numbers and lands exactly when the time is
 *   up. On the last-but-one number the figure grows, on the last one it bursts
 *   (rings, rays, a pop) and the larger figure stays (motion.css). Straight away
 *   when it is on screen at load, otherwise when it scrolls into view. Until the client
 *   takes over the animated text is invisible (`data-count-pending`, motion.css),
 *   so the true number never flashes and then restarts from 0. The rules are in
 *   countUpController.ts.
 * - Frames are written straight to `textContent` through a ref: no React
 *   state, no re-render per frame. The last frame is the exact value.
 *
 * `value` is a plain integer (`format="number"`) or grosze (`format="pln"`).
 */
export function CountUp({
  value,
  format = "number",
  duration = COUNT_UP_HERO_MS,
  className
}: {
  value: number;
  format?: CountFormat;
  duration?: number;
  className?: string;
}) {
  const textRef = useRef<HTMLSpanElement>(null);
  const finalText = formatCountValue(value, format);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    return startCountUp(el, { value, format, duration }, browserCountUpEnv());
  }, [value, format, duration]);

  const pending = { [PENDING_ATTRIBUTE]: "" };
  return (
    <span className={cn("num", className)}>
      <span ref={textRef} className="count-figure" aria-hidden="true" {...pending}>
        {finalText}
      </span>
      <span className="sr-only">{finalText}</span>
    </span>
  );
}
