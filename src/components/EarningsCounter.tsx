"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { formatPLN } from "@/lib/format";

/** Animated count-up used once the user has earned their first checklist reward. */
export function EarningsCounter({ totalCents }: { totalCents: number }) {
  const [displayed, setDisplayed] = useState(0);
  const fromRef = useRef(0);
  const frameRef = useRef<number>();

  useEffect(() => {
    const from = fromRef.current;
    const to = totalCents;
    if (from === to) return;

    const start = performance.now();
    const duration = 900;

    function tick(now: number) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    }
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [totalCents]);

  if (totalCents <= 0) return null;

  return (
    <div className="mb-8 flex items-center gap-3 rounded-xl2 border border-gold-600 bg-gold-100/40 p-5">
      <Sparkles className="h-6 w-6 shrink-0 text-gold-600" />
      <div>
        <p className="text-xs font-medium text-ink-500">Z nami zdobyłeś/aś już:</p>
        <p className="font-display text-2xl font-semibold text-ink-900">{formatPLN(displayed)}</p>
      </div>
    </div>
  );
}
