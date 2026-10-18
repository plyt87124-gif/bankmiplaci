// Wiring of the SEO landing pages: the route flags and the sitemap, the <head> metadata (canonical, robots,
// title/description limits), the route structure (no loading boundary above a route that calls notFound(),
// the static segment next to [slug]), the links on the pages, and a source-hygiene scan.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BANK_INDEX_FAQ, BANK_INDEX_RELATED } from "../src/components/seo-pages/bankIndexContent";
import { BankIndexPage } from "../src/components/seo-pages/BankIndexPage";
import { BankPage } from "../src/components/seo-pages/BankPage";
import { EndingSoonPage } from "../src/components/seo-pages/EndingSoonPage";
import { ENDING_SOON_FAQ, ENDING_SOON_RELATED } from "../src/components/seo-pages/endingSoon";
import { HubPage } from "../src/components/seo-pages/HubPage";
import { HUB_FAQ, hubRelatedLinks } from "../src/components/seo-pages/hubs";
import {
  bankIndexDescription,
  bankIndexMetadata,
  bankMetadata,
  bankNotFoundMetadata,
  endingSoonMetadata,
  hubMetadata
} from "../src/components/seo-pages/pageMetadata";
import { DESCRIPTION_MAX } from "../src/lib/seo/metadata";
import { DYNAMIC_ROUTE_FLAGS, SITE_ROUTES, isRouteLive, liveRoutes } from "../src/lib/seo/routes";
import { buildSitemapEntries, type SitemapInput, type SitemapPromotionRow } from "../src/lib/seo/sitemapEntries";

// The expected titles end with the site name; CI sets NEXT_PUBLIC_SITE_NAME="Bankmiplaci CI".
process.env.NEXT_PUBLIC_SITE_NAME = "Bankmiplaci";

(globalThis as { React?: unknown }).React = React;
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.NEXT_PUBLIC_SITE_URL = "https://bankmiplaci.example";
const SITE = "https://bankmiplaci.example";

const h = React.createElement;
const ROOT = process.cwd();
const APP = path.join(ROOT, "src", "app");
const NOW = new Date("2026-10-10T09:00:00Z");
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** True when `segs` resolve to a page.* file; route groups such as "(lista)" do not count as URL segments. */
function hasPage(dir: string, segs: string[]): boolean {
  if (segs.length === 0 && ["page.tsx", "page.ts"].some((f) => fs.existsSync(path.join(dir, f)))) return true;
  if (!fs.existsSync(dir)) return false;
  if (segs.length > 0 && hasPage(path.join(dir, segs[0]!), segs.slice(1))) return true;
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .some((e) => e.isDirectory() && /^\(.+\)$/.test(e.name) && hasPage(path.join(dir, e.name), segs));
}
const pageExists = (route: string) => hasPage(APP, route.split("/").filter(Boolean));

/** Source without comments, so a doc comment may mention what the code must NOT do. */
const code = (file: string) => fs.readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/* ------------------------------------------------------------------ */
/* Flags and the sitemap                                               */
/* ------------------------------------------------------------------ */

const PHASE_1 = ["/konta-osobiste-z-premia", "/konta-firmowe-z-premia", "/banki", "/promocje/konczace-sie"];
const PHASE_2 = ["/promocje/archiwum", "/najlatwiejsze-promocje-bankowe", "/promocje-bez-oplat", "/promocje-dla-nowych-klientow"];

test("flags: the four phase-1 pages and the bank pages are live, and each has its page.tsx", () => {
  for (const route of PHASE_1) {
    assert.equal(isRouteLive(route), true, route);
    assert.ok(pageExists(route), `${route} has src/app${route}/page.tsx`);
  }
  assert.equal(DYNAMIC_ROUTE_FLAGS.bankPages, true);
  assert.ok(pageExists("/banki/[slug]"));
  assert.ok(isRouteLive("/banki"), "bank pages need the /banki index");
});

test("flags: phase 2 (archive, easiest, no fees, new clients) is not part of this package and stays off", () => {
  for (const route of PHASE_2) assert.equal(isRouteLive(route), false, route);
  for (const route of PHASE_2) assert.ok(!pageExists(route), `${route} has no page yet`);
});

