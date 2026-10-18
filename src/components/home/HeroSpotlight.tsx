"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Where and when the soft glows appear on a card: irregular but fixed per slide (no randomness during render). */
function glowsFor(index: number): CSSProperties[] {
  const seed = (n: number) => {
    const x = Math.sin((index + 1) * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  return [0, 1, 2].map((n) => ({
    left: `${Math.round(seed(n * 3 + 1) * 80)}%`,
    top: `${Math.round(seed(n * 3 + 2) * 80)}%`,
    width: `${60 + Math.round(seed(n * 3 + 3) * 70)}px`,
    animationDelay: `${Math.round((0.8 + n * 1.9 + seed(n + 9) * 1.5) * 100) / 100}s`,
    animationDuration: `${Math.round((3.2 + seed(n + 5) * 2) * 100) / 100}s`
  }));
}

/** How long one offer stays on screen before the next one takes its place. */
export const SPOTLIGHT_INTERVAL_MS = 5000;

/**
 * The hero's right-hand side: the most recommended offers as cards that take
 * turns by themselves (every 5 s), with a light sweep over the card that has
 * just arrived. The cards are ready server-rendered nodes (the same
 * PromotionCard as in the lists); this island only decides which one is
 * visible. All slides stay in the HTML (stacked in one grid cell), the hidden
 * ones are inert and out of the accessibility tree.
 *
 * Auto-advance stops while the pointer or keyboard focus is inside, and does
 * not run at all with prefers-reduced-motion: then the dots are the only way
 * to change the card. `header` (the offer counter) sits above the card.
 */
export function HeroSpotlight({ header, slides, labels }: { header: ReactNode; slides: ReactNode[]; labels: string[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [canPlay, setCanPlay] = useState(false);
  const count = slides.length;

  useEffect(() => {
    try {
      setCanPlay(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch {
      setCanPlay(false);
    }
  }, []);

  useEffect(() => {
    if (!canPlay || paused || count < 2) return;
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % count), SPOTLIGHT_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [canPlay, paused, count, index]);

  return (
    <div
      className="w-full max-w-md justify-self-center lg:justify-self-end"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="mb-3">{header}</div>

      <div
        role="group"
        aria-roledescription="karuzela"
        aria-label="Najbardziej polecane promocje"
        className="relative rounded-card shadow-[0_18px_50px_-18px_rgb(var(--color-action)/0.45)] ring-1 ring-action/30"
      >
        <div className="grid overflow-hidden rounded-card">
          {slides.map((slide, i) => {
            const active = i === index;
            return (
              <div
                key={i}
                aria-hidden={active ? undefined : true}
                inert={active ? undefined : true}
                aria-label={labels[i]}
                className={cn(
                  "col-start-1 row-start-1 flex min-w-0 transition-[opacity,transform,filter] duration-[1400ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] motion-reduce:transition-none",
                  active ? "translate-y-0 scale-100 opacity-100 blur-0" : "pointer-events-none translate-y-4 scale-[0.985] opacity-0 blur-[3px]"
                )}
              >
                {slide}
              </div>
            );
          })}
          {/* key = index: the sweep restarts with every new card */}
          <span key={index} aria-hidden="true" className="pointer-events-none relative col-start-1 row-start-1">
            {glowsFor(index).map((glow, i) => (
              <span key={i} className="spotlight-glow" style={glow} />
            ))}
          </span>
        </div>
      </div>

      {count > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-1">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Pokaż promocję ${i + 1} z ${count}`}
              aria-current={i === index ? "true" : undefined}
              onClick={() => setIndex(i)}
              className="group/dot flex h-6 w-6 items-center justify-center rounded-full outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring"
            >
              <span
                className={cn(
                  "block h-2 rounded-full transition-all duration-300",
                  i === index ? "w-6 bg-action" : "w-2 bg-line-strong group-hover/dot:bg-ink-500"
                )}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
