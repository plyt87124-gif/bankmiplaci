// Offer card (design spec section 5): server render with fixtures. Layout, hover
// and focus are verified with Playwright against the dev server, see the WP-09 report.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PromotionCard, PRIORITY_CARD_COUNT, type PromotionCardData } from "../src/components/PromotionCard";
import {
  cardLeadLine,
  describeAccountFee,
  hasShowableLogo,
  ratingExplainerHref
} from "../src/components/promocje/cardCopy";
import type { PromotionCardData as ServiceCard, PromotionCardJson } from "../src/lib/services/promotionCards";

// Source files use the classic JSX transform under tsx: they need React in scope.
(globalThis as { React?: unknown }).React = React;
// next/image validates remote hosts against next.config.js (checked at render time
// and skipped when NODE_ENV is "test"); the hosts of bank logos are not configured here.
(process.env as Record<string, string | undefined>).NODE_ENV = "test";

const h = React.createElement;
const NBSP = " ";
const NOW = new Date("2026-10-09T10:00:00Z");

/**
 * What a reader sees: tags removed (a space after block-level ones), spaces
 * collapsed. Non-breaking spaces are kept - they are part of what is tested.
 */
const text = (markup: string) =>
  markup
    .replace(/<\/(p|div|li|ul|h[1-6]|article|a|summary|details|label)>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t\r\n]+/g, " ")
    .trim();

function card(overrides: Partial<ServiceCard> = {}): ServiceCard {
  return {
    slug: "alior-konto-z-premia",
    name: "Konto z Premią",
    summary: "Otwórz konto i płać kartą.",
    maxBonusCents: 80_000,
    difficulty: "EASY",
    accountType: "PERSONAL",
    rating: 9.4,
    ratingReason: null,
    endDate: new Date("2026-12-31T00:00:00Z"),
    lastVerifiedAt: new Date("2026-10-06T10:00:00Z"),
    fees: { accountFeeCents: 0, accountFeeWaiverCondition: null, cardFeeCents: 0, cardFeeWaiverCondition: null },
    conditions: [{ title: "Otwórz konto online" }],
    bank: { name: "Alior Bank", slug: "alior-bank", logoUrl: "https://img.example.pl/logos/alior.png" },
    ...overrides
  };
}

const render = (promotion: PromotionCardData, props: Partial<React.ComponentProps<typeof PromotionCard>> = {}) =>
  renderToStaticMarkup(h(PromotionCard, { promotion, now: NOW, ...props }));

const anchors = (markup: string) => [...markup.matchAll(/<a\s([^>]*)>(.*?)<\/a>/gs)].map((m) => ({ attrs: m[1] ?? "", inner: m[2] ?? "" }));

/* ------------------------------------------------------------------ */
/* structure                                                           */
/* ------------------------------------------------------------------ */

