import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "../src/components/ui/Button";
import { Segment } from "../src/components/ui/Segment";
import { CategoryNav } from "../src/components/blog/CategoryNav";
import { PILL_OFF, PILL_ON } from "../src/components/ui/pillStyles";

// The owner's favourite look is the Segment ("Konta osobiste | Konta firmowe"): selected = SOLID action fill with a bold
// on-action label, not selected = cream (sunken) with a strong grey border. Everything that is selected, primary or a
// window header copies it. These tests keep the copies from drifting back to tinted ("tonal") fills.
(globalThis as { React?: typeof React }).React = React;

const h = React.createElement;
const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const src = (rel: string) => readFileSync(join(process.cwd(), "src", rel), "utf8");

test("Segment: the selected option is a solid action fill with on-action text, never a tint", () => {
  const out = html(
    h(Segment, {
      label: "Typ konta",
      value: "a",
      onChange: () => undefined,
      options: [
        { value: "a", label: "Konta osobiste" },
        { value: "b", label: "Konta firmowe" }
      ]
    })
  );
  const selected = /<button[^>]*aria-checked="true"[^>]*class="([^"]*)"/.exec(out)![1]!;
  assert.match(selected, /(?<![\w/-])bg-action(?![\w/\[-])/);
  assert.match(selected, /text-on-action/);
  assert.doesNotMatch(selected, /color-action\)\/0\.2|text-action(?!-)/, "no tint, no action-coloured label");
  const other = /<button[^>]*aria-checked="false"[^>]*class="([^"]*)"/.exec(out)![1]!;
  assert.match(other, /bg-sunken/);
  assert.match(other, /border-line-strong/);
});

test("Button: primary is the selected-Segment look, secondary is the cream one, cta adds a halo", () => {
  const primary = html(h(Button, null, "Zapisz"));
  assert.match(primary, /bg-action/);
  assert.match(primary, /text-on-action/);
  assert.match(primary, /rounded-full/);
  assert.doesNotMatch(primary, /bg-action\/\[0\.16\]/);
  assert.ok(PILL_ON.split(" ").every((c) => primary.includes(c)), "primary carries every PILL_ON class");

  const secondary = html(h(Button, { variant: "secondary" }, "Anuluj"));
  assert.match(secondary, /bg-sunken/);
  assert.match(secondary, /border-line-strong/);
  assert.ok(PILL_OFF.split(" ").every((c) => secondary.includes(c)), "secondary carries every PILL_OFF class");

  const cta = html(h(Button, { variant: "cta" }, "Przejdź do promocji"));
  assert.match(cta, /shadow-\[0_0_0_4px/, "cta has the halo");
  assert.doesNotMatch(primary, /shadow-\[0_0_0_4px/, "plain primary has none");
});

test("Button: a disabled button loses the halo, the drop shadow and the hover tint", () => {
  const disabled = html(h(Button, { variant: "secondary", disabled: true }, "Zapisz"));
  assert.match(disabled, /disabled:shadow-none/);
  assert.match(disabled, /disabled:bg-none/);
  assert.match(disabled, /disabled:bg-ink-100/);
});

test("category chips: the current one is solid, the others are cream pills", () => {
  const out = html(h(CategoryNav, { counts: { PROMOCJE_BANKOWE: 2, KONTA_BANKOWE: 3 }, current: null }));
  const chips = [...out.matchAll(/<a[^>]*class="([^"]*)"/g)].map((m) => m[1] ?? "");
  assert.ok(chips.length >= 2);
  assert.match(chips[0]!, /bg-action/);
  assert.match(chips[0]!, /text-on-action/);
  assert.match(chips[1]!, /bg-sunken/);
  assert.ok(chips.every((c) => c.includes("rounded-full")));
});

test("windows: the sign-in dialog and the filter sheet have a solid action header with an on-action title", () => {
  for (const file of ["components/AuthModalProvider.tsx", "components/filters/FilterSheet.tsx"]) {
    const source = src(file);
    assert.match(source, /bg-action[^"]*text-on-action|text-on-action[^"]*bg-action/, `${file}: header is solid`);
    assert.match(source, /border-action(?![/\w-])/, `${file}: the frame is action-coloured`);
    assert.doesNotMatch(source, /color-action\)\/0\.08/, `${file}: no tinted header any more`);
  }
});

test("no control is styled with a tinted action fill + action text any more (the retired 'tonal' look)", () => {
  for (const file of [
    "components/ui/Button.tsx",
    "components/ui/Segment.tsx",
    "components/blog/CategoryNav.tsx",
    "components/filters/FilterFields.tsx",
    "components/PromotionComments.tsx",
    "components/AdminSwitcher.tsx"
  ]) {
    assert.doesNotMatch(src(file), /bg-action\/\[0\.1[46]\]|bg-action\/\[0\.2/, `${file} still has a tonal fill`);
  }
});
