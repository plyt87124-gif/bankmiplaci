// The home page rendered on the server with fixtures: order of the blocks, the
// disclosure strip right under the "Polecane promocje" heading, the blocks that
// disappear when empty, the quiz band numbers, the trust claims, the FAQ shortcut
// and its JSON-LD, the failure state, and the privacy of what reaches the HTML
// and the client island. The page itself needs the database; the data rules are
// in tests/home-model.test.tsx, the look is checked in a browser (WP-08 report).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeView } from "../src/components/home/HomeView";
import { HomeEndingSoon } from "../src/components/home/HomeEndingSoon";
import { HomeFaq } from "../src/components/home/HomeFaq";
import { HomeFeatured } from "../src/components/home/HomeFeatured";
import { HomeSeeAllLink, HomeSegmentPanels, HomeSegmentProvider } from "../src/components/home/HomeSegment";
import { HOME_FAQ_IDS, HOME_H1, HOME_HUBS, HOME_TRUST_COLUMNS, homeFaqItems, liveHomeHubs } from "../src/components/home/homeContent";
import { buildHomeModel, type HomeModel } from "../src/components/home/homeModel";
import { PromotionCard } from "../src/components/PromotionCard";
import { FAQ_ITEMS } from "../src/app/faq/faqItems";
import { RATING_COMMISSION_RULE, STRIP_RECOMMENDED, disclosureText } from "../src/lib/disclosureCopy";
import { pluralizePl } from "../src/lib/format";
import { QUIZ_QUESTION_COUNT, QUIZ_RESULT_COUNT } from "../src/lib/quiz";
import { websiteId, organizationId } from "../src/lib/seo";
import type { PromotionCardData } from "../src/lib/services/promotionCards";

// Source files use the classic JSX transform under tsx: they need React in scope.
(globalThis as { React?: unknown }).React = React;
// next/image validates remote hosts at render time unless NODE_ENV is "test".
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.NEXT_PUBLIC_SITE_URL = "https://bankmiplaci.example";

const h = React.createElement;
const NOW = new Date("2026-10-10T10:00:00Z");
const day = (offset: number) => new Date(Date.UTC(2026, 9, 10 + offset));

/** What a reader sees: tags removed (a space after block-level ones), spaces collapsed. */
const text = (markup: string) =>
  markup
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<\/(p|div|li|ul|h[1-6]|article|a|summary|details|label|span|section|time)>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t\r\n ]+/g, " ")
    .trim();

function card(slug: string, overrides: Partial<PromotionCardData> = {}): PromotionCardData {
  return {
    slug,
    name: `Oferta ${slug}`,
    summary: null,
    maxBonusCents: 50_000,
    difficulty: "EASY",
    accountType: "PERSONAL",
    rating: 8.4,
    ratingReason: null,
    endDate: day(60),
    lastVerifiedAt: new Date("2026-10-06T10:00:00Z"),
    fees: { accountFeeCents: 0, accountFeeWaiverCondition: null, cardFeeCents: 0, cardFeeWaiverCondition: null },
    conditions: [{ title: "Otwórz konto" }],
    bank: { name: `Bank ${slug}`, slug: `bank-${slug}`, logoUrl: null },
    ...overrides
  };
}

/** A realistic pool: 4 personal, 2 business, two of them ending within 14 days, two difficulty levels. */
function pool(): PromotionCardData[] {
  return [
    card("p1", { lastVerifiedAt: new Date("2026-10-07T08:00:00Z"), difficulty: "VERY_EASY", maxBonusCents: 10_000 }),
    card("b1", { accountType: "BUSINESS", maxBonusCents: 90_000 }),
    card("p2", { endDate: day(3) }),
    card("p3", { endDate: day(9), difficulty: "HARD", maxBonusCents: 120_000 }),
    card("b2", { accountType: "BUSINESS", difficulty: "MEDIUM" }),
    card("p4")
  ];
}

function render(model: HomeModel | null, hubs: ReturnType<typeof liveHomeHubs> = []): string {
  return renderToStaticMarkup(h(HomeView, { model, now: NOW, hubs }));
}

// "Zobacz wszystkie" is tested in both modes: hubs not live here (the legacy ?accountType link), hubs live in the last test.
const FULL = render(buildHomeModel(pool(), NOW, () => false));

