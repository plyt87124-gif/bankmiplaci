// The rules of the animated "N aktualnych promocji" figure (src/components/motion/countUpController.ts), run against a
// fake browser: manual clock, frame queue, timers and IntersectionObserver. No DOM, no real time.
import test from "node:test";
import assert from "node:assert/strict";
import {
  ARM_OBSERVER,
  BURST_MS,
  PENDING_ATTRIBUTE,
  PHASE_ATTRIBUTE,
  PLAY_SLACK_MS,
  SETTLE_MS,
  startCountUp,
  type CountUpElement,
  type CountUpEnv
} from "../src/components/motion/countUpController";
import { COUNT_UP_HERO_MS } from "../src/components/motion/easing";
import { formatCountValue } from "../src/components/motion/format";

type Frame = { id: number; cb: (now: number) => void };
type Timer = { id: number; at: number; cb: () => void };
type Watch = { id: number; options?: IntersectionObserverInit; cb: () => void; stopped: boolean };

function fakeBrowser(opts: { reducedMotion?: boolean; top?: number; bottom?: number; viewport?: number } = {}) {
  let clock = 0;
  let nextId = 1;
  const frames: Frame[] = [];
  const timers: Timer[] = [];
  const watches: Watch[] = [];
  const printListeners = new Set<() => void>();
  const writes: string[] = [];
  const el = {
    attrs: new Map<string, string>([[PENDING_ATTRIBUTE, ""]]),
    _text: "SSR",
    get textContent() {
      return this._text;
    },
    set textContent(value: string | null) {
      this._text = value ?? "";
      writes.push(this._text);
    },
    get phase() {
      return this.attrs.get(PHASE_ATTRIBUTE) ?? null;
    },
    pending() {
      return this.attrs.has(PENDING_ATTRIBUTE);
    },
    getBoundingClientRect: () => ({ top: opts.top ?? 100, bottom: opts.bottom ?? 130 }),
    removeAttribute(name: string) {
      this.attrs.delete(name);
    },
    setAttribute(name: string, value: string) {
      this.attrs.set(name, value);
    }
  };
  const env: CountUpEnv = {
    reducedMotion: () => opts.reducedMotion ?? false,
    viewportHeight: () => opts.viewport ?? 800,
    now: () => clock,
    raf: (cb) => {
      const id = nextId++;
      frames.push({ id, cb });
      return id;
    },
    caf: (id) => {
      const i = frames.findIndex((f) => f.id === id);
      if (i !== -1) frames.splice(i, 1);
    },
    observeOnce: (_el, cb, options) => {
      const watch: Watch = { id: nextId++, options, cb, stopped: false };
      watches.push(watch);
      return () => {
        watch.stopped = true;
      };
    },
    setTimeout: (cb, ms) => {
      const id = nextId++;
      timers.push({ id, at: clock + ms, cb });
      return id;
    },
    clearTimeout: (id) => {
      const i = timers.findIndex((t) => t.id === id);
      if (i !== -1) timers.splice(i, 1);
    },
    onBeforePrint: (cb) => {
      printListeners.add(cb);
      return () => printListeners.delete(cb);
    }
  };
  /** Moves the clock by `ms`, in 16 ms frames, firing due timers. */
  function advance(ms: number) {
    const end = clock + ms;
    while (clock < end) {
      clock = Math.min(end, clock + 16);
      for (const t of [...timers].sort((a, b) => a.at - b.at)) {
        if (t.at <= clock) {
          timers.splice(timers.indexOf(t), 1);
          t.cb();
        }
      }
      const due = frames.splice(0, frames.length);
      for (const f of due) f.cb(clock);
    }
  }
  /** The observer with this index fires. */
  function fire(index: number) {
    const w = watches[index];
    assert.ok(w && !w.stopped, `watch ${index} is live`);
    w.stopped = true;
    w.cb();
  }
  return { env, el: el as unknown as CountUpElement & typeof el, advance, fire, frames, timers, watches, printListeners, writes, now: () => clock };
}

const FINAL = formatCountValue(25, "number");
const FULL_COUNT = COUNT_UP_HERO_MS + 50;

test("the home counter takes 2.5 times the old 750 ms", () => {
  assert.equal(COUNT_UP_HERO_MS, 1875);
  assert.equal(COUNT_UP_HERO_MS, 750 * 2.5);
});

test("on screen at mount: counts straight away from 0 and lands on the true value", () => {
  const b = fakeBrowser();
  startCountUp(b.el, { value: 25 }, b.env);
  assert.equal(b.el.textContent, "0", "starts from 0 at once");
  assert.equal(b.el.pending(), false, "shown as soon as it starts from 0");
  assert.equal(b.watches.length, 0, "no observer needed");
  b.advance(900);
  const mid = Number(b.el.textContent);
  assert.ok(mid > 0 && mid < 25, `counting: ${mid}`);
  assert.notEqual(b.el.textContent, FINAL, "not there yet half-way");
  b.advance(FULL_COUNT);
  assert.equal(b.el.textContent, FINAL);
  assert.equal(b.frames.length, 0, "no frame left running");
});