test("sitemap: the four pages and every bank page are listed, once, with a real lastmod where there is one", () => {
  const promo = (slug: string, over: Partial<SitemapPromotionRow> = {}): SitemapPromotionRow => ({
    slug,
    status: "ACTIVE",
    endDate: day("2026-12-31"),
    accountType: "PERSONAL",
    contentUpdatedAt: null,
    lastVerifiedAt: new Date("2026-10-02T09:00:00Z"),
    ...over
  });
  const input: SitemapInput = {
    promotions: [
      promo("p1", { lastVerifiedAt: new Date("2026-10-02T09:00:00Z") }),
      promo("p2", { accountType: "YOUNG", lastVerifiedAt: new Date("2026-10-05T09:00:00Z") }),
      promo("b1", { accountType: "BUSINESS", lastVerifiedAt: new Date("2026-10-08T09:00:00Z") })
    ],
    articles: [],
    banks: [
      { slug: "alior", lastModified: new Date("2026-10-08T09:00:00Z") },
      { slug: "nest", lastModified: null }
    ]
  };
  const entries = buildSitemapEntries(input, NOW);
  const urls = entries.map((e) => e.url);
  assert.equal(new Set(urls).size, urls.length, "no duplicates");
  const find = (p: string) => entries.find((e) => e.url === `${SITE}${p}`);

  for (const route of PHASE_1) assert.ok(find(route), `${route} is in the sitemap`);
  assert.ok(find("/banki/alior") && find("/banki/nest"));
  assert.equal(find("/banki/alior")!.lastModified?.toISOString(), "2026-10-08T09:00:00.000Z");
  assert.equal(find("/banki/nest")!.lastModified, undefined, "no invented date");
  // the personal hub's lastmod follows every non-business offer (the hub lists PERSONAL, SAVINGS, YOUNG, JOINT)
  assert.equal(find("/konta-osobiste-z-premia")!.lastModified?.toISOString(), "2026-10-05T09:00:00.000Z");
  assert.equal(find("/konta-firmowe-z-premia")!.lastModified?.toISOString(), "2026-10-08T09:00:00.000Z");
  // a page whose content changes daily, without an honest date, carries none
  assert.equal(find("/promocje/konczace-sie")!.lastModified, undefined);
  for (const e of entries) assert.deepEqual(Object.keys(e).filter((k) => k !== "url" && k !== "lastModified"), []);
});

test("sitemap: phase-2 pages are still not listed", () => {
  const urls = buildSitemapEntries({ promotions: [], articles: [], banks: [] }, NOW).map((e) => e.url);
  for (const route of PHASE_2) assert.ok(!urls.includes(`${SITE}${route}`), route);
  assert.equal(liveRoutes().length, SITE_ROUTES.filter((r) => r.live).length);
});

/* ------------------------------------------------------------------ */
/* Route structure                                                     */
/* ------------------------------------------------------------------ */

test("route structure: no loading.tsx above /banki/[slug] (it calls notFound()) or above /promocje/[slug]", () => {
  for (const route of ["banki/[slug]", "promocje/[slug]"]) {
    const segments = route.split("/");
    for (let i = 0; i <= segments.length; i++) {
      const dir = path.join(APP, ...segments.slice(0, i));
      assert.ok(!fs.existsSync(path.join(dir, "loading.tsx")), `${path.relative(APP, dir) || "app"}/loading.tsx would soften the 404 of /${route}`);
    }
  }
  assert.ok(!fs.existsSync(path.join(APP, "promocje", "loading.tsx")), "adding konczace-sie must not bring a loading file back over [slug]");
  assert.ok(!fs.existsSync(path.join(APP, "banki", "loading.tsx")));
});

test("route structure: /promocje/konczace-sie is a static segment next to [slug], never swallowed by it", () => {
  const dir = path.join(APP, "promocje");
  const entries = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  assert.ok(entries.includes("konczace-sie") && entries.includes("[slug]"));
  assert.ok(fs.existsSync(path.join(dir, "konczace-sie", "page.tsx")));
  assert.ok(!fs.existsSync(path.join(dir, "konczace-sie", "[slug]")), "no nested dynamic segment");
  assert.ok(!fs.existsSync(path.join(dir, "page.tsx")), "/promocje stays in its (lista) group");
});

