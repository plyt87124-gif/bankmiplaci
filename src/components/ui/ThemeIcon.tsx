import type { CSSProperties } from "react";
import type { ThemePreference } from "@/components/ui/theme";

/**
 * The icons of the theme switch (sun = Jasny, moon = Ciemny, screen = Automatyczny): the same shapes and the same
 * 24 x 24 / 2 px stroke look as the lucide icons they replace, drawn here so that the parts can move.
 *
 * Owner, 2026-11-11: a light touch of life, NOT all the time - one movement every ten seconds:
 *   sun    the eight rays stretch by different amounts, one after another, so the length looks uneven and the sun
 *          seems to shine; a soft halo breathes once
 *   moon   the crescent rocks a little and two small stars twinkle next to it
 *   screen the glass lights up faintly once
 * The movement lives in motion.css (`.theme-icon`, only under `.motion-ok`, so reduced motion gets a still icon).
 * Each cycle is 10 s long and idle for the first ~4 s and the last ~4.5 s.
 */

/** The eight rays: `k` = how far the ray stretches at its longest, `j` = the second, smaller stretch, `d` = start delay. */
const SUN_RAYS: readonly { angle: number; k: number; j: number; d: number }[] = [
  { angle: 0, k: 1.85, j: 1.25, d: 0 },
  { angle: 45, k: 1.3, j: 1.75, d: 130 },
  { angle: 90, k: 1.95, j: 1.15, d: 60 },
  { angle: 135, k: 1.4, j: 1.6, d: 200 },
  { angle: 180, k: 1.7, j: 1.3, d: 90 },
  { angle: 225, k: 1.2, j: 1.85, d: 260 },
  { angle: 270, k: 1.9, j: 1.2, d: 30 },
  { angle: 315, k: 1.5, j: 1.7, d: 170 }
];

function Sun() {
  return (
    <>
      <circle className="sun-halo" cx="12" cy="12" r="7" strokeWidth="1" />
      <circle cx="12" cy="12" r="4" />
      {SUN_RAYS.map((ray) => (
        <g
          key={ray.angle}
          style={{ transform: `rotate(${ray.angle}deg)`, transformOrigin: "12px 12px" }}
        >
          <path
            className="sun-ray"
            d="M12 2v2"
            style={{ "--k": ray.k, "--j": ray.j, "--d": `${ray.d}ms` } as CSSProperties}
          />
        </g>
      ))}
    </>
  );
}

function Moon() {
  return (
    <>
      <path className="moon-body" d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      <path className="moon-star moon-star-a" d="M18 3.8v4.4M15.8 6h4.4" strokeWidth="1.6" />
      <path className="moon-star moon-star-b" d="M21.4 9.6v2.8M20 11h2.8" strokeWidth="1.6" />
    </>
  );
}

function Screen() {
  return (
    <>
      <rect className="screen-glow" x="4" y="5" width="16" height="10" rx="1" fill="currentColor" stroke="none" />
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </>
  );
}

export function ThemeIcon({ kind, className }: { kind: ThemePreference; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={["theme-icon", className].filter(Boolean).join(" ")}
      data-theme-icon={kind}
    >
      {kind === "light" ? <Sun /> : kind === "dark" ? <Moon /> : <Screen />}
    </svg>
  );
}
