// On a phone the offer cards are a row you swipe, with the neighbouring cards peeking out at both edges; from `sm` up
// they are the 2 / 3 column grid they always were. The layout is pure CSS (so there is no flash and no layout shift),
// which is why these tests pin the class contract of the markup the server sends.
import "./legal-setup";
import test from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CardRail } from "../src/components/ui/CardRail";
import { HeroSpotlight } from "../src/components/home/HeroSpotlight";

const cards = (n: number) => Array.from({ length: n }, (_, i) => h("li", { key: i, className: "flex min-w-0" }, `Karta ${i + 1}`));
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
// class="[&amp;&gt;li]:w-..." is what the HTML says; the browser reads [&>li]:w-...
const decode = (text: string) => text.replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const tag = (markup: string, name: string) => decode(new RegExp(`<${name}\\b[^>]*>`).exec(markup)?.[0] ?? "");

test("CardRail: on a phone one snapping row, full width, neighbours peek out; from sm the grid", () => {
  const ul = tag(html(h(CardRail, { children: cards(3) })), "ul");
  assert.match(ul, /role="list"/);
  // phone: a row you swipe, snapping to the middle, running edge to edge
  for (const c of ["-mx-4", "flex", "snap-x", "snap-mandatory", "overflow-x-auto", "overscroll-x-contain", "max-sm:gap-3"]) {
    assert.ok(ul.includes(c), `phone class ${c}`);
  }
  // each card is 80% of the screen (22 rem at most): the rest is the peeking neighbours
  assert.ok(ul.includes("[&>li]:w-[min(80vw,22rem)]"));
  assert.ok(ul.includes("[&>li]:snap-center"));
  // empty ends so the first and the last card can reach the middle of the screen
  assert.ok(ul.includes("before:w-[calc((100vw-min(80vw,22rem))/2-0.75rem)]"));
  assert.ok(ul.includes("after:w-[calc((100vw-min(80vw,22rem))/2-0.75rem)]"));
  // sm and up: the grid again
  for (const c of ["sm:grid", "sm:grid-cols-2", "sm:snap-none", "sm:mx-0", "sm:overflow-visible", "lg:grid-cols-3", "sm:before:hidden", "sm:after:hidden"]) {
    assert.ok(ul.includes(c), `sm+ class ${c}`);
  }
});

test("CardRail: two columns from lg when asked, never three", () => {
  const ul = tag(html(h(CardRail, { columns: 2, children: cards(2) })), "ul");
  assert.ok(ul.includes("sm:grid-cols-2"));
  assert.ok(!ul.includes("lg:grid-cols-3"));
});

test("CardRail: the dots say where you are (first one active), exist only on a phone and are decoration", () => {
  const out = html(h(CardRail, { children: cards(3) }));
  const dots = /<div aria-hidden="true" data-rail-dots=""[^>]*>(.*?)<\/div>/.exec(out);
  assert.ok(dots, "dots row");
  assert.match(tag(dots[0], "div"), /sm:hidden/);
  assert.equal((dots[1]!.match(/<span\b/g) ?? []).length, 3);
  assert.equal((dots[1]!.match(/data-active="true"/g) ?? []).length, 1);
  assert.match(dots[1]!, /^<span data-active="true"/);
});

test("CardRail: the cards stay real list items in the HTML (links, order, SEO), nothing is duplicated", () => {
  const out = html(h(CardRail, { className: "mt-6", children: cards(3) }));
  assert.equal((out.match(/<li\b/g) ?? []).length, 3);
  assert.match(out, /^<div class="mt-6">/);
  assert.ok(out.indexOf("Karta 1") < out.indexOf("Karta 2") && out.indexOf("Karta 2") < out.indexOf("Karta 3"));
});

test("CardRail: a single card has nothing to swipe to - a normal full-width card, no dots, no peeking ends", () => {
  const out = html(h(CardRail, { children: cards(1) }));
  const ul = tag(out, "ul");
  assert.ok(ul.includes("grid"));
  assert.ok(!ul.includes("snap-x"));
  assert.ok(!ul.includes("-mx-4"));
  assert.ok(!ul.includes("before:w-"));
  assert.ok(!out.includes("data-rail-dots"));
});

const slide = (i: number) => h("article", { key: i }, `Oferta ${i + 1}`);

test("HeroSpotlight: the same cards are a swipeable row on a phone and the cross-fade stack from sm", () => {
  const out = html(
    h(HeroSpotlight, { header: null, slides: [0, 1, 2].map(slide), labels: ["A", "B", "C"] })
  );
  const track = decode(/<div class="(-mx-4 flex[^"]*)"/.exec(out)?.[1] ?? "");
  for (const c of ["snap-x", "snap-mandatory", "overflow-x-auto", "[&>div]:w-[min(80vw,22rem)]", "[&>div]:snap-center"]) {
    assert.ok(track.includes(c), `phone class ${c}`);
  }
  for (const c of ["sm:grid", "sm:overflow-hidden", "sm:snap-none", "sm:mx-0", "sm:[&>div]:w-auto"]) {
    assert.ok(track.includes(c), `sm+ class ${c}`);
  }
  // all three slides are in the HTML once; the fading (opacity) belongs to sm+ only, so on a phone every card is visible
  assert.equal((out.match(/data-slide=""/g) ?? []).length, 3);
  const slides = out.match(/<div data-slide=""[^>]*>/g) ?? [];
  for (const s of slides) {
    assert.ok(!/(^|\s)opacity-0/.test(s) && !/(^|\s)blur-\[3px\]/.test(s), "no unprefixed hiding on a phone");
  }
  assert.ok(slides[1]!.includes("sm:opacity-0"));
  assert.ok(slides[0]!.includes("sm:opacity-100"));
  // the light sweep of the stack is not part of the swipeable row
  assert.match(out, /max-sm:hidden/);
  // no ring and no glow around the whole strip on a phone: each card has its own border
  assert.match(out, /max-sm:ring-0/);
  assert.match(out, /max-sm:shadow-none/);
});

test("HeroSpotlight: server HTML keeps the stack semantics (other cards inert) until the script knows it is on a phone", () => {
  const out = html(h(HeroSpotlight, { header: null, slides: [0, 1].map(slide), labels: ["A", "B"] }));
  const slides = out.match(/<div data-slide=""[^>]*>/g) ?? [];
  assert.ok(!slides[0]!.includes("inert"));
  assert.ok(slides[1]!.includes("inert"));
  assert.ok(slides[1]!.includes('aria-hidden="true"'));
});

test("HeroSpotlight: the root is not capped at 28 rem on a phone (the row must reach both screen edges) and may shrink in a grid", () => {
  const root = tag(html(h(HeroSpotlight, { header: null, slides: [0, 1].map(slide), labels: ["A", "B"] })), "div");
  assert.ok(root.includes("max-sm:max-w-none"));
  assert.ok(root.includes("min-w-0"));
});
