// /banki and /banki/[slug]: the pure model (which bank page exists, when it is indexable, the ended-offers
// list and its links, the FAQ made of data, alphabetical order) and the server render of both pages.
// The loaders (bankData.ts) need the database; the 404 decision is the pure resolveBankPage().
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BankIndexPage } from "../src/components/seo-pages/BankIndexPage";
import { BankPage } from "../src/components/seo-pages/BankPage";
import { BANK_INDEX_FAQ, BANK_INDEX_RELATED, BANK_INDEX_SECTIONS } from "../src/components/seo-pages/bankIndexContent";
import {
  BANK_PAGE_STATUSES,
  BANK_VISIBLE_STATUSES,
  ENDED_OFFERS_LIMIT,
  accountTypeLabel,
  activeCountText,
  bankDescriptionParagraphs,
  bankFaq,
  bankIndexLead,
  endedOfferHref,
  endedOffersNote,
  endedOffersOf,
  isBankIndexable,
  isEndedOffer,
  isPlausibleBankSlug,
  resolveBankPage,
  sortBanks,
  type BankIndexRow,
  type BankOfferRow,
  type BankRecord
} from "../src/components/seo-pages/banks";
import { countWords } from "../src/components/seo-pages/shared";
import { robotsForStatus } from "../src/lib/promotionAvailability";
import { bankHeading, promotionHeading } from "../src/lib/seo";
import type { PromotionCardData } from "../src/lib/services/promotionCards";

(globalThis as { React?: unknown }).React = React;
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.NEXT_PUBLIC_SITE_URL = "https://bankmiplaci.example";
const SITE = "https://bankmiplaci.example";

const h = React.createElement;
const NOW = new Date("2026-10-10T09:00:00Z");
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

const text = (markup: string) =>
  markup
    .replace(/<\/(p|div|li|ul|h[1-6]|article|a|summary|details|label|span|section|nav)>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t\r\n]+/g, " ")
    .trim();

function jsonLd(markup: string): Record<string, unknown>[] {
  return [...markup.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].flatMap((m) => {
    const parsed = JSON.parse(m[1]!) as Record<string, unknown> | Record<string, unknown>[];
    return Array.isArray(parsed) ? parsed : [parsed];
  });
}
const byType = (nodes: Record<string, unknown>[], type: string) => nodes.find((n) => n["@type"] === type);
const stripTag = (markup: string) => markup.match(/<[a-z]+[^>]*data-disclosure="strip"[^>]*>/)?.[0] ?? "";

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
    endDate: day("2099-06-30"),
    lastVerifiedAt: new Date("2026-10-06T10:00:00Z"),
    fees: { accountFeeCents: 0, accountFeeWaiverCondition: null, cardFeeCents: 0, cardFeeWaiverCondition: null },
    conditions: [],
    bank: { name: "Bank Testowy", slug: "testowy", logoUrl: null },
    ...overrides
  };
}

function row(slug: string, status: string, endIso: string, over: Partial<BankOfferRow> = {}): BankOfferRow {
  return { slug, name: `Promocja ${slug}`, status, accountType: "PERSONAL", endDate: day(endIso), ...over };
}

const BANK: BankRecord = { slug: "testowy", name: "Bank Testowy", logoUrl: null, description: null };

/* ------------------------------------------------------------------ */
/* 404 / indexing decisions                                            */
/* ------------------------------------------------------------------ */

test("resolveBankPage: 404 only for a bank that does not exist or has nothing public", () => {
  assert.deepEqual(resolveBankPage(null, []), { kind: "not-found" });
  assert.deepEqual(resolveBankPage(null, [row("a", "ACTIVE", "2099-01-01")]), { kind: "not-found" });
  // a bank row with no offer at all, or with drafts only, is not public (a draft must not leak the bank's name)
  assert.deepEqual(resolveBankPage(BANK, []), { kind: "not-found" });
  assert.deepEqual(resolveBankPage(BANK, [row("a", "DRAFT", "2099-01-01")]), { kind: "not-found" });
});

