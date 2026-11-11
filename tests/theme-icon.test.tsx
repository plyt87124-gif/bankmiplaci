// Owner, 2026-11-11: the theme switch icon moves a little, but not all the time: one movement every ten seconds.
// The sun's rays get uneven lengths so it seems to shine; the moon rocks and two small stars twinkle.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeIcon } from "../src/components/ui/ThemeIcon";

(globalThis as unknown as { React: typeof React }).React = React;

const SRC = path.join(process.cwd(), "src");
const CSS = fs.readFileSync(path.join(SRC, "styles", "motion.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const html = (kind: "light" | "dark" | "system") => renderToStaticMarkup(React.createElement(ThemeIcon, { kind, className: "h-5 w-5" }));

test("every icon is decorative (the button carries the name), 24 x 24, stroke 2, and marks which mode it shows", () => {
  for (const [kind, shape] of [["light", "sun-ray"], ["dark", "moon-body"], ["system", "screen-glow"]] as const) {
    const out = html(kind);
    assert.match(out, /aria-hidden="true"/);
    assert.match(out, /viewBox="0 0 24 24"/);
    assert.match(out, /stroke-width="2"/);
    assert.match(out, new RegExp(`data-theme-icon="${kind}"`));
    assert.match(out, /class="theme-icon h-5 w-5"/);
    assert.ok(out.includes(shape), `${kind}: ${shape}`);
  }
});

test("the sun: eight rays at 45 degrees, each stretching by a DIFFERENT amount (uneven lengths), plus a halo", () => {
  const out = html("light");
  const rays = [...out.matchAll(/class="sun-ray"[^>]*style="([^"]*)"/g)].map((m) => m[1] ?? "");
  assert.equal(rays.length, 8);
  const peaks = rays.map((style) => Number(/--k:([\d.]+)/.exec(style)?.[1]));
  const seconds = rays.map((style) => Number(/--j:([\d.]+)/.exec(style)?.[1]));
  assert.ok(peaks.every((k) => k >= 1.2 && k <= 2), "stretched, but inside the icon (the ray starts at y=4, 2 long: 2k <= 4)");
  assert.ok(new Set(peaks).size >= 6, `uneven lengths: ${peaks.join(", ")}`);
  assert.ok(new Set(seconds).size >= 5, "a second, different stretch per ray");
  const delays = rays.map((style) => Number(/--d:(\d+)ms/.exec(style)?.[1]));
  assert.ok(new Set(delays).size >= 6, "the rays do not move in lockstep");
  assert.ok(Math.max(...delays) <= 300, "but they all belong to one movement");
  const angles = [...out.matchAll(/rotate\((\d+)deg\)/g)].map((m) => Number(m[1]));
  assert.deepEqual(angles.sort((a, b) => a - b), [0, 45, 90, 135, 180, 225, 270, 315]);
  assert.match(out, /class="sun-halo"/);
});

test("the moon: the crescent plus two small stars that are invisible until they twinkle", () => {
  const out = html("dark");
  assert.match(out, /class="moon-body"/);
  assert.equal((out.match(/class="moon-star moon-star-[ab]"/g) ?? []).length, 2);
  assert.match(CSS, /\.motion-ok \.theme-icon \.moon-star \{[^}]*opacity: 0/, "no star at rest");
});

test("every animation is ONE 10 s cycle: the movement sits in a window of about 1.8 s, the rest of the time it is still", () => {
  const names = ["sun-ray", "sun-halo", "moon-rock", "moon-twinkle", "screen-glow"];
  for (const name of names) {
    const rule = new RegExp(`animation:\\s*${name} (\\d+)s [^;]*infinite`).exec(CSS);
    assert.ok(rule, `${name} is an infinite animation`);
    assert.equal(rule?.[1], "10", `${name}: a cycle of ten seconds`);
    const block = new RegExp(`@keyframes ${name} \\{([\\s\\S]*?)\\n\\}`).exec(CSS)?.[1] ?? "";
    const stops = [...block.matchAll(/(\d+(?:\.\d+)?)%/g)].map((m) => Number(m[1]));
    // the keyframes that LEAVE the rest state: every percentage that is not one of the rest stops (listed first, with the same value)
    const rest = block.split("{")[1]?.split("}")[0] ?? "";
    assert.ok(rest.length > 0);
    const firstLine = block.trim().split("\n")[0] ?? "";
    const restStops = [...firstLine.matchAll(/(\d+(?:\.\d+)?)%/g)].map((m) => Number(m[1]));
    const moving = stops.filter((s) => !restStops.includes(s));
    assert.ok(moving.length >= 1, `${name}: has a moving part`);
    // still before it starts (>= 36 %) and between its end and the cycle's end
    const startOfMotion = Math.min(...restStops.filter((s) => s > 0 && s < 50));
    const endOfMotion = Math.max(...restStops.filter((s) => s > 50 && s < 100));
    assert.ok(startOfMotion >= 36, `${name}: still for the first ${startOfMotion} % of the cycle`);
    assert.ok(endOfMotion - startOfMotion <= 22, `${name}: the movement takes ${endOfMotion - startOfMotion} % (2.2 s) at most`);
    assert.ok(endOfMotion <= 60, `${name}: and it is over by ${endOfMotion} %`);
  }
});

test("the movement exists only under .motion-ok (reduced motion gets a still icon) and only transform / opacity move", () => {
  const rules = CSS.match(/[^{}]*\.theme-icon[^{]*\{[^}]*\}/g) ?? [];
  assert.ok(rules.length >= 7);
  for (const rule of rules) assert.match(rule, /\.motion-ok \.theme-icon/, rule.trim().slice(0, 60));
  for (const name of ["sun-ray", "sun-halo", "moon-rock", "moon-twinkle", "screen-glow"]) {
    const block = new RegExp(`@keyframes ${name} \\{([\\s\\S]*?)\\n\\}`).exec(CSS)?.[1] ?? "";
    const props = [...block.matchAll(/([a-z-]+):\s*[^;]+;/g)].map((m) => m[1]);
    assert.ok(props.length > 0 && props.every((p) => p === "transform" || p === "opacity"), `${name}: ${props.join(",")}`);
  }
});

test("the toggle uses the animated icons and keeps its accessible name and 44 px button", () => {
  const source = fs.readFileSync(path.join(SRC, "components", "ThemeToggle.tsx"), "utf8");
  assert.match(source, /<ThemeIcon kind=\{preference\}/);
  assert.doesNotMatch(source, /lucide-react/);
  assert.match(source, /aria-label=\{label\}/);
  assert.match(source, /h-11 w-11/);
});
