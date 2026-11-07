"use client";

import { useEffect, useRef, type ReactElement } from "react";

/**
 * Faint line drawings (coin, banknote, percent sign, card, stack of coins) behind the whole site. They drift
 * at different speeds while the page scrolls: slower than the text they look far away, a little faster than it
 * they look near, so the page gets some depth without any of it competing with the content.
 *
 *  - Meant to be almost invisible: the stroke is `stroke-ink-300` (the colour reserved for decoration), opacity 10 to 16 %,
 *    1.5 px lines, twelve drawings on a wide screen and eight on a phone.
 *  - NEVER above a promotion tile. The tiles (PromotionCard, ArticleCard, ...) are positioned (`relative`, opaque
 *    background) and come later in the DOM than this component, so they paint over every drawing. Two fixed layers:
 *    "back" (`-z-10`) sits behind the page, the opaque bands of the home page (hero, quiz) hide it; "front" (`z-0`)
 *    paints over plain page content and text but still UNDER every positioned tile and under the sticky header. Do not
 *    give this layer a positive z-index: that is what once let a drawing cross a tile. Neither layer takes pointer
 *    events; both are hidden from assistive technology and print.
 *  - The drawings are our own simple outlines, not reproductions of real banknotes or coins.
 *  - Each drawing's screen position is `start - speed * scroll`, wrapped around the viewport height with enough
 *    margin that the wrap-around happens off screen. Written straight to `transform` from one requestAnimationFrame
 *    per scroll burst, with no React state, so scrolling stays cheap.
 *  - With `prefers-reduced-motion` the drawings stay where they start and nothing listens to the scroll.
 */

export type DecorGlyph = "coin" | "banknote" | "percent" | "card" | "stack";

export interface DecorItem {
  glyph: DecorGlyph;
  /** Horizontal centre, % of the viewport width. */
  x: number;
  /** Where it sits at scroll 0, % of the viewport height. */
  y: number;
  /** Width in px. */
  size: number;
  /** Scroll speed relative to the page: 0.2 drifts slowly (far), 1.18 moves a little faster than the page (near). */
  speed: number;
  /** Degrees. */
  rotate: number;
  /** 0..1, lower is further away. */
  opacity: number;
  /** "back" sits behind the page (it slides under the coloured bands), "front" over plain content but under every tile. */
  layer: "back" | "front";
  /** Hidden below `md`. */
  desktopOnly?: boolean;
}

export const DECOR_ITEMS: readonly DecorItem[] = [
  // Far: slower than the page, behind everything.
  { glyph: "coin", x: 6, y: 24, size: 64, speed: 0.18, rotate: -12, opacity: 0.16, layer: "back" },
  { glyph: "percent", x: 91, y: 42, size: 72, speed: 0.3, rotate: 8, opacity: 0.16, layer: "back" },
  { glyph: "stack", x: 93, y: 6, size: 58, speed: 0.22, rotate: 0, opacity: 0.14, layer: "back" },
  { glyph: "percent", x: 12, y: 46, size: 48, speed: 0.12, rotate: -18, opacity: 0.14, layer: "back" },
  { glyph: "coin", x: 84, y: 84, size: 52, speed: 0.36, rotate: 20, opacity: 0.16, layer: "back" },
  { glyph: "card", x: 4, y: 64, size: 96, speed: 0.5, rotate: 10, opacity: 0.16, layer: "back", desktopOnly: true },
  { glyph: "banknote", x: 22, y: 8, size: 108, speed: 0.26, rotate: -6, opacity: 0.14, layer: "back", desktopOnly: true },
  // Near: a little faster than the page, over plain content and text but still under every tile.
  { glyph: "coin", x: 9, y: 92, size: 112, speed: 1.18, rotate: 14, opacity: 0.12, layer: "front" },
  { glyph: "banknote", x: 88, y: 70, size: 130, speed: 1.32, rotate: -8, opacity: 0.1, layer: "front", desktopOnly: true },
  { glyph: "stack", x: 94, y: 30, size: 70, speed: 1.1, rotate: 6, opacity: 0.1, layer: "front" },
  { glyph: "card", x: 12, y: 52, size: 84, speed: 1.24, rotate: -10, opacity: 0.1, layer: "front", desktopOnly: true },
  { glyph: "percent", x: 80, y: 96, size: 64, speed: 1.45, rotate: 12, opacity: 0.1, layer: "front" }
];

