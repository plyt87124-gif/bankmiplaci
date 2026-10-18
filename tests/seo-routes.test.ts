import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DYNAMIC_ROUTE_FLAGS, SITE_ROUTES, isRouteLive, liveRoutes } from "../src/lib/seo/routes";

const APP = path.join(process.cwd(), "src", "app");

/** True when `segs` resolve to a page.* file; route groups such as "(lista)" do not count as URL segments. */
function hasPage(dir: string, segs: string[]): boolean {
  if (segs.length === 0 && ["page.tsx", "page.ts", "page.jsx", "page.js"].some((f) => fs.existsSync(path.join(dir, f)))) return true;
  if (!fs.existsSync(dir)) return false;
  if (segs.length > 0 && hasPage(path.join(dir, segs[0]!), segs.slice(1))) return true;
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .some((e) => e.isDirectory() && /^\(.+\)$/.test(e.name) && hasPage(path.join(dir, e.name), segs));
}

function pageExists(routePath: string): boolean {
  return hasPage(APP, routePath.split("/").filter(Boolean));
}

test("every route the sitemap lists has a page in src/app (the sitemap never links to a 404)", () => {
  for (const route of liveRoutes()) {
    assert.ok(pageExists(route.path), `${route.path} is marked live but src/app${route.path}/page.tsx does not exist`);
  }
});

test("the dynamic families listed in the sitemap have their [slug] pages", () => {
  // Offers and articles are always listed.
  assert.ok(pageExists("/promocje/[slug]"), "/promocje/[slug]");
  assert.ok(pageExists("/blog/[slug]"), "/blog/[slug]");
  if (DYNAMIC_ROUTE_FLAGS.bankPages) {
    assert.ok(pageExists("/banki/[slug]"), "/banki/[slug] is switched on but missing");
    assert.ok(isRouteLive("/banki"), "bank pages need the /banki index too");
  }
});

test("registry sanity: unique, absolute paths without query strings or trailing slashes", () => {
  const paths = SITE_ROUTES.map((r) => r.path);
  assert.equal(new Set(paths).size, paths.length, "duplicate path");
  for (const p of paths) {
    assert.ok(p.startsWith("/"), p);
    assert.ok(!p.includes("?") && !p.includes("#"), p);
    assert.ok(p === "/" || !p.endsWith("/"), p);
  }
});

test("pages that must never be indexed are not in the registry", () => {
  for (const p of SITE_ROUTES.map((r) => r.path)) {
    assert.ok(!/^\/(admin|api|out|konto)(\/|$)/.test(p), `${p} must not be in the sitemap`);
  }
});

test("the home page and the offers list are always listed", () => {
  assert.ok(isRouteLive("/"));
  assert.ok(isRouteLive("/promocje"));
  assert.equal(isRouteLive("/nie-istnieje"), false);
});
