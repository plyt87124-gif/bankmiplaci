import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ARTICLE_PARTNER_REL, ArticleBody } from "../src/components/blog/ArticleBody";
import { ArticleCard } from "../src/components/blog/ArticleCard";
import { CategoryNav } from "../src/components/blog/CategoryNav";
import { Pagination } from "../src/components/blog/Pagination";
import {
  ARTICLE_CATEGORIES,
  CATEGORY_INFO,
  categoryFromSlug,
  categoryHref
} from "../src/components/blog/categories";
import { classifyHref, containsPartnerLinks, extractMarkdownHrefs } from "../src/components/blog/links";
import { BLOG_MAX_PAGE, BLOG_PAGE_SIZE, pageHref, parsePage, totalPagesFor } from "../src/components/blog/paging";

(globalThis as { React?: typeof React }).React = React;

const h = React.createElement;
const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const SITE = "bankmiplaci.pl";

// ---------------------------------------------------------------------------
// links.ts
// ---------------------------------------------------------------------------

test("classifyHref: internal links are relative paths, same-host absolute URLs are reduced to a path", () => {
  assert.deepEqual(classifyHref("/promocje", SITE), { kind: "internal", href: "/promocje" });
  assert.deepEqual(classifyHref("/blog/x?a=1#b", SITE), { kind: "internal", href: "/blog/x?a=1#b" });
  assert.deepEqual(classifyHref("https://bankmiplaci.pl/porownaj?x=1", SITE), { kind: "internal", href: "/porownaj?x=1" });
  assert.deepEqual(classifyHref("#sekcja", SITE), { kind: "anchor", href: "#sekcja" });
});

test("classifyHref: /out/ and the affiliate network host are partner links", () => {
  assert.equal(classifyHref("/out/alior-bank", SITE)?.kind, "partner");
  assert.equal(classifyHref("https://bankmiplaci.pl/out/alior-bank", SITE)?.kind, "partner");
  assert.equal(classifyHref("https://ebrokerpartner.pl/abc", SITE)?.kind, "partner");
  assert.equal(classifyHref("https://www.ebrokerpartner.pl/abc?x=1", SITE)?.kind, "partner");
  assert.equal(classifyHref("//ebrokerpartner.pl/abc", SITE)?.kind, "partner");
  // a look-alike host is not the network
  assert.equal(classifyHref("https://notebrokerpartner.pl/abc", SITE)?.kind, "external");
  assert.equal(classifyHref("https://ebrokerpartner.pl.evil.example/", SITE)?.kind, "external");
});

test("classifyHref: other sites are external; unsafe or empty targets are rejected", () => {
  assert.equal(classifyHref("https://www.bfg.pl/", SITE)?.kind, "external");
  assert.equal(classifyHref("mailto:a@b.pl", SITE)?.kind, "other");
  assert.equal(classifyHref("javascript:alert(1)", SITE), null);
  assert.equal(classifyHref("JaVaScRiPt:alert(1)", SITE), null);
  assert.equal(classifyHref("data:text/html,x", SITE), null);
  assert.equal(classifyHref("tel:123", SITE), null);
  assert.equal(classifyHref("", SITE), null);
  assert.equal(classifyHref(undefined, SITE), null);
});

test("classifyHref: a backslash cannot smuggle an open redirect into an 'internal' link", () => {
  const link = classifyHref("/\\evil.example/path", SITE);
  assert.equal(link?.kind, "external");
  assert.ok(link?.href.startsWith("https://evil.example"));
});