const STROKE = { fill: "none", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", vectorEffect: "non-scaling-stroke" } as const;

/** [viewBox width, viewBox height, drawing]. Every shape keeps a constant 1.5 px stroke whatever its size. */
const GLYPHS: Record<DecorGlyph, readonly [number, number, ReactElement]> = {
  coin: [
    64,
    64,
    <g key="coin" {...STROKE}>
      <circle cx="32" cy="32" r="28" />
      <circle cx="32" cy="32" r="21" />
      <path d="M17 25a17 17 0 0 1 9-9" />
    </g>
  ],
  banknote: [
    100,
    60,
    <g key="banknote" {...STROKE}>
      <rect x="2" y="2" width="96" height="56" rx="5" />
      <rect x="8" y="8" width="84" height="44" rx="3" />
      <circle cx="50" cy="30" r="12" />
      <circle cx="50" cy="30" r="5" />
      <circle cx="18" cy="18" r="3" />
      <circle cx="82" cy="42" r="3" />
    </g>
  ],
  percent: [
    64,
    64,
    <g key="percent" {...STROKE}>
      <circle cx="20" cy="20" r="9" />
      <circle cx="44" cy="44" r="9" />
      <path d="M48 14 16 50" />
    </g>
  ],
  card: [
    100,
    64,
    <g key="card" {...STROKE}>
      <rect x="2" y="2" width="96" height="60" rx="6" />
      <path d="M2 20h96M2 30h96" />
      <rect x="12" y="40" width="16" height="12" rx="2" />
      <path d="M40 46h30" />
    </g>
  ],
  stack: [
    64,
    64,
    <g key="stack" {...STROKE}>
      <ellipse cx="32" cy="16" rx="22" ry="8" />
      <path d="M10 16v10c0 4.4 9.8 8 22 8s22-3.6 22-8V16" />
      <path d="M10 26v10c0 4.4 9.8 8 22 8s22-3.6 22-8V26" />
      <path d="M10 36v10c0 4.4 9.8 8 22 8s22-3.6 22-8V36" />
    </g>
  ]
};

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Screen y (px, top of the drawing) at a scroll position. Pure, so it can be tested. */
export function decorY(item: Pick<DecorItem, "y" | "speed" | "size">, scroll: number, viewportHeight: number): number {
  const margin = item.size * 1.5 + 40;
  const span = viewportHeight + margin * 2;
  const start = (item.y / 100) * viewportHeight;
  const raw = start - item.speed * scroll + margin;
  return ((raw % span) + span) % span - margin;
}

export function ScrollDecor() {
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let viewportHeight = Math.max(window.innerHeight, 700);
    let lastWidth = window.innerWidth;
    let frame = 0;

    const apply = () => {
      frame = 0;
      const scroll = reduced ? 0 : window.scrollY;
      DECOR_ITEMS.forEach((item, index) => {
        const el = refs.current[index];
        if (!el) return;
        el.style.transform = `translate3d(0, ${round1(decorY(item, scroll, viewportHeight))}px, 0) rotate(${item.rotate}deg)`;
        el.style.opacity = String(item.opacity);
      });
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(apply);
    };
    // The height only changes on a real resize (width too); a phone's address bar showing or hiding must not move the drawings.
    const onResize = () => {
      if (window.innerWidth !== lastWidth) {
        lastWidth = window.innerWidth;
        viewportHeight = Math.max(window.innerHeight, 700);
      }
      schedule();
    };

    apply();
    if (reduced) return;
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", onResize);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const drawings = (layer: DecorItem["layer"]) =>
    DECOR_ITEMS.map((item, index) => {
      if (item.layer !== layer) return null;
      const [w, h, shape] = GLYPHS[item.glyph];
      return (
        <div
          key={`${item.glyph}-${index}`}
          ref={(el) => {
            refs.current[index] = el;
          }}
          data-decor={item.glyph}
          className={item.desktopOnly ? "absolute top-0 hidden will-change-transform md:block" : "absolute top-0 will-change-transform"}
          style={{
            left: `${item.x}%`,
            width: item.size,
            marginLeft: -item.size / 2,
            opacity: 0,
            transition: "opacity 900ms ease-out",
            transform: `translate3d(0, ${round1(decorY(item, 0, 800))}px, 0) rotate(${item.rotate}deg)`
          }}
        >
          <svg viewBox={`0 0 ${w} ${h}`} width={item.size} height={(item.size * h) / w} focusable="false" className="stroke-ink-300 [&_*]:[vector-effect:non-scaling-stroke]">
            {shape}
          </svg>
        </div>
      );
    });

  return (
    <>
      {/* Behind the page: the coloured bands (hero, quiz) are opaque, so these slide under them and show on the plain page. */}
      <div aria-hidden="true" data-scroll-decor="back" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden print:hidden">
        {drawings("back")}
      </div>
      {/* Over plain content but UNDER the tiles: z-0 and earlier in the DOM than <main>, so every positioned tile (and the
          sticky header, z-40) paints over it. Never raise this z-index. */}
      <div aria-hidden="true" data-scroll-decor="front" className="pointer-events-none fixed inset-0 z-0 overflow-hidden print:hidden">
        {drawings("front")}
      </div>
    </>
  );
}
