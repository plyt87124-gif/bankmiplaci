"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { formatPLN } from "@/lib/format";
import { useEarningsContext } from "@/components/EarningsContext";
import { clampCountUpDuration, easeOutCubic } from "@/components/motion/easing";
import { prefersReducedMotion } from "@/hooks/useReducedMotion";

// Count-up length: short enough not to make anyone wait, long
// enough to read as "building up". Same 700-800 ms window as CountUp.
const COUNT_DURATION_MS = clampCountUpDuration(800);

/**
 * Animated count-up shown next to "Moje konto" (see EarningsProvider),
 * once the user has earned their first checklist reward.
 *
 * When the count-up reaches its new ceiling (the target amount for this
 * update) the number plays a brief pop (scale 1 -> 1.04 -> 1, see
 * `earnings-pop` in src/styles/motion.css) and settles back. No sparks, no
 * overshoot. With prefers-reduced-motion the number simply shows its final
 * value at once, without the pop.
 */
export function EarningsCounter() {
  const { total: totalCents } = useEarningsContext();
  const [displayed, setDisplayed] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  // Mirrors `displayed` on every animation frame — the actual source of
  // truth for "where the number currently visually is". Needed because a
  // fast double-click can retrigger this effect mid-animation: without a
  // live ref, the new animation would start from the *last completed*
  // value instead of wherever it was cut off, which could make `from`
  // equal the new `to` and short-circuit the effect below, freezing the
  // display mid-count instead of snapping/animating to the right number.
  const displayedRef = useRef(0);
  const frameRef = useRef<number | undefined>(undefined);
  const celebrateTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Layout effect: with reduced motion the jump to the final value is applied before the
  // first paint, so there is no frame showing "0 zł".
  useLayoutEffect(() => {
    const from = displayedRef.current;
    const to = totalCents;
    if (from === to) return;

    if (prefersReducedMotion()) {
      displayedRef.current = to;
      setDisplayed(to);
      return;
    }

    const start = performance.now();
    const duration = COUNT_DURATION_MS;

    function tick(now: number) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(progress);
      // Round to the nearest whole złoty (not cent) while animating, so
      // formatPLN never flashes grosze mid-count — it only omits the
      // decimal when the cents value is an exact multiple of 100.
      // The last frame lands on the exact target (it may include grosze).
      const value = progress >= 1 ? to : Math.round((from + (to - from) * eased) / 100) * 100;
      displayedRef.current = value;
      setDisplayed(value);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else if (to > from) {
        // Reached the new ceiling for this update — celebrate, then
        // settle back down on its own (handled by the CSS keyframes).
        setCelebrate(true);
        clearTimeout(celebrateTimeoutRef.current);
        celebrateTimeoutRef.current = setTimeout(() => setCelebrate(false), 700);
      }
    }
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [totalCents]);

  useEffect(() => () => clearTimeout(celebrateTimeoutRef.current), []);

  if (totalCents <= 0) return null;

  return (
    <div className="flex items-center gap-2.5 rounded-full border border-gold-500 bg-gold-100/40 px-4 py-2">
      <Sparkles className="h-5 w-5 shrink-0 text-gold-500" aria-hidden="true" />
      <div className="leading-tight">
        <p className="text-caption font-medium text-ink-500">Z nami już zdobyłeś/aś:</p>
        <p
          className={`num inline-block font-display text-xl font-semibold text-ink-900 ${celebrate ? "animate-earnings-pop" : ""}`}
        >
          {formatPLN(displayed)}
        </p>
      </div>
    </div>
  );
}
