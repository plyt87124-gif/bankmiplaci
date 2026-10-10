// Comparison page: pure selection/best-value/fee logic and a server render of the table.
// Browser behaviour (sticky header and column, scroll inside the region, 320 px without
// page scroll) is verified with Playwright against the dev server, see the WP-12 report.
import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  COMPARE_MAX,
  bestFlags,
  cellDisclosureText,
  compareUrl,
  cooldownLines,
  describeFee,
  feeRank,
  parseSegment,
  parseSlugList,
  resolveSelection,
  segmentOf
} from "../src/app/porownaj/compareModel";
import { selectionSummary } from "../src/app/porownaj/CompareControls";
import { CompareTable, type CompareColumn } from "../src/app/porownaj/CompareTable";
import { buildCompareHref } from "../src/lib/quiz";
import { COMPACT } from "../src/lib/disclosureCopy";
import { cooldownRule, cooldownShort } from "../src/components/promocja/offerModel";
import type { PromotionCardData } from "../src/lib/services/promotionCards";

// Source files use the classic JSX transform under tsx: they need React in scope.
(globalThis as { React?: unknown }).React = React;

/** What a reader sees: tags removed, whitespace collapsed. */
const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

function card(slug: string, overrides: Partial<PromotionCardData> = {}): PromotionCardData {
  return {
    slug,
    name: `Oferta ${slug}`,
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
    bank: { name: `Bank ${slug}`, slug: `bank-${slug}`, logoUrl: null },
    ...overrides
  };
}

const EXTRAS_ON = { cooldownMonths: null, cooldownCutoffDate: null, affiliateLinkEnabled: true };

/* ---------------- selection ---------------- */

test("parseSegment accepts only the two known values", () => {
  assert.equal(parseSegment("PERSONAL"), "PERSONAL");
  assert.equal(parseSegment("BUSINESS"), "BUSINESS");
  assert.equal(parseSegment("business"), undefined);
  assert.equal(parseSegment(undefined), undefined);
  assert.equal(parseSegment(["BUSINESS", "PERSONAL"]), "BUSINESS");
});

test("segmentOf: only BUSINESS is firmowe", () => {
  assert.equal(segmentOf("BUSINESS"), "BUSINESS");
  for (const type of ["PERSONAL", "SAVINGS", "YOUNG", "JOINT"]) assert.equal(segmentOf(type), "PERSONAL");
});

test("parseSlugList trims, drops empties and duplicates, keeps the order", () => {
  assert.deepEqual(parseSlugList(" a, b ,,a,c "), ["a", "b", "c"]);
  assert.deepEqual(parseSlugList(["a,b", "c"]), ["a", "b", "c"]);
  assert.deepEqual(parseSlugList(undefined), []);
});

const POOL = [
  card("p1"),
  card("p2"),
  card("b1", { accountType: "BUSINESS" }),
  card("p3"),
  card("p4"),
  card("p5"),
  card("b2", { accountType: "BUSINESS" })
];

test("default selection: the first 4 of the personal segment (the list is in rating order)", () => {
  const sel = resolveSelection(POOL, {});
  assert.equal(sel.segment, "PERSONAL");
  assert.equal(COMPARE_MAX, 4);
  assert.deepEqual(sel.selected.map((c) => c.slug), ["p1", "p2", "p3", "p4"]);
  assert.equal(sel.isDefault, true);
  assert.deepEqual(sel.pool.map((c) => c.slug), ["p1", "p2", "p3", "p4", "p5"]);
});

test("typ=BUSINESS switches the segment and its default", () => {
  const sel = resolveSelection(POOL, { typ: "BUSINESS" });
  assert.equal(sel.segment, "BUSINESS");
  assert.deepEqual(sel.selected.map((c) => c.slug), ["b1", "b2"]);
});