test("containsPartnerLinks finds markdown links, reference links and bare URLs", () => {
  assert.equal(containsPartnerLinks("Tekst [oferta](/out/alior) koniec", SITE), true);
  assert.equal(containsPartnerLinks("Tekst [oferta](https://www.ebrokerpartner.pl/x) koniec", SITE), true);
  assert.equal(containsPartnerLinks("[a][1]\n\n[1]: https://ebrokerpartner.pl/x", SITE), true);
  assert.equal(containsPartnerLinks("Zobacz https://ebrokerpartner.pl/x.", SITE), true);
  assert.equal(containsPartnerLinks("Zobacz www.ebrokerpartner.pl/x", SITE), true);
  assert.equal(containsPartnerLinks("Zwykły [link](/promocje) i [BFG](https://www.bfg.pl/)", SITE), false);
  assert.equal(containsPartnerLinks("", SITE), false);
  assert.equal(containsPartnerLinks(null, SITE), false);
  assert.ok(extractMarkdownHrefs("[a](/x) i [b](<https://y.pl/z>)").length >= 2);
});

// ---------------------------------------------------------------------------
// paging.ts
// ---------------------------------------------------------------------------

test("parsePage defaults to 1 and clamps junk", () => {
  assert.equal(parsePage(undefined), 1);
  assert.equal(parsePage(""), 1);
  assert.equal(parsePage("abc"), 1);
  assert.equal(parsePage("0"), 1);
  assert.equal(parsePage("-3"), 1);
  assert.equal(parsePage("2"), 2);
  assert.equal(parsePage(["3", "4"]), 3);
  assert.equal(parsePage("99999999"), BLOG_MAX_PAGE);
});

test("totalPagesFor / pageHref: 20 per page, page 1 is the clean path", () => {
  assert.equal(BLOG_PAGE_SIZE, 20);
  assert.equal(totalPagesFor(0), 1);
  assert.equal(totalPagesFor(20), 1);
  assert.equal(totalPagesFor(21), 2);
  assert.equal(pageHref("/blog", 1), "/blog");
  assert.equal(pageHref("/blog", 3), "/blog?strona=3");
});

// ---------------------------------------------------------------------------
// categories.ts
// ---------------------------------------------------------------------------

test("every category has a unique slug, a description within the meta limit and round-trips", () => {
  const slugs = new Set<string>();
  for (const key of ARTICLE_CATEGORIES) {
    const info = CATEGORY_INFO[key];
    assert.equal(info.key, key);
    assert.ok(!slugs.has(info.slug), `duplicate slug ${info.slug}`);
    slugs.add(info.slug);
    assert.ok(info.description.length > 0 && info.description.length <= 160, `${key}: ${info.description.length}`);
    assert.equal(categoryFromSlug(info.slug), info);
    assert.equal(categoryHref(key), `/blog/kategoria/${info.slug}`);
  }
  assert.equal(categoryFromSlug("nie-ma-takiej"), null);
  assert.equal(categoryFromSlug(null), null);
  // a prototype key must not resolve
  assert.equal(categoryFromSlug("constructor"), null);
});

// ---------------------------------------------------------------------------
// ArticleBody
// ---------------------------------------------------------------------------

const BODY = [
  "# Nagłówek z markdowna",
  "",
  "Akapit z [wewnętrznym](/promocje), [ofertą](/out/alior-bank), [partnerem](https://www.ebrokerpartner.pl/abc?x=1), [BFG](https://www.bfg.pl/) i [zły](javascript:alert(1)).",
  "",
  "## Sekcja",
  "",
  "| A | B |",
  "|---|---|",
  "| 1 | 2 |",
  "",
  "- punkt",
  "",
  "<script>alert(1)</script>"
].join("\n");

const anchors = (markup: string) => [...markup.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]);
const anchorFor = (markup: string, href: string) => anchors(markup).find((a) => a.includes(`href="${href}"`));

test("ArticleBody: internal links carry no target and no rel", () => {
  const a = anchorFor(html(h(ArticleBody, { markdown: BODY })), "/promocje");
  assert.ok(a);
  assert.ok(!/target=/.test(a));
  assert.ok(!/rel=/.test(a));
  assert.match(a, /underline|link-inline/);
});

test("ArticleBody: partner links are sponsored nofollow noopener in a new tab", () => {
  const out = html(h(ArticleBody, { markdown: BODY }));
  for (const href of ["/out/alior-bank", "https://www.ebrokerpartner.pl/abc?x=1"]) {
    const a = anchorFor(out, href.replace(/&/g, "&amp;"));
    assert.ok(a, href);
    assert.ok(a.includes(`rel="${ARTICLE_PARTNER_REL}"`), a);
    assert.ok(a.includes('target="_blank"'), a);
  }
});

