// The pieces of /promocje around the cards: grid and "Pokaż więcej", the empty
// state, the editorial block + FAQ (and the FAQPage data made from the same
// array), the loading skeleton. Server render only; the page itself needs the
// database and is checked in the browser, see the WP-09 report.
import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ListingGrid } from "../src/components/promocje/ListingGrid";
import { ListingEditorial } from "../src/components/promocje/ListingEditorial";
import {
  EDITORIAL_SECTIONS,
  LISTING_FAQ,
  editorialWordCount
} from "../src/components/promocje/editorialContent";
import { NoResultsState } from "../src/components/NoResultsState";
import Loading from "../src/app/promocje/(lista)/loading";
import { faqLd } from "../src/lib/seo";
import type { PromotionCardData } from "../src/lib/services/promotionCards";

// Source files use the classic JSX transform under tsx: they need React in scope.
(globalThis as { React?: unknown }).React = React;
// next/image checks remote hosts at render time unless NODE_ENV is "test".
(process.env as Record<string, string | undefined>).NODE_ENV = "test";

const h = React.createElement;
const text = (markup: string) =>
  markup
    .replace(/<\/(p|div|li|ul|h[1-6]|article|a|summary|details|label|span)>/g, " ")
    .replace(/<[^>]+>/g, "")
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

/* ------------------------------------------------------------------ */
/* grid                                                                */
/* ------------------------------------------------------------------ */