test("resolveBankPage: the page is permanent - 200 and indexable after every offer has ended", () => {
  assert.deepEqual(resolveBankPage(BANK, [row("a", "ACTIVE", "2099-01-01")]), { kind: "page", indexable: true });
  assert.deepEqual(resolveBankPage(BANK, [row("a", "EXPIRED", "2020-01-01")]), { kind: "page", indexable: true });
  // an ACTIVE row whose deadline passed (the expiry cron has not run yet) is still the same page
  assert.deepEqual(resolveBankPage(BANK, [row("a", "ACTIVE", "2020-01-01")]), { kind: "page", indexable: true });
});

test("resolveBankPage: only manually retired offers = 200 but noindex (the sitemap does not list such a bank)", () => {
  assert.deepEqual(resolveBankPage(BANK, [row("a", "ARCHIVED", "2020-01-01")]), { kind: "page", indexable: false });
  assert.deepEqual(resolveBankPage(BANK, [row("a", "ARCHIVED", "2020-01-01"), row("b", "DRAFT", "2099-01-01")]), {
    kind: "page",
    indexable: false
  });
  assert.equal(isBankIndexable([{ status: "ARCHIVED" }, { status: "DRAFT" }]), false);
  assert.equal(isBankIndexable([{ status: "ARCHIVED" }, { status: "EXPIRED" }]), true);
});

test("the bank page's indexing rule is the sitemap's rule: same offer statuses as src/app/sitemap.ts", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "src", "app", "sitemap.ts"), "utf8");
  const match = source.match(/OFFER_STATUSES\s*=\s*\[([^\]]*)\]/);
  assert.ok(match, "sitemap.ts declares OFFER_STATUSES");
  const statuses = match![1]!.split(",").map((s) => s.trim().replace(/^PromotionStatus\./, "")).filter(Boolean);
  assert.deepEqual([...statuses].sort(), [...BANK_PAGE_STATUSES].sort());
  // a draft is never visible; the visible set is the indexable one plus retired offers
  assert.ok(!(BANK_VISIBLE_STATUSES as readonly string[]).includes("DRAFT"));
  for (const status of BANK_PAGE_STATUSES) assert.ok((BANK_VISIBLE_STATUSES as readonly string[]).includes(status));
});

test("isPlausibleBankSlug: the admin form's slug rule, so garbage never reaches the database", () => {
  for (const ok of ["alior", "pko", "credit-agricole", "bank2"]) assert.equal(isPlausibleBankSlug(ok), true, ok);
  for (const bad of ["", "Alior", "a b", "a/b", "..", "a%20b", "<script>", "ąę", "a".repeat(81)]) {
    assert.equal(isPlausibleBankSlug(bad), false, JSON.stringify(bad));
  }
});

/* ------------------------------------------------------------------ */
/* Ended offers                                                        */
/* ------------------------------------------------------------------ */

test("endedOffersOf: ACTIVE past its deadline and EXPIRED are ended; open, retired and draft offers are not", () => {
  const rows = [
    row("open", "ACTIVE", "2099-01-01"),
    row("last-day", "ACTIVE", "2026-10-10"), // today is still open
    row("yesterday", "ACTIVE", "2026-10-09"),
    row("expired", "EXPIRED", "2026-08-01"),
    row("expired-early", "EXPIRED", "2099-01-01"), // closed early: not "ended by date"
    row("archived", "ARCHIVED", "2026-01-01"),
    row("draft", "DRAFT", "2026-01-01")
  ];
  assert.equal(isEndedOffer(rows[1]!, NOW), false);
  assert.equal(isEndedOffer(rows[2]!, NOW), true);
  const ended = endedOffersOf(rows, NOW);
  assert.deepEqual(ended.shown.map((r) => r.slug), ["yesterday", "expired"], "newest first");
  assert.equal(ended.total, 2);
  assert.equal(ended.hidden, 0);
  assert.equal(endedOffersNote(ended), null);
});