test("the count never goes backwards, never overshoots and uses every number on the way up", () => {
  const b = fakeBrowser();
  startCountUp(b.el, { value: 25 }, b.env);
  let last = 0;
  const seen = new Set<number>();
  for (let i = 0; i < 130; i++) {
    b.advance(16);
    const now = Number(b.el.textContent);
    assert.ok(now >= last && now <= 25, `${last} -> ${now}`);
    seen.add(now);
    last = now;
  }
  assert.equal(last, 25);
  for (const n of [20, 21, 22, 23, 24, 25]) assert.ok(seen.has(n), `the last numbers are not skipped: ${n}`);
});

test("it is NOT linear: it slows down, the last number is shown longer than the first ten together", () => {
  const b = fakeBrowser();
  startCountUp(b.el, { value: 25 }, b.env);
  const firstSeen = new Map<number, number>();
  for (let t = 0; t <= COUNT_UP_HERO_MS + 100; t += 16) {
    if (t > 0) b.advance(16);
    const n = Number(b.el.textContent);
    if (!firstSeen.has(n)) firstSeen.set(n, b.now());
  }
  const at = (n: number) => firstSeen.get(n) ?? Number.NaN;
  const heldFor = (n: number) => at(n + 1) - at(n);
  // the first ten numbers pass quickly, the end crawls
  assert.ok(at(10) < COUNT_UP_HERO_MS * 0.3, `10 is reached early: ${at(10)} ms`);
  assert.ok(heldFor(24) > 250, `"24" holds for a long time: ${heldFor(24)} ms`);
  assert.ok(heldFor(24) > heldFor(20) && heldFor(20) > heldFor(15) && heldFor(15) > heldFor(5), "every step is slower than the one before");
  assert.ok(heldFor(24) > at(10) - at(0), "the last step takes longer than the first ten steps together");
  // and the last number lands at the very end, not part-way through an idle tail
  assert.ok(at(25) >= COUNT_UP_HERO_MS - 40, `25 lands at the end: ${at(25)} ms`);
});

test("the figure GROWS on the last-but-one number, BURSTS on the last and the larger figure STAYS", () => {
  const b = fakeBrowser();
  startCountUp(b.el, { value: 25 }, b.env);
  assert.equal(b.el.phase, null, "no growth while the count is far from the end");
  let grewAt: number | null = null;
  let grewOnNumber: number | null = null;
  for (let t = 0; t < COUNT_UP_HERO_MS + 40; t += 16) {
    b.advance(16);
    if (grewAt === null && b.el.phase === "grow") {
      grewAt = b.now();
      grewOnNumber = Number(b.el.textContent);
    }
  }
  assert.equal(grewOnNumber, 24, "it starts to grow when the last-but-one number shows");
  assert.ok(grewAt !== null && grewAt < COUNT_UP_HERO_MS - 200, "the growth is under way before the landing");
  assert.equal(b.el.textContent, FINAL);
  assert.equal(b.el.phase, "burst", "the landing bursts");
  b.advance(BURST_MS + 50);
  assert.equal(b.el.phase, "done", "after the burst the larger figure stays");
  assert.equal(b.el.textContent, FINAL);
  b.advance(5000);
  assert.equal(b.el.phase, "done", "and stays");
  assert.equal(b.timers.length, 0, "nothing keeps running");
});

test("reduced motion: the true value at once, shown, no growth, no burst, nothing scheduled", () => {
  const b = fakeBrowser({ reducedMotion: true });
  startCountUp(b.el, { value: 25 }, b.env);
  assert.equal(b.el.textContent, FINAL);
  assert.equal(b.el.pending(), false);
  assert.equal(b.el.phase, null);
  assert.equal(b.frames.length + b.timers.length + b.watches.length, 0);
});

test("a value of 0 (or not a number) is shown as it is, without a count or a burst", () => {
  for (const value of [0, -3, Number.NaN]) {
    const b = fakeBrowser();
    startCountUp(b.el, { value }, b.env);
    assert.equal(b.el.textContent, formatCountValue(value, "number"));
    assert.equal(b.el.pending(), false);
    assert.equal(b.el.phase, null);
    assert.equal(b.frames.length + b.timers.length + b.watches.length, 0, `value ${value}`);
  }
});

test("a single offer still counts, grows and bursts (the last number is also the first)", () => {
  const b = fakeBrowser();
  startCountUp(b.el, { value: 1 }, b.env);
  b.advance(COUNT_UP_HERO_MS + 40);
  assert.equal(b.el.textContent, "1");
  assert.equal(b.el.phase, "burst");
});