function jsonLdBlocks(markup: string): Record<string, unknown>[] {
  const blocks = [...markup.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  return blocks.flatMap((m) => {
    const parsed = JSON.parse(m[1]!) as Record<string, unknown> | Record<string, unknown>[];
    return Array.isArray(parsed) ? parsed : [parsed];
  });
}

/* ------------------------------------------------------------------ */
/* order and headings                                                  */
/* ------------------------------------------------------------------ */

test("home: one H1 with the planned wording, the blocks in the order of the layout spec", () => {
  assert.equal((FULL.match(/<h1[ >]/g) ?? []).length, 1);
  assert.match(FULL, new RegExp(`<h1[^>]*>${HOME_H1}</h1>`));
  assert.equal(HOME_H1, "Promocje bankowe: znajdź konto z premią i sprawdź, co musisz zrobić");

  const order = [
    'id="home-title"',
    'id="polecane-title"',
    'id="konczace-title"',
    'id="wysilek-title"',
    'id="quiz-title"',
    'id="zaufanie-title"',
    'id="faq-title"'
  ].map((marker) => FULL.indexOf(marker));
  for (const [i, position] of order.entries()) assert.ok(position >= 0, `block ${i} is rendered`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, "hero, Polecane, Kończą się, Ile wysiłku, quiz, zaufanie, FAQ");
});

test("home: the blocks have the planned headings and 'Najlepsze' is nowhere", () => {
  const headings = [...FULL.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => text(m[1]!));
  assert.deepEqual(headings, [
    "Polecane promocje",
    "Kończą się wkrótce",
    "Ile wysiłku wymaga promocja?",
    "Nie wiesz, którą promocję wybrać?",
    "Dlaczego możesz nam ufać",
    "Najczęstsze pytania"
  ]);
  assert.doesNotMatch(FULL, /Najlepsze/, "'Polecane', never a superlative (the sort option 'Najlepsza ocena' in a FAQ answer is a name)");
});

/* ------------------------------------------------------------------ */
/* hero                                                                */
/* ------------------------------------------------------------------ */

test("hero: kicker with the newest verification date, lead, segment control, buttons, three facts", () => {
  const hero = FULL.slice(FULL.indexOf('aria-labelledby="home-title"'), FULL.indexOf('aria-labelledby="polecane-title"'));
  assert.match(text(hero), /Najnowsza weryfikacja oferty: 7 paź 2026/, "the NEWEST lastVerifiedAt of the pool (p1), not today's date");
  assert.match(hero, /Najnowsza weryfikacja oferty: <time dateTime="2026-10-07">7 paź 2026<\/time>/);
  assert.doesNotMatch(text(hero), /Aktualizacja:|Ostatnia weryfikacja/, "one name for that date, said once");
  assert.match(text(hero), /Pokazujemy, ile możesz zyskać, ile to kosztuje i co trzeba zrobić – ze ściągą krok po kroku\./);

  assert.match(hero, /role="radiogroup" aria-label="Typ konta"/);
  assert.equal((hero.match(/role="radio"/g) ?? []).length, 2);
  assert.match(hero, /aria-checked="true"[^>]*>Konta osobiste</);

  assert.match(hero, /<a [^>]*href="\/promocje"[^>]*>\s*Zobacz promocje\s*<\/a>/, "the hero button is the clean /promocje (canonical), whatever the segment");
  assert.match(hero, /<a [^>]*href="\/jak-to-dziala"[^>]*>Jak to działa<\/a>/);

  assert.match(text(hero), /6 aktualnych promocji/, "the counter: the end value is in the server HTML (CountUp)");
  assert.match(text(hero), /Przy każdej ofercie pokazujemy datę weryfikacji/, "a true statement (VerifiedLine on every card), not a second copy of the date");
  assert.equal((text(hero).match(/7 paź 2026/g) ?? []).length, 1, "the date appears once in the hero");
  assert.doesNotMatch(hero, /Ocena serwisu bez prowizji|Jak zarabiamy/, "the owner removed this fact from the hero");
});

test("hero: the counter uses the Polish plural form and the exact number", () => {
  const many = (n: number) =>
    render(buildHomeModel(Array.from({ length: n }, (_, i) => card(`o${i}`)), NOW));
  for (const [n, noun] of [
    [1, "aktualna promocja"],
    [2, "aktualne promocje"],
    [5, "aktualnych promocji"],
    [22, "aktualne promocje"],
    [12, "aktualnych promocji"]
  ] as const) {
    assert.equal(pluralizePl(n, "aktualna promocja", "aktualne promocje", "aktualnych promocji"), noun);
    assert.match(text(many(n)), new RegExp(`(^| )${n} ${n} ${noun}`), `${n} ${noun} (visible number + the one read aloud)`);
  }
});

test("hero: a static dot, no ping and no ornament; the LCP text is not revealed on scroll", () => {
  assert.doesNotMatch(FULL, /animate-ping|animate-pulse/);
  const firstReveal = FULL.indexOf("data-reveal");
  assert.ok(firstReveal > FULL.indexOf('id="polecane-title"'), "hero and the offers of the first screen are not wrapped in Reveal");
  assert.ok(firstReveal > FULL.indexOf("Zobacz wszystkie"), "Polecane (with its disclosure) is complete before the first Reveal");
});

/* ------------------------------------------------------------------ */
/* Polecane promocje                                                   */
/* ------------------------------------------------------------------ */

test("Polecane: no affiliate strip (removed by the owner) - the heading is followed by the segment label", () => {
  assert.doesNotMatch(FULL, /data-disclosure/);
});

test("Polecane: three cards per segment in the pool's order, the other segment is hidden, 'Zobacz wszystkie (N)' follows the segment", () => {
  const section = FULL.slice(FULL.indexOf('aria-labelledby="polecane-title"'), FULL.indexOf('id="konczace-title"'));
  const personal = section.match(/<div data-segment="PERSONAL"( hidden="")?>([\s\S]*?)<\/div><div data-segment="BUSINESS"/);
  const business = section.match(/<div data-segment="BUSINESS"( hidden="")?>([\s\S]*?)<\/div><p role="status"/);
  assert.ok(personal && business, "both panels are in the HTML");
  assert.equal(personal![1], undefined, "personal is visible");
  assert.equal(business![1], ' hidden=""', "business is hidden");
  const slugsIn = (html: string) => [...html.matchAll(/data-slug="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(slugsIn(personal![2]!), ["p1", "p2", "p3"], "the first three personal offers of the pool");
  assert.deepEqual(slugsIn(business![2]!), ["b1", "b2"]);

  assert.match(section, /<a [^>]*href="\/promocje\?accountType=PERSONAL"[^>]*><span>Zobacz wszystkie \(4\)<\/span><\/a>/);
  assert.match(text(section), /Nie obejmujemy całego rynku/);
  assert.match(section, /<p role="status" class="sr-only">Polecane promocje: konta osobiste<\/p>/);
});

test("Polecane: only the visible segment preloads its logos", () => {
  const withLogos = pool().map((c) => ({ ...c, bank: { ...c.bank, logoUrl: `https://img.example.pl/${c.slug}.png` } }));
  const html = render(buildHomeModel(withLogos, NOW));
  const personal = html.slice(html.indexOf('data-segment="PERSONAL"'), html.indexOf('data-segment="BUSINESS"'));
  const business = html.slice(html.indexOf('data-segment="BUSINESS"'), html.indexOf('role="status"'));
  const imgs = (markup: string) => markup.match(/<img [^>]*>/g) ?? [];
  assert.equal((html.match(/<link rel="preload" as="image"/g) ?? []).length, 3, "three logos of the visible list are preloaded");
  assert.ok(imgs(personal).length >= 3 && imgs(personal).every((img) => !/loading="lazy"/.test(img)), "visible list: no lazy loading");
  assert.ok(imgs(business).length >= 2 && imgs(business).every((img) => /loading="lazy"/.test(img)), "hidden list: lazy");
  const below = html.slice(html.indexOf('id="konczace-title"'));
  assert.ok(imgs(below).every((img) => /loading="lazy"/.test(img)), "blocks below the fold: lazy");
});

test("Polecane: a single segment shows no control and no caption", () => {
  const html = render(buildHomeModel(pool().filter((c) => c.accountType === "BUSINESS"), NOW, () => false));
  assert.doesNotMatch(html, /role="radiogroup"/);
  assert.doesNotMatch(html, /Wybór zmienia listę/);
  assert.doesNotMatch(html, /<p role="status"/);
  assert.match(html, /href="\/promocje"[^>]*>Zobacz promocje</, "the button leads to the whole list");
  assert.match(html, /<span>Zobacz wszystkie \(2\)<\/span>/, "the count is what that list shows (the two business offers are all of them)");
});

/* ------------------------------------------------------------------ */
/* Kończą się wkrótce                                                  */
/* ------------------------------------------------------------------ */

test("ending soon: the cards with the nearest deadline first, none of the far ones", () => {
  const section = FULL.slice(FULL.indexOf('aria-labelledby="konczace-title"'), FULL.indexOf('aria-labelledby="wysilek-title"'));
  assert.deepEqual([...section.matchAll(/data-slug="([^"]+)"/g)].map((m) => m[1]), ["p2", "p3"]);
  assert.match(text(section), /w ciągu 14 dni/);
  assert.doesNotMatch(section, /data-disclosure="tag"/, "no sentence about what the order depends on");
});

test("ending soon: an empty list renders no block at all (no heading, no wrapper)", () => {
  const farOnly = render(buildHomeModel([card("a"), card("b", { accountType: "BUSINESS" })], NOW));
  assert.doesNotMatch(farOnly, /Kończą się wkrótce/);
  assert.doesNotMatch(farOnly, /konczace-title/);
  assert.equal(renderToStaticMarkup(h(HomeEndingSoon, { model: buildHomeModel([card("a")], NOW) })), "");
  assert.equal(renderToStaticMarkup(h(HomeEndingSoon, { model: null })), "");
});

test("ending soon: the link to the whole list shows only while that page is live", () => {
  const model = buildHomeModel(pool(), NOW);
  const live = renderToStaticMarkup(h(HomeEndingSoon, { model, now: NOW, isLive: (p: string) => p === "/promocje/konczace-sie" }));
  assert.match(live, /<a [^>]*href="\/promocje\/konczace-sie"[^>]*>Wszystkie kończące się promocje/);
  const notLive = renderToStaticMarkup(h(HomeEndingSoon, { model, now: NOW, isLive: () => false }));
  assert.doesNotMatch(notLive, /konczace-sie|Wszystkie kończące się/);
});

/* ------------------------------------------------------------------ */
/* Ile wysiłku                                                         */
/* ------------------------------------------------------------------ */

test("effort: one sentence, the four-step legend and the easiest and hardest real offer", () => {
  const section = FULL.slice(FULL.indexOf('aria-labelledby="wysilek-title"'), FULL.indexOf('aria-labelledby="quiz-title"'));
  assert.deepEqual(
    [...section.matchAll(/aria-label="Trudność: ([^"]+)"/g)].slice(0, 4).map((m) => m[1]),
    ["bardzo łatwa, 1 z 4", "łatwa, 2 z 4", "średnia, 3 z 4", "trudna, 4 z 4"],
    "the legend: the four steps of the meter"
  );
  assert.deepEqual([...section.matchAll(/data-slug="([^"]+)"/g)].map((m) => m[1]), ["p1", "p3"], "very easy (p1) and hard (p3), from the pool");
  assert.match(text(section), /Przykłady z aktualnej oferty/);
});

test("effort: one difficulty level in the pool = one example card; no offers = no block", () => {
  const oneLevel = render(buildHomeModel([card("a"), card("b", { maxBonusCents: 90_000 })], NOW));
  const section = oneLevel.slice(oneLevel.indexOf('aria-labelledby="wysilek-title"'), oneLevel.indexOf('aria-labelledby="quiz-title"'));
  assert.deepEqual([...section.matchAll(/data-slug="([^"]+)"/g)].map((m) => m[1]), ["b"]);
  assert.match(text(section), /Przykład z aktualnej oferty/);

  const none = render(buildHomeModel([], NOW));
  assert.doesNotMatch(none, /Ile wysiłku wymaga promocja/);
});

/* ------------------------------------------------------------------ */
/* quiz, trust, FAQ                                                    */
/* ------------------------------------------------------------------ */

test("quiz band: the numbers are the quiz's own constants, the button leads to /quiz", () => {
  const band = FULL.slice(FULL.indexOf('aria-labelledby="quiz-title"'), FULL.indexOf('aria-labelledby="zaufanie-title"'));
  const questions = `${QUIZ_QUESTION_COUNT} ${pluralizePl(QUIZ_QUESTION_COUNT, "pytanie", "pytania", "pytań")}`;
  const results = `${QUIZ_RESULT_COUNT} ${pluralizePl(QUIZ_RESULT_COUNT, "promocję", "promocje", "promocji")}`;
  assert.match(text(band), new RegExp(`Odpowiedz na ${questions}\\. Pokażemy ${results}, które najlepiej pasują do Twoich odpowiedzi\\.`));
  assert.match(band, /<a [^>]*href="\/quiz"[^>]*>Dopasuj w quizie<\/a>/);
  assert.match(band, /class="[^"]*border-y border-line/, "a band between hairlines");
});

test("trust: three claims with their links, the commission wording from the one source, no deposit-guarantee claim", () => {
  const section = FULL.slice(FULL.indexOf('aria-labelledby="zaufanie-title"'), FULL.indexOf('aria-labelledby="faq-title"'));
  assert.deepEqual([...section.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map((m) => m[1]), ["Skąd bierzemy dane", "Jak liczymy ocenę"]);
  for (const href of ["/metodologia#zrodla", "/metodologia"]) {
    assert.match(section, new RegExp(`<a [^>]*href="${href}"`), href);
  }
  const plain = text(section);
  assert.doesNotMatch(plain, /Wysokość prowizji/, "no commission wording in the trust block");
  assert.doesNotMatch(plain, /Jak zarabiamy|Zarabiamy z prowizji/, "the owner removed the 'Jak zarabiamy' column");
  assert.doesNotMatch(plain, /BFG|gwarancj|Bankowy Fundusz/i, "the deposit guarantee needs an approved wording first");
  assert.equal(HOME_TRUST_COLUMNS.length, 2);
});

test("FAQ shortcut: three questions from the /faq source, answers in the HTML, link to /faq", () => {
  assert.equal(HOME_FAQ_IDS.length, 3);
  const items = homeFaqItems();
  assert.deepEqual(items.map((i) => i.id), [...HOME_FAQ_IDS]);
  for (const item of items) assert.ok(FAQ_ITEMS.includes(item), "the very object of /faq, not a copy");

  const section = FULL.slice(FULL.indexOf('aria-labelledby="faq-title"'));
  assert.equal((section.match(/<details /g) ?? []).length, 3);
  assert.equal((section.match(/<details [^>]* open=""/g) ?? []).length, 0, "closed rows keep the page short; the answers are still in the DOM");
  for (const item of items) {
    assert.ok(text(section).includes(item.answer), `answer in the HTML: ${item.id}`);
    assert.ok(text(section).includes(item.question), `question: ${item.id}`);
  }
  assert.match(section, /<a [^>]*href="\/faq"[^>]*>Wszystkie pytania i odpowiedzi/);
});

test("hubs: each link shows only while its page is live; none live = no navigation block", () => {
  const live = renderToStaticMarkup(h(HomeFaq, { hubs: liveHomeHubs((p: string) => p === "/banki" || p === "/konta-osobiste-z-premia") }));
  assert.match(live, /<a [^>]*href="\/konta-osobiste-z-premia"[^>]*>Konta osobiste z premią/);
  assert.match(live, /<a [^>]*href="\/banki"[^>]*>Banki/);
  assert.doesNotMatch(live, /konta-firmowe-z-premia/);

  const none = renderToStaticMarkup(h(HomeFaq, { hubs: liveHomeHubs(() => false) }));
  assert.doesNotMatch(none, /<nav|Przeglądaj promocje/);
  assert.deepEqual(HOME_HUBS.map((hub) => hub.href), ["/konta-osobiste-z-premia", "/konta-firmowe-z-premia", "/banki"]);
});

/* ------------------------------------------------------------------ */
/* JSON-LD                                                             */
/* ------------------------------------------------------------------ */

test("JSON-LD: Organization + WebSite with the @ids the offer pages point to, and the FAQPage of the shortcut", () => {
  const nodes = jsonLdBlocks(FULL);
  const types = nodes.map((n) => n["@type"]);
  assert.deepEqual(types, ["Organization", "WebSite", "FAQPage"]);

  const org = nodes[0]!;
  const site = nodes[1]!;
  assert.equal(org["@id"], organizationId());
  assert.equal(site["@id"], websiteId());
  assert.equal(site["@id"], "https://bankmiplaci.example/#website", "offer pages say isPartOf { @id: '#website' }");
  assert.deepEqual(site["publisher"], { "@id": organizationId() });

  const faq = nodes[2]!;
  const questions = (faq["mainEntity"] as { name: string; acceptedAnswer: { text: string } }[]).map((q) => q.name);
  assert.deepEqual(questions, homeFaqItems().map((i) => i.question), "the visible questions, same text");
  assert.deepEqual(
    (faq["mainEntity"] as { acceptedAnswer: { text: string } }[]).map((q) => q.acceptedAnswer.text),
    homeFaqItems().map((i) => i.answer)
  );
  assert.doesNotMatch(JSON.stringify(nodes), /Review|AggregateRating|ratingValue/, "no self-rating markup");
});

/* ------------------------------------------------------------------ */
/* failure and empty states                                            */
/* ------------------------------------------------------------------ */

test("database failure: the page still renders its static blocks with a notice instead of the offers", () => {
  const html = render(null);
  assert.match(html, /<h1[^>]*>Promocje bankowe: znajdź konto/);
  assert.match(text(html), /Nie udało się teraz wczytać promocji/);
  assert.match(html, /<a [^>]*href="\/promocje"[^>]*>Przejdź do listy promocji/);
  assert.doesNotMatch(html, /data-card=|role="radiogroup"|Aktualizacja:|Najnowsza weryfikacja|data-disclosure="strip"/, "no offers, no control, no invented date");
  assert.doesNotMatch(text(html), /\d+ aktualn/, "no invented counter");
  for (const id of ["quiz-title", "zaufanie-title", "faq-title"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.doesNotMatch(html, /konczace-title|wysilek-title/);
  assert.equal(jsonLdBlocks(html).length, 3, "the structured data does not depend on the offers");
});

test("no active offers: an honest message, never a made-up list or '0 aktualnych promocji'", () => {
  const html = render(buildHomeModel([], NOW));
  assert.match(text(html), /Nie mamy teraz aktualnych promocji do pokazania/);
  assert.doesNotMatch(text(html), /0 aktualnych promocji|0 0 aktualnych/);
  assert.doesNotMatch(html, /data-card=|Aktualizacja:|Najnowsza weryfikacja/);
});

/* ------------------------------------------------------------------ */
/* privacy                                                             */
/* ------------------------------------------------------------------ */

const SECRET_URL = "https://partner.example/secret-affiliate-link";

/** Public cards that carry private fields at RUNTIME (as a bug in the data layer would). */
function leakyPool(): PromotionCardData[] {
  return pool().map((c, i) => ({
    ...c,
    affiliateUrl: SECRET_URL,
    affiliateCommissionCents: 777_00 + i
  })) as PromotionCardData[];
}

test("privacy: no affiliate URL or commission in the rendered HTML", () => {
  const html = render(buildHomeModel(leakyPool(), NOW));
  assert.ok(html.includes("data-card="), "the cards are rendered");
  assert.doesNotMatch(html, /secret-affiliate-link|partner\.example/);
  assert.doesNotMatch(html, /affiliateUrl|affiliateCommission|commissionCents/i);
  assert.doesNotMatch(html, /77700|77701|77705/);
  assert.doesNotMatch(html, /href="\/out\//, "the home page has no outbound bank link of its own: cards lead to offer pages");
});

type ElementLike = { type: unknown; props: Record<string, unknown> };
const isElement = (node: unknown): node is ElementLike => typeof node === "object" && node !== null && "type" in node && "props" in node;

/** Every element of a tree (children only), for assertions on props. */
function walk(node: unknown, visit: (element: ElementLike) => void): void {
  if (Array.isArray(node)) return node.forEach((child) => walk(child, visit));
  if (!isElement(node)) return;
  visit(node);
  walk(node.props.children, visit);
}

test("privacy: the client island gets text and numbers only (segments) and ready-made lists (panels), never offers", () => {
  const model = buildHomeModel(leakyPool(), NOW, () => false);
  const view = HomeView({ model, now: NOW, hubs: [] }) as unknown;

  let provider: ElementLike | undefined;
  walk(view, (el) => {
    if (el.type === HomeSegmentProvider) provider = el;
  });
  assert.ok(provider, "the provider is in the tree");
  const options = provider!.props.options as Record<string, unknown>[];
  assert.deepEqual(
    options.map((o) => Object.keys(o).sort()),
    [
      ["count", "href", "label", "seeAll", "value"],
      ["count", "href", "label", "seeAll", "value"]
    ]
  );
  for (const o of options) {
    assert.deepEqual(Object.keys(o.seeAll as object).sort(), ["href", "label"], "seeAll is a link target and its text, nothing else");
  }
  // `children` are server-rendered nodes (executed on the server); what is serialised for the island is the rest.
  const { children: _children, ...islandProps } = provider!.props;
  void _children;
  assert.doesNotMatch(JSON.stringify(islandProps), /secret|affiliate|commission|slug|bank|offer/i, "not even card data: the lists are rendered nodes");

  const featured = HomeFeatured({ model, now: NOW }) as unknown;
  let panels: ElementLike | undefined;
  walk(featured, (el) => {
    if (el.type === HomeSegmentPanels) panels = el;
  });
  assert.ok(panels, "the panels reach the island as nodes");
  const cards: ElementLike[] = [];
  for (const panel of panels!.props.panels as { content: unknown }[]) {
    walk(panel.content, (el) => {
      if (el.type === PromotionCard) cards.push(el);
    });
  }
  assert.equal(cards.length, 3 + 2, "three personal + two business cards");
});

/* ------------------------------------------------------------------ */
/* style and structure guards (source level)                           */
/* ------------------------------------------------------------------ */

const HOME_DIR = path.join(process.cwd(), "src", "components", "home");
const homeSources = () =>
  fs
    .readdirSync(HOME_DIR)
    .filter((file) => /\.(ts|tsx)$/.test(file))
    .map((file) => ({ file, source: fs.readFileSync(path.join(HOME_DIR, file), "utf8") }))
    .concat([{ file: "app/page.tsx", source: fs.readFileSync(path.join(process.cwd(), "src", "app", "page.tsx"), "utf8") }]);

test("source guard: none of the retired v1 patterns of the design spec (section 2 / 7)", () => {
  const forbidden: [RegExp, string][] = [
    [/animate-ping/, "animate-ping"],
    [/border-ink-100/, "border-ink-100"],
    [/text-ink-300/, "text-ink-300 as text"],
    [/text-\[1[01]px\]/, "text-[10px]/[11px]"],
    [/\bh-13\b/, "h-13"],
    [/break-all/, "break-all"],
    [/toFixed\(/, "toFixed"],
    [/bg-ink-solid/, "bg-ink-solid"],
    [/bg-teal-700 text-white/, "bg-teal-700 text-white"],
    [/Najlepsz/, "'Najlepsze'"]
  ];
  for (const { file, source } of homeSources()) {
    for (const [pattern, label] of forbidden) assert.doesNotMatch(source, pattern, `${file}: ${label}`);
  }
});

test("source guard: one place reads the site URL (the SEO library), nothing private is selected, one database read", () => {
  for (const { file, source } of homeSources()) {
    assert.doesNotMatch(source, /process\.env\.NEXT_PUBLIC_SITE_URL/, `${file}: site URL only via src/lib/seo`);
    assert.doesNotMatch(source, /affiliateUrl|affiliateCommission/, `${file}: private fields`);
  }
  const data = fs.readFileSync(path.join(HOME_DIR, "homeData.ts"), "utf8");
  assert.equal((data.match(/listPromotionCards\(/g) ?? []).length, 1, "ONE read feeds every block");
  assert.doesNotMatch(data, /countActive|getEndingSoon|listActivePromotions|getEffortShowcase|countActivePromotions|db\./);
  const page = fs.readFileSync(path.join(process.cwd(), "src", "app", "page.tsx"), "utf8");
  assert.doesNotMatch(page, /listPromotionCards|listActivePromotions|\bdb\b/, "the page reads through the cached loader only");
});

test("source guard: Reveal only below the featured list, CountUp only for the counter", () => {
  const view = fs.readFileSync(path.join(HOME_DIR, "HomeView.tsx"), "utf8");
  const firstReveal = view.indexOf("<Reveal>");
  assert.ok(firstReveal > view.indexOf("<HomeFeatured"), "no Reveal above or around the hero and Polecane");
  for (const block of ["HomeEndingSoon", "HomeEffort", "HomeFaq"]) {
    const before = view.slice(Math.max(0, view.indexOf("<" + block) - 40), view.indexOf("<" + block));
    assert.doesNotMatch(before, /<Reveal>\s*$/, block + " (result list / FAQ) is not wrapped in Reveal");
  }
  for (const { file, source } of homeSources()) {
    if (/<CountUp/.test(source)) assert.equal(file, "HomeHero.tsx", "CountUp is the hero counter only");
  }
});

test("links with an anchor point at sections that exist (the pages of other packages are read, not copied)", () => {
  const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), "src", "app", ...parts), "utf8");
  assert.match(read("jak-zarabiamy", "page.tsx"), /id="ocena"/, "/jak-zarabiamy#ocena (the hero fact)");
  assert.match(read("jak-zarabiamy", "page.tsx"), /id="polecane"/, "/jak-zarabiamy#polecane (the disclosure strip)");
  const methodology = read("metodologia", "MethodologyContent.tsx");
  assert.match(methodology, /id="zrodla"/, "/metodologia#zrodla (trust column 1)");
  assert.match(methodology, /id="skladniki"/, "/metodologia#skladniki (the effort block)");
  const hrefs = [...HOME_TRUST_COLUMNS.map((c) => c.link.href), "/jak-zarabiamy#ocena", "/metodologia#skladniki"];
  for (const href of hrefs) {
    const [route] = href.split("#");
    const dir = route === "/" ? "" : route!.replace(/^\//, "");
    assert.ok(fs.existsSync(path.join(process.cwd(), "src", "app", dir, "page.tsx")), `${href}: the page exists`);
  }
});

test("the link under 'Polecane' shows the label and target the model gives it (the hub), and falls back to 'Zobacz wszystkie (N)'", () => {
  const base = { value: "PERSONAL" as const, label: "Konta osobiste", href: "/promocje?typ=PERSONAL", count: 4 };
  const withSeeAll = renderToStaticMarkup(
    h(
      HomeSegmentProvider,
      {
        options: [{ ...base, seeAll: { href: "/konta-osobiste-z-premia", label: "Wszystkie konta osobiste z premią (16)" } }],
        initial: "PERSONAL",
        children: h(HomeSeeAllLink)
      }
    )
  );
  assert.match(withSeeAll, /<a [^>]*href="\/konta-osobiste-z-premia"[^>]*><span>Wszystkie konta osobiste z premią \(16\)<\/span><\/a>/);
  assert.doesNotMatch(withSeeAll, /Zobacz wszystkie/);

  const fallback = renderToStaticMarkup(
    h(HomeSegmentProvider, { options: [base], initial: "PERSONAL", children: h(HomeSeeAllLink) })
  );
  assert.match(fallback, /href="\/promocje\?typ=PERSONAL"[^>]*><span>Zobacz wszystkie \(4\)<\/span>/);
});

test("HomeView passes the model's seeAll to the island: with live hubs the link under 'Polecane' is the indexable hub", () => {
  const html = renderToStaticMarkup(h(HomeView, { model: buildHomeModel(pool(), NOW, () => true), now: NOW }));
  assert.match(html, /<a [^>]*href="\/konta-osobiste-z-premia"[^>]*><span>Wszystkie konta osobiste z premią \(\d+\)<\/span><\/a>/);
  const offline = renderToStaticMarkup(h(HomeView, { model: buildHomeModel(pool(), NOW, () => false), now: NOW }));
  assert.match(offline, /href="\/promocje\?accountType=PERSONAL"[^>]*><span>Zobacz wszystkie \(\d+\)<\/span>/);
});
