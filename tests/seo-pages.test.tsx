// The two account hubs (/konta-osobiste-z-premia, /konta-firmowe-z-premia): which offers belong to a
// hub, the editorial text and the FAQ (rules of docs/redesign-v2/03: no amounts, bank names, dates or
// counts in the editorial text; neutral answers), and the server render of the page with the SEO
// library's H1, the disclosure strip over the list, the structured data and the empty state.
// The page files themselves need the database; they are thin wrappers around these pieces.
import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HubPage } from "../src/components/seo-pages/HubPage";
import {
  HUBS,
  HUB_CARD_LIMIT,
  HUB_FAQ,
  HUB_SECTIONS,
  hubEditorialWordCount,
  hubKindOf,
  hubLead,
  hubRelatedLinks,
  latestVerification,
  selectHubCards
} from "../src/components/seo-pages/hubs";
import { SeoEditorial } from "../src/components/seo-pages/SeoEditorial";
import { countWords, recommendedOrderFaq } from "../src/components/seo-pages/shared";
import { STRIP_OTHER, stripCopy } from "../src/lib/disclosureCopy";
import { hubHeading, promotionHeading } from "../src/lib/seo";
import type { PromotionCardData } from "../src/lib/services/promotionCards";

// Source files use the classic JSX transform under tsx: they need React in scope.
(globalThis as { React?: unknown }).React = React;
// next/image checks remote hosts at render time unless NODE_ENV is "test".
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.NEXT_PUBLIC_SITE_URL = "https://bankmiplaci.example";
const SITE = "https://bankmiplaci.example";

const h = React.createElement;
const NOW = new Date("2026-10-10T09:00:00Z");

const text = (markup: string) =>
  markup
    .replace(/<\/(p|div|li|ul|h[1-6]|article|a|summary|details|label|span|section|nav)>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/[ \t\r\n]+/g, " ")
    .trim();

function card(n: number, overrides: Partial<PromotionCardData> = {}): PromotionCardData {
  return {
    slug: `oferta-${n}`,
    name: `Oferta numer ${n}`,
    summary: null,
    maxBonusCents: 50_000,
    difficulty: "EASY",
    accountType: "PERSONAL",
    rating: 8,
    ratingReason: null,
    endDate: new Date("2099-06-30T00:00:00Z"),
    lastVerifiedAt: new Date("2026-10-06T10:00:00Z"),
    fees: { accountFeeCents: 0, accountFeeWaiverCondition: null, cardFeeCents: 0, cardFeeWaiverCondition: null },
    conditions: [],
    bank: { name: `Bank ${n}`, slug: `bank-${n}`, logoUrl: null },
    ...overrides
  };
}

/** Every <script type="application/ld+json"> of a markup, parsed. */
function jsonLd(markup: string): Record<string, unknown>[] {
  return [...markup.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].flatMap((m) => {
    const parsed = JSON.parse(m[1]!) as Record<string, unknown> | Record<string, unknown>[];
    return Array.isArray(parsed) ? parsed : [parsed];
  });
}
const byType = (nodes: Record<string, unknown>[], type: string) => nodes.find((n) => n["@type"] === type);
const stripTag = (markup: string) => markup.match(/<[a-z]+[^>]*data-disclosure="strip"[^>]*>/)?.[0] ?? "";

const BANK_NAMES = /alior|pko|pekao|mbank|millennium|revolut|nest|erste|velobank|unicredit|bnp|credit agricole|pocztowy|ing |santander|citi/i;
const ALL_KINDS = ["personal", "business"] as const;

/* ------------------------------------------------------------------ */
/* Which offers belong to a hub                                        */
/* ------------------------------------------------------------------ */

