import test from "node:test";
import assert from "node:assert/strict";
import {
  articleLastModified,
  buildSitemapEntries,
  promotionLastModified,
  type SitemapArticleRow,
  type SitemapEntry,
  type SitemapInput,
  type SitemapPromotionRow
} from "../src/lib/seo/sitemapEntries";
import { robotsForStatus } from "../src/lib/promotionAvailability";

process.env.NEXT_PUBLIC_SITE_URL = "https://bankmiplaci.example";
const SITE = "https://bankmiplaci.example";
const NOW = new Date("2026-10-09T10:00:00Z");
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

function promo(slug: string, over: Partial<SitemapPromotionRow> = {}): SitemapPromotionRow {
  return {
    slug,
    status: "ACTIVE",
    endDate: day("2026-12-31"),
    accountType: "PERSONAL",
    contentUpdatedAt: null,
    lastVerifiedAt: new Date("2026-10-01T09:00:00Z"),
    ...over
  };
}

function article(slug: string, over: Partial<SitemapArticleRow> = {}): SitemapArticleRow {
  return {
    slug,
    contentUpdatedAt: null,
    publishedAt: new Date("2026-09-01T09:00:00Z"),
    updatedAt: new Date("2026-10-05T09:00:00Z"),
    ...over
  };
}

const empty: SitemapInput = { promotions: [], articles: [], banks: [] };
const entriesOf = (input: SitemapInput): SitemapEntry[] => buildSitemapEntries(input, NOW);
const urls = (input: SitemapInput) => entriesOf(input).map((e) => e.url);
const find = (input: SitemapInput, path: string) => entriesOf(input).find((e) => e.url === `${SITE}${path}`);
const lastmod = (input: SitemapInput, path: string) => find(input, path)?.lastModified?.toISOString();

test("static pages are listed with absolute urls; no changefreq/priority anywhere", () => {
  const entries = entriesOf(empty);
  assert.ok(entries.length >= 8);
  for (const e of entries) {
    assert.ok(e.url.startsWith(`${SITE}/`), e.url);
    assert.deepEqual(Object.keys(e).filter((k) => k !== "url" && k !== "lastModified"), [], `${e.url} has extra signals`);
  }
  assert.ok(urls(empty).includes(`${SITE}/`));
  assert.ok(urls(empty).includes(`${SITE}/promocje`));
});

test("no duplicate urls", () => {
  const input: SitemapInput = {
    promotions: [promo("a"), promo("b"), promo("c", { status: "EXPIRED", endDate: day("2026-10-01") })],
    articles: [article("x"), article("y")],
    banks: []
  };
  const list = urls(input);
  assert.equal(new Set(list).size, list.length);
});

test("offer lastmod = contentUpdatedAt when set, else lastVerifiedAt", () => {
  const input: SitemapInput = {
    ...empty,
    promotions: [promo("with-content", { contentUpdatedAt: new Date("2026-10-05T12:00:00Z") }), promo("only-verified")]
  };
  assert.equal(lastmod(input, "/promocje/with-content"), "2026-10-05T12:00:00.000Z");
  assert.equal(lastmod(input, "/promocje/only-verified"), "2026-10-01T09:00:00.000Z");
  assert.equal(promotionLastModified(promo("z")).toISOString(), "2026-10-01T09:00:00.000Z");
});

test("/ and /promocje take the newest lastmod among open offers; ended offers do not count", () => {
  const input: SitemapInput = {
    ...empty,
    promotions: [
      promo("old", { lastVerifiedAt: new Date("2026-09-10T00:00:00Z") }),
      promo("new", { lastVerifiedAt: new Date("2026-10-07T00:00:00Z") }),
      promo("ended", { status: "EXPIRED", endDate: day("2026-10-01"), lastVerifiedAt: new Date("2026-10-08T23:00:00Z") })
    ]
  };
  assert.equal(lastmod(input, "/"), "2026-10-07T00:00:00.000Z");
  assert.equal(lastmod(input, "/promocje"), "2026-10-07T00:00:00.000Z");
});

test("/blog lastmod = newest article date (contentUpdatedAt, else publishedAt - not a bare updatedAt)", () => {
  const input: SitemapInput = {
    ...empty,
    articles: [
      article("a", { publishedAt: new Date("2026-09-01T00:00:00Z"), updatedAt: new Date("2026-10-08T00:00:00Z") }),
      article("b", { contentUpdatedAt: new Date("2026-09-20T00:00:00Z") })
    ]
  };
  assert.equal(lastmod(input, "/blog"), "2026-09-20T00:00:00.000Z");
  assert.equal(lastmod(input, "/blog/a"), "2026-09-01T00:00:00.000Z");
  assert.equal(
    articleLastModified({ contentUpdatedAt: null, publishedAt: null, updatedAt: new Date("2026-01-01T00:00:00Z") }).toISOString(),
    "2026-01-01T00:00:00.000Z"
  );
});

test("pages without an honest date get no lastmod (no invented 'now')", () => {
  for (const p of ["/quiz", "/faq", "/jak-zarabiamy", "/jak-to-dziala"]) {
    const entry = find(empty, p);
    assert.ok(entry, p);
    assert.ok(!("lastModified" in entry), `${p} should have no lastmod`);
  }
  assert.equal(find(empty, "/blog"), undefined, "/blog with no articles is a thin (noindex) page: not in the sitemap");
  assert.ok(!("lastModified" in find(empty, "/promocje")!), "no open offers -> no lastmod");
});