test("endedOffersOf: at most six are shown and the note says how many there are", () => {
  const rows = Array.from({ length: 9 }, (_, i) => row(`s${i}`, "EXPIRED", `2026-0${(i % 9) + 1}-15`));
  const ended = endedOffersOf(rows, NOW);
  assert.equal(ended.shown.length, ENDED_OFFERS_LIMIT);
  assert.equal(ended.hidden, 3);
  assert.equal(ended.total, 9);
  assert.equal(endedOffersNote(ended), "Pokazujemy 6 najnowszych z 9 zakończonych promocji tego banku.");
  const times = ended.shown.map((r) => r.endDate.getTime());
  assert.deepEqual(times, [...times].sort((a, b) => b - a));
});

test("endedOfferHref: a link only while the offer page is indexable (robotsForStatus), plain text afterwards", () => {
  const recent = row("recent", "EXPIRED", "2026-09-01"); // 39 days ago
  const edge = row("edge", "EXPIRED", "2026-07-12"); // exactly 90 days ago
  const old = row("old", "EXPIRED", "2026-07-11"); // 91 days ago
  const activeStale = row("stale", "ACTIVE", "2026-09-30");
  assert.equal(endedOfferHref(recent, NOW), "/promocje/recent");
  assert.equal(endedOfferHref(edge, NOW), "/promocje/edge");
  assert.equal(endedOfferHref(old, NOW), null);
  assert.equal(endedOfferHref(activeStale, NOW), "/promocje/stale");
  for (const r of [recent, edge, old, activeStale, row("arch", "ARCHIVED", "2026-09-01")]) {
    assert.equal(endedOfferHref(r, NOW) !== null, robotsForStatus(r.status, r.endDate, NOW).index, r.slug);
  }
});

test("accountTypeLabel: the site's labels, nothing for an unknown type", () => {
  assert.equal(accountTypeLabel("PERSONAL"), "Konto osobiste");
  assert.equal(accountTypeLabel("BUSINESS"), "Konto firmowe");
  assert.equal(accountTypeLabel("YOUNG"), "Konto dla młodych");
  assert.equal(accountTypeLabel("???"), null);
});

/* ------------------------------------------------------------------ */
/* Text helpers                                                        */
/* ------------------------------------------------------------------ */

test("bankDescriptionParagraphs: only a non-blank Bank.description produces text", () => {
  assert.deepEqual(bankDescriptionParagraphs(null), []);
  assert.deepEqual(bankDescriptionParagraphs(undefined), []);
  assert.deepEqual(bankDescriptionParagraphs(""), []);
  assert.deepEqual(bankDescriptionParagraphs("  \n\n \t "), []);
  assert.deepEqual(bankDescriptionParagraphs("Jedno zdanie."), ["Jedno zdanie."]);
  assert.deepEqual(bankDescriptionParagraphs("Pierwszy akapit\nw dwóch liniach.\n\nDrugi akapit."), [
    "Pierwszy akapit w dwóch liniach.",
    "Drugi akapit."
  ]);
});

test("activeCountText: Polish plural of 'aktualna promocja', 'Brak aktualnych promocji' for none", () => {
  assert.equal(activeCountText(0), "Brak aktualnych promocji");
  assert.equal(activeCountText(1), "1 aktualna promocja");
  assert.equal(activeCountText(2), "2 aktualne promocje");
  assert.equal(activeCountText(4), "4 aktualne promocje");
  assert.equal(activeCountText(5), "5 aktualnych promocji");
  assert.equal(activeCountText(12), "12 aktualnych promocji");
  assert.equal(activeCountText(22), "22 aktualne promocje");
});