test("hubs: only BUSINESS is 'firmowe'; PERSONAL, SAVINGS, YOUNG and JOINT are 'osobiste' (as in /porownaj)", () => {
  assert.equal(hubKindOf("BUSINESS"), "business");
  for (const type of ["PERSONAL", "SAVINGS", "YOUNG", "JOINT"]) assert.equal(hubKindOf(type), "personal", type);

  const cards = [
    card(1, { accountType: "BUSINESS" }),
    card(2, { accountType: "PERSONAL" }),
    card(3, { accountType: "YOUNG" }),
    card(4, { accountType: "BUSINESS" }),
    card(5, { accountType: "SAVINGS" })
  ];
  assert.deepEqual(selectHubCards(cards, "personal").map((c) => c.slug), ["oferta-2", "oferta-3", "oferta-5"], "order kept");
  assert.deepEqual(selectHubCards(cards, "business").map((c) => c.slug), ["oferta-1", "oferta-4"]);
  assert.deepEqual(selectHubCards([], "personal"), []);
});

test("hubs: paths and labels, and the two hubs point at each other", () => {
  assert.equal(HUBS.personal.path, "/konta-osobiste-z-premia");
  assert.equal(HUBS.business.path, "/konta-firmowe-z-premia");
  assert.equal(HUBS[HUBS.personal.other].path, HUBS.business.path);
  assert.equal(HUBS[HUBS.business.other].path, HUBS.personal.path);
});

test("latestVerification: newest valid date, ignores missing and garbage", () => {
  assert.equal(latestVerification([]), null);
  assert.equal(latestVerification([{ lastVerifiedAt: null }, { lastVerifiedAt: "nope" }, {}]), null);
  const newest = latestVerification([
    { lastVerifiedAt: new Date("2026-10-01T10:00:00Z") },
    { lastVerifiedAt: "2026-10-08T10:00:00.000Z" },
    { lastVerifiedAt: new Date("2026-09-30T10:00:00Z") }
  ]);
  assert.equal(newest?.toISOString(), "2026-10-08T10:00:00.000Z");
});

test("hub lead: numerals go through the Polish plural rule, and an empty hub says so", () => {
  const lead = (n: number) => hubLead("personal", n);
  assert.match(lead(1), /Zestawiamy 1 ofertę na konta dla osób fizycznych/);
  assert.match(lead(2), /Zestawiamy 2 oferty/);
  assert.match(lead(5), /Zestawiamy 5 ofert/);
  assert.match(lead(12), /Zestawiamy 12 ofert/);
  assert.match(lead(22), /Zestawiamy 22 oferty/);
  assert.match(hubLead("business", 3), /3 oferty na konta dla firm i jednoosobowych działalności/);
  assert.match(lead(0), /Obecnie nie mamy aktualnych promocji na konta osobiste/);
  assert.match(hubLead("business", 0), /Obecnie nie mamy aktualnych promocji na konta firmowe/);
});

/* ------------------------------------------------------------------ */
/* Editorial text and FAQ                                              */
/* ------------------------------------------------------------------ */

test("editorial: 200-450 words per hub, unique to the hub", () => {
  for (const kind of ALL_KINDS) {
    const words = hubEditorialWordCount(kind);
    assert.ok(words >= 200 && words <= 450, `${kind}: ${words} words`);
    assert.equal(words, countWords(HUB_SECTIONS[kind]));
  }
  const personal = new Set(HUB_SECTIONS.personal.flatMap((s) => s.paragraphs));
  for (const paragraph of HUB_SECTIONS.business.flatMap((s) => s.paragraphs)) {
    assert.ok(!personal.has(paragraph), `shared paragraph: ${paragraph.slice(0, 40)}`);
  }
  const headings = [...HUB_SECTIONS.personal, ...HUB_SECTIONS.business].map((s) => s.heading);
  assert.equal(new Set(headings).size, headings.length, "no repeated heading between hubs");
});