test("route structure: the bank page answers 404 through notFound() for an unknown bank, and nothing else does", () => {
  const src = code(path.join(APP, "banki", "[slug]", "page.tsx"));
  assert.match(src, /import \{ notFound \} from "next\/navigation"/);
  assert.match(src, /if \(!data\) notFound\(\)/);
  for (const file of ["banki/page.tsx", "konta-osobiste-z-premia/page.tsx", "konta-firmowe-z-premia/page.tsx", "promocje/konczace-sie/page.tsx"]) {
    assert.doesNotMatch(code(path.join(APP, ...file.split("/"))), /notFound/, `${file} is never a 404`);
  }
});

/* ------------------------------------------------------------------ */
/* Metadata                                                            */
/* ------------------------------------------------------------------ */

type Meta = ReturnType<typeof hubMetadata>;
const canonicalOf = (m: Meta) => (m.alternates as { canonical?: string } | undefined)?.canonical;
const absoluteTitle = (m: Meta) => (m.title as { absolute: string }).absolute;

test("metadata: hubs - SEO library title/description, canonical on the clean path, indexable", () => {
  const personal = hubMetadata("personal", 12, {}, NOW);
  assert.equal(absoluteTitle(personal), "Konta osobiste z premią 2026 – aktualne promocje | Bankmiplaci");
  assert.equal(canonicalOf(personal), `${SITE}/konta-osobiste-z-premia`);
  assert.equal(personal.robots, undefined, "default index,follow");
  assert.match(String(personal.description), /Zestawienie 12 aktualnych promocji na konta osobiste z premią/);
  assert.equal((personal.openGraph as { url?: string }).url, `${SITE}/konta-osobiste-z-premia`);

  const business = hubMetadata("business", 1, undefined, NOW);
  assert.equal(absoluteTitle(business), "Konta firmowe z premią 2026 – promocje dla firm i JDG | Bankmiplaci");
  assert.equal(canonicalOf(business), `${SITE}/konta-firmowe-z-premia`);
  assert.match(String(business.description), /Porównanie 1 aktualnej promocji na konta firmowe/);
  assert.match(String(hubMetadata("business", 0, {}, NOW).description), /Porównanie aktualnych promocji/, "no '0 promocji'");
});

test("metadata: filter/sort/paging parameters make a page noindex,follow with the same clean canonical; tracking ones do not", () => {
  for (const params of [{ sort: "top-rated" }, { q: "alior" }, { bank: "pko" }, { strona: "2" }, { accountType: "BUSINESS" }]) {
    const hub = hubMetadata("personal", 5, params, NOW);
    assert.deepEqual(hub.robots, { index: false, follow: true }, JSON.stringify(params));
    assert.equal(canonicalOf(hub), `${SITE}/konta-osobiste-z-premia`);
    assert.deepEqual(endingSoonMetadata(params, NOW).robots, { index: false, follow: true });
    assert.deepEqual(bankIndexMetadata(3, params).robots, { index: false, follow: true });
    assert.deepEqual(bankMetadata({ name: "Alior Bank", slug: "alior" }, 2, true, params, NOW).robots, { index: false, follow: true });
  }
  for (const params of [{ utm_source: "newsletter" }, { gclid: "abc" }, { strona: "1" }, {}]) {
    assert.equal(hubMetadata("personal", 5, params, NOW).robots, undefined, JSON.stringify(params));
  }
});

test("metadata: a bank page - title and description of the library, noindex exactly when the sitemap would not list it", () => {
  const live = bankMetadata({ name: "Alior Bank", slug: "alior" }, 3, true, {}, NOW);
  assert.equal(absoluteTitle(live), "Alior Bank – promocje i konta z premią 2026 | Bankmiplaci");
  assert.equal(canonicalOf(live), `${SITE}/banki/alior`);
  assert.equal(live.robots, undefined);
  assert.match(String(live.description), /^3 aktualne promocje Alior Bank:/);

  const ended = bankMetadata({ name: "Alior Bank", slug: "alior" }, 0, true, {}, NOW);
  assert.equal(ended.robots, undefined, "a bank whose offers ended stays indexable");
  assert.match(String(ended.description), /^Promocje Alior Bank – /, "no claim about 'current' offers");

  const retired = bankMetadata({ name: "Alior Bank", slug: "alior" }, 0, false, {}, NOW);
  assert.deepEqual(retired.robots, { index: false, follow: true });
  assert.equal(canonicalOf(retired), `${SITE}/banki/alior`);
});

