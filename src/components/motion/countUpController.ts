import { observeOnce } from "@/hooks/useInView";
import { prefersReducedMotion } from "@/hooks/useReducedMotion";
import { COUNT_UP_HERO_MS, countAt } from "./easing";
import { formatCountFrame, formatCountValue, type CountFormat } from "./format";

/**
 * The state machine behind <CountUp>: when the figure is hidden, when it jumps to 0, when it counts, when it grows
 * and bursts and when it lands on the true value. Kept out of the component, with every browser API injected
 * (`CountUpEnv`), so each rule is covered by tests/count-up-controller.test.ts without a browser.
 *
 * Rules (owner, 2026-11-11: "zanimujmy ten licznik" - the old version almost never animated, because it left
 * alone every figure that was on screen at load and every figure more than 1.5 screens below the fold):
 *
 *  - The true value is ALWAYS what the server renders and what the count lands on. Reduced motion, a value of 0
 *    or a failure of any timer end on the true value.
 *  - The element starts with `data-count-pending` (invisible under `.motion-ok`, see motion.css; a CSS timer shows
 *    it after 2.5 s if JavaScript never takes over). So the true number never flashes and then restarts from 0.
 *  - On screen at mount: count straight away, from 0.
 *  - Off screen: it keeps the true text and stays unseen. Within one screen of the viewport it is "armed" (the swap to
 *    0 happens unseen), and it counts when it really enters. An armed figure that is still off-screen after SETTLE_MS
 *    shows the true value again, so a late screenshot or a crawler never reads a 0; it still counts when it arrives.
 *  - Printing shows the true value.
 *  - The count is not linear: it slows down towards the end and lands on the last number exactly when the time is
 *    up (countAt in easing.ts). When the shown number reaches the last-but-one the figure starts to GROW (phase
 *    "grow"); on the last number it bursts (phase "burst": rings, rays and a pop drawn by CSS) and the larger figure
 *    STAYS (phase "done"). The phases are `data-count-phase` on the element, styled in motion.css under
 *    `.motion-ok`. Reduced motion and a value of 0 show the plain true value without them; settle() (print, a
 *    stalled frame loop, an armed figure that nobody scrolled to) shows the true value and the larger figure ("done").
 */

/** Browser APIs the controller needs; the real ones come from `browserCountUpEnv`. */
export interface CountUpEnv {
  reducedMotion: () => boolean;
  viewportHeight: () => number;
  now: () => number;
  raf: (callback: (now: number) => void) => number;
  caf: (id: number) => void;
  observeOnce: (el: Element, onEnter: () => void, options?: IntersectionObserverInit) => () => void;
  setTimeout: (callback: () => void, ms: number) => number;
  clearTimeout: (id: number) => void;
  onBeforePrint: (callback: () => void) => () => void;
}

/** The part of an element the controller touches (an HTMLElement fits; so does a test double). */
export interface CountUpElement {
  textContent: string | null;
  getBoundingClientRect: () => { top: number; bottom: number };
  removeAttribute: (name: string) => void;
  setAttribute: (name: string, value: string) => void;
}

export const PENDING_ATTRIBUTE = "data-count-pending";
export const PHASE_ATTRIBUTE = "data-count-phase";
export type CountPhase = "grow" | "burst" | "done";
/** The burst (rings, rays, pop) lasts this long, then the phase becomes "done": the larger figure stays. */
export const BURST_MS = 900;
/** The controller accepts durations in this range (the home counter uses COUNT_UP_HERO_MS). */
export const MIN_DURATION_MS = 700;
export const MAX_DURATION_MS = 3000;
/** Arm a figure that is within one viewport height below the screen. */
export const ARM_OBSERVER: IntersectionObserverInit = { threshold: 0, rootMargin: "0px 0px 100% 0px" };
/** An armed figure still off-screen after this long shows its true value again. */
export const SETTLE_MS = 6000;
/** After the count started, the true value is forced this long after it should have ended (rAF can stall in a hidden tab). */
export const PLAY_SLACK_MS = 1500;