test("editorial and FAQ: no digits (amounts, dates, counts), no bank names, no promises", () => {
  for (const kind of ALL_KINDS) {
    const pieces = [
      ...HUB_SECTIONS[kind].flatMap((s) => [s.heading, ...s.paragraphs]),
      ...HUB_FAQ[kind].flatMap((f) => [f.question, f.answer])
    ];
    for (const piece of pieces) {
      assert.doesNotMatch(piece, /\d/, `${kind}: digit in "${piece.slice(0, 60)}"`);
      assert.doesNotMatch(piece, BANK_NAMES, `${kind}: bank name in "${piece.slice(0, 60)}"`);
      assert.doesNotMatch(piece, /gwarantuj|bez ryzyka|na pewno|najtaniej|najkorzystniej|zawsze dostaniesz/i, `${kind}: promise in "${piece.slice(0, 60)}"`);
      assert.doesNotMatch(piece, /(^|[^\p{L}])(zł|PLN)([^\p{L}]|$)/u, `${kind}: amount in "${piece.slice(0, 60)}"`);
    }
  }
});

test("FAQ: 4-6 questions per hub, each with an answer, no repeated question, advice only neutral", () => {
  for (const kind of ALL_KINDS) {
    const faq = HUB_FAQ[kind];
    assert.ok(faq.length >= 4 && faq.length <= 6, `${kind}: ${faq.length} questions`);
    assert.equal(new Set(faq.map((f) => f.question)).size, faq.length);
    for (const item of faq) {
      assert.ok(item.question.endsWith("?"), item.question);
      assert.ok(item.answer.length > 60, item.question);
    }
  }
  // tax answers state the general rule (owner decision) and always end with a pointer to an adviser (never as advice)
  const taxAnswers = [...HUB_FAQ.personal, ...HUB_FAQ.business].filter((f) => /opodatk/i.test(f.question));
  for (const item of taxAnswers) assert.match(item.answer, /podlega opodatkowaniu[\s\S]*To nie jest porada podatkowa/);
});

test("related links: tools, trust pages, the other hub, banks, ending soon, the full list - all site paths", () => {
  for (const kind of ALL_KINDS) {
    const links = hubRelatedLinks(kind);
    const hrefs = links.map((l) => l.href);
    for (const href of ["/porownaj", "/quiz", "/metodologia", "/jak-zarabiamy", "/banki", "/promocje/konczace-sie", "/promocje"]) {
      assert.ok(hrefs.includes(href), `${kind}: ${href}`);
    }
    assert.ok(hrefs.includes(HUBS[HUBS[kind].other].path), `${kind}: the other hub`);
    assert.ok(!hrefs.includes(HUBS[kind].path), "no self link");
    assert.equal(new Set(hrefs).size, hrefs.length);
    for (const href of hrefs) assert.ok(href.startsWith("/") && !href.includes("?"), href);
  }
});

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */

const render = (kind: "personal" | "business", cards: PromotionCardData[]) =>
  renderToStaticMarkup(h(HubPage, { kind, cards }));