test("metadata: a missing bank leaks nothing and is never indexed", () => {
  const meta = bankNotFoundMetadata();
  assert.deepEqual(meta.robots, { index: false, follow: true });
  assert.equal(meta.title, "Nie znaleziono banku");
  assert.equal(meta.alternates, undefined);
});

test("metadata: /banki and /promocje/konczace-sie", () => {
  const index = bankIndexMetadata(12, {});
  assert.equal(index.title, "Banki z promocjami – lista banków i ich ofert");
  assert.equal(canonicalOf(index), `${SITE}/banki`);
  assert.equal(index.robots, undefined);
  assert.match(String(index.description), /^12 banków z promocjami/);
  assert.match(bankIndexDescription(0), /^Banki z promocjami, które analizujemy/);
  assert.match(bankIndexDescription(2), /^2 banki z promocjami/);

  const ending = endingSoonMetadata({}, NOW);
  assert.equal(absoluteTitle(ending), "Promocje bankowe kończące się wkrótce – październik 2026 | Bankmiplaci");
  assert.equal(canonicalOf(ending), `${SITE}/promocje/konczace-sie`);
  assert.equal(ending.robots, undefined, "indexable also when the list is empty (the sitemap lists it)");
  assert.match(String(ending.description), /Bank może zakończyć promocję wcześniej/);
});

test("metadata: every description fits the 160-character limit and every title is distinct", () => {
  const all = [
    hubMetadata("personal", 123, {}, NOW),
    hubMetadata("business", 123, {}, NOW),
    bankIndexMetadata(123, {}),
    bankMetadata({ name: "Credit Agricole Bank Polska", slug: "creditagricole" }, 23, true, {}, NOW),
    bankMetadata({ name: "Credit Agricole Bank Polska", slug: "creditagricole" }, 0, true, {}, NOW),
    endingSoonMetadata({}, NOW)
  ];
  for (const meta of all) {
    assert.ok(String(meta.description).length <= DESCRIPTION_MAX, `${String(meta.description).length}: ${meta.description}`);
  }
  const titles = all.slice(0, 3).concat(all[5]!).map((m) => (typeof m.title === "string" ? m.title : (m.title as { absolute: string }).absolute));
  assert.equal(new Set(titles).size, titles.length);
});

/* ------------------------------------------------------------------ */
/* Links                                                               */
/* ------------------------------------------------------------------ */

test("links: every internal link of the editorial, FAQ and 'Zobacz także' blocks leads to an existing page", () => {
  const hrefs = new Set<string>();
  const add = (href: string) => hrefs.add(href);
  for (const kind of ["personal", "business"] as const) {
    hubRelatedLinks(kind).forEach((l) => add(l.href));
    HUB_FAQ[kind].forEach((f) => f.link && add(f.link.href));
  }
  BANK_INDEX_RELATED.forEach((l) => add(l.href));
  BANK_INDEX_FAQ.forEach((f) => f.link && add(f.link.href));
  ENDING_SOON_RELATED.forEach((l) => add(l.href));
  ENDING_SOON_FAQ.forEach((f) => f.link && add(f.link.href));

  for (const href of hrefs) {
    const [pathAndQuery, fragment] = href.split("#");
    const route = pathAndQuery!.split("?")[0]!;
    assert.ok(pageExists(route), `${href}: no such page`);
    void fragment;
  }
  // and every route they point at is either live in the registry or a page that exists today
  for (const href of hrefs) {
    const route = href.split("#")[0]!.split("?")[0]!;
    if (SITE_ROUTES.some((r) => r.path === route)) assert.ok(isRouteLive(route), `${route} is linked but not live`);
  }
});

