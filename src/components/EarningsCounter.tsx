"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Sparkles } from "lucide-react";
import { formatPLN } from "@/lib/format";
import { useEarningsContext } from "@/components/EarningsContext";

// 8 evenly-spaced burst directions for the "reached the new ceiling" spark
// effect below — deterministic (no Math.random) so the animation is stable
// across re-renders and doesn't need a key/remount trick.
const PARTICLE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

/**
 * Animated count-up shown next to "Moje konto" (see EarningsProvider),
 * once the user has earned their first checklist reward.
 *
 * Two explicit tweaks on top of the original quick tween: the count-up
 * itself is slower (was 900ms, now 2.4s) so it reads as "building up" to
 * something rather than just ticking over instantly, and the moment it
 * reaches its new ceiling — the target amount for this update — it plays a
 * brief spring-scale pop plus a small firework-style spark burst, then
 * gently settles back to its normal size.
 */
export function EarningsCounter() {
  const { total: totalCents } = useEarningsContext();
  const [displayed, setDisplayed] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const fromRef = useRef(0);
  const frameRef = useRef<number>();
  const celebrateTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const from = fromRef.current;
    const to = totalCents;
    if (from === to) return;

    const start = performance.now();
    const duration = 2400; // was 900ms — deliberately slower

    function tick(now: number) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      // Round to the nearest whole złoty (not cent) while animating, so
      // formatPLN never flashes grosze mid-count — it only omits the
      // decimal when the cents value is an exact multiple of 100.
      setDisplayed(Math.round((from + (to - from) * eased) / 100) * 100);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
        if (to > from) {
          // Reached the new ceiling for this update — celebrate, then
          // settle back down on its own (handled by the CSS keyframes).
          setCelebrate(true);
          clearTimeout(celebrateTimeoutRef.current);
          celebrateTimeoutRef.current = setTimeout(() => setCelebrate(false), 700);
        }
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
    <div className="flex items-center gap-2.5 rounded-full border border-gold-600 bg-gold-100/40 px-4 py-2">
      <Sparkles className="h-5 w-5 shrink-0 text-gold-600" />
      <div className="leading-tight">
        <p className="text-xs font-medium text-ink-500">Z nami już zdobyłeś/aś:</p>
        <span className="relative inline-block">
          <p
            className={`font-display text-xl font-semibold text-ink-900 ${celebrate ? "animate-earnings-pop" : ""}`}
          >
            {formatPLN(displayed)}
          </p>
          {celebrate &&
            PARTICLE_ANGLES.map((angle, i) => (
              <span
                key={angle}
                className={`animate-earnings-firework pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full ${
                  i % 2 === 0 ? "bg-gold-600" : "bg-teal-500"
                }`}
                style={{ "--earnings-angle": `${angle}deg` } as CSSProperties}
              />
            ))}
        </span>
      </div>
    </div>
  );
}