test("sortBanks: alphabetical with Polish collation, case-insensitive, a copy", () => {
  const input = [{ name: "Żubr Bank" }, { name: "zeta" }, { name: "Łoś Bank" }, { name: "Alior" }, { name: "bank Pekao" }];
  const sorted = sortBanks(input);
  assert.deepEqual(sorted.map((b) => b.name), ["Alior", "bank Pekao", "Łoś Bank", "zeta", "Żubr Bank"]);
  assert.equal(input[0]!.name, "Żubr Bank", "input untouched");
});

test("bankIndexLead: counts go through the plural rule", () => {
  assert.match(bankIndexLead(1), /1 bank\./);
  assert.match(bankIndexLead(2), /2 banki\./);
  assert.match(bankIndexLead(5), /5 banków\./);
  assert.match(bankIndexLead(0), /Na razie nie mamy banków/);
});

test("bankFaq: computed from the current offers; nothing for a bank without them", () => {
  assert.deepEqual(bankFaq("Bank Testowy", []), []);

  const faq = bankFaq("Bank Testowy", [
    { accountType: "PERSONAL", maxBonusCents: 80_000, endDate: day("2026-10-13") },
    { accountType: "PERSONAL", maxBonusCents: 50_000, endDate: day("2026-12-31") },
    { accountType: "BUSINESS", maxBonusCents: 400_000, endDate: day("2026-10-31") }
  ]);
  assert.equal(faq.length, 2);
  assert.equal(faq[0]!.question, "Jakie promocje Bank Testowy są teraz dostępne?");
  assert.equal(
    faq[0]!.answer,
    "W serwisie mamy teraz 3 aktualne promocje Bank Testowy, w tym 2 dla osób fizycznych i 1 dla firm. Najwyższa premia w tych ofertach to do 4000 zł. Warunki, terminy i opłaty różnią się między ofertami, dlatego sprawdź każdą z nich."
  );
  assert.equal(faq[1]!.question, "Do kiedy można skorzystać z promocji Bank Testowy?");
  assert.match(faq[1]!.answer, /^Najbliższy termin zapisów mija 13\.10\.2026, a najdalszy 31\.12\.2026\. Bank może zakończyć promocję wcześniej/);
});

test("bankFaq: one offer, one deadline, no bonus - plain forms, no invented amount", () => {
  const [available, until] = bankFaq("Bank Testowy", [{ accountType: "BUSINESS", maxBonusCents: 0, endDate: day("2026-11-30") }]);
  assert.equal(
    available!.answer,
    "W serwisie mamy teraz 1 aktualną promocję Bank Testowy (dla firm). Warunki, terminy i opłaty różnią się między ofertami, dlatego sprawdź każdą z nich."
  );
  assert.doesNotMatch(available!.answer, /premia|0 zł/);
  assert.match(until!.answer, /^Termin zapisów mija 30\.11\.2026\./);
});

/* ------------------------------------------------------------------ */
/* Render: /banki/[slug]                                               */
/* ------------------------------------------------------------------ */

const renderBank = (over: { bank?: BankRecord; cards?: PromotionCardData[]; offers?: BankOfferRow[] } = {}) =>
  renderToStaticMarkup(
    h(BankPage, { bank: over.bank ?? BANK, cards: over.cards ?? [], offers: over.offers ?? [], now: NOW })
  );