test("ArticleBody: other external links are noopener noreferrer in a new tab", () => {
  const a = anchorFor(html(h(ArticleBody, { markdown: BODY })), "https://www.bfg.pl/");
  assert.ok(a);
  assert.ok(a.includes('rel="noopener noreferrer"'));
  assert.ok(a.includes('target="_blank"'));
});

test("ArticleBody: unsafe URLs and raw HTML are not rendered as live markup", () => {
  const out = html(h(ArticleBody, { markdown: BODY }));
  assert.ok(!/javascript:/i.test(out));
  assert.ok(!/<script/i.test(out));
  assert.ok(out.includes("zły"), "the link text stays");
});

test("ArticleBody: markdown # becomes h2 (the page owns the h1); tables sit in a scroll region", () => {
  const out = html(h(ArticleBody, { markdown: BODY }));
  assert.ok(!/<h1\b/.test(out));
  assert.match(out, /<h2[^>]*>Nagłówek z markdowna<\/h2>/);
  assert.match(out, /<h2[^>]*>Sekcja<\/h2>/);
  assert.match(out, /role="region"[^>]*tabindex="0"|tabindex="0"[^>]*role="region"/);
  assert.match(out, /<th[^>]*scope="col"/);
});

test("ArticleBody: reading typography class, no legacy article-body-sm", () => {
  const out = html(h(ArticleBody, { markdown: "Tekst." }));
  assert.match(out, /type-article/);
  assert.ok(!out.includes("article-body-sm"));
});

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

test("ArticleCard: one link to the article, category and date shown, no body needed", () => {
  const out = html(
    h(ArticleCard, {
      article: {
        slug: "jak-zalozyc-konto",
        title: "Jak założyć konto",
        excerpt: "Krótki opis.",
        category: "KONTA_BANKOWE",
        publishedAt: new Date("2026-09-01T10:00:00Z")
      }
    })
  );
  assert.equal(anchors(out).length, 1);
  assert.ok(out.includes('href="/blog/jak-zalozyc-konto"'));
  assert.ok(out.includes("Konta bankowe"));
  assert.match(out, /<time dateTime="2026-09-01T10:00:00.000Z"|<time datetime="2026-09-01T10:00:00.000Z"/);
  assert.match(out, /<h2/);
});

test("CategoryNav: advertises only categories with articles, marks the current page", () => {
  const out = html(h(CategoryNav, { counts: { KONTA_BANKOWE: 2, CASHBACK: 0 }, current: "KONTA_BANKOWE" }));
  assert.ok(out.includes('href="/blog"'));
  assert.ok(out.includes('href="/blog/kategoria/konta-bankowe"'));
  assert.ok(!out.includes("/blog/kategoria/cashback"));
  assert.equal((out.match(/aria-current="page"/g) ?? []).length, 1);
});

test("CategoryNav: an empty current category is still shown (its page exists)", () => {
  const out = html(h(CategoryNav, { counts: {}, current: "CASHBACK" }));
  assert.ok(out.includes("/blog/kategoria/cashback"));
});

test("Pagination: nothing for one page; prev/next hrefs use ?strona=", () => {
  assert.equal(html(h(Pagination, { basePath: "/blog", page: 1, totalPages: 1 })), "");
  const middle = html(h(Pagination, { basePath: "/blog", page: 2, totalPages: 3 }));
  assert.ok(middle.includes('href="/blog"'), "page 1 is the clean path");
  assert.ok(middle.includes('href="/blog?strona=3"'));
  assert.ok(middle.includes("Strona 2 z 3"));
  const first = html(h(Pagination, { basePath: "/blog/kategoria/cashback", page: 1, totalPages: 2 }));
  assert.ok(!first.includes("Poprzednia"));
  assert.ok(first.includes('href="/blog/kategoria/cashback?strona=2"'));
});
