/**
 * Pure helpers shared by CountUp and EarningsCounter. No "use client" and no
 * DOM access, so both server and client code (and tests) can import it.
 */

/** Count-ups last 700-800 ms (design spec section 6): long enough to read as a build-up, short enough to never get in the way. */
export const COUNT_UP_MIN_MS = 700;
export const COUNT_UP_MAX_MS = 800;
export const COUNT_UP_DEFAULT_MS = 750;

export function clampCountUpDuration(ms: number): number {
  if (!Number.isFinite(ms)) return COUNT_UP_DEFAULT_MS;
  return Math.min(COUNT_UP_MAX_MS, Math.max(COUNT_UP_MIN_MS, ms));
}

/** Decelerating curve: fast start, soft landing. `t` is clamped to 0..1. */
export function easeOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - x, 3);
}