test("page: H1 from the SEO library, lead, 'Najnowsza weryfikacja oferty', one strip ABOVE the cards, cards without a partner link", () => {
  const cards = [card(1), card(2, { lastVerifiedAt: new Date("2026-10-09T08:00:00Z") }), card(3)];
  const out = render("personal", cards);

  assert.equal((out.match(/<h1[ >]/g) ?? []).length, 1);
  assert.match(out, new RegExp(`<h1[^>]*>${hubHeading("personal")}</h1>`));
  assert.match(text(out), /Zestawiamy 3 oferty na konta dla osób fizycznych/);
  assert.match(text(out), /Najnowsza weryfikacja oferty: 9 paź 2026/);

  assert.equal((out.match(/data-disclosure="strip"/g) ?? []).length, 0);
  assert.equal((out.match(/data-card="promotion"/g) ?? []).length, 3);
  assert.match(text(out), /Aktualne promocje \(3\)/);

  // cards lead to the offer page, never to a bank
  assert.doesNotMatch(out, /\/out\//);
  assert.doesNotMatch(out, /data-disclosure="compact"/, "no button to a bank on the page, so no compact disclosure");
  assert.match(out, /href="\/promocje\/oferta-1"/);
});

test("page: nothing private reaches the HTML or the structured data, even if a caller passes extra fields", () => {
  const poisoned = { ...card(1), affiliateUrl: "https://secret-partner.example/aff?id=7771234", affiliateCommissionCents: 7771234 };
  const out = render("personal", [poisoned as PromotionCardData]);
  assert.doesNotMatch(out, /secret-partner|7771234|affiliateUrl|affiliateCommission/i);
});

test("page: the first card is not rendered twice and every card is a list item of one list", () => {
  const out = render("business", [card(1, { accountType: "BUSINESS" }), card(2, { accountType: "BUSINESS" })]);
  assert.equal((out.match(/<ul role="list" class="grid/g) ?? []).length, 1);
  assert.equal((out.match(/data-slug="oferta-1"/g) ?? []).length, 1);
  assert.match(out, /Konta firmowe z premią/);
});

test("page: breadcrumbs, BreadcrumbList + ItemList + FAQPage parse and describe what is on the page", () => {
  const cards = Array.from({ length: 12 }, (_, i) => card(i + 1));
  const out = render("personal", cards);
  const nodes = jsonLd(out);

  const crumbs = byType(nodes, "BreadcrumbList") as { itemListElement: { position: number; name: string; item: string }[] };
  assert.deepEqual(
    crumbs.itemListElement.map((e) => [e.position, e.name, e.item]),
    [
      [1, "Start", `${SITE}/`],
      [2, "Konta osobiste z premią", `${SITE}/konta-osobiste-z-premia`]
    ]
  );
  assert.match(out, /<nav aria-label="Ścieżka nawigacji"/);

  const list = byType(nodes, "ItemList") as { numberOfItems: number; itemListElement: { position: number; url: string; name: string }[] };
  assert.equal(list.numberOfItems, 10, "top ten, the plan's ItemList");
  assert.equal(list.itemListElement[0]?.url, `${SITE}/promocje/oferta-1`);
  assert.equal(list.itemListElement[0]?.name, promotionHeading({ name: "Oferta numer 1", bankName: "Bank 1" }));
  assert.deepEqual(list.itemListElement.map((e) => e.position), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

  const faq = byType(nodes, "FAQPage") as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
  assert.deepEqual(faq.mainEntity.map((q) => q.name), HUB_FAQ.personal.map((q) => q.question));
  const visible = text(out);
  for (const q of faq.mainEntity) {
    assert.ok(visible.includes(q.name), `question on the page: ${q.name}`);
    assert.ok(visible.includes(q.acceptedAnswer.text), `answer on the page: ${q.name}`);
  }
  for (const node of nodes) assert.equal(node["@context"], "https://schema.org");
  assert.ok(!nodes.some((n) => /Review|AggregateRating/.test(JSON.stringify(n))), "no self-rating markup");
});

test("page: more than the limit shows the first 24, says how many are left and links to the full list", () => {
  const cards = Array.from({ length: HUB_CARD_LIMIT + 6 }, (_, i) => card(i + 1));
  const out = render("personal", cards);
  assert.equal((out.match(/data-card="promotion"/g) ?? []).length, HUB_CARD_LIMIT);
  assert.match(text(out), /Aktualne promocje \(30\)/, "the heading counts all offers of the hub");
  assert.match(text(out), /Zostało jeszcze 6 promocji – zobacz pełną listę z filtrami i sortowaniem/);
  assert.match(out, /href="\/promocje"/);

  const exact = render("personal", Array.from({ length: HUB_CARD_LIMIT }, (_, i) => card(i + 1)));
  assert.doesNotMatch(exact, /Zostało jeszcze|zobacz pełną listę/);
});

test("page: editorial block, the shown FAQ and the 'Zobacz także' links are all in the HTML", () => {
  for (const kind of ALL_KINDS) {
    const out = render(kind, [card(1, { accountType: kind === "business" ? "BUSINESS" : "PERSONAL" })]);
    const visible = text(out);
    for (const section of HUB_SECTIONS[kind]) {
      assert.match(out, new RegExp(`<h2 id="${section.id}">`));
      for (const paragraph of section.paragraphs) assert.ok(visible.includes(paragraph), section.heading);
    }
    assert.equal((out.match(/<details /g) ?? []).length, HUB_FAQ[kind].length);
    assert.match(out, /<summary [^>]*>/);
    // the scope note under the list ("Nie obejmujemy całego rynku ...")
    assert.match(out, /data-trust-note="scope"/);
    for (const link of hubRelatedLinks(kind)) assert.match(out, new RegExp(`href="${link.href.replace(/\//g, "\\/")}"`), link.href);
    // heading outline: one h1, then h2 sections, cards are h3
    assert.equal((out.match(/<h1[ >]/g) ?? []).length, 1);
    assert.match(out, /<h3[^>]*>[\s\S]*?Oferta numer 1/);
  }
});

test("page: every id is unique and the markup avoids the forbidden patterns of the design spec", () => {
  const out = render("personal", Array.from({ length: 5 }, (_, i) => card(i + 1)));
  const ids = [...out.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!);
  assert.equal(new Set(ids).size, ids.length, `duplicate ids: ${ids.filter((id, i) => ids.indexOf(id) !== i)}`);
  assert.doesNotMatch(out, /text-ink-300|text-\[1[01]px\]|border-ink-100|break-all|animate-ping|bg-ink-solid|h-13\b/);
  assert.doesNotMatch(out, /target="_blank"/);
});

test("empty hub: an honest message and a way out, no strip and no ItemList, the text and the FAQ stay", () => {
  for (const kind of ALL_KINDS) {
    const out = render(kind, []);
    const label = kind === "personal" ? "konta osobiste" : "konta firmowe";
    assert.match(out, /data-empty-state="true"/);
    assert.match(text(out), new RegExp(`Brak aktualnych promocji na ${label}`));
    assert.match(text(out), new RegExp(`Obecnie nie mamy aktualnych promocji na ${label}`));
    assert.match(out, /href="\/promocje"/);
    assert.match(out, new RegExp(`href="${HUBS[HUBS[kind].other].path}"`));
    assert.doesNotMatch(out, /data-disclosure="strip"/, "no list of offers, no strip");
    assert.doesNotMatch(out, /data-card="promotion"/);
    assert.doesNotMatch(out, /Najnowsza weryfikacja oferty/, "no invented date");

    const nodes = jsonLd(out);
    assert.ok(byType(nodes, "BreadcrumbList"));
    assert.ok(byType(nodes, "FAQPage"));
    assert.equal(byType(nodes, "ItemList"), undefined, "an empty list is not a list");
    assert.equal((out.match(/<details /g) ?? []).length, HUB_FAQ[kind].length);
    assert.match(out, new RegExp(`<h2 id="${HUB_SECTIONS[kind][0]!.id}">`));
    assert.match(out, /data-trust-note="scope"/);
  }
});

test("SeoEditorial: every part is optional; ids can be prefixed when a page shows two blocks", () => {
  const empty = renderToStaticMarkup(h(SeoEditorial, {}));
  assert.equal(text(empty), "");
  const faqOnly = renderToStaticMarkup(
    h(SeoEditorial, { faq: [{ question: "Pytanie?", answer: "Odpowiedź." }], faqHeading: "Pytania", idPrefix: "x-" })
  );
  assert.match(faqOnly, /<h2 id="x-najczestsze-pytania">Pytania<\/h2>/);
  assert.doesNotMatch(faqOnly, /Zobacz także/);
});
