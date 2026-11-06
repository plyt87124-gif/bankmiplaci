import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { GET } from "../src/app/llms.txt/route";
import { LLMS_SECTIONS, buildLlmsTxt } from "../src/lib/seo/llmsTxt";

process.env.NEXT_PUBLIC_SITE_URL = "https://bankmiplaci.example";
delete process.env.NEXT_PUBLIC_SITE_NAME;

test("llms.txt is plain UTF-8 text with the site name as the top heading and a summary", async () => {
  const res = GET();
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /^text\/plain; charset=utf-8$/);
  const body = await res.text();
  assert.equal(body, buildLlmsTxt());
  assert.match(body, /^# Bankmiplaci\n\n> Serwis porównujący promocje bankowe/);
});

test("llms.txt states how the service earns, same as the rest of the site (never hides the commission)", () => {
  const body = buildLlmsTxt();
  assert.match(body, /Możemy otrzymywać wynagrodzenie/);
  assert.match(body, /Wynagrodzenie partnerskie jest jednym ze składników oceny/);
  assert.match(body, /kwoty maksymalne/);
});

test("every link is an absolute URL on the configured origin", () => {
  const body = buildLlmsTxt();
  const urls = [...body.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map((m) => m[1] ?? "");
  assert.equal(urls.length, LLMS_SECTIONS.flatMap((s) => s.links).length);
  for (const u of urls) assert.ok(u.startsWith("https://bankmiplaci.example/"), u);
});

/** Does the app have a page for these URL segments? Route groups "(x)" and dynamic folders "[x]" are allowed. */
function hasPage(dir: string, segments: string[]): boolean {
  const subdirs = existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [];
  if (segments.length === 0) {
    if (existsSync(join(dir, "page.tsx"))) return true;
    return subdirs.filter((n) => /^\(.+\)$/.test(n)).some((g) => hasPage(join(dir, g), segments));
  }
  const [head, ...rest] = segments as [string, ...string[]];
  const groups = subdirs.filter((n) => /^\(.+\)$/.test(n));
  const dynamic = subdirs.filter((n) => /^\[[^.\]]+\]$/.test(n));
  const candidates = [...(subdirs.includes(head) ? [join(dir, head)] : []), ...dynamic.map((n) => join(dir, n))];
  return candidates.some((c) => hasPage(c, rest)) || groups.some((g) => hasPage(join(dir, g), segments));
}

test("every linked path has a page in the app (no dead links in llms.txt)", () => {
  const appDir = join(process.cwd(), "src", "app");
  for (const link of LLMS_SECTIONS.flatMap((s) => s.links)) {
    const segments = link.path.split("/").filter(Boolean);
    assert.ok(hasPage(appDir, segments), `${link.path}: brak strony w src/app`);
  }
});

test("llms.txt does not point to dated or private areas", () => {
  const body = buildLlmsTxt();
  assert.doesNotMatch(body, /\/admin|\/api|\/out|\/konto|stan-rynku-promocji-bankowych-/);
});
