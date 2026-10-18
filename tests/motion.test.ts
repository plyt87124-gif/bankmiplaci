import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React, { createElement, type ComponentProps, type FunctionComponent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Reveal } from "../src/components/motion/Reveal";
import { CountUp } from "../src/components/motion/CountUp";
import { COUNT_UP_MAX_MS, COUNT_UP_MIN_MS, clampCountUpDuration, easeOutCubic } from "../src/components/motion/easing";
import { formatCountFrame, formatCountValue } from "../src/components/motion/format";
import { prefersReducedMotion } from "../src/hooks/useReducedMotion";
import { formatPLN } from "../src/lib/format";

const SRC = path.join(process.cwd(), "src");

// tsx compiles the components' JSX with the classic runtime (tsconfig has
// "jsx": "preserve" for Next), which needs React in scope when rendering.
(globalThis as unknown as { React: typeof React }).React = React;

// Reveal with optional props, so tests can pass children the idiomatic way.
const RevealAny = Reveal as FunctionComponent<Partial<ComponentProps<typeof Reveal>>>;

// ---------------------------------------------------------------- Reveal (SSR)

test("Reveal: server HTML has the content, data-reveal and no data-in", () => {
  const html = renderToStaticMarkup(createElement(RevealAny, { index: 2, className: "py-12" }, createElement("p", null, "Treść sekcji")));
  assert.match(html, /Treść sekcji/);
  assert.match(html, /data-reveal=""/);
  assert.doesNotMatch(html, /data-in/);
  assert.match(html, /--reveal-i:2/);
  assert.match(html, /class="py-12"/);
});

test("Reveal: nothing hides content by itself (no opacity:0 / visibility / hidden inline, no motion class)", () => {
  const html = renderToStaticMarkup(createElement(RevealAny, { as: "section", id: "jak-to-dziala" }, createElement("h2", null, "Tytuł")));
  assert.doesNotMatch(html, /opacity/i);
  assert.doesNotMatch(html, /visibility|hidden|display:\s*none/i);
  assert.doesNotMatch(html, /motion-ok/);
  assert.match(html, /^<section /);
  assert.match(html, /id="jak-to-dziala"/);
});

test("Reveal: stagger index wraps at 6 and survives junk input", () => {
  const step = (index: number) => /--reveal-i:(\d+)/.exec(renderToStaticMarkup(createElement(RevealAny, { index }, "x")))?.[1];
  assert.equal(step(0), "0");
  assert.equal(step(5), "5");
  assert.equal(step(6), "0");
  assert.equal(step(13), "1");
  assert.equal(step(-1), "1");
  assert.equal(step(Number.NaN), "0");
});

