"use client";

import { useEffect, useRef } from "react";
import { observeOnce } from "@/hooks/useInView";
import { prefersReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/cn";
import { clampCountUpDuration, COUNT_UP_DEFAULT_MS, easeOutCubic } from "./easing";
import { formatCountFrame, formatCountValue, type CountFormat } from "./format";

/**
 * Count-up for AGGREGATES only (the "N aktualnych promocji" figure in the
 * home hero, the lifetime total in "Moje konto"). NEVER for bonuses, fees,
 * ratings or any other number a decision rests on (design spec section 6).
 *
 * - Server HTML, no-JS and reduced motion: the FINAL value, always.
 * - Assistive tech reads the FINAL value from a visually-hidden text; the
 *   animated text is `aria-hidden`, so intermediate numbers are never heard and
 *   the number stays plain text inside a sentence (no `role="img"`).
 * - Animates only when the element is OFF-screen at mount: it waits for it to
 *   scroll into view, then counts 0 -> value in 700-800 ms (easeOutCubic). An
 *   element already visible when the page hydrates is left alone (no flash).
 * - Frames are written straight to `textContent` through a ref: no React
 *   state, no re-render per frame. The last frame is the exact value.
 *
 * `value` is a plain integer (`format="number"`) or grosze (`format="pln"`).
 */
export function CountUp({
  value,
  format = "number",
  duration = COUNT_UP_DEFAULT_MS,
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
    if (el.textContent !== finalText) el.textContent = finalText;
    if (prefersReducedMotion() || !Number.isFinite(value) || value <= 0) return;
    const rect = el.getBoundingClientRect();
    if (rect.bottom > 0 && rect.top < window.innerHeight) return; // already on screen: do not animate
    // Far below the fold the observer may not fire for a long time (and crawlers/screenshots
    // would see the starting "0"): animate only what is about to come into view.
    if (rect.top > window.innerHeight * 1.5) return;

    const ms = clampCountUpDuration(duration);
    let frame: number | undefined;
    const showFinal = () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined;
      if (el.textContent !== finalText) el.textContent = finalText;
    };

    // Off-screen, so nobody sees the swap to the starting value.
    el.textContent = formatCountFrame(0, format);
    const stopObserving = observeOnce(el, () => {
      const start = performance.now();
      let shown = "";
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / ms);
        if (progress >= 1) return showFinal();
        const text = formatCountFrame(value * easeOutCubic(progress), format);
        if (text !== shown) {
          shown = text;
          el.textContent = text;
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });

    // Printing / "save as PDF" must never capture a half-counted number.
    window.addEventListener("beforeprint", showFinal);
    // Failsafe: if the observer never fires, the true value must not stay hidden behind "0".
    const failsafe = window.setTimeout(showFinal, 3000);
    return () => {
      window.clearTimeout(failsafe);
      stopObserving();
      window.removeEventListener("beforeprint", showFinal);
      showFinal();
    };
  }, [value, format, duration, finalText]);

  return (
    <span className={cn("num", className)}>
      <span ref={textRef} aria-hidden="true">
        {finalText}
      </span>
      <span className="sr-only">{finalText}</span>
    </span>
  );
}
