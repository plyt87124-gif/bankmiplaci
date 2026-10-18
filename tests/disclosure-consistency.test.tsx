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