test("off screen: keeps the true text and stays pending until it is within one screen of the viewport", () => {
  const b = fakeBrowser({ top: 2600, bottom: 2630, viewport: 800 }); // 3.25 screens down: far below the fold
  startCountUp(b.el, { value: 25 }, b.env);
  assert.equal(b.el.textContent, FINAL, "a crawler or screenshot reads the true number");
  assert.equal(b.el.pending(), true, "invisible, so it can be swapped to 0 unseen");
  assert.equal(b.watches.length, 1);
  assert.deepEqual(b.watches[0]?.options, ARM_OBSERVER, "armed one viewport height before it is visible");
  assert.equal(b.frames.length, 0);

  b.fire(0); // it comes within one screen
  assert.equal(b.el.textContent, "0", "armed: swapped to 0 while still off screen");
  assert.equal(b.el.pending(), false);
  assert.equal(b.watches.length, 2, "now it waits to be really seen");
  assert.equal(b.frames.length, 0, "not counting yet");
  assert.equal(b.el.phase, null, "no growth before it counts");

  b.fire(1); // it enters the viewport
  b.advance(FULL_COUNT);
  assert.equal(b.el.textContent, FINAL);
  assert.equal(b.el.phase, "burst");
});

test("the figure on a phone (just below the first screen) is armed and animated when scrolled to", () => {
  const b = fakeBrowser({ top: 1100, bottom: 1130, viewport: 740 }); // 1.5 screens: the old code gave up on it
  startCountUp(b.el, { value: 25 }, b.env);
  assert.equal(b.watches.length, 1, "no longer skipped");
  b.fire(0);
  b.fire(1);
  b.advance(900);
  const mid = Number(b.el.textContent);
  assert.ok(mid > 0 && mid < 25, `counting while scrolled to: ${mid}`);
  b.advance(FULL_COUNT);
  assert.equal(b.el.textContent, FINAL);
});

test("armed but never seen: after SETTLE_MS the true value (and the larger figure) is back, and it still counts when it arrives", () => {
  const b = fakeBrowser({ top: 1500, bottom: 1530 });
  startCountUp(b.el, { value: 25 }, b.env);
  b.fire(0);
  assert.equal(b.el.textContent, "0");
  b.advance(SETTLE_MS + 100);
  assert.equal(b.el.textContent, FINAL, "a late screenshot reads the true number, not 0");
  assert.equal(b.el.phase, "done");
  assert.equal(b.watches[1]?.stopped, false, "still waiting to be seen");
  b.fire(1);
  assert.equal(b.el.textContent, "0", "restarts from 0 the moment it enters");
  assert.equal(b.el.phase, null, "the growth restarts too");
  b.advance(FULL_COUNT);
  assert.equal(b.el.textContent, FINAL);
  assert.equal(b.el.phase, "burst");
});

test("if frames never run (hidden tab) the true value is forced shortly after the count should have ended", () => {
  const b = fakeBrowser();
  startCountUp(b.el, { value: 25 }, b.env);
  b.frames.length = 0; // the browser never delivers a frame
  assert.equal(b.el.textContent, "0");
  b.advance(COUNT_UP_HERO_MS + PLAY_SLACK_MS + 50);
  assert.equal(b.el.textContent, FINAL);
  assert.equal(b.el.phase, "done");
});

test("printing shows the true value in the middle of a count", () => {
  const b = fakeBrowser();
  startCountUp(b.el, { value: 25 }, b.env);
  b.advance(400);
  assert.notEqual(b.el.textContent, FINAL);
  assert.equal(b.printListeners.size, 1);
  for (const listener of b.printListeners) listener();
  assert.equal(b.el.textContent, FINAL);
});

test("cleanup stops everything, leaves the true value shown and takes the growth away (unmount, StrictMode, a new value)", () => {
  const b = fakeBrowser();
  const stop = startCountUp(b.el, { value: 25 }, b.env);
  b.advance(1700); // mid-growth
  assert.equal(b.el.phase, "grow");
  stop();
  assert.equal(b.el.textContent, FINAL);
  assert.equal(b.el.pending(), false);
  assert.equal(b.el.phase, null);
  assert.equal(b.frames.length + b.timers.length, 0);
  assert.equal(b.printListeners.size, 0);

  const far = fakeBrowser({ top: 3000, bottom: 3030 });
  const stopFar = startCountUp(far.el, { value: 25 }, far.env);
  stopFar();
  assert.equal(far.watches.every((w) => w.stopped), true);
  assert.equal(far.el.pending(), false);
});

test("grosze format counts whole zloty and lands on the exact amount, with the same growth and burst", () => {
  const b = fakeBrowser();
  startCountUp(b.el, { value: 123456, format: "pln" }, b.env);
  b.advance(COUNT_UP_HERO_MS + 40);
  assert.equal(b.el.textContent, formatCountValue(123456, "pln"));
  assert.equal(b.el.phase, "burst");
});

test("an explicit duration is honoured within 0.7-3 s (the other count-ups keep their own speed)", () => {
  const b = fakeBrowser();
  startCountUp(b.el, { value: 25, duration: 800 }, b.env);
  b.advance(840);
  assert.equal(b.el.textContent, FINAL);
  const c = fakeBrowser();
  startCountUp(c.el, { value: 25, duration: 100 }, c.env); // clamped up to 700 ms
  c.advance(300);
  assert.notEqual(c.el.textContent, FINAL);
  c.advance(500);
  assert.equal(c.el.textContent, FINAL);
});
