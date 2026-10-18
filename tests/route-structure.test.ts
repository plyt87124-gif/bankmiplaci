import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const APP = path.join(process.cwd(), "src", "app");

/**
 * A loading.tsx makes Next stream a 200 response before a page can call
 * notFound(), so an unknown slug would become a soft 404. Routes that can 404
 * must therefore not sit below any loading boundary.
 */
test("pages that call notFound() have no loading.tsx on their path", () => {
  const dynamicPages = ["promocje/[slug]", "blog/[slug]", "blog/kategoria/[kategoria]"];
  for (const route of dynamicPages) {
    const segments = route.split("/");
    for (let i = 0; i <= segments.length; i++) {
      const dir = path.join(APP, ...segments.slice(0, i));
      assert.ok(!fs.existsSync(path.join(dir, "loading.tsx")), `${path.relative(APP, dir) || "app"}/loading.tsx would turn /${route} 404s into HTTP 200`);
    }
    assert.ok(fs.existsSync(path.join(APP, ...segments, "page.tsx")), `${route}/page.tsx exists`);
  }
});

test("the list pages keep their skeletons inside the (lista) route groups", () => {
  for (const section of ["promocje", "blog"]) {
    assert.ok(fs.existsSync(path.join(APP, section, "(lista)", "page.tsx")), `${section}/(lista)/page.tsx`);
    assert.ok(fs.existsSync(path.join(APP, section, "(lista)", "loading.tsx")), `${section}/(lista)/loading.tsx`);
    assert.ok(!fs.existsSync(path.join(APP, section, "page.tsx")), `${section}/page.tsx would clash with the group`);
  }
});

test("/blog/kategoria is a permanent redirect to /blog in next.config.js", async () => {
  const config = require(path.join(process.cwd(), "next.config.js")) as { redirects?: () => Promise<unknown[]>; headers?: unknown };
  assert.equal(typeof config.headers, "function", "existing headers() is kept");
  const redirects = (await config.redirects!()) as { source: string; destination: string; permanent: boolean }[];
  assert.deepEqual(
    redirects.find((r) => r.source === "/blog/kategoria"),
    { source: "/blog/kategoria", destination: "/blog", permanent: true }
  );
  assert.ok(!fs.existsSync(path.join(APP, "blog", "kategoria", "page.tsx")), "no page.tsx competes with the redirect");
});

/**
 * The root layout reads the session cookie, so every route is dynamic. An
 * ISR-style export (revalidate / generateStaticParams) on a dynamic route made
 * an unknown /blog/<slug> answer HTTP 500 (DYNAMIC_SERVER_USAGE) in a
 * production build while dev answered 404. Bring them back only together with
 * WP-17 (session out of the layout) and a production-build check.
 */
test("dynamic [slug] pages do not export ISR settings while the layout reads cookies", () => {
  const layout = fs.readFileSync(path.join(APP, "layout.tsx"), "utf8");
  if (!/getCurrentUser|cookies\(/.test(layout)) return; // WP-17 done: the rule no longer applies
  for (const route of ["promocje/[slug]", "blog/[slug]", "blog/kategoria/[kategoria]"]) {
    const source = fs.readFileSync(path.join(APP, ...route.split("/"), "page.tsx"), "utf8");
    assert.ok(!/export\s+const\s+revalidate\b/.test(source), `${route}: no revalidate export`);
    assert.ok(!/export\s+(async\s+)?function\s+generateStaticParams\b/.test(source), `${route}: no generateStaticParams`);
  }
});
