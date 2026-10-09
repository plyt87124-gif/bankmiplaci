import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DYNAMIC_ROUTE_FLAGS, SITE_ROUTES, isRouteLive, liveRoutes } from "../src/lib/seo/routes";

const APP = path.join(process.cwd(), "src", "app");

function pageExists(routePath: string): boolean {
  const dir = routePath === "/" ? APP : path.join(APP, ...routePath.split("/").filter(Boolean));
  return ["page.tsx", "page.ts", "page.jsx", "page.js"].some((f) => fs.existsSync(path.join(dir, f)));
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
