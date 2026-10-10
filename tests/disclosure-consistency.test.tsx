import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import HowWeEarnPage from "../src/app/jak-zarabiamy/page";
import AboutPage from "../src/app/o-nas/page";
import { RATING_FLOOR } from "../src/app/metodologia/ratingModel";
import { STRIP_RECOMMENDED, TAG_RECOMMENDED_DESCRIPTION, disclosureText } from "../src/lib/disclosureCopy";
import { LISTING_FAQ } from "../src/components/promocje/editorialContent";

// The "Polecane" disclosure must say the same thing everywhere: the order depends
// on the rating AND on partner remuneration, a lower-rated offer can rank higher,
// and the rating itself is computed without remuneration. The earlier wording
// ("uwzględnia m.in. wynagrodzenie") understated the main parameter.

(globalThis as { React?: typeof React }).React = React;

const ROOT = join(__dirname, "..");
const text = (markup: string) => markup.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

test("the strip says the order depends on rating AND remuneration and that a lower-rated offer can rank higher", () => {
  const copy = disclosureText(STRIP_RECOMMENDED);
  assert.ok(copy.includes("zależy od oceny serwisu i od wynagrodzenia partnerskiego"));
  assert.ok(copy.includes("oferta o niższej ocenie może znaleźć się wyżej"));
  assert.ok(copy.includes("Ocena serwisu jest liczona bez wynagrodzenia."));
  assert.ok(!/m\.in\./.test(copy));
});

test("the description under the sort control adds information instead of repeating the strip", () => {
  const strip = STRIP_RECOMMENDED.lead;
  const tag = TAG_RECOMMENDED_DESCRIPTION.lead;
  assert.ok(tag.length < strip.length, "shorter than the strip");
  assert.notEqual(tag, strip);
  // It names the scope (this sort order, not the others) - the thing the strip does not say.
  assert.ok(/W tym sortowaniu/.test(tag) && /Pozostałe sortowania od niego nie zależą/.test(tag));
  // No sentence of the tag is copied from the strip.
  for (const sentence of tag.split(/(?<=\.)\s+/)) assert.ok(!strip.includes(sentence), sentence);
  assert.equal(TAG_RECOMMENDED_DESCRIPTION.href, "/jak-zarabiamy#polecane");
});

test("no source or test still carries the old 'uwzględnia m.in. wynagrodzenie' or 'jedynie na domyślną kolejność' wording", () => {
  const needles = [/uwzględnia (ono )?m\.in\. wynagrodzeni/, /jedynie na domyślną kolejność/, /Polecane uwzględnia m\\?\.in/];
  const files = [...sourceFiles(join(ROOT, "src")), ...sourceFiles(join(ROOT, "tests"))].filter(
    (f) => !f.endsWith("disclosure-consistency.test.tsx")
  );
  for (const file of files) {
    const code = readFileSync(file, "utf8");
    for (const needle of needles) assert.ok(!needle.test(code), `${file}: ${needle}`);
  }
});

test("the list FAQ answers the commission question like the strip", () => {
  const item = LISTING_FAQ.find((i) => i.question === "Czy kolejność ofert zależy od prowizji?");
  assert.ok(item, "FAQ item present");
  assert.ok(item!.answer.includes("zależy od oceny serwisu i od wynagrodzenia partnerskiego"));
  assert.ok(item!.answer.includes("oferta o niższej ocenie może znaleźć się wyżej"));
  assert.ok(item!.answer.includes("Ocena serwisu jest liczona bez wynagrodzenia"));
});

test("/jak-zarabiamy gives the rating scale as the real floor, not 0", () => {
  const body = text(renderToStaticMarkup(React.createElement(HowWeEarnPage)));
  const floor = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(RATING_FLOOR);
  assert.equal(floor, "6,5");
  assert.ok(body.includes(`Ocena serwisu (od ${floor} do 10, liczona bez prowizji`));
  assert.ok(!body.includes("od 0 do 10"));
});

test("/o-nas and /metodologia say the commission changes the 'Polecane' order, possibly strongly", () => {
  const about = text(renderToStaticMarkup(React.createElement(AboutPage)));
  assert.ok(about.includes("Wpływa natomiast na domyślną kolejność ofert „Polecane” i może ją wyraźnie zmienić"));
  const methodology = readFileSync(join(ROOT, "src", "app", "metodologia", "MethodologyContent.tsx"), "utf8");
  assert.ok(methodology.includes("natomiast na domyślną kolejność „Polecane” i może ją wyraźnie zmienić"));
  assert.ok(!methodology.includes("jedynie"));
});