test("grid: a list of cards, 1 / 2 / 3 columns that never shrink on a wider screen, the cards fill their cell", () => {
  const out = renderToStaticMarkup(h(ListingGrid, { cards: [card(1), card(2), card(3)], moreHref: null, remaining: 0 }));
  assert.match(out, /<ul role="list" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">/);
  assert.doesNotMatch(out, /xl:grid-cols/, "no column count that drops at 1280 px (layout spec: 1 / 2 / 3)");
  assert.equal((out.match(/<li /g) ?? []).length, 3);
  assert.equal((out.match(/data-card="promotion"/g) ?? []).length, 3);
  assert.doesNotMatch(out, /Pokaż więcej/);
});

test("grid: 'Pokaż więcej' is a plain link to ?strona=N (works without JavaScript) with what is left", () => {
  const out = renderToStaticMarkup(
    h(ListingGrid, { cards: [card(1)], moreHref: "/promocje?sort=top-rated&strona=2", remaining: 11 })
  );
  assert.match(out, /<a [^>]*href="\/promocje\?sort=top-rated&amp;strona=2"[^>]*>Pokaż więcej<\/a>/);
  assert.match(text(out), /Zostało jeszcze 11 promocji/);
  assert.doesNotMatch(out, /<button/);
  // idle state of the loading-aware link: not busy, no spinner, an empty polite status next to it
  assert.doesNotMatch(out, /aria-busy|aria-disabled|Ładuję/);
  assert.match(out, /<span role="status" aria-live="polite" class="sr-only"><\/span>/);
});

test("grid: the first cards get priority logos", () => {
  const cards = Array.from({ length: 6 }, (_, i) => card(i + 1, { bank: { name: `Bank ${i}`, slug: `b-${i}`, logoUrl: `https://img.example.pl/${i}.png` } }));
  const out = renderToStaticMarkup(h(ListingGrid, { cards, moreHref: null, remaining: 0 }));
  assert.equal((out.match(/rel="preload" as="image"/g) ?? []).length, 3);
  assert.equal((out.match(/loading="lazy"/g) ?? []).length, 3);
});

/* ------------------------------------------------------------------ */
/* empty state                                                         */
/* ------------------------------------------------------------------ */

test("empty state with filters: says what is wrong, offers the single filters to remove and 3 nearest offers", () => {
  const out = renderToStaticMarkup(
    h(NoResultsState, {
      query: "xyz",
      hasFilters: true,
      clearHref: "/promocje?sort=newest",
      relaxations: [
        { label: "Trudność: Trudna", href: "/promocje?q=xyz", count: 2 },
        { label: "Fraza: „xyz”", href: "/promocje?difficulty=HARD", count: 1 }
      ],
      suggestions: { caption: "Najbliższe wyniki bez filtra „Trudność: Trudna”", cards: [card(1), card(2)] }
    })
  );
  assert.match(out, /data-empty-state="true"/);
  assert.match(text(out), /Brak promocji dla „xyz” przy wybranych filtrach/);
  assert.match(text(out), /Poluzuj filtr albo wyczyść wszystkie/);
  assert.match(out, /<a [^>]*href="\/promocje\?q=xyz"[^>]*>.*Usuń filtr: Trudność: Trudna.*2 promocje/s);
  assert.match(text(out), /1 promocja/);
  assert.match(out, /<a [^>]*href="\/promocje\?sort=newest"[^>]*>Wyczyść filtry<\/a>/);
  assert.equal((out.match(/data-card="promotion"/g) ?? []).length, 2);
  // the cards sit under an h3, so they are h4
  assert.match(out, /<h4/);
});

test("empty state without a phrase and without suggestions", () => {
  const out = renderToStaticMarkup(h(NoResultsState, { hasFilters: true }));
  assert.match(text(out), /Brak promocji spełniających wybrane filtry/);
  assert.doesNotMatch(out, /data-card/);
});

test("empty list with no filter active is just empty - nothing to loosen, no 'Wyczyść filtry'", () => {
  const out = renderToStaticMarkup(h(NoResultsState, { hasFilters: false }));
  assert.match(text(out), /Obecnie nie mamy aktualnych promocji do pokazania/);
  assert.doesNotMatch(out, /Wyczyść filtry/);
  assert.doesNotMatch(out, /Poluzuj/);
  assert.match(out, /href="\/blog"/);
});

/* ------------------------------------------------------------------ */
/* editorial block                                                     */
/* ------------------------------------------------------------------ */

test("editorial: 200-400 words in four sections, plus 6-8 FAQ entries", () => {
  const words = editorialWordCount();
  assert.ok(words >= 200 && words <= 400, `${words} words`);
  assert.deepEqual(
    EDITORIAL_SECTIONS.map((s) => s.heading),
    [
      "Jak działa konto z premią?",
      "Dla kogo są promocje bankowe?",
      "Na co uważać przed założeniem konta",
      "Jak czytać naszą ocenę i trudność"
    ]
  );
  assert.ok(LISTING_FAQ.length >= 6 && LISTING_FAQ.length <= 8, `${LISTING_FAQ.length} questions`);
});

test("editorial text states general facts only: no amounts, dates, years or promises", () => {
  const all = [
    ...EDITORIAL_SECTIONS.flatMap((s) => s.paragraphs),
    ...LISTING_FAQ.flatMap((f) => [f.question, f.answer])
  ].join("\n");
  assert.doesNotMatch(all, /\d/, "digits would be hard-coded facts that go stale");
  assert.doesNotMatch(all, /gwarantuj|na pewno|zawsze dostaniesz|bez ryzyka|najlepsze (promocje|oferty|konta)|najlepszy bank|najtańsz|numer 1/i);
  // the ranking and rating wording must match the disclosure (the order is not independent of commission)
  assert.match(all, /wynagrodzenie partnerskie/);
  assert.match(all, /Prowizja[^.]*nie wpływa na ocenę|Prowizja nie jest składnikiem oceny/);
  assert.match(all, /nie jest to doradztwo finansowe|To nie jest porada/);
});

test("editorial render: every answer is in the HTML (native <details>), the first one open, headings are h2", () => {
  const out = renderToStaticMarkup(h(ListingEditorial));
  for (const section of EDITORIAL_SECTIONS) {
    assert.match(out, new RegExp(`<h2 id="${section.id}">${section.heading.replace(/[?]/g, "\\?")}</h2>`));
  }
  assert.match(out, /<h2[^>]*>Najczęstsze pytania o promocje bankowe<\/h2>/);
  assert.equal((out.match(/<details/g) ?? []).length, LISTING_FAQ.length);
  assert.equal((out.match(/<details[^>]* open=""/g) ?? []).length, 1);
  for (const item of LISTING_FAQ) {
    assert.ok(text(out).includes(item.question), item.question);
    assert.ok(text(out).includes(item.answer.slice(0, 60)), item.question);
  }
  assert.match(out, /container-reading/);
  assert.match(out, /type-article/);
});

test("editorial FAQ links lead to the explanation of the ranking", () => {
  const out = renderToStaticMarkup(h(ListingEditorial));
  assert.match(out, /href="\/jak-zarabiamy#polecane"/);
  assert.match(out, /href="\/(metodologia|jak-zarabiamy#ocena)"/);
});

test("FAQPage structured data is made from the same entries as the page", () => {
  const ld = faqLd(LISTING_FAQ);
  assert.ok(ld);
  const entities = ld["mainEntity"] as { name: string; acceptedAnswer: { text: string } }[];
  assert.equal(entities.length, LISTING_FAQ.length);
  assert.deepEqual(
    entities.map((e) => e.name),
    LISTING_FAQ.map((f) => f.question)
  );
  assert.deepEqual(
    entities.map((e) => e.acceptedAnswer.text),
    LISTING_FAQ.map((f) => f.answer)
  );
  // answers are plain text (no markup that would be wrong inside JSON-LD)
  for (const f of LISTING_FAQ) assert.doesNotMatch(f.answer, /[<>]/);
});

/* ------------------------------------------------------------------ */
/* loading skeleton                                                    */
/* ------------------------------------------------------------------ */

test("loading: one polite status, six card skeletons, nothing readable but 'Ładowanie promocji'", () => {
  const out = renderToStaticMarkup(h(Loading));
  assert.match(out, /role="status" aria-live="polite"/);
  assert.equal(text(out), "Ładowanie promocji");
  // each card skeleton = rounded-card with the card's own border and padding
  assert.equal((out.match(/rounded-card border border-line bg-surface p-4 sm:p-5/g) ?? []).length, 6);
  assert.equal((out.match(/class="skeleton /g) ?? []).length > 40, true);
  assert.doesNotMatch(out, /<h1|<a |<button|<input/);
});