test("one article, one stretched link to the offer, no 'Jak liczymy?' link", () => {
  const out = render(card());
  assert.equal((out.match(/<article/g) ?? []).length, 1);

  const links = anchors(out);
  assert.equal(links.length, 1, "only the title link (the 'Jak liczymy?' link was removed by the owner)");
  const title = links[0]!;
  assert.match(title.attrs, /href="\/promocje\/alior-konto-z-premia"/);
  assert.match(title.attrs, /after:absolute/);
  assert.match(title.attrs, /after:inset-0/);
  assert.match(text(title.inner), /Konto z Premią/);
  assert.doesNotMatch(text(out), /Jak liczymy/);

  // no nested links and never an outbound / partner link on a card
  assert.doesNotMatch(out, /<a\s[^>]*>(?:(?!<\/a>).)*<a\s/s);
  assert.doesNotMatch(out, /\/out\//);
  assert.doesNotMatch(out, /target="_blank"/);
  assert.doesNotMatch(out, /sponsored/);
});

test("the offer name is the heading (h3 by default, level adjustable); a name without the bank gets the bank for screen readers", () => {
  assert.match(render(card()), /<h3[^>]*>.*Konto z Premią/s);
  assert.match(render(card(), { headingLevel: 2 }), /<h2[^>]*>/);
  assert.match(render(card(), { headingLevel: 4 }), /<h4[^>]*>/);

  assert.match(render(card({ name: "Konto z Premią" })), /<span class="sr-only">Alior Bank: <\/span>Konto z Premią/);
  const mentioned = render(card({ name: "Alior Bank: Konto z Premią" }));
  assert.doesNotMatch(mentioned, /sr-only">Alior Bank:/);
});

test("amount is the hero: 'Premia do' + the figure with a non-breaking space before zł", () => {
  const out = render(card({ maxBonusCents: 270_000 }));
  assert.match(out, /Premia do/);
  // one plain text run "2700<nbsp>zł" (only the "zł" is drawn smaller), in the display font
  assert.match(out, new RegExp(`type-amount[^>]*>2700${NBSP}<span[^>]*>zł</span>`));
  assert.match(text(out), new RegExp(`Premia do 2700${NBSP}zł`));
});

test("no cash bonus: 'Bez premii gotówkowej' instead of 'Premia do 0 zł'", () => {
  const out = render(card({ maxBonusCents: 0, name: "0 zł za konto i kartę", fees: null }));
  assert.match(text(out), /Bez premii gotówkowej/);
  assert.doesNotMatch(out, /Premia do/);
  assert.doesNotMatch(out, /type-amount/);
  // and there is no "0 zł" claim anywhere but the offer's own name
  assert.equal((text(out).match(new RegExp(`0${NBSP}zł`, "g")) ?? []).length, 0);
});

test("type of account, difficulty (neutral meter with a word) and deadline", () => {
  const out = render(card({ accountType: "BUSINESS", difficulty: "HARD" }));
  assert.match(text(out), /Konto firmowe/);
  assert.match(out, /aria-label="Trudność: trudna, 4 z 4"/);
  assert.match(text(out), /Ważna do 31\.12\.2026/);
});

/* ------------------------------------------------------------------ */
/* fee                                                                 */
/* ------------------------------------------------------------------ */

test("account fee: 'Brak danych' when unknown - never 0 zł", () => {
  assert.deepEqual(describeAccountFee(null), { kind: "unknown", text: "Brak danych" });
  assert.deepEqual(describeAccountFee(undefined), { kind: "unknown", text: "Brak danych" });
  assert.deepEqual(describeAccountFee({ accountFeeCents: null }), { kind: "unknown", text: "Brak danych" });
  // 0 zł together with a waiver condition contradicts itself: the real rate is unknown
  assert.equal(describeAccountFee({ accountFeeCents: 0, accountFeeWaiverCondition: "wpływ 1000 zł" }).kind, "unknown");
  assert.equal(describeAccountFee({ accountFeeCents: 0, accountFeeWaiverCondition: "   " }).kind, "free");
});

test("account fee: confirmed free, paid, and paid-until-condition", () => {
  assert.deepEqual(describeAccountFee({ accountFeeCents: 0, accountFeeWaiverCondition: null }), { kind: "free", text: `0${NBSP}zł` });
  assert.deepEqual(describeAccountFee({ accountFeeCents: 1200 }), { kind: "paid", text: `12${NBSP}zł` });
  assert.deepEqual(describeAccountFee({ accountFeeCents: 1900, accountFeeWaiverCondition: "wpływ 1000 zł" }), {
    kind: "conditional",
    text: `19${NBSP}zł`,
    note: `0${NBSP}zł po spełnieniu warunku`
  });
});

test("card prints the fee line", () => {
  const free = text(render(card()));
  assert.ok(free.includes("Bez opłat za prowadzenie"));
  const unknown = text(render(card({ fees: null })));
  assert.match(unknown, /Opłata za konto: Brak danych/);
  assert.doesNotMatch(unknown, new RegExp(`Opłata za konto: 0${NBSP}zł`));
  const conditional = text(render(card({ fees: { accountFeeCents: 1500, accountFeeWaiverCondition: "x", cardFeeCents: null, cardFeeWaiverCondition: null } })));
  assert.ok(conditional.includes("Bez opłat za prowadzenie* (pod warunkami)"), conditional);
});

/* ------------------------------------------------------------------ */
/* lead line                                                           */
/* ------------------------------------------------------------------ */

test("lead line: first step, else the summary, else nothing (nothing is invented)", () => {
  assert.equal(cardLeadLine([{ title: "  Otwórz   konto  " }], "summary"), "Krok 1: Otwórz konto");
  assert.equal(cardLeadLine([], "  Płać kartą \n co miesiąc "), "Płać kartą co miesiąc");
  assert.equal(cardLeadLine([], null), null);
  assert.equal(cardLeadLine(undefined, "   "), null);
  assert.equal(cardLeadLine([{ title: "   " }], "Streszczenie"), "Streszczenie");
});

test("no conditions and no summary: the lead line is simply absent", () => {
  const out = render(card({ conditions: [], summary: null }));
  assert.doesNotMatch(out, /Krok 1/);
});

/* ------------------------------------------------------------------ */
/* verification, deadline, state                                       */
/* ------------------------------------------------------------------ */

test("verification line comes only from lastVerifiedAt: date, 'stale' note, or 'Brak daty weryfikacji'", () => {
  const fresh = render(card({ lastVerifiedAt: new Date("2026-10-08T10:00:00Z") }));
  assert.match(text(fresh), /Zweryfikowano 8 paź 2026/);
  assert.match(fresh, /data-freshness="fresh"/);

  const stale = render(card({ lastVerifiedAt: new Date("2026-08-01T10:00:00Z") }));
  assert.match(text(stale), /Zweryfikowano 1 sie 2026 – dane mogą być nieaktualne/);

  const none = render(card({ lastVerifiedAt: null as unknown as Date }));
  assert.match(text(none), /Brak daty weryfikacji/);
  assert.doesNotMatch(none, /Zweryfikowano/);
});

test("deadline badge: neutral date, then 'Koniec za N dni' close to the end", () => {
  assert.match(text(render(card())), /Ważna do 31\.12\.2026/);
  assert.match(text(render(card({ endDate: new Date("2026-10-13T00:00:00Z") }))), /Koniec za 4 dni/);
  assert.match(text(render(card({ endDate: new Date("2026-10-11T00:00:00Z") }))), /Koniec za 2 dni/);
});

test("ended offer: red banner, no 'Szczegóły', a link to the bank's current offers, grey logo", () => {
  const out = render(card({ endDate: new Date("2026-09-30T00:00:00Z") }));
  assert.match(text(out), /Zakończona/);
  assert.match(out, /bg-coral-100/);
  assert.match(out, /grayscale/);
  assert.doesNotMatch(text(out), /Szczegóły/);
  const link = anchors(out).find((a) => /Aktualne promocje banku/.test(a.inner));
  assert.ok(link, "link to the bank's current offers");
  assert.match(link.attrs, /href="\/promocje\?bank=alior-bank"/);
  assert.match(link.attrs, /z-10/);
  // no deadline badge repeated under the banner
  assert.doesNotMatch(text(out), /Ważna do/);
});

test("an offer marked EXPIRED is ended even before its date passes; a DRAFT is labelled 'Roboczy'", () => {
  assert.match(text(render(card({ ...{ status: "EXPIRED" } } as Partial<ServiceCard>))), /Zakończona/);
  const draft = render({ ...card(), status: "DRAFT" });
  assert.match(text(draft), /Roboczy/);
  assert.doesNotMatch(text(render(card())), /Roboczy/);
});

test("the footer: 'Ocena serwisu 9,4/10' with a comma, 'Szczegóły' with an arrow", () => {
  const out = render(card());
  assert.match(text(out), /Ocena serwisu 9,4\/10/);
  assert.match(text(out), /Szczegóły/);
  assert.doesNotMatch(out, /9\.4/);
  assert.match(text(render(card({ rating: 8 }))), /Ocena serwisu 8,0\/10/);
});

test("the rating can come as a number, a numeric string or a Prisma Decimal", () => {
  assert.match(text(render({ ...card(), rating: "8.5" })), /Ocena serwisu 8,5\/10/);
  assert.match(text(render({ ...card(), rating: { toNumber: () => 9.1 } })), /Ocena serwisu 9,1\/10/);
});

test("'Jak liczymy?' goes to /metodologia once it is live, to the rating section of /jak-zarabiamy before", () => {
  assert.match(ratingExplainerHref(), /^\/(metodologia|jak-zarabiamy#ocena)$/);
});

/* ------------------------------------------------------------------ */
/* logo                                                                */
/* ------------------------------------------------------------------ */

test("logo: the bank is named on screen only when there is no logo to show", () => {
  const withLogo = render(card());
  assert.match(withLogo, /<img[^>]*alt="Alior Bank"/);
  assert.doesNotMatch(withLogo, /type-label[^>]*>Alior Bank</);

  for (const logoUrl of [null, "", "http://insecure.example/logo.png", "//cdn.example/x.png"]) {
    const out = render(card({ bank: { name: "Alior Bank", slug: "alior-bank", logoUrl } }));
    assert.match(out, /type-label[^>]*>Alior Bank</, String(logoUrl));
    assert.doesNotMatch(out, /<img/);
  }
  assert.equal(hasShowableLogo("https://x.example/a.png"), true);
  assert.equal(hasShowableLogo("/logos/a.png"), true);
  assert.equal(hasShowableLogo("//x.example/a.png"), false);
  assert.equal(hasShowableLogo(undefined), false);
});

test("the first cards load their logo with priority, the rest lazily", () => {
  assert.equal(PRIORITY_CARD_COUNT, 3);
  const first = render(card(), { index: 0 });
  const later = render(card(), { index: 10 });
  // priority = a preload hint and no lazy loading; the rest = lazy
  assert.match(first, /<link rel="preload" as="image"/);
  assert.doesNotMatch(first, /loading="lazy"/);
  assert.match(later, /loading="lazy"/);
  assert.doesNotMatch(later, /rel="preload"/);
  assert.match(render(card(), { index: PRIORITY_CARD_COUNT - 1 }), /rel="preload"/);
  assert.match(render(card(), { index: PRIORITY_CARD_COUNT }), /loading="lazy"/);
  // explicit override wins; without an index nothing is prioritised
  assert.match(render(card(), { index: 10, priority: true }), /rel="preload"/);
  assert.match(render(card(), { index: 0, priority: false }), /loading="lazy"/);
  assert.match(render(card()), /loading="lazy"/);
});

/* ------------------------------------------------------------------ */
/* compatibility and privacy                                           */
/* ------------------------------------------------------------------ */

test("accepts the card after a JSON round trip (dates as ISO strings, as in the quiz)", () => {
  const json: PromotionCardJson = JSON.parse(JSON.stringify(card()));
  assert.equal(typeof json.endDate, "string");
  const out = render(json);
  assert.match(text(out), /Ważna do 31\.12\.2026/);
  assert.match(text(out), /Zweryfikowano 6 paź 2026/);
});

test("accepts the pre-redesign shape (no lastVerifiedAt, no bank slug, no status, no fees) without throwing", () => {
  const legacy = {
    slug: "stara-oferta",
    name: "Stara oferta",
    maxBonusCents: 50_000,
    difficulty: "MEDIUM" as const,
    accountType: "BUSINESS" as const,
    rating: 7.5,
    endDate: "2099-01-31T00:00:00.000Z",
    bank: { name: "Bank Testowy" }
  };
  const out = render(legacy);
  assert.match(text(out), /Brak daty weryfikacji/);
  assert.match(text(out), /Opłata za konto: Brak danych/);
  assert.match(text(out), /Bank Testowy/);
  assert.match(text(out), /Ocena serwisu 7,5\/10/);
});

test("a whole database row can be passed (old callers do) and nothing private reaches the HTML", () => {
  const row = {
    ...card(),
    id: "cuid-123",
    affiliateUrl: "https://partner.example/track?id=SECRET",
    affiliateCommissionCents: 987_654,
    sourceUrl: "https://bank.example/regulamin",
    ratingOverride: 9.99
  };
  const out = render(row);
  for (const secret of ["partner.example", "SECRET", "987654", "987 654", "bank.example", "cuid-123", "9.99"]) {
    assert.ok(!out.includes(secret), `leaked: ${secret}`);
  }
});

test("no animation or lift on the card; hover is a border/tint change only", () => {
  const out = render(card());
  assert.match(out, /hover:border-line-strong/);
  assert.match(out, /hover:bg-sunken\/40/);
  assert.doesNotMatch(out, /shadow-|hover:-translate|hover:scale|animate-/);
});

/* ------------------------------------------------------------------ */
/* the design rules, enforced on the WP-09 sources                     */
/* ------------------------------------------------------------------ */

const FORBIDDEN: [RegExp, string][] = [
  [/text-ink-300/, "text-ink-300 is for icons only"],
  [/border-ink-100/, "border-ink-100: cards use border-line, controls border-line-strong"],
  [/bg-ink-solid/, "ink-solid is legacy"],
  [/text-\[1[01]px\]/, "text under 12 px"],
  [/\bh-13\b/, "h-13 does not exist"],
  [/\bink-200\b/, "ink-200 does not exist"],
  [/break-all/, "break-all splits Polish words"],
  [/toFixed\(/, "ratings go through formatRating"],
  [/animate-ping/, "no pulsing indicators"],
  [/dangerouslySetInnerHTML/, "structured data goes through <JsonLd>"],
  [/NEXT_PUBLIC_SITE_URL/, "the site URL comes from the SEO library"],
  [/bg-teal-[67]00[^"]*text-white|text-white[^"]*bg-teal-[67]00/, "use <Button> / bg-action text-on-action"]
];

const WP09_SOURCES = [
  "src/components/PromotionCard.tsx",
  "src/components/Filters.tsx",
  "src/components/NoResultsState.tsx",
  "src/components/filters/FilterFields.tsx",
  "src/components/filters/FilterSheet.tsx",
  "src/components/filters/filterParams.ts",
  "src/components/filters/committer.ts",
  "src/components/filters/useCommittedValue.ts",
  "src/components/promocje/ListingGrid.tsx",
  "src/components/promocje/ListingEditorial.tsx",
  "src/components/promocje/cardCopy.ts",
  "src/components/promocje/editorialContent.ts",
  "src/components/promocje/listing.ts",
  "src/components/promocje/listingData.ts",
  "src/app/promocje/(lista)/page.tsx",
  "src/app/promocje/(lista)/loading.tsx"
];

test("WP-09 sources contain none of the banned patterns of the design spec", () => {
  for (const file of WP09_SOURCES) {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    for (const [pattern, why] of FORBIDDEN) {
      assert.ok(!pattern.test(source), `${file}: ${why}`);
    }
  }
});

test("account fee: hasOtherFee no longer changes a bare 0 zł, like the offer page", () => {
  assert.deepEqual(describeAccountFee({ accountFeeCents: 0, accountFeeWaiverCondition: null, hasOtherFee: true }), {
    kind: "free",
    text: `0${NBSP}zł`
  });
  assert.deepEqual(describeAccountFee({ accountFeeCents: 0, accountFeeWaiverCondition: null, hasOtherFee: false }), {
    kind: "free",
    text: `0${NBSP}zł`
  });
  // a paid fee keeps its amount; the unknown stays unknown whatever the remark says
  assert.equal(describeAccountFee({ accountFeeCents: 1200, hasOtherFee: true }).text, `12${NBSP}zł`);
  assert.equal(describeAccountFee({ accountFeeCents: null, hasOtherFee: true }).text, "Brak danych");

  const withRemark = text(render(card({ fees: { accountFeeCents: 0, accountFeeWaiverCondition: null, cardFeeCents: 0, cardFeeWaiverCondition: null, hasOtherFee: true } })));
  assert.ok(withRemark.includes("Bez opłat za prowadzenie"), withRemark);
});