test("ended offers: listed for 90 days, after everything else; older, DRAFT and ARCHIVED are not listed", () => {
  const input: SitemapInput = {
    promotions: [
      promo("open"),
      promo("ended-recent", { status: "EXPIRED", endDate: day("2026-10-01") }),
      promo("ended-day-90", { status: "EXPIRED", endDate: day("2026-07-11") }), // 90 days before 09.10
      promo("ended-day-91", { status: "EXPIRED", endDate: day("2026-07-10") }),
      promo("active-but-late", { status: "ACTIVE", endDate: day("2026-09-30") }), // the expire cron has not run yet
      promo("draft", { status: "DRAFT" }),
      promo("archived", { status: "ARCHIVED", endDate: day("2026-10-01") })
    ],
    articles: [article("art")],
    banks: []
  };
  const list = urls(input);
  assert.ok(list.includes(`${SITE}/promocje/open`));
  assert.ok(list.includes(`${SITE}/promocje/ended-recent`));
  assert.ok(list.includes(`${SITE}/promocje/ended-day-90`));
  assert.ok(list.includes(`${SITE}/promocje/active-but-late`));
  assert.ok(!list.includes(`${SITE}/promocje/ended-day-91`));
  assert.ok(!list.includes(`${SITE}/promocje/draft`));
  assert.ok(!list.includes(`${SITE}/promocje/archived`));
  // Order: static pages, open offers, articles, then the ended offers last.
  const idx = (path: string) => list.indexOf(`${SITE}${path}`);
  assert.ok(idx("/promocje/open") < idx("/blog/art"));
  assert.ok(idx("/blog/art") < idx("/promocje/ended-recent"));
  assert.ok(idx("/blog/art") < idx("/promocje/active-but-late"));
});

test("the sitemap lists an offer exactly when its own robots policy says index", () => {
  const rows: SitemapPromotionRow[] = [];
  for (const status of ["ACTIVE", "EXPIRED", "DRAFT", "ARCHIVED"]) {
    for (const end of ["2027-03-01", "2026-10-09", "2026-10-08", "2026-08-01", "2026-06-01", "2025-01-01"]) {
      rows.push(promo(`${status.toLowerCase()}-${end}`, { status, endDate: day(end) }));
    }
  }
  const listed = new Set(urls({ promotions: rows, articles: [], banks: [] }));
  for (const row of rows) {
    assert.equal(listed.has(`${SITE}/promocje/${row.slug}`), robotsForStatus(row.status, row.endDate, NOW).index, row.slug);
  }
});

test("hub pages (live since WP-16) carry the newest change of their own account types; the home page still sees all offers", () => {
  const input: SitemapInput = {
    ...empty,
    promotions: [
      promo("p", { accountType: "PERSONAL", lastVerifiedAt: new Date("2026-10-02T00:00:00Z") }),
      promo("b", { accountType: "BUSINESS", lastVerifiedAt: new Date("2026-10-06T00:00:00Z") })
    ]
  };
  assert.equal(lastmod(input, "/konta-firmowe-z-premia"), "2026-10-06T00:00:00.000Z");
  assert.equal(lastmod(input, "/konta-osobiste-z-premia"), "2026-10-02T00:00:00.000Z");
  assert.equal(lastmod(input, "/"), "2026-10-06T00:00:00.000Z");
});

test("bank pages (live since WP-16) are listed with the bank's newest change as lastmod, after /banki", () => {
  const list = urls({ ...empty, banks: [{ slug: "alior", lastModified: new Date("2026-10-01T00:00:00Z") }] });
  assert.ok(list.includes(`${SITE}/banki`));
  assert.ok(list.includes(`${SITE}/banki/alior`));
  assert.ok(list.indexOf(`${SITE}/banki`) < list.indexOf(`${SITE}/banki/alior`));
  assert.equal(
    lastmod({ ...empty, banks: [{ slug: "alior", lastModified: new Date("2026-10-01T00:00:00Z") }] }, "/banki/alior"),
    "2026-10-01T00:00:00.000Z"
  );
});

test("blog category pages are listed only for categories with a published article (same rule as the page's noindex)", () => {
  const input: SitemapInput = {
    ...empty,
    articles: [
      article("a1", { category: "PORADNIKI", publishedAt: new Date("2026-09-01T00:00:00Z") }),
      article("a2", { category: "PORADNIKI", publishedAt: new Date("2026-09-15T00:00:00Z") }),
      article("a3", { category: "CASHBACK", publishedAt: new Date("2026-08-01T00:00:00Z") }),
      article("a4") // no category known: it contributes no category page
    ]
  };
  const list = urls(input);
  assert.ok(list.includes(`${SITE}/blog/kategoria/poradniki`));
  assert.ok(list.includes(`${SITE}/blog/kategoria/cashback`));
  assert.ok(!list.includes(`${SITE}/blog/kategoria/promocje-bankowe`), "empty category: noindex, so not listed");
  assert.ok(!list.includes(`${SITE}/blog/kategoria/konta-bankowe`));
  assert.ok(!list.includes(`${SITE}/blog/kategoria/finanse-osobiste`));
  assert.equal(new Set(list).size, list.length, "no duplicates");
  // lastmod = newest article date in the category
  assert.equal(lastmod(input, "/blog/kategoria/poradniki"), "2026-09-15T00:00:00.000Z");
  assert.equal(lastmod(input, "/blog/kategoria/cashback"), "2026-08-01T00:00:00.000Z");
  // no category page without articles at all
  assert.ok(!urls(empty).some((u) => u.includes("/blog/kategoria/")));
  // listed after the articles
  const idx = (path: string) => list.indexOf(`${SITE}${path}`);
  assert.ok(idx("/blog/a1") < idx("/blog/kategoria/poradniki"));
});
