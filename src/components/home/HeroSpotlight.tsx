"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Where and when the soft glows appear on a card: irregular but fixed per slide (no randomness during render). */
function glowsFor(index: number): CSSProperties[] {
  const seed = (n: number) => {
    const x = Math.sin((index + 1) * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  const r2 = (value: number) => Math.round(value * 100) / 100;
  // Each glint starts on its own side of the card (top, right, bottom, left, anywhere), has its own size, shape,
  // strength, period and delay, and keeps coming back, so the card never repeats one pattern.
  return [0, 1, 2, 3, 4].map((n) => {
    const side = (Math.floor(seed(n * 7 + 1) * 4) + n) % 4;
    const along = Math.round(seed(n * 7 + 2) * 90);
    const edge = Math.round(-12 + seed(n * 7 + 3) * 30);
    const position: CSSProperties =
      side === 0 ? { left: `${along}%`, top: `${edge}%` }
      : side === 1 ? { top: `${along}%`, right: `${edge}%` }
      : side === 2 ? { left: `${along}%`, bottom: `${edge}%` }
      : { top: `${along}%`, left: `${edge}%` };
    const size = 36 + Math.round(seed(n * 7 + 4) * seed(n * 7 + 6) * 190);
    return {
      ...position,
      width: `${size}px`,
      height: `${Math.round(size * (0.35 + seed(n * 7 + 5) * 0.9))}px`,
      transform: `rotate(${Math.round(seed(n * 7 + 8) * 180)}deg)`,
      ["--glow-peak" as string]: String(r2(0.16 + seed(n * 7 + 9) * 0.34)),
      animationDelay: `${r2(seed(n * 7 + 10) * 6)}s`,
      animationDuration: `${r2(4.5 + seed(n * 7 + 11) * 6.5)}s`
    };
  });
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
 *
 * On a phone (below `sm`) the same cards are NOT stacked: they are one row you
 * swipe with a finger, snapping to the centre of the screen, with the
 * neighbouring cards peeking out at both edges (the same pattern as
 * ui/CardRail.tsx). There is no auto-advance then (it would fight the finger);
 * the dots follow the scroll and a tap on a dot scrolls to that card. The
 * layout switch is pure CSS (no flash); the script only follows the scroll.
 */
export function HeroSpotlight({ header, slides, labels }: { header: ReactNode; slides: ReactNode[]; labels: string[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [canPlay, setCanPlay] = useState(false);
  /** Below `sm`: a swipeable row instead of the stacked cross-fade. */
  const [railMode, setRailMode] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const count = slides.length;

  useEffect(() => {
    try {
      setCanPlay(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch {
      setCanPlay(false);
    }
  }, []);

  useEffect(() => {
    try {
      const query = window.matchMedia("(max-width: 639.98px)");
      const sync = () => setRailMode(query.matches);
      sync();
      query.addEventListener("change", sync);
      return () => query.removeEventListener("change", sync);
    } catch {
      setRailMode(false);
    }
  }, []);

  // In the swipeable row the dots follow the finger: the card nearest to the middle of the row is the current one.
  useEffect(() => {
    const track = trackRef.current;
    if (!railMode || !track) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const items = Array.from(track.children).filter(
        (child): child is HTMLElement => child instanceof HTMLElement && child.hasAttribute("data-slide")
      );
      const middle = track.scrollLeft + track.clientWidth / 2;
      let best = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      items.forEach((item, i) => {
        const distance = Math.abs(item.offsetLeft + item.offsetWidth / 2 - middle);
        if (distance < bestDistance) {
          best = i;
          bestDistance = distance;
        }
      });
      setIndex(best);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [railMode]);

  const showSlide = (i: number) => {
    if (!railMode) {
      setIndex(i);
      return;
    }
    const slide = trackRef.current?.querySelectorAll<HTMLElement>("[data-slide]")[i];
    slide?.scrollIntoView({ behavior: canPlay ? "smooth" : "auto", inline: "center", block: "nearest" });
  };

  useEffect(() => {
    if (!canPlay || paused || railMode || count < 2) return;
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % count), SPOTLIGHT_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [canPlay, paused, railMode, count, index]);

  return (
    <div
      className="w-full min-w-0 max-w-md justify-self-center max-sm:max-w-none lg:justify-self-end"
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
        className="relative rounded-card shadow-[0_24px_48px_-28px_rgb(0_0_0/0.6)] ring-1 ring-line-strong/40 max-sm:rounded-none max-sm:shadow-none max-sm:ring-0"
      >
        <div
          ref={trackRef}
          className={cn(
            // phone: one row you swipe, snapping to the centre, the neighbours peek out at both edges
            "-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "before:w-[calc((100vw-min(80vw,22rem))/2-0.75rem)] before:shrink-0 before:content-[''] after:w-[calc((100vw-min(80vw,22rem))/2-0.75rem)] after:shrink-0 after:content-['']",
            "[&>div]:w-[min(80vw,22rem)] [&>div]:shrink-0 [&>div]:snap-center",
            // sm and up: the stacked cross-fade we always had
            "sm:mx-0 sm:grid sm:snap-none sm:gap-0 sm:overflow-hidden sm:rounded-card sm:pb-0 sm:before:hidden sm:after:hidden sm:[&>div]:w-auto sm:[&>div]:shrink"
          )}
        >
          {slides.map((slide, i) => {
            const active = i === index;
            // Only the stacked cross-fade hides the other cards; in the swipeable row they are all there to touch.
            const hidden = !railMode && !active;
            return (
              <div
                key={i}
                data-slide=""
                aria-hidden={hidden ? true : undefined}
                inert={hidden ? true : undefined}
                aria-label={labels[i]}
                className={cn(
                  "col-start-1 row-start-1 flex min-w-0 transition-[opacity,transform,filter] duration-[1400ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] motion-reduce:transition-none",
                  active
                    ? "sm:translate-y-0 sm:scale-100 sm:opacity-100 sm:blur-0"
                    : "sm:pointer-events-none sm:translate-y-4 sm:scale-[0.985] sm:opacity-0 sm:blur-[3px]"
                )}
              >
                {slide}
              </div>
            );
          })}
          {/* key = index: the sweep restarts with every new card (stacked layout only) */}
          <span key={index} aria-hidden="true" className="pointer-events-none relative col-start-1 row-start-1 max-sm:hidden">
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
              onClick={() => showSlide(i)}
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
