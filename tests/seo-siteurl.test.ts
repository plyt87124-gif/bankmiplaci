import test from "node:test";
import assert from "node:assert/strict";
import {
  FALLBACK_SITE_URL,
  absoluteUrl,
  resetSiteUrlWarning,
  resolveSiteUrl,
  siteName,
  siteUrl
} from "../src/lib/seo/siteUrl";

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const saved: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) {
    saved[key] = process.env[key];
    if (vars[key] === undefined) delete process.env[key];
    else process.env[key] = vars[key];
  }
  try {
    return fn();
  } finally {
    for (const key of Object.keys(saved)) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

test("resolveSiteUrl keeps only the origin, never a trailing slash", () => {
  assert.deepEqual(resolveSiteUrl("https://bankmiplaci.pl"), { url: "https://bankmiplaci.pl", fromFallback: false });
  assert.equal(resolveSiteUrl("https://bankmiplaci.pl/").url, "https://bankmiplaci.pl");
  assert.equal(resolveSiteUrl("  https://bankmiplaci.pl///  ").url, "https://bankmiplaci.pl");
  assert.equal(resolveSiteUrl("https://bankmiplaci.pl/app?x=1#y").url, "https://bankmiplaci.pl");
  assert.equal(resolveSiteUrl("http://localhost:3000/").url, "http://localhost:3000");
});

test("resolveSiteUrl falls back for empty, missing and non-http values", () => {
  for (const raw of [undefined, null, "", "   ", "bankmiplaci.pl", "not a url", "ftp://x.pl", "javascript:alert(1)"]) {
    assert.deepEqual(resolveSiteUrl(raw), { url: FALLBACK_SITE_URL, fromFallback: true }, String(raw));
  }
});

test("siteUrl warns exactly once when it has to fall back", () => {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => void warnings.push(args.join(" "));
  try {
    resetSiteUrlWarning();
    withEnv({ NEXT_PUBLIC_SITE_URL: undefined }, () => {
      assert.equal(siteUrl(), FALLBACK_SITE_URL);
      assert.equal(siteUrl(), FALLBACK_SITE_URL);
      assert.equal(absoluteUrl("/x"), `${FALLBACK_SITE_URL}/x`);
    });
    assert.equal(warnings.length, 1);
    assert.match(warnings[0] ?? "", /NEXT_PUBLIC_SITE_URL/);

    // A configured value never warns.
    resetSiteUrlWarning();
    warnings.length = 0;
    withEnv({ NEXT_PUBLIC_SITE_URL: "https://bankmiplaci.pl/" }, () => {
      assert.equal(siteUrl(), "https://bankmiplaci.pl");
    });
    assert.equal(warnings.length, 0);
  } finally {
    console.warn = original;
    resetSiteUrlWarning();
  }
});

test("absoluteUrl builds absolute urls from any path spelling", () => {
  withEnv({ NEXT_PUBLIC_SITE_URL: "https://bankmiplaci.pl/" }, () => {
    assert.equal(absoluteUrl("/"), "https://bankmiplaci.pl/");
    assert.equal(absoluteUrl(""), "https://bankmiplaci.pl/");
    assert.equal(absoluteUrl(), "https://bankmiplaci.pl/");
    assert.equal(absoluteUrl("/promocje"), "https://bankmiplaci.pl/promocje");
    assert.equal(absoluteUrl("promocje"), "https://bankmiplaci.pl/promocje");
    assert.equal(absoluteUrl("/promocje?sort=top-rated#x"), "https://bankmiplaci.pl/promocje?sort=top-rated#x");
    // Already absolute: untouched (bank logos, bank websites).
    assert.equal(absoluteUrl("https://cdn.example.com/a.png"), "https://cdn.example.com/a.png");
  });
});

test("siteName defaults to Bankmiplaci and can be overridden", () => {
  withEnv({ NEXT_PUBLIC_SITE_NAME: undefined }, () => assert.equal(siteName(), "Bankmiplaci"));
  withEnv({ NEXT_PUBLIC_SITE_NAME: "  Inna Nazwa " }, () => assert.equal(siteName(), "Inna Nazwa"));
  withEnv({ NEXT_PUBLIC_SITE_NAME: "   " }, () => assert.equal(siteName(), "Bankmiplaci"));
});