test("oferty= selects those offers, in table order, at most 4, ignoring unknown or foreign slugs", () => {
  const sel = resolveSelection(POOL, { oferty: "p5,p1,nie-ma,b1,p3" });
  assert.deepEqual(sel.selected.map((c) => c.slug), ["p1", "p3", "p5"]);
  assert.equal(sel.isDefault, false);

  const many = resolveSelection(POOL, { oferty: "p5,p4,p3,p2,p1" });
  assert.equal(many.selected.length, 4);
  assert.deepEqual(many.selected.map((c) => c.slug), ["p2", "p3", "p4", "p5"], "the first four requested, shown in table order");
});

test("without typ, the segment of the first valid requested offer decides (quiz link for business offers)", () => {
  const sel = resolveSelection(POOL, { oferty: "b2,b1" });
  assert.equal(sel.segment, "BUSINESS");
  assert.deepEqual(sel.selected.map((c) => c.slug), ["b1", "b2"]);
  // An explicit typ wins; offers of the other segment are dropped and the default is used.
  const forced = resolveSelection(POOL, { typ: "PERSONAL", oferty: "b2,b1" });
  assert.equal(forced.segment, "PERSONAL");
  assert.equal(forced.isDefault, true);
  assert.equal(forced.selected.length, 4);
});

test("an empty or junk oferty= falls back to the default instead of an empty table", () => {
  assert.equal(resolveSelection(POOL, { oferty: "" }).isDefault, true);
  assert.equal(resolveSelection(POOL, { oferty: "x,y" }).selected.length, 4);
  assert.deepEqual(resolveSelection([], {}).selected, []);
});

test("compareUrl and the quiz link agree on the parameters", () => {
  assert.equal(compareUrl("PERSONAL", null), "/porownaj");
  assert.equal(compareUrl("BUSINESS", null), "/porownaj?typ=BUSINESS");
  assert.equal(compareUrl("PERSONAL", ["a", "b"]), "/porownaj?oferty=a,b");
  assert.equal(compareUrl("BUSINESS", ["a"]), "/porownaj?typ=BUSINESS&oferty=a");
  assert.equal(compareUrl("BUSINESS", ["a", "b"]), buildCompareHref(["a", "b"], "business"));
  assert.equal(compareUrl("PERSONAL", ["a", "b"]), buildCompareHref(["a", "b"], "personal"));
});

/* ---------------- best value ---------------- */

test("bestFlags marks the best value, ties included, and nothing when there is no real winner", () => {
  assert.deepEqual(bestFlags([800, 500, 800], "max"), [true, false, true]);
  assert.deepEqual(bestFlags([2, 1, 3], "min"), [false, true, false]);
  assert.deepEqual(bestFlags([5, 5, 5], "max"), [false, false, false], "all equal");
  assert.deepEqual(bestFlags([5, null, null], "max"), [false, false, false], "a single known value");
  assert.deepEqual(bestFlags([null, 3, 7], "min"), [false, true, false], "unknown is never best");
  assert.deepEqual(bestFlags([], "max"), []);
});

/* ---------------- fees ---------------- */

test("describeFee: unknown is never free; 0 zł with a waiver condition is contradictory = unknown", () => {
  assert.deepEqual(describeFee(null), { kind: "unknown" });
  assert.deepEqual(describeFee(undefined, "x"), { kind: "unknown" });
  assert.deepEqual(describeFee(0, "wpływ min. 1000 zł"), { kind: "unknown" });
  assert.deepEqual(describeFee(0), { kind: "free" });
  assert.deepEqual(describeFee(0, "  "), { kind: "free" });
  assert.deepEqual(describeFee(600), { kind: "paid", cents: 600 });
  assert.deepEqual(describeFee(600, " 300 zł płatności "), { kind: "conditional", cents: 600, condition: "300 zł płatności" });
});

test("only a verified unconditional 0 zł wins the fee row", () => {
  assert.equal(feeRank(describeFee(0)), 0);
  assert.equal(feeRank(describeFee(600)), 1);
  assert.equal(feeRank(describeFee(600, "warunek")), 1);
  assert.equal(feeRank(describeFee(null)), null);
});

