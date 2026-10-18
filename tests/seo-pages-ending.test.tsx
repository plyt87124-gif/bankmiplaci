// /promocje/konczace-sie: grouping by 7 / 14 / 30 days, the "zostało N dni" caption counted by the SAME
// function as the cards' deadline badge, headings only for non-empty groups, the strip for a non-"Polecane"
// order, the empty state, the editorial text and FAQ, the structured data.
import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EndingSoonPage } from "../src/components/seo-pages/EndingSoonPage";
import {
  ENDING_SOON_EARLY_END_NOTE,
  ENDING_SOON_FAQ,
  ENDING_SOON_GROUPS,
  ENDING_SOON_MAX_DAYS,
  ENDING_SOON_SECTIONS,
  deadlineCaption,
  endingSoonLead,
  endingSoonWordCount,
  groupEndingSoon
} from "../src/components/seo-pages/endingSoon";
import { STRIP_OTHER, STRIP_RECOMMENDED } from "../src/lib/disclosureCopy";
import { deadlineState } from "../src/lib/freshness";
import { daysUntil } from "../src/lib/format";
import { endingSoonHeading, promotionHeading } from "../src/lib/seo";
import type { PromotionCardData } from "../src/lib/services/promotionCards";

(globalThis as { React?: unknown }).React = React;
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.NEXT_PUBLIC_SITE_URL = "https://bankmiplaci.example";
const SITE = "https://bankmiplaci.example";

