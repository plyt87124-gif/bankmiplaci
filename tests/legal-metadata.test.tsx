import "./legal-setup";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { metadata as regulaminMetadata } from "../src/app/regulamin/page";
import { metadata as politykaMetadata } from "../src/app/polityka-prywatnosci/page";
import { metadata as cookiesMetadata } from "../src/app/cookies/page";
import { DESCRIPTION_MAX, STATIC_PAGE_META, staticPageMetadata } from "../src/lib/seo/metadata";

// The legal pages used to inherit the root layout's description, i.e. the very same
// <meta name="description"> as the home page (duplicate descriptions across URLs).

// The root layout imports CSS, which the test runner cannot load: read its default description from the source.
const layoutSource = readFileSync(join(__dirname, "..", "src", "app", "layout.tsx"), "utf8");
const LAYOUT_DESCRIPTION = /\n {2}description:\s*\n?\s*"([^"]+)"/.exec(layoutSource)?.[1] ?? "";

const PAGES = [
  { key: "regulamin", path: "/regulamin", title: "Regulamin", metadata: regulaminMetadata },
  { key: "polityka", path: "/polityka-prywatnosci", title: "Polityka prywatności", metadata: politykaMetadata },
  { key: "cookies", path: "/cookies", title: "Polityka cookies", metadata: cookiesMetadata }
] as const;

test("the root layout's default description was found (the comparisons below are not vacuous)", () => {
  assert.ok(LAYOUT_DESCRIPTION.startsWith("Porównujemy aktualne promocje bankowe"), LAYOUT_DESCRIPTION);
});

test("legal pages have their own meta description, within the limit", () => {
  for (const page of PAGES) {
    const meta = STATIC_PAGE_META[page.key];
    assert.equal(meta.path, page.path);
    assert.equal(meta.title, page.title, "the page keeps its own heading as the title");
    assert.ok(meta.description.length > 40 && meta.description.length <= DESCRIPTION_MAX, `${page.key}: ${meta.description.length}`);
    assert.equal(page.metadata.description, meta.description);
    assert.notEqual(page.metadata.description, LAYOUT_DESCRIPTION, `${page.key} inherits the home page description`);
  }
});

test("no two static pages share a description", () => {
  const seen = new Map<string, string>();
  for (const [key, meta] of Object.entries(STATIC_PAGE_META)) {
    assert.ok(!seen.has(meta.description), `${key} duplicates ${seen.get(meta.description)}`);
    seen.set(meta.description, key);
  }
  assert.ok(!seen.has(LAYOUT_DESCRIPTION), "none equals the site-wide default");
});

test("legal pages export staticPageMetadata: absolute canonical, Open Graph and Twitter included", () => {
  for (const page of PAGES) {
    const expected = staticPageMetadata(page.key);
    assert.deepEqual(page.metadata, expected);
    assert.match(String(page.metadata.alternates?.canonical), new RegExp(`^https?://[^/]+${page.path}$`));
    assert.ok(page.metadata.openGraph, `${page.key}: Open Graph`);
    assert.equal(page.metadata.title, page.title);
    // the page indexes (legal pages are public): nothing sets robots
    assert.equal(page.metadata.robots, undefined);
  }
});

test("the legal text itself is untouched by the metadata change: pages only swap their `metadata` export", () => {
  for (const [dir, key] of [["regulamin", "regulamin"], ["polityka-prywatnosci", "polityka"], ["cookies", "cookies"]] as const) {
    const src = readFileSync(join(__dirname, "..", "src", "app", dir, "page.tsx"), "utf8");
    assert.ok(src.includes(`export const metadata: Metadata = staticPageMetadata("${key}");`), dir);
    assert.ok(!/alternates:\s*\{\s*canonical/.test(src), `${dir}: no hand-written canonical any more`);
  }
});