test("links: the rendered pages only link to existing pages or to offers/banks by slug", () => {
  const card = {
    slug: "oferta-1",
    name: "Oferta",
    summary: null,
    maxBonusCents: 10000,
    difficulty: "EASY" as const,
    accountType: "PERSONAL" as const,
    rating: 8,
    ratingReason: null,
    endDate: day("2026-10-20"),
    lastVerifiedAt: new Date("2026-10-06T10:00:00Z"),
    fees: null,
    conditions: [],
    bank: { name: "Bank", slug: "bank", logoUrl: null }
  };
  const bank = { slug: "bank", name: "Bank", logoUrl: null, description: null };
  const pages = [
    renderToStaticMarkup(h(HubPage, { kind: "personal", cards: [card] })),
    renderToStaticMarkup(h(HubPage, { kind: "business", cards: [] })),
    renderToStaticMarkup(h(BankIndexPage, { banks: [{ slug: "bank", name: "Bank", logoUrl: null, activeCount: 1 }] })),
    renderToStaticMarkup(h(BankPage, { bank, cards: [card], offers: [{ slug: "stara", name: "Stara", status: "EXPIRED", accountType: "BUSINESS", endDate: day("2026-09-20") }], now: NOW })),
    renderToStaticMarkup(h(EndingSoonPage, { cards: [card], now: NOW })),
    renderToStaticMarkup(h(EndingSoonPage, { cards: [], now: NOW }))
  ];
  for (const html of pages) {
    for (const m of html.matchAll(/href="(\/[^"]*)"/g)) {
      const href = m[1]!.replace(/&amp;/g, "&");
      const route = href.split("#")[0]!.split("?")[0]!;
      const dynamic = /^\/promocje\/[a-z0-9-]+$/.test(route) && route !== "/promocje/konczace-sie";
      const bankPage = /^\/banki\/[a-z0-9-]+$/.test(route);
      assert.ok(route === "/" || dynamic || bankPage || pageExists(route), `${href}: no such page`);
    }
    assert.doesNotMatch(html, /href="https?:/, "no outbound link at all on these pages");
    assert.doesNotMatch(html, /\/out\//);
  }
});

/* ------------------------------------------------------------------ */
/* Source hygiene                                                      */
/* ------------------------------------------------------------------ */

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(e.name)) out.push(full);
    }
  };
  for (const rel of [
    "src/components/seo-pages",
    "src/app/konta-osobiste-z-premia",
    "src/app/konta-firmowe-z-premia",
    "src/app/banki",
    "src/app/promocje/konczace-sie"
  ]) {
    walk(path.join(ROOT, ...rel.split("/")));
  }
  return out;
}

test("source: the pages use the shared pieces - no site URL from the environment, no raw JSON-LD, no private fields", () => {
  const files = sourceFiles();
  assert.ok(files.length >= 15, `${files.length} files scanned`);
  for (const file of files) {
    const src = code(file);
    const name = path.relative(ROOT, file);
    assert.doesNotMatch(src, /process\.env\.NEXT_PUBLIC_SITE_URL/, `${name}: site URL only from src/lib/seo`);
    assert.doesNotMatch(src, /dangerouslySetInnerHTML/, `${name}: JSON-LD only through <JsonLd>`);
    assert.doesNotMatch(src, /affiliateUrl|affiliateCommission|affiliateLinkEnabled/, `${name}: nothing private`);
    assert.doesNotMatch(src, /export const (revalidate|dynamic)\b|generateStaticParams/, `${name}: dynamic page, no ISR export`);
    assert.doesNotMatch(src, /target="_blank"/, name);
    assert.doesNotMatch(src, /text-ink-300|border-ink-100|bg-ink-solid|animate-ping|break-all|text-\[1[01]px\]|h-13\b/, `${name}: forbidden pattern of the design spec`);
    assert.doesNotMatch(src, /toFixed\(/, `${name}: ratings go through formatRating`);
    assert.doesNotMatch(src, /<Reveal|<CountUp/, `${name}: no entrance motion on list pages`);
  }
});

test("source: pages read data only through the services layer (explicit columns), never a full Promotion row", () => {
  for (const file of sourceFiles()) {
    const src = code(file);
    assert.doesNotMatch(src, /listActivePromotions|getPromotionBySlug|stripPrivateFields/, `${path.relative(ROOT, file)}: use the slim cards`);
    assert.doesNotMatch(src, /db\.promotion\.(findMany|findFirst|findUnique)\([^)]*include:/s, `${path.relative(ROOT, file)}: no include (it would select every column)`);
  }
});