/* ---------------- karencja ---------------- */

test("cooldownLines uses the offer page's wording (cooldownShort): months, the cutoff date, both, or nothing", () => {
  assert.deepEqual(cooldownLines(24, null), [cooldownShort({ months: 24, cutoff: null })]);
  assert.match(cooldownLines(24, null)[0]!, /24/);
  const cutoff = new Date("2024-08-01T00:00:00Z");
  assert.deepEqual(cooldownLines(null, cutoff), [cooldownShort({ months: null, cutoff })]);
  assert.match(cooldownLines(null, cutoff)[0]!, /01\.08\.2024/);
  assert.deepEqual(cooldownLines(36, "2022-01-01T00:00:00Z"), [
    cooldownShort({ months: 36, cutoff: null }),
    cooldownShort({ months: null, cutoff: cooldownRule({ cooldownCutoffDate: "2022-01-01T00:00:00Z" })!.cutoff })
  ]);
  assert.deepEqual(cooldownLines(null, null), [], "no data: the cell says 'Brak danych', never 'no karencja'");
  assert.deepEqual(cooldownLines(undefined, undefined), []);
  assert.deepEqual(cooldownLines(null, "nie-data"), [], "an unreadable date is no data");
});

test("cooldownLines: 0 months is 'Bez karencji' like on the offer page, not 'Brak danych'", () => {
  assert.deepEqual(cooldownLines(0, null), [cooldownShort({ months: 0, cutoff: null })]);
  assert.match(cooldownLines(0, null)[0]!, /Bez karencji/);
});

test("cellDisclosureText: the compact disclosure without its 'Link partnerski:' lead and without the link", () => {
  const text = cellDisclosureText();
  assert.ok(COMPACT.lead.toLowerCase().endsWith(text.slice(1).toLowerCase()), "same words as disclosureCopy");
  assert.doesNotMatch(text, /^Link partnerski/i);
  assert.doesNotMatch(text, new RegExp(COMPACT.linkLabel));
  assert.match(text, /^[A-ZŁŚŻŹĆŃÓĘĄ]/, "starts a sentence");
  // A lead without the prefix is kept as it is.
  assert.equal(cellDisclosureText("Możemy dostać prowizję."), "Możemy dostać prowizję.");
});

/* ---------------- the table ---------------- */

function render(columns: CompareColumn[]): string {
  return renderToStaticMarkup(<CompareTable columns={columns} />);
}

const columns: CompareColumn[] = [
  {
    card: card("a", {
      maxBonusCents: 80_000,
      rating: 9.4,
      fees: { accountFeeCents: 0, accountFeeWaiverCondition: null, cardFeeCents: 1000, cardFeeWaiverCondition: "5 płatności kartą w miesiącu" }
    }),
    extras: { ...EXTRAS_ON, cooldownMonths: 24 }
  },
  {
    card: card("b", {
      maxBonusCents: 50_000,
      rating: 9.4,
      difficulty: "HARD",
      fees: null
    }),
    extras: { ...EXTRAS_ON, affiliateLinkEnabled: false }
  },
  {
    card: card("c", { maxBonusCents: 0, rating: 7, endDate: new Date("2026-10-12T00:00:00Z") }),
    extras: undefined
  }
];

test("table is accessible: caption, scoped headers, focusable named region, sr-only text in the empty corner header", () => {
  const html = render(columns);
  assert.match(html, /<caption class="sr-only">/);
  assert.match(html, /role="region"[^>]*tabindex="0"|tabindex="0"[^>]*role="region"/);
  assert.match(html, /aria-label="Tabela porównania 3 ofert, przewijana poziomo"/);
  // 1 corner + 3 offers in the header row, scope="col"; one scope="row" per body row (8 + actions).
  assert.equal((html.match(/<th scope="col"/g) ?? []).length, 4);
  assert.equal((html.match(/<th scope="row"/g) ?? []).length, 9);
  assert.match(html, /<th scope="col"[^>]*><span class="sr-only">Kryterium<\/span><\/th>/);
  assert.doesNotMatch(html, /<th[^>]*>\s*<\/th>/, "no empty header cells");
});