export function startCountUp(
  el: CountUpElement,
  options: { value: number; format?: CountFormat; duration?: number },
  env: CountUpEnv
): () => void {
  const { value } = options;
  const format = options.format ?? "number";
  const requested = options.duration ?? COUNT_UP_HERO_MS;
  const ms = Number.isFinite(requested) ? Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, requested)) : COUNT_UP_HERO_MS;
  const finalText = formatCountValue(value, format);
  /** One step of the shown number: a whole zloty when the value is in grosze. */
  const unit = format === "pln" ? 100 : 1;

  const setText = (text: string) => {
    if (el.textContent !== text) el.textContent = text;
  };
  const reveal = () => el.removeAttribute(PENDING_ATTRIBUTE);
  let phase: CountPhase | null = null;
  const setPhase = (next: CountPhase | null) => {
    if (phase === next) return;
    phase = next;
    if (next) el.setAttribute(PHASE_ATTRIBUTE, next);
    else el.removeAttribute(PHASE_ATTRIBUTE);
  };

  setText(finalText);
  if (env.reducedMotion() || !Number.isFinite(value) || value <= 0) {
    reveal();
    return () => {};
  }

  let frame: number | undefined;
  let safety: number | undefined;
  let settleTimer: number | undefined;
  let burstTimer: number | undefined;
  const stops: Array<() => void> = [];

  const stopFrames = () => {
    if (frame !== undefined) env.caf(frame);
    frame = undefined;
    if (safety !== undefined) env.clearTimeout(safety);
    safety = undefined;
  };
  const stopBurstTimer = () => {
    if (burstTimer !== undefined) env.clearTimeout(burstTimer);
    burstTimer = undefined;
  };
  /** The true value on screen, the larger figure included; a later `play` can still run. */
  const settle = () => {
    stopFrames();
    stopBurstTimer();
    setText(finalText);
    reveal();
    setPhase("done");
  };
  /** The last number is on screen: burst, then the larger figure stays. */
  const land = () => {
    setText(finalText);
    setPhase("burst");
    stopBurstTimer();
    burstTimer = env.setTimeout(() => {
      burstTimer = undefined;
      setPhase("done");
    }, BURST_MS);
  };

  const play = () => {
    stopFrames();
    stopBurstTimer();
    if (settleTimer !== undefined) env.clearTimeout(settleTimer);
    settleTimer = undefined;
    setPhase(null);
    setText(formatCountFrame(0, format));
    reveal();
    const start = env.now();
    let shown = "";
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / ms);
      if (progress >= 1) {
        frame = undefined;
        if (safety !== undefined) env.clearTimeout(safety);
        safety = undefined;
        land();
        return;
      }
      const current = countAt(progress, value, unit);
      const text = formatCountFrame(current, format);
      if (text !== shown) {
        shown = text;
        setText(text);
      }
      // the last or the last-but-one number is showing: the figure starts to grow
      if (phase === null && Math.round(current / unit) >= Math.round(value / unit) - 1) setPhase("grow");
      frame = env.raf(tick);
    };
    frame = env.raf(tick);
    safety = env.setTimeout(settle, ms + PLAY_SLACK_MS);
  };

  // Printing / "save as PDF" must never capture a half-counted number.
  stops.push(env.onBeforePrint(settle));

  const rect = el.getBoundingClientRect();
  const onScreen = rect.bottom > 0 && rect.top < env.viewportHeight();
  if (onScreen) {
    play();
  } else {
    stops.push(
      env.observeOnce(
        el as unknown as Element,
        () => {
          // Within one screen of the viewport: start from 0 now, while nobody can see the swap.
          setText(formatCountFrame(0, format));
          reveal();
          settleTimer = env.setTimeout(settle, SETTLE_MS);
          stops.push(env.observeOnce(el as unknown as Element, play));
        },
        ARM_OBSERVER
      )
    );
  }

  return () => {
    stopFrames();
    stopBurstTimer();
    if (settleTimer !== undefined) env.clearTimeout(settleTimer);
    for (const stop of stops) stop();
    setText(finalText);
    reveal();
    setPhase(null);
  };
}

/** The real browser APIs. Call it inside an effect, never during render. */
export function browserCountUpEnv(): CountUpEnv {
  return {
    reducedMotion: prefersReducedMotion,
    viewportHeight: () => window.innerHeight,
    now: () => performance.now(),
    raf: (callback) => requestAnimationFrame(callback),
    caf: (id) => cancelAnimationFrame(id),
    observeOnce,
    setTimeout: (callback, ms) => window.setTimeout(callback, ms),
    clearTimeout: (id) => window.clearTimeout(id),
    onBeforePrint: (callback) => {
      window.addEventListener("beforeprint", callback);
      return () => window.removeEventListener("beforeprint", callback);
    }
  };
}