const h = React.createElement;
// 10 Oct 2026, 11:00 in Warsaw (CEST)
const NOW = new Date("2026-10-10T09:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;
/** Last sign-up day `n` days after today (Warsaw), stored as 00:00 UTC like the database does. */
const inDays = (n: number) => new Date(Date.UTC(2026, 9, 10) + n * DAY_MS);

const text = (markup: string) =>
  markup
    .replace(/<\/(p|div|li|ul|h[1-6]|article|a|summary|details|label|span|section|nav)>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
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

function card(n: number, daysLeft: number, overrides: Partial<PromotionCardData> = {}): PromotionCardData {
  return {
    slug: `oferta-${n}`,
    name: `Oferta numer ${n}`,
    summary: null,
    maxBonusCents: 50_000,
    difficulty: "EASY",
    accountType: "PERSONAL",
    rating: 8,
    ratingReason: null,
    endDate: inDays(daysLeft),
    lastVerifiedAt: new Date("2026-10-06T10:00:00Z"),
    fees: { accountFeeCents: 0, accountFeeWaiverCondition: null, cardFeeCents: 0, cardFeeWaiverCondition: null },
    conditions: [],
    bank: { name: `Bank ${n}`, slug: `bank-${n}`, logoUrl: null },
    ...overrides
  };
}

/* ------------------------------------------------------------------ */
/* Grouping                                                            */
/* ------------------------------------------------------------------ */

test("groups: the plan's thresholds 7 / 14 / 30 days, boundaries belong to the lower group", () => {
  assert.deepEqual(
    ENDING_SOON_GROUPS.map((g) => [g.id, g.from, g.to]),
    [
      ["do-7", 0, 7],
      ["8-14", 8, 14],
      ["15-30", 15, 30]
    ]
  );
  assert.equal(ENDING_SOON_MAX_DAYS, 30);

  const cards = [0, 1, 7, 8, 14, 15, 30].map((d, i) => card(i + 1, d));
  const groups = groupEndingSoon(cards, NOW);
  assert.deepEqual(groups.map((g) => [g.id, g.cards.map((c) => daysUntil(c.endDate, NOW))]), [
    ["do-7", [0, 1, 7]],
    ["8-14", [8, 14]],
    ["15-30", [15, 30]]
  ]);
});

test("groups: offers that are over, farther than 30 days or without a usable date are dropped", () => {
  const cards = [card(1, -1), card(2, 31), card(3, 90), card(4, 5), card(5, 5, { endDate: "garbage" as unknown as Date })];
  const groups = groupEndingSoon(cards, NOW);
  assert.deepEqual(groups.map((g) => g.cards.map((c) => c.slug)), [["oferta-4"]]);
  assert.deepEqual(groupEndingSoon([], NOW), []);
});

test("groups: only non-empty groups are returned (no empty heading), the given order is kept inside a group", () => {
  const groups = groupEndingSoon([card(1, 20), card(2, 3), card(3, 20), card(4, 2)], NOW);
  assert.deepEqual(groups.map((g) => g.id), ["do-7", "15-30"], "no 8-14 group");
  assert.deepEqual(groups[0]!.cards.map((c) => c.slug), ["oferta-2", "oferta-4"]);
  assert.deepEqual(groups[1]!.cards.map((c) => c.slug), ["oferta-1", "oferta-3"]);
});

test("groups: the day is Poland's - 00:30 in Warsaw on the last day is still 'today', not 'yesterday'", () => {
  const lateEvening = new Date("2026-10-09T22:30:00Z"); // 10 Oct, 00:30 in Warsaw
  assert.equal(daysUntil(inDays(0), lateEvening), 0);
  assert.deepEqual(groupEndingSoon([card(1, 0)], lateEvening).map((g) => g.id), ["do-7"]);
  const dstEdge = new Date("2026-10-24T23:30:00Z"); // 25 Oct 2026 01:30 CEST, the night the clocks go back
  assert.equal(daysUntil(new Date(Date.UTC(2026, 9, 25)), dstEdge), 0);
});

/* ------------------------------------------------------------------ */
/* Caption                                                             */
/* ------------------------------------------------------------------ */

test("caption completes the badge instead of repeating it: last day within 14 days, days left beyond", () => {
  const cap = (d: number) => deadlineCaption(inDays(d), NOW);
  // the badge says "Koniec dziś" / "Koniec za N dni" -> the caption gives the date
  assert.equal(cap(0), "Ostatni dzień zapisów: 10.10.2026");
  assert.equal(cap(1), "Ostatni dzień zapisów: 11.10.2026");
  assert.equal(cap(3), "Ostatni dzień zapisów: 13.10.2026");
  assert.equal(cap(14), "Ostatni dzień zapisów: 24.10.2026");
  // the badge says "Ważna do dd.mm.rrrr" -> the caption gives the days, with the right verb and noun
  assert.equal(cap(15), "Zostało 15 dni");
  assert.equal(cap(22), "Zostały 22 dni");
  assert.equal(cap(25), "Zostało 25 dni");
  assert.equal(cap(30), "Zostało 30 dni");
  assert.equal(deadlineCaption(inDays(-3), NOW), "Zakończona 07.10.2026");
  assert.equal(deadlineCaption(null, NOW), null);
  assert.equal(deadlineCaption("garbage", NOW), null);
});

test("caption agrees with the card's deadline badge (freshness.ts) for every day of the page and never repeats it", () => {
  for (let d = 0; d <= ENDING_SOON_MAX_DAYS; d++) {
    const info = deadlineState(inDays(d), NOW);
    assert.equal(info.days, d);
    const caption = deadlineCaption(inDays(d), NOW)!;
    if (info.state === "soon" || info.state === "urgent") {
      // badge: the number of days; caption: the date only
      if (d > 0) assert.match(info.label, new RegExp(`Koniec za ${d} (dzień|dni)`));
      assert.ok(caption.includes(info.dateText!), `${d}: ${caption}`);
      assert.doesNotMatch(caption, /\d+ (dzień|dni)/, `${d}: no days in the caption`);
    } else {
      // badge: the date; caption: the days only
      assert.ok(info.label.includes(info.dateText!));
      assert.ok(caption.includes(` ${d} `), `${d}: ${caption}`);
      assert.ok(!caption.includes(info.dateText!), `${d}: the date is not repeated`);
    }
  }
});

test("lead: the count goes through the plural rule; an empty list says so", () => {
  assert.match(endingSoonLead(1), /kończy się termin zapisów na 1 promocję\./);
  assert.match(endingSoonLead(2), /na 2 promocje\./);
  assert.match(endingSoonLead(5), /na 5 promocji\./);
  assert.match(endingSoonLead(22), /na 22 promocje\./);
  assert.match(endingSoonLead(0), /Obecnie żadna z aktualnych promocji nie kończy się w ciągu 30 dni\./);
});

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */

const render = (cards: PromotionCardData[]) => renderToStaticMarkup(h(EndingSoonPage, { cards, now: NOW }));

test("page: H1 from the SEO library, lead, early-end note, one strip for a non-'Polecane' order above the groups", () => {
  const out = render([card(1, 2), card(2, 3), card(3, 12), card(4, 20)]);
  assert.equal((out.match(/<h1[ >]/g) ?? []).length, 1);
  assert.match(out, new RegExp(`<h1[^>]*>${endingSoonHeading(NOW)}</h1>`));
  assert.match(text(out), /październik 2026/);
  assert.match(text(out), /W ciągu 30 dni kończy się termin zapisów na 4 promocje\./);
  assert.match(text(out), /Bank może zakończyć promocję wcześniej, gdy wyczerpie się pula\./);

  assert.equal((out.match(/data-disclosure="strip"/g) ?? []).length, 1);
  assert.match(stripTag(out), /data-disclosure-sort="other"/, "deadline order: independent of the commission");
  assert.ok(text(out).includes(STRIP_OTHER.lead));
  assert.ok(out.indexOf('data-disclosure="strip"') < out.indexOf("<h2"), "strip above the first group");
  assert.doesNotMatch(out, /\/out\//);
});

test("page: an h2 per non-empty group with its count, cards under it, a caption under every card", () => {
  const out = render([card(1, 2), card(2, 3), card(3, 20)]);
  const visible = text(out);
  assert.match(out, /<h2 id="grupa-do-7">Do 7 dni <span[^>]*>\(2\)<\/span><\/h2>/);
  assert.match(out, /<h2 id="grupa-15-30">15–30 dni <span[^>]*>\(1\)<\/span><\/h2>/);
  assert.doesNotMatch(out, /grupa-8-14/, "no empty group, no empty heading");
  assert.equal((out.match(/data-card="promotion"/g) ?? []).length, 3);
  assert.ok(visible.indexOf("Do 7 dni") < visible.indexOf("15–30 dni"));
  assert.match(visible, /Ostatni dzień zapisów: 12\.10\.2026/);
  assert.match(visible, /Ostatni dzień zapisów: 13\.10\.2026/);
  assert.match(visible, /Zostało 20 dni/);
  assert.doesNotMatch(visible, /Zostały 2 dni|Zostały 3 dni/, "the days under a short-deadline card are the badge's job");
  assert.equal((out.match(/<h3[^>]*>/g) ?? []).length, 3, "cards are h3 under the group h2");
  // the card's own badge says the same number of days
  assert.match(out, /Koniec za 2 dni/);
  assert.match(out, /Koniec za 3 dni/);
});

test("page: the caption sits under its card, so the cards of a row start on one line", () => {
  const out = render([card(1, 5)]);
  assert.ok(out.indexOf('data-card="promotion"') < out.indexOf("Ostatni dzień zapisów"));
  assert.match(out, /<li class="flex min-w-0 flex-col gap-2">/);
});

test("page: structured data - BreadcrumbList (Start / Promocje / ...), ItemList of the listed offers, FAQPage", () => {
  const out = render([card(1, 2), card(2, 9), card(3, 25)]);
  const nodes = jsonLd(out);
  const crumbs = byType(nodes, "BreadcrumbList") as { itemListElement: { name: string; item: string }[] };
  assert.deepEqual(crumbs.itemListElement.map((e) => [e.name, e.item]), [
    ["Start", `${SITE}/`],
    ["Promocje", `${SITE}/promocje`],
    ["Kończące się wkrótce", `${SITE}/promocje/konczace-sie`]
  ]);
  const list = byType(nodes, "ItemList") as { itemListElement: { url: string; name: string }[] };
  assert.deepEqual(list.itemListElement.map((e) => e.url), [1, 2, 3].map((n) => `${SITE}/promocje/oferta-${n}`));
  assert.equal(list.itemListElement[0]!.name, promotionHeading({ name: "Oferta numer 1", bankName: "Bank 1" }));
  const faq = byType(nodes, "FAQPage") as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
  assert.deepEqual(faq.mainEntity.map((q) => q.name), ENDING_SOON_FAQ.map((q) => q.question));
  for (const q of faq.mainEntity) assert.ok(text(out).includes(q.acceptedAnswer.text), q.name);
  assert.ok(!nodes.some((n) => /Review|AggregateRating/.test(JSON.stringify(n))));
});

test("empty list: a message and a link to /promocje, still a full page - text, FAQ, breadcrumbs", () => {
  const out = render([]);
  assert.match(out, /data-empty-state="true"/);
  assert.match(out, /<h2 class="mt-3 text-h4 text-ink-900">Żadna promocja nie kończy się w najbliższym czasie<\/h2>/);
  assert.match(text(out), /Obecnie żadna z aktualnych promocji nie kończy się w ciągu 30 dni\./);
  assert.match(text(out), /termin zapisów mija w ciągu 30 dni/);
  assert.match(out, /href="\/promocje"/);
  assert.doesNotMatch(out, /data-disclosure="strip"/);
  assert.doesNotMatch(out, /data-card="promotion"/);
  assert.doesNotMatch(out, /Bank może zakończyć promocję wcześniej, gdy wyczerpie się pula\./, "that note belongs to a list");
  assert.equal((out.match(/<details /g) ?? []).length, ENDING_SOON_FAQ.length);
  assert.match(text(out), /Jak czytać terminy promocji/);

  const nodes = jsonLd(out);
  assert.ok(byType(nodes, "BreadcrumbList"));
  assert.ok(byType(nodes, "FAQPage"));
  assert.equal(byType(nodes, "ItemList"), undefined);
});

test("page: offers outside 0-30 days never appear, even if the service returned them", () => {
  const out = render([card(1, -2), card(2, 45)]);
  assert.match(out, /data-empty-state/);
  assert.doesNotMatch(out, /data-card="promotion"/);
});

test("page: nothing private reaches the HTML, no forbidden patterns, unique ids", () => {
  const poisoned = { ...card(1, 4), affiliateUrl: "https://secret-partner.example/aff?id=7771234", affiliateCommissionCents: 7771234 };
  const out = render([poisoned as PromotionCardData, card(2, 10)]);
  assert.doesNotMatch(out, /secret-partner|7771234|affiliateUrl|affiliateCommission/i);
  assert.doesNotMatch(out, /text-ink-300|text-\[1[01]px\]|border-ink-100|break-all|animate-ping|bg-ink-solid|h-13\b|target="_blank"/);
  const ids = [...out.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!);
  assert.equal(new Set(ids).size, ids.length);
});

test("page: no urgency copy, no countdown - the facts of the plan only", () => {
  const visible = text(render([card(1, 0), card(2, 1)]));
  assert.doesNotMatch(visible, /ostatnia szansa|ostatnie miejsca|spiesz się|nie przegap|nie zwlekaj|odliczani|tylko dziś|pośpiesz|zaraz zniknie|ostatnia chwila|ostatnią chwilę/i);
});

/* ------------------------------------------------------------------ */
/* Editorial text                                                      */
/* ------------------------------------------------------------------ */

test("editorial: 100-200 words, FAQ of 2-3 questions, no digits or bank names", () => {
  const words = endingSoonWordCount();
  assert.ok(words >= 100 && words <= 200, `${words} words`);
  assert.ok(ENDING_SOON_FAQ.length >= 2 && ENDING_SOON_FAQ.length <= 3);
  for (const piece of [
    ...ENDING_SOON_SECTIONS.flatMap((s) => [s.heading, ...s.paragraphs]),
    ...ENDING_SOON_FAQ.flatMap((f) => [f.question, f.answer])
  ]) {
    assert.doesNotMatch(piece, /\d/, piece.slice(0, 50));
    assert.doesNotMatch(piece, /alior|pko|pekao|mbank|millennium|revolut|nest|erste|velobank|unicredit|bnp|agricole|pocztowy/i, piece.slice(0, 50));
  }
  assert.ok(ENDING_SOON_FAQ.some((f) => /wcześniejsze zakończenie/.test(f.answer)), "early end is explained in the FAQ");
  assert.equal(ENDING_SOON_EARLY_END_NOTE, "Bank może zakończyć promocję wcześniej, gdy wyczerpie się pula.");
});