test("bank page with current offers: H1, logo, strip above the cards, cards, FAQ, no partner link", () => {
  const cards = [card(1), card(2, { accountType: "BUSINESS", maxBonusCents: 400_000 })];
  const out = renderBank({ cards, offers: [row("oferta-1", "ACTIVE", "2099-06-30"), row("oferta-2", "ACTIVE", "2099-06-30")] });

  assert.equal((out.match(/<h1[ >]/g) ?? []).length, 1);
  assert.match(out, new RegExp(`<h1[^>]*>${bankHeading("Bank Testowy")}</h1>`));
  assert.match(text(out), /Bank Testowy: 2 aktualne promocje\./);
  assert.match(text(out), /Aktualne promocje \(2\)/);
  assert.match(stripTag(out), /data-disclosure-sort="recommended"/);
  assert.ok(out.indexOf('data-disclosure="strip"') < out.indexOf('data-card="promotion"'));
  assert.equal((out.match(/data-card="promotion"/g) ?? []).length, 2);
  assert.doesNotMatch(out, /\/out\//);
  assert.doesNotMatch(out, /data-empty-state/);
  assert.doesNotMatch(text(out), /Zakończone promocje banku/, "nothing ended: no empty section");
  assert.equal((out.match(/<details /g) ?? []).length, 2, "two data-based questions");
  assert.match(text(out), /Najczęstsze pytania o promocje: Bank Testowy/);
  assert.match(out, /data-trust-note="scope"/);
});

test("bank page: Bank.description is shown only when it is not blank, and as text", () => {
  const none = renderBank({ cards: [card(1)] });
  assert.doesNotMatch(none, /max-w-2xl space-y-3/, "no description block for null");
  for (const blank of ["", "   ", "\n\n"]) {
    assert.doesNotMatch(renderBank({ bank: { ...BANK, description: blank }, cards: [card(1)] }), /max-w-2xl space-y-3/, JSON.stringify(blank));
  }

  const out = renderBank({ bank: { ...BANK, description: "Bank działa w Polsce.\n\nDrugi <b>akapit</b> & więcej." }, cards: [card(1)] });
  assert.match(out, /<p>Bank działa w Polsce\.<\/p>/);
  assert.match(out, /<p>Drugi &lt;b&gt;akapit&lt;\/b&gt; &amp; więcej\.<\/p>/, "escaped, never HTML");
});

test("bank page: JSON-LD is BreadcrumbList (Start / Banki / bank) + ItemList of the current offers + FAQPage", () => {
  const out = renderBank({ cards: [card(1), card(2)], offers: [row("oferta-1", "ACTIVE", "2099-06-30")] });
  const nodes = jsonLd(out);
  const crumbs = byType(nodes, "BreadcrumbList") as { itemListElement: { name: string; item: string; position: number }[] };
  assert.deepEqual(
    crumbs.itemListElement.map((e) => [e.position, e.name, e.item]),
    [
      [1, "Start", `${SITE}/`],
      [2, "Banki", `${SITE}/banki`],
      [3, "Bank Testowy", `${SITE}/banki/testowy`]
    ]
  );
  const list = byType(nodes, "ItemList") as { itemListElement: { url: string; name: string }[] };
  assert.deepEqual(list.itemListElement.map((e) => e.url), [`${SITE}/promocje/oferta-1`, `${SITE}/promocje/oferta-2`]);
  assert.equal(list.itemListElement[0]!.name, promotionHeading({ name: "Oferta numer 1", bankName: "Bank Testowy" }));
  const faq = byType(nodes, "FAQPage") as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
  const visible = text(out);
  for (const q of faq.mainEntity) {
    assert.ok(visible.includes(q.name));
    assert.ok(visible.includes(q.acceptedAnswer.text));
  }
  assert.ok(!nodes.some((n) => /Review|AggregateRating/.test(JSON.stringify(n))));
});

test("bank page after the offers ended: 'Brak aktualnych promocji' + the ended offers, links only to indexable ones", () => {
  const offers = [
    row("niedawno", "EXPIRED", "2026-09-01", { name: "Niedawna promocja" }),
    row("dawno", "EXPIRED", "2026-03-01", { name: "Dawna promocja", accountType: "BUSINESS" }),
    row("wycofana", "ARCHIVED", "2026-09-01", { name: "Wycofana promocja" })
  ];
  const out = renderBank({ cards: [], offers });
  const visible = text(out);

  assert.match(out, /data-empty-state="true"/);
  assert.match(visible, /Brak aktualnych promocji/);
  assert.match(visible, /Bank Testowy: brak aktualnych promocji\. Poniżej znajdziesz zakończone promocje tego banku\./);
  assert.doesNotMatch(out, /data-disclosure="strip"/, "no offers to list, no strip");
  assert.doesNotMatch(out, /data-card="promotion"/);
  assert.match(visible, /Zakończone promocje banku/);

  assert.match(out, /<a [^>]*href="\/promocje\/niedawno"[^>]*>Niedawna promocja<\/a>/);
  assert.doesNotMatch(out, /href="\/promocje\/dawno"/, "older than 90 days: no link to a noindex page");
  assert.match(out, /<span[^>]*>Dawna promocja<\/span>/);
  assert.doesNotMatch(visible, /Wycofana promocja/, "retired offers are not listed");
  assert.match(visible, /Niedawna promocja Konto osobiste · Zakończona 01\.09\.2026/);
  assert.match(visible, /Dawna promocja Konto firmowe · Zakończona 01\.03\.2026/);
  assert.match(out, /<time dateTime="2026-09-01">01\.09\.2026<\/time>/);

  const nodes = jsonLd(out);
  assert.ok(byType(nodes, "BreadcrumbList"));
  assert.equal(byType(nodes, "ItemList"), undefined);
  assert.equal(byType(nodes, "FAQPage"), undefined, "no data, no FAQ");
  assert.equal((out.match(/<details /g) ?? []).length, 0);
});

test("bank page with a long history: six newest ended offers and an honest note", () => {
  const offers = Array.from({ length: 8 }, (_, i) => row(`s${i}`, "EXPIRED", `2026-0${i + 1}-10`, { name: `Edycja ${i + 1}` }));
  const out = renderBank({ cards: [card(1)], offers });
  assert.equal((out.match(/Edycja \d/g) ?? []).length, 6);
  assert.match(text(out), /Pokazujemy 6 najnowszych z 8 zakończonych promocji tego banku\./);
  assert.ok(text(out).indexOf("Edycja 8") < text(out).indexOf("Edycja 3"), "newest first");
});

test("bank page with nothing at all (no current, no ended): still a normal page that points elsewhere", () => {
  const out = renderBank({ cards: [], offers: [row("x", "ARCHIVED", "2026-01-01")] });
  assert.match(text(out), /Bank Testowy: brak aktualnych promocji\. Sprawdź promocje innych banków\./);
  assert.match(out, /href="\/promocje"/);
  assert.match(out, /href="\/banki"/);
  assert.doesNotMatch(text(out), /Zakończone promocje banku/);
});

test("bank page: unique ids, no forbidden patterns, no new tabs", () => {
  const out = renderBank({
    cards: [card(1)],
    offers: [row("a", "EXPIRED", "2026-09-01"), row("b", "EXPIRED", "2026-03-01")]
  });
  const ids = [...out.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!);
  assert.equal(new Set(ids).size, ids.length);
  assert.doesNotMatch(out, /text-ink-300|text-\[1[01]px\]|border-ink-100|break-all|animate-ping|bg-ink-solid|h-13\b|target="_blank"/);
});

/* ------------------------------------------------------------------ */
/* Render: /banki                                                      */
/* ------------------------------------------------------------------ */

const INDEX: BankIndexRow[] = [
  { slug: "alior", name: "Alior Bank", logoUrl: null, activeCount: 4 },
  { slug: "nest", name: "Nest! BANK", logoUrl: null, activeCount: 0 },
  { slug: "pko", name: "PKO Bank Polski", logoUrl: "https://img.example.pl/pko.png", activeCount: 1 }
];

test("/banki: banks in the given (alphabetical) order, each with its count and a link to its permanent page", () => {
  const out = renderToStaticMarkup(h(BankIndexPage, { banks: INDEX }));
  assert.equal((out.match(/<h1[ >]/g) ?? []).length, 1);
  assert.match(out, /<h1[^>]*>Banki z promocjami<\/h1>/);
  assert.match(text(out), /Banki, których promocje analizujemy: 3 banki\./);

  const links = [...out.matchAll(/href="(\/banki\/[a-z0-9-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(links, ["/banki/alior", "/banki/nest", "/banki/pko"]);
  const visible = text(out);
  assert.match(visible, /Alior Bank 4 aktualne promocje/);
  assert.match(visible, /Nest! BANK Brak aktualnych promocji/);
  assert.match(visible, /PKO Bank Polski 1 aktualna promocja/);
  assert.match(out, /<span aria-hidden="true"><span [^>]*>/, "the logo is hidden from assistive technology (the name is text)");
  assert.doesNotMatch(out, /\/out\//);
  assert.doesNotMatch(out, /data-disclosure/, "a list of banks, not offers: no strip, no compact");
  assert.match(out, /data-trust-note="scope"/);
});

test("/banki: BreadcrumbList + ItemList of the bank pages + FAQPage; the FAQ is on the page", () => {
  const out = renderToStaticMarkup(h(BankIndexPage, { banks: INDEX }));
  const nodes = jsonLd(out);
  const crumbs = byType(nodes, "BreadcrumbList") as { itemListElement: { name: string; item: string }[] };
  assert.deepEqual(crumbs.itemListElement.map((e) => [e.name, e.item]), [
    ["Start", `${SITE}/`],
    ["Banki", `${SITE}/banki`]
  ]);
  const list = byType(nodes, "ItemList") as { numberOfItems: number; itemListElement: { url: string; name: string }[] };
  assert.equal(list.numberOfItems, 3);
  assert.deepEqual(list.itemListElement.map((e) => e.url), [`${SITE}/banki/alior`, `${SITE}/banki/nest`, `${SITE}/banki/pko`]);
  const faq = byType(nodes, "FAQPage") as { mainEntity: { name: string }[] };
  assert.deepEqual(faq.mainEntity.map((q) => q.name), BANK_INDEX_FAQ.map((q) => q.question));
  for (const item of BANK_INDEX_FAQ) assert.ok(text(out).includes(item.answer));
});

test("/banki: a longer list is not cut at ten in the ItemList; an empty list is an honest page", () => {
  const many: BankIndexRow[] = Array.from({ length: 14 }, (_, i) => ({ slug: `b${i}`, name: `Bank ${i}`, logoUrl: null, activeCount: i }));
  const list = byType(jsonLd(renderToStaticMarkup(h(BankIndexPage, { banks: many }))), "ItemList") as { numberOfItems: number };
  assert.equal(list.numberOfItems, 14);

  const empty = renderToStaticMarkup(h(BankIndexPage, { banks: [] }));
  assert.match(text(empty), /Na razie nie mamy banków z promocjami do pokazania/);
  assert.match(text(empty), /Nie mamy teraz banków z promocjami do pokazania/);
  assert.equal(byType(jsonLd(empty), "ItemList"), undefined);
  assert.ok(byType(jsonLd(empty), "FAQPage"), "the text and the FAQ stay");
});

test("/banki: editorial text 150-500 words, general statements only (no digits, no bank names), scope honest", () => {
  const words = countWords(BANK_INDEX_SECTIONS);
  assert.ok(words >= 100 && words <= 500, `${words} words`);
  for (const piece of [...BANK_INDEX_SECTIONS.flatMap((s) => s.paragraphs), ...BANK_INDEX_FAQ.flatMap((f) => [f.question, f.answer])]) {
    assert.doesNotMatch(piece, /\d/, piece.slice(0, 50));
    assert.doesNotMatch(piece, /alior|pko|pekao|mbank|millennium|revolut|nest|erste|velobank|unicredit|bnp|agricole|pocztowy/i, piece.slice(0, 50));
  }
  assert.match(BANK_INDEX_SECTIONS.map((s) => s.paragraphs.join(" ")).join(" "), /Nie obejmujemy całego rynku/);
  assert.match(BANK_INDEX_SECTIONS.map((s) => s.paragraphs.join(" ")).join(" "), /nie jest ranking/);
  for (const link of BANK_INDEX_RELATED) assert.ok(link.href.startsWith("/") && !link.href.includes("?"), link.href);
});
