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

/* ------------------------------------------------------------------ */
/* The home counter ("N aktualnych promocji"): slower, and it slows down at the end */
/* ------------------------------------------------------------------ */

/**
 * Owner, 2026-11-11: the home counter loads 2.5 times slower than the 750 ms default (700-800 ms is the window
 * for the other count-ups, EarningsCounter among them), and it must not be linear: the last numbers crawl.
 */
export const COUNT_UP_HERO_MS = 1875;
/** How hard the count slows down: 1 - (1 - t)^power. 4 = a long crawl over the last few numbers. */
export const COUNT_UP_HERO_POWER = 4;

/** Strong ease-out: `1 - (1 - t)^power`, t clamped to 0..1. */
export function easeOutPower(t: number, power: number = COUNT_UP_HERO_POWER): number {
  const x = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - x, power);
}

/**
 * The number on screen `progress` (0..1) of the way through the count. The curve is `easeOutPower`, but stretched
 * so the LAST number is reached exactly at the end (progress 1), not part-way through a long idle tail: the figure
 * keeps counting, slower and slower, and lands when the time is up. With `unit` = 100 the shown steps are whole
 * zloty (the amount is in grosze). Always `value` at progress >= 1.
 *
 * For 25 offers (power 4): the first ten numbers pass in the first ~18 % of the time, "24" holds from ~81 %, and
 * "25" lands at 100 %.
 */
export function countAt(progress: number, value: number, unit: number = 1, power: number = COUNT_UP_HERO_POWER): number {
  if (!(value > 0)) return 0;
  const p = Math.min(1, Math.max(0, progress));
  if (p >= 1) return value;
  // the underlying time at which the last unit is first shown (value - unit/2 rounds up to value)
  const landing = 1 - Math.pow(Math.min(1, unit / 2 / value), 1 / power);
  return value * easeOutPower(p * landing, power);
}