test("motion.css: every rule that starts from opacity:0 is scoped to .motion-ok (or is the failsafe keyframe)", () => {
  const css = fs.readFileSync(path.join(SRC, "styles", "motion.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [...css.matchAll(/([^{}@][^{}]*)\{([^{}]*)\}/g)];
  const hiding = rules.filter(([, , body]) => /opacity:\s*0\s*[;}]?\s*$|opacity:\s*0\s*;/m.test(body ?? ""));
  assert.ok(hiding.length > 0, "expected to find the reveal / skeleton rules");
  for (const [, selector] of hiding) {
    const sel = (selector ?? "").trim();
    // keyframe steps ("from", "0%") and ring pseudo-element are animation internals, not static hiding
    if (/^(from|to|\d+%(,\s*\d+%)*)$/.test(sel)) continue;
    if (/\.animate-ring-pulse::after/.test(sel)) continue;
    assert.match(sel, /\.motion-ok/, `"${sel}" hides content without .motion-ok`);
  }
});

// -------------------------------------------------------------- CountUp (SSR)

test("CountUp: server HTML shows the FINAL value and labels it for assistive tech", () => {
  const html = renderToStaticMarkup(createElement(CountUp, { value: 12500 }));
  const final = formatCountValue(12500, "number");
  assert.equal(final, `12${String.fromCharCode(0xa0)}500`); // pl-PL groups with a non-breaking space
  assert.ok(html.includes(`<span class="sr-only">${final}</span>`), html);
  assert.ok(html.includes(`<span aria-hidden="true">${final}</span>`), html);
  assert.doesNotMatch(html, /role="img"/);
  assert.doesNotMatch(html, />0</);
});

test("CountUp: pln format uses formatPLN of grosze, final text is exact", () => {
  const html = renderToStaticMarkup(createElement(CountUp, { value: 123456, format: "pln", className: "text-h3" }));
  const final = formatPLN(123456);
  assert.ok(html.includes(`<span class="sr-only">${final}</span>`), html);
  assert.ok(html.includes(`>${final}</span>`), html);
  assert.match(html, /class="num text-h3"/);
});

test("CountUp: zero renders 0 (an aggregate of nothing is not hidden)", () => {
  const html = renderToStaticMarkup(createElement(CountUp, { value: 0 }));
  assert.ok(html.includes('<span class="sr-only">0</span>'), html);
});

// ------------------------------------------------------------------ pure bits

test("easeOutCubic: 0 -> 0, 1 -> 1, monotonic, clamped, front-loaded", () => {
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  assert.equal(easeOutCubic(-3), 0);
  assert.equal(easeOutCubic(7), 1);
  assert.ok(easeOutCubic(0.5) > 0.5);
  let prev = -1;
  for (let i = 0; i <= 20; i++) {
    const v = easeOutCubic(i / 20);
    assert.ok(v >= prev);
    prev = v;
  }
});

test("count-up duration is clamped to 700-800 ms", () => {
  assert.equal(clampCountUpDuration(2400), COUNT_UP_MAX_MS);
  assert.equal(clampCountUpDuration(100), COUNT_UP_MIN_MS);
  assert.equal(clampCountUpDuration(750), 750);
  assert.ok(clampCountUpDuration(Number.NaN) >= COUNT_UP_MIN_MS);
});

test("formatCountFrame rounds to whole units, formatCountValue keeps the exact value", () => {
  assert.equal(formatCountFrame(12.6, "number"), "13");
  assert.equal(formatCountFrame(15050, "pln"), formatPLN(15100));
  assert.equal(formatCountValue(15050, "pln"), formatPLN(15050));
});

// ------------------------------------------------------------- reduced motion

test("prefersReducedMotion follows matchMedia and is false without a browser", () => {
  const g = globalThis as unknown as { window?: unknown };
  const original = g.window;
  try {
    delete g.window;
    assert.equal(prefersReducedMotion(), false);
    g.window = { matchMedia: (q: string) => ({ matches: q.includes("reduce") }) };
    assert.equal(prefersReducedMotion(), true);
    g.window = { matchMedia: () => ({ matches: false }) };
    assert.equal(prefersReducedMotion(), false);
    g.window = {
      matchMedia: () => {
        throw new Error("blocked");
      }
    };
    assert.equal(prefersReducedMotion(), false);
  } finally {
    if (original === undefined) delete g.window;
    else g.window = original;
  }
});

// --------------------------------------------------------------- EarningsCounter

test("EarningsCounter: no sparks, 800 ms count-up, reduced motion handled, pop class kept", () => {
  const src = fs.readFileSync(path.join(SRC, "components", "EarningsCounter.tsx"), "utf8");
  assert.doesNotMatch(src, /PARTICLE_ANGLES|earnings-firework|--earnings-angle/);
  assert.doesNotMatch(src, /2400/);
  assert.match(src, /clampCountUpDuration\(800\)/);
  assert.match(src, /prefersReducedMotion\(\)/);
  assert.match(src, /animate-earnings-pop/);
});

test("motion.css pop never exceeds 1.04", () => {
  const css = fs.readFileSync(path.join(SRC, "styles", "motion.css"), "utf8");
  const pop = /@keyframes earnings-pop\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  const scales = [...pop.matchAll(/scale\(([\d.]+)\)/g)].map((m) => Number(m[1]));
  assert.ok(scales.length >= 2);
  assert.ok(Math.max(...scales) <= 1.04);
  assert.ok(Math.min(...scales) >= 1);
});
