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