test("rows follow the order of a decision", () => {
  const html = render(columns);
  const labels = [...html.matchAll(/<th scope="row"[^>]*>([^<]*)<\/th>/g)].map((m) => m[1]);
  assert.deepEqual(labels, [
    "Premia",
    "Termin",
    "Trudność",
    "Opłata za konto",
    "Opłata za kartę",
    "Dla nowych klientów",
    "Ocena serwisu",
    "Weryfikacja",
    "Działania"
  ]);
});

test("no link opens a new tab; offer links only in the column header and the actions row", () => {
  const html = render(columns);
  assert.doesNotMatch(html, /target="_blank"/);
  const detailLinks = [...html.matchAll(/<a [^>]*href="\/promocje\/([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(detailLinks.sort(), ["a", "a", "b", "b", "c", "c"], "header + actions, once each");
});

test("the CTA goes through /out with rel=sponsored, the badge above and a short disclosure (no link) under it", () => {
  const html = render(columns);
  const out = [...html.matchAll(/<a [^>]*href="(\/out\/[^"]+)"[^>]*>/g)];
  assert.equal(out.length, 1, "only the offer with an enabled partner link has a CTA");
  assert.equal(out[0]![1], "/out/a?src=compare-table");
  assert.match(out[0]![0], /rel="sponsored nofollow noopener noreferrer"/);
  assert.match(out[0]![0], /target="_self"/);
  // One short disclosure per button; its "Jak zarabiamy" link is NOT repeated in every cell
  // (the single full compact disclosure with the link is under the table, in page.tsx).
  assert.equal((html.match(/data-disclosure="compact"/g) ?? []).length, 1);
  assert.ok(html.indexOf("data-disclosure=\"compact\"") > html.indexOf("/out/a?src=compare-table"), "disclosure sits under the button");
  assert.ok(html.indexOf("Link partnerski") < html.indexOf("/out/a?src=compare-table"), "badge above the button");
  assert.match(text(html), new RegExp(cellDisclosureText()));
  assert.doesNotMatch(html, /href="\/jak-zarabiamy/, "no link in the cells");
  // Offers without a live link or without extras get no CTA and no disclosure.
  assert.doesNotMatch(html, /\/out\/b|\/out\/c/);
});

test("best values: bold + check mark + words for screen readers, no coloured background", () => {
  const html = render(columns);
  // Bonus "do 800 zł" is the best (a vs b vs 0).
  assert.match(html, /font-bold"><span>do\s800\szł<\/span>.*?najlepsza wartość w wierszu/s);
  // Rating 9,4 ties between a and b: both marked, c (7,0) is not.
  const ratingBest = html.match(/9,4\/10<\/span>[^]*?najlepsza wartość w wierszu/g) ?? [];
  assert.equal(ratingBest.length >= 2, true);
  assert.equal((html.match(/najlepsza wartość w wierszu/g) ?? []).length, 1 /* bonus: a */ + 2 /* effort: a and c tie */ + 0 /* account fee: a and c both free, b unknown */ + 1 /* card fee: only c is free */ + 2 /* rating: a and b tie */);
  assert.doesNotMatch(html, /bg-teal-100|bg-success-100|bg-gold-100/, "no coloured fill for the best value");
});

test("unknown values say 'Brak danych', never 0 zł; a waivable fee shows the asterisk and the condition", () => {
  const html = render(columns);
  const t = text(html);
  assert.match(t, /Brak danych/);
  // b has no Fees row: both fee cells are unknown.
  const bColumn = render([columns[1]!]);
  assert.equal((text(bColumn).match(/Brak danych/g) ?? []).length >= 3, true, "account fee, card fee, karencja");
  assert.doesNotMatch(text(bColumn), /(^|\D)0 zł/);
  // a: card fee 10 zł* with its waiver condition under the amount.
  assert.match(t, /10 zł\*/);
  assert.match(t, /Zwolnienie: 5 płatności kartą w miesiącu/);
});

test("karencja row prints the structured data and 'Brak danych' otherwise", () => {
  const t = text(render(columns));
  assert.ok(t.includes(cooldownShort({ months: 24, cutoff: null })), "the same words as the offer page");
  assert.match(t, /Brak danych Sprawdź warunki w ofercie\./);
});

test("an offer with no cash bonus is not shown as 0 zł and cannot win the bonus row", () => {
  const t = text(render(columns));
  assert.match(t, /Bez premii gotówkowej/);
});

test("deadline: date with days left; within 14 days a badge with the real number of days", () => {
  const html = render([
    { card: card("far", { endDate: new Date("2099-06-30T00:00:00Z") }), extras: EXTRAS_ON },
    { card: card("near", { endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) }), extras: EXTRAS_ON }
  ]);
  assert.match(text(html), /30\.06\.2099 Do końca: \d+ dni/);
  assert.match(html, /data-deadline="soon"/);
});

test("ratings use a decimal comma and the 'Ocena serwisu' label", () => {
  const t = text(render(columns));
  assert.match(t, /9,4\/10/);
  assert.match(t, /Ocena serwisu/);
  assert.doesNotMatch(t, /9\.4/);
});

test("premia is shown as a maximum: 'do 800 zł', never a bare amount", () => {
  const t = text(render(columns));
  assert.match(t, /do\s800\szł/);
  assert.match(t, /do\s500\szł/);
  assert.doesNotMatch(t, /(^|[^o]\s)800\szł/, "no amount without 'do'");
});

test("karencja cell: 0 months reads 'Bez karencji', no data reads 'Brak danych'", () => {
  const zero = text(render([{ card: card("z"), extras: { ...EXTRAS_ON, cooldownMonths: 0 } }]));
  assert.match(zero, /Bez karencji/);
  const none = text(render([{ card: card("n"), extras: { ...EXTRAS_ON, cooldownMonths: null } }]));
  assert.match(none, /Brak danych Sprawdź warunki w ofercie\./);
  assert.doesNotMatch(none, /Bez karencji/);
});

test("action cell names its bank and offer: caption + aria-labels that start with the visible text", () => {
  const html = render(columns);
  // Visible caption: bank name and offer name (the row sits far below the column headers on a phone).
  assert.match(html, /<p class="[^"]*text-caption[^"]*"><span class="[^"]*font-semibold[^"]*">Bank a<\/span>Oferta a<\/p>/);
  // The order of attributes is not part of the contract: find the tag by its href, then read its aria-label.
  const label = (href: string) => {
    // (/promocje/a is linked twice: the column header has no aria-label, the action cell has.)
    const tag = [...html.matchAll(/<a [^>]*>/g)].map((m) => m[0]).find((t) => t.includes(`href="${href}"`) && t.includes("aria-label="));
    return /aria-label="([^"]+)"/.exec(tag ?? "")?.[1];
  };
  const detail = label("/promocje/a");
  const cta = label("/out/a?src=compare-table");
  assert.equal(detail, "Szczegóły: Bank a – Oferta a");
  assert.equal(cta, "Przejdź do promocji: Bank a – Oferta a");
  // WCAG 2.5.3: the accessible name contains the visible words (the phone shows the shorter 'Do promocji').
  assert.ok(cta!.toLowerCase().includes("do promocji"));
  assert.ok(detail!.startsWith("Szczegóły"));
  // Every offer's "Szczegóły" link has a different name.
  const names = [...html.matchAll(/aria-label="(Szczegóły: [^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(names).size, columns.length);
});

test("phone geometry: label 96 px + two 115 px offer columns fit the 326 px frame of a 360 px screen", () => {
  const html = render(columns);
  assert.match(html, /<col class="w-\[96px\] sm:w-\[152px\]"\/>/);
  assert.match(html, /--cmp-min-m:441px/, "96 px label + 3 x 115 px offers; the columns snap two at a time");
  assert.match(html, /scroll-pl-\[96px\]/);
});

test("no forbidden design patterns in the table markup", () => {
  const html = render(columns);
  assert.doesNotMatch(html, /text-ink-300|border-ink-100|bg-ink-solid|text-\[1[01]px\]|break-all|animate-ping/);
});

/* ---------------- "od 0 zł" and the karencja rule ---------------- */

test("table: a free fee with an 'Inne opłaty' remark reads 'od 0 zł', is not marked best, and says why", () => {
  const free = { accountFeeCents: 0, accountFeeWaiverCondition: null, cardFeeCents: 0, cardFeeWaiverCondition: null };
  const html = render([
    { card: card("x", { fees: { ...free, hasOtherFee: true } }), extras: EXTRAS_ON },
    { card: card("y", { fees: { ...free, accountFeeCents: 1500 } }), extras: EXTRAS_ON }
  ]);
  const t = text(html);
  assert.match(t, /od 0\s?zł/);
  assert.ok(t.includes("Zależnie od warunków"));
  // the remark qualifies the card fee as well (like FeesSection): neither fee row of column "x" is a winner
  const accountRow = html.slice(html.indexOf("Opłata za konto"), html.indexOf("Opłata za kartę"));
  assert.doesNotMatch(accountRow, /sr-only">[^<]*najlepsz/i);
  assert.equal(describeFee(0, null, true).kind, "free");
  assert.equal(feeRank(describeFee(0, null, true)), 1);
  assert.equal(feeRank(describeFee(0, null)), 0);
});

test("table: without the remark a verified 0 zł is still the best value of its row", () => {
  const free = { accountFeeCents: 0, accountFeeWaiverCondition: null, cardFeeCents: 0, cardFeeWaiverCondition: null };
  const html = render([
    { card: card("x", { fees: { ...free, hasOtherFee: false } }), extras: EXTRAS_ON },
    { card: card("y", { fees: { ...free, accountFeeCents: 1500 } }), extras: EXTRAS_ON }
  ]);
  const accountRow = html.slice(html.indexOf("Opłata za konto"), html.indexOf("Opłata za kartę"));
  assert.match(accountRow, /sr-only">[^<]*najlepsz/i);
});

test("cooldownLines follows the offer page's rule for every (months, date) pair", () => {
  const date = "2024-08-01T00:00:00Z";
  const dateLine = "Wymagane: brak konta w tym banku od 01.08.2024";
  // (0, date): the date is a concrete requirement; "Bez karencji" next to it would contradict it
  assert.deepEqual(cooldownLines(0, date), [dateLine]);
  // (12, date): two different checks, both printed
  assert.deepEqual(cooldownLines(12, date), ["Karencja 12 mies. od zamknięcia konta", dateLine]);
  // (0, no date): no waiting time
  assert.deepEqual(cooldownLines(0, null), ["Bez karencji"]);
  // (null, date)
  assert.deepEqual(cooldownLines(null, date), [dateLine]);
  // the summary bar's single line is always the first table line
  for (const [months, cutoff] of [[0, date], [12, date], [0, null], [null, date], [24, null], [null, null]] as const) {
    const rule = cooldownRule({ cooldownMonths: months, cooldownCutoffDate: cutoff });
    const lines = cooldownLines(months, cutoff);
    assert.equal(rule ? cooldownShort(rule) : "Brak danych", lines[0] ?? "Brak danych", `${months} / ${cutoff}`);
    assert.ok(!(lines.includes("Bez karencji") && lines.length > 1), "never 'Bez karencji' together with another line");
  }
});

test("the picker summary counts the chosen offers against the maximum and the available ones", () => {
  assert.equal(selectionSummary(4, COMPARE_MAX, 16), `Wybrano 4 z maks. ${COMPARE_MAX} ofert (dostępnych: 16)`);
  assert.equal(selectionSummary(1, 4, 3), "Wybrano 1 z maks. 4 ofert (dostępnych: 3)");
});
