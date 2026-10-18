// /promocje filters: URL <-> state rules (whitelists, canonical query), chips, the
// debounce bookkeeping (fake timers) and a server render of the toolbar with
// Next's router contexts. Behaviour in a real browser (typing, arrow keys, the
// bottom sheet, focus return) is verified with Playwright, see the WP-09 report.
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext, SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import {
  DEFAULT_SORT,
  MAX_PAGE,
  PAGE_SIZE,
  SORT_OPTIONS,
  SORT_VALUES,
  buildChips,
  clearChips,
  describeResultCount,
  effectiveSort,
  focusAfterChipRemoval,
  hasActiveFilters,
  isCanonicalListing,
  listingHref,
  panelFilterCount,
  parseListingParams,
  parsePage,
  segmentOf,
  toQueryString,
  toServiceFilters,
  withSelectedBank,
  type ListingState
} from "../src/components/filters/filterParams";
import { Segment } from "../src/components/ui/Segment";
import { LISTING_FAQ } from "../src/components/promocje/editorialContent";
import { createCommitter } from "../src/components/filters/committer";
import { FilterFields } from "../src/components/filters/FilterFields";
import { Filters } from "../src/components/Filters";
import {
  applyAccountType,
  relaxationCandidates,
  remainingText,
  segmentCounts,
  slicePage
} from "../src/components/promocje/listing";
import { SORT_RECOMMENDED_LABEL } from "../src/lib/disclosureCopy";

// Source files use the classic JSX transform under tsx: they need React in scope.
(globalThis as { React?: unknown }).React = React;

const h = React.createElement;
/** What a reader sees: tags removed, whitespace collapsed. */
const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const EMPTY: ListingState = parseListingParams({});
const NBSP = " ";
/** "500 zł" as the app prints it: a non-breaking space before "zł". */
const zl = (amount: number | string) => `${amount}${NBSP}zł`;

/* ------------------------------------------------------------------ */
/* parseListingParams: whitelist                                       */
/* ------------------------------------------------------------------ */

test("empty URL = empty state, default sort in force", () => {
  assert.deepEqual(parseListingParams({}), {
    q: "",
    bank: "",
    accountType: "",
    difficulty: [],
    minBonus: null,
    noFees: false,
    sort: ""
  });
  assert.equal(effectiveSort(EMPTY), DEFAULT_SORT);
  assert.equal(DEFAULT_SORT, "recommended");
  assert.equal(hasActiveFilters(EMPTY), false);
});

test("unknown accountType / difficulty / sort are ignored (they used to end in a 500)", () => {
  const state = parseListingParams({ accountType: "HACKED", difficulty: "IMPOSSIBLE,EASY,;DROP", sort: "random" });
  assert.equal(state.accountType, "");
  assert.deepEqual(state.difficulty, ["EASY"]);
  assert.equal(state.sort, "");
});

test("every old value still works: all sorts, all account types, comma list of difficulties", () => {
  for (const sort of ["recommended", "top-rated", "highest-bonus", "easiest", "newest", "ending-soon"]) {
    assert.equal(parseListingParams({ sort }).sort, sort);
  }
  for (const accountType of ["PERSONAL", "BUSINESS", "SAVINGS", "YOUNG", "JOINT"]) {
    assert.equal(parseListingParams({ accountType }).accountType, accountType);
  }
  // canonical order, duplicates collapsed, whatever order the link had
  assert.deepEqual(parseListingParams({ difficulty: "HARD,EASY,HARD,VERY_EASY" }).difficulty, [
    "VERY_EASY",
    "EASY",
    "HARD"
  ]);
});

test("minBonus: positive whole grosze only", () => {
  assert.equal(parseListingParams({ minBonus: "50000" }).minBonus, 50000);
  for (const bad of ["0", "-5", "abc", "1.5", "1e6", "", "99999999999999"]) {
    assert.equal(parseListingParams({ minBonus: bad }).minBonus, null, bad);
  }
});

test("noFees is on only for '1'; q is trimmed, collapsed and capped; bank must look like a slug", () => {
  assert.equal(parseListingParams({ noFees: "1" }).noFees, true);
  assert.equal(parseListingParams({ noFees: "true" }).noFees, false);
  assert.equal(parseListingParams({ q: "  m   bank \n" }).q, "m bank");
  assert.equal(parseListingParams({ q: "x".repeat(300) }).q.length, 100);
  assert.equal(parseListingParams({ bank: "pko-bp" }).bank, "pko-bp");
  assert.equal(parseListingParams({ bank: "../etc/passwd" }).bank, "");
  assert.equal(parseListingParams({ bank: "a b" }).bank, "");
});

test("a repeated parameter (array) uses its first value; URLSearchParams works like the page's record", () => {
  assert.equal(parseListingParams({ sort: ["newest", "easiest"] }).sort, "newest");
  const fromUrl = parseListingParams(new URLSearchParams("accountType=BUSINESS&difficulty=EASY%2CHARD&q=mbank"));
  assert.equal(fromUrl.accountType, "BUSINESS");
  assert.deepEqual(fromUrl.difficulty, ["EASY", "HARD"]);
  assert.equal(fromUrl.q, "mbank");
});

test("parsePage: 1 for junk, capped at MAX_PAGE", () => {
  assert.equal(parsePage({}), 1);
  assert.equal(parsePage({ strona: "abc" }), 1);
  assert.equal(parsePage({ strona: "0" }), 1);
  assert.equal(parsePage({ strona: "-3" }), 1);
  assert.equal(parsePage({ strona: "3" }), 3);
  assert.equal(parsePage({ strona: "9999" }), MAX_PAGE);
});

/* ------------------------------------------------------------------ */
/* canonical query string                                              */
/* ------------------------------------------------------------------ */

test("query string: stable order, default sort omitted, comma not escaped, page adds strona", () => {
  const state = parseListingParams({
    sort: "recommended",
    noFees: "1",
    difficulty: "HARD,EASY",
    accountType: "BUSINESS",
    q: "mbank",
    bank: "mbank",
    minBonus: "50000"
  });
  assert.equal(
    toQueryString(state),
    "q=mbank&bank=mbank&accountType=BUSINESS&difficulty=EASY,HARD&minBonus=50000&noFees=1"
  );
  assert.equal(toQueryString({ ...state, sort: "newest" }).endsWith("&sort=newest"), true);
  assert.equal(toQueryString(EMPTY), "");
  assert.equal(toQueryString(EMPTY, 2), "strona=2");
  assert.equal(toQueryString(EMPTY, 9999), `strona=${MAX_PAGE}`);
  assert.equal(listingHref(EMPTY), "/promocje");
  assert.equal(listingHref({ ...EMPTY, sort: "top-rated" }, 2), "/promocje?sort=top-rated&strona=2");
  assert.equal(listingHref({ ...EMPTY, q: "a&b=c" }), "/promocje?q=a%26b%3Dc");
});

test("a state survives a trip through the URL", () => {
  const state: ListingState = {
    q: "konto firmowe",
    bank: "pko-bp",
    accountType: "BUSINESS",
    difficulty: ["EASY", "MEDIUM"],
    minBonus: 100000,
    noFees: true,
    sort: "highest-bonus"
  };
  assert.deepEqual(parseListingParams(new URLSearchParams(toQueryString(state))), state);
});

/* ------------------------------------------------------------------ */
/* chips                                                               */
/* ------------------------------------------------------------------ */

const BANKS = [
  { slug: "pko-bp", name: "PKO Bank Polski" },
  { slug: "mbank", name: "mBank" }
];

test("chips: one per active filter, in a fixed order, with a spoken name and what removing does", () => {
  const state = parseListingParams({
    q: "karta",
    bank: "pko-bp",
    difficulty: "EASY,HARD",
    minBonus: "50000",
    noFees: "1",
    accountType: "BUSINESS"
  });
  const chips = buildChips(state, BANKS);
  assert.deepEqual(
    chips.map((chip) => chip.label),
    ["Fraza: „karta”", "Bank: PKO Bank Polski", "Trudność: Łatwa", "Trudność: Trudna", `Premia od ${zl(500)}`, "Bez opłaty za konto"]
  );
  assert.equal(chips[0]?.removeLabel, "Usuń filtr: Fraza: „karta”");
  // removing one difficulty keeps the other
  assert.deepEqual(chips[2]?.clear, { difficulty: ["HARD"] });
  assert.deepEqual(chips[3]?.clear, { difficulty: ["EASY"] });
  // the Osobiste / Firmowe segment is its own control, not a chip
  assert.ok(!chips.some((chip) => chip.id === "accountType"));
  // "Filtry (n)" counts what lives in the sheet: bank, 2 difficulties, minBonus, noFees (not q)
  assert.equal(panelFilterCount(chips), 5);
});

test("chips: an account type the segment cannot show (old link) is a chip; an unknown bank shows its slug", () => {
  const chips = buildChips(parseListingParams({ accountType: "SAVINGS", bank: "nieznany-bank" }), BANKS);
  assert.deepEqual(
    chips.map((chip) => chip.label),
    ["Typ konta: Konto oszczędnościowe", "Bank: nieznany-bank"]
  );
});

test("clearChips removes every chip but keeps the segment and the sort", () => {
  const state = parseListingParams({ q: "x", bank: "mbank", difficulty: "EASY", accountType: "PERSONAL", sort: "newest", noFees: "1" });
  const cleared = clearChips(state);
  assert.equal(hasActiveFilters(cleared), true, "the segment is still a narrowing choice");
  assert.equal(cleared.accountType, "PERSONAL");
  assert.equal(cleared.sort, "newest");
  assert.deepEqual({ ...cleared, accountType: "" }, { ...EMPTY, sort: "newest" });
  // an old-link account type has no segment: it goes
  assert.equal(clearChips(parseListingParams({ accountType: "YOUNG" })).accountType, "");
});

/* ------------------------------------------------------------------ */
/* state -> service filters                                            */
/* ------------------------------------------------------------------ */

test("toServiceFilters maps to the service's names; noFees means a confirmed 0 zl fee; omit leaves a filter out", () => {
  const state = parseListingParams({ q: "mbank", bank: "mbank", accountType: "BUSINESS", difficulty: "EASY", minBonus: "20000", noFees: "1", sort: "easiest" });
  assert.deepEqual(toServiceFilters(state), {
    q: "mbank",
    bankSlug: "mbank",
    accountType: "BUSINESS",
    difficulty: ["EASY"],
    minBonusCents: 20000,
    maxAccountFeeCents: 0,
    sort: "easiest"
  });
  assert.deepEqual(toServiceFilters(EMPTY), {});
  const noType = toServiceFilters(state, ["accountType"]);
  assert.equal("accountType" in noType, false);
  assert.equal(noType.bankSlug, "mbank");
});

/* ------------------------------------------------------------------ */
/* sort options                                                        */
/* ------------------------------------------------------------------ */

test("the sort select offers every SortKey once; 'Polecane' carries the disclosure label", () => {
  assert.deepEqual([...SORT_OPTIONS.map((o) => o.value)].sort(), [...SORT_VALUES].sort());
  assert.equal(new Set(SORT_OPTIONS.map((o) => o.value)).size, SORT_OPTIONS.length);
  const recommended = SORT_OPTIONS.find((o) => o.value === "recommended");
  assert.equal(recommended?.label, SORT_RECOMMENDED_LABEL);
  assert.equal(SORT_RECOMMENDED_LABEL, "Polecane");
});

/* ------------------------------------------------------------------ */
/* counter                                                             */
/* ------------------------------------------------------------------ */

test("result counter: Polish plural forms, 'Pokazujemy N z M', empty", () => {
  assert.equal(describeResultCount(1), "1 aktualna promocja");
  assert.equal(describeResultCount(2), "2 aktualne promocje");
  assert.equal(describeResultCount(4), "4 aktualne promocje");
  assert.equal(describeResultCount(5), "5 aktualnych promocji");
  assert.equal(describeResultCount(12), "12 aktualnych promocji");
  assert.equal(describeResultCount(22), "22 aktualne promocje");
  assert.equal(describeResultCount(23), "23 aktualne promocje");
  assert.equal(describeResultCount(35, 24), "Pokazujemy 24 z 35 aktualnych promocji");
  assert.equal(describeResultCount(24, 24), "24 aktualne promocje");
  assert.equal(describeResultCount(0), "Brak promocji spełniających wybrane kryteria");
});

/* ------------------------------------------------------------------ */
/* listing helpers                                                     */
/* ------------------------------------------------------------------ */

test("slicePage: 'Pokaż więcej' is cumulative and says what is left", () => {
  const cards = Array.from({ length: 60 }, (_, i) => i);
  assert.equal(PAGE_SIZE, 24);
  const first = slicePage(cards, 1);
  assert.equal(first.visible.length, 24);
  assert.equal(first.remaining, 36);
  assert.equal(first.nextPage, 2);
  const second = slicePage(cards, 2);
  assert.equal(second.visible.length, 48);
  assert.deepEqual(second.visible.slice(0, 24), first.visible, "page 2 still shows the first 24");
  const last = slicePage(cards, 3);
  assert.equal(last.visible.length, 60);
  assert.equal(last.nextPage, null);
  assert.equal(slicePage(cards, 0).visible.length, 24);
  assert.equal(slicePage([], 1).nextPage, null);
  // 23 offers fit on one page: no "Pokaż więcej" at all
  assert.equal(slicePage(cards.slice(0, 23), 1).nextPage, null);
});

test("remainingText declines verb and noun", () => {
  assert.equal(remainingText(1), "Została jeszcze 1 promocja");
  assert.equal(remainingText(3), "Zostały jeszcze 3 promocje");
  assert.equal(remainingText(11), "Zostało jeszcze 11 promocji");
  assert.equal(remainingText(22), "Zostały jeszcze 22 promocje");
});

test("segment counts and the in-memory account type filter agree (Osobiste = every non-business type)", () => {
  const cards = [
    { id: 1, accountType: "PERSONAL" },
    { id: 2, accountType: "BUSINESS" },
    { id: 3, accountType: "PERSONAL" },
    { id: 4, accountType: "SAVINGS" },
    { id: 5, accountType: "YOUNG" },
    { id: 6, accountType: "JOINT" }
  ];
  // Osobiste + Firmowe = Wszystkie: a savings, youth or joint account is on the Osobiste tab, not on no tab.
  const counts = segmentCounts(cards);
  assert.deepEqual(counts, { all: 6, PERSONAL: 5, BUSINESS: 1 });
  assert.equal(counts.PERSONAL + counts.BUSINESS, counts.all);
  assert.deepEqual(applyAccountType(cards, "PERSONAL").map((c) => c.id), [1, 3, 4, 5, 6], "order of the rest is untouched");
  assert.equal(applyAccountType(cards, "").length, 6);
  assert.equal(applyAccountType(cards, "BUSINESS").length, counts.BUSINESS);
  assert.equal(applyAccountType(cards, "PERSONAL").length, counts.PERSONAL, "the tab lists as many as its counter says");
  // An old link with one type narrows to exactly that type.
  assert.deepEqual(applyAccountType(cards, "YOUNG").map((c) => c.id), [5]);
  assert.deepEqual(applyAccountType(cards, "SAVINGS").map((c) => c.id), [4]);
});

test("the Osobiste tab needs no chip, an old single type does (and clearing keeps the tab)", () => {
  assert.ok(!buildChips(parseListingParams({ accountType: "PERSONAL" }), BANKS).some((chip) => chip.id === "accountType"));
  const young = buildChips(parseListingParams({ accountType: "YOUNG" }), BANKS).find((chip) => chip.id === "accountType");
  assert.equal(young?.label, "Typ konta: Konto dla młodych");
  assert.equal(segmentOf(parseListingParams({ accountType: "PERSONAL" })), "PERSONAL");
  assert.equal(segmentOf(parseListingParams({ accountType: "YOUNG" })), "");
});

test("relaxation candidates: one per active filter, the sort is not one", () => {
  const state = parseListingParams({ q: "x", accountType: "BUSINESS", bank: "mbank", difficulty: "EASY,HARD", minBonus: "50000", noFees: "1", sort: "newest" });
  const out = relaxationCandidates(state, BANKS);
  assert.deepEqual(out.map((c) => c.label), [
    "Fraza: „x”",
    "Typ konta: Konto firmowe",
    "Bank: mBank",
    "Trudność: Łatwa, Trudna",
    `Premia od ${zl(500)}`,
    "Bez opłaty za konto"
  ]);
  assert.deepEqual(out[3]?.patch, { difficulty: [] });
  assert.deepEqual(relaxationCandidates(EMPTY), []);
});

/* ------------------------------------------------------------------ */
/* committer (debounce + echo of the URL)                              */
/* ------------------------------------------------------------------ */

test("committer: typing is committed once, after the pause", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const committed: string[] = [];
    const committer = createCommitter<string>("", () => ({ commit: (v: string) => committed.push(v), delay: 350 }));
    committer.set("m");
    mock.timers.tick(200);
    committer.set("mb");
    mock.timers.tick(200);
    committer.set("mbank");
    assert.deepEqual(committed, [], "nothing written while the user is still typing");
    mock.timers.tick(349);
    assert.deepEqual(committed, []);
    mock.timers.tick(1);
    assert.deepEqual(committed, ["mbank"]);
  } finally {
    mock.timers.reset();
  }
});

test("committer: immediate commit (Enter) and delay 0 skip the wait and cancel a pending one", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const committed: string[] = [];
    const committer = createCommitter<string>("", () => ({ commit: (v: string) => committed.push(v), delay: 350 }));
    committer.set("mban");
    committer.set("mbank", true);
    assert.deepEqual(committed, ["mbank"]);
    mock.timers.tick(1000);
    assert.deepEqual(committed, ["mbank"], "the earlier pending commit was cancelled");

    const instant = createCommitter<string>("", () => ({ commit: (v: string) => committed.push(v), delay: 0 }));
    instant.set("x");
    assert.deepEqual(committed, ["mbank", "x"]);
  } finally {
    mock.timers.reset();
  }
});

test("committer: the URL's echo of our own commit is ignored, a slow answer cannot overwrite newer typing", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const committer = createCommitter<string>("", () => ({ commit: () => {}, delay: 100 }));
    committer.set("a");
    mock.timers.tick(100); // commit "a" (URL not updated yet)
    committer.set("ab");
    mock.timers.tick(100); // commit "ab"
    committer.set("abc"); // user keeps typing (draft "abc", not committed yet)
    assert.equal(committer.sync("a"), null, "echo of the first commit: draft stays 'abc'");
    assert.equal(committer.sync("ab"), null, "echo of the second commit: draft stays 'abc'");
  } finally {
    mock.timers.reset();
  }
});

test("committer: a change from outside (chip removed, Back button) is followed and drops the pending commit", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const committed: string[] = [];
    const committer = createCommitter<string>("mbank", () => ({ commit: (v: string) => committed.push(v), delay: 100 }));
    committer.set("mbankk"); // pending
    assert.deepEqual(committer.sync(""), { follow: "" });
    mock.timers.tick(500);
    assert.deepEqual(committed, [], "the stale commit never fires");
    // and the same value again is not news
    assert.equal(committer.sync(""), null);
  } finally {
    mock.timers.reset();
  }
});

test("committer: equality can ignore surrounding spaces (the search box)", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const norm = (v: string) => v.replace(/\s+/g, " ").trim();
    const equals = (a: string, b: string) => norm(a) === norm(b);
    const committer = createCommitter<string>("", () => ({ commit: () => {}, delay: 10, equals }));
    committer.set("mbank "); // the user typed a trailing space
    mock.timers.tick(10);
    assert.equal(committer.sync("mbank"), null, "the URL's trimmed echo does not eat the space");
  } finally {
    mock.timers.reset();
  }
});

test("committer: dispose cancels the pending commit and stays usable (StrictMode remount)", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const committed: string[] = [];
    const committer = createCommitter<string>("", () => ({ commit: (v: string) => committed.push(v), delay: 50 }));
    committer.set("a");
    committer.dispose();
    mock.timers.tick(100);
    assert.deepEqual(committed, []);
    committer.set("b");
    mock.timers.tick(50);
    assert.deepEqual(committed, ["b"]);
  } finally {
    mock.timers.reset();
  }
});

/* ------------------------------------------------------------------ */
/* server render: fields and toolbar                                   */
/* ------------------------------------------------------------------ */

const noop = () => {};

test("FilterFields: every control has a visible label; difficulty is a fieldset of toggle buttons", () => {
  const state = parseListingParams({ difficulty: "EASY", minBonus: "50000", noFees: "1", bank: "mbank" });
  const out = renderToStaticMarkup(h(FilterFields, { idPrefix: "t", banks: BANKS, state, onChange: noop }));

  assert.match(out, /<fieldset>\s*<legend[^>]*>Poziom trudności<\/legend>/);
  // toggle buttons: aria-pressed, 44 px target, the chosen one has a check mark
  assert.match(out, /aria-pressed="true"[^>]*>(?:<svg[^>]*>.*?<\/svg>)?Łatwa<\/button>/);
  assert.match(out, /aria-pressed="false"[^>]*>Trudna<\/button>/);
  assert.equal((out.match(/min-h-11/g) ?? []).length >= 4, true);

  // select-name / label rule: <label for=id> for the two selects and the checkbox
  for (const id of ["t-bank", "t-min-bonus", "t-no-fees"]) {
    assert.match(out, new RegExp(`<label[^>]*for="${id}"`), `label for ${id}`);
    assert.match(out, new RegExp(`id="${id}"`), `control ${id}`);
  }
  assert.match(out, /<option value="">Wszystkie banki<\/option>/);
  assert.match(out, /<option value="">Dowolna<\/option>/);
  assert.match(out, new RegExp(`<option value="50000" selected="">od 500 zł<\/option>`));
  // the "only without fee" checkbox: 20 px accent checkbox, checked, described
  assert.match(out, /<input id="t-no-fees" type="checkbox" aria-describedby="t-no-fees-hint" class="checkbox checkbox-sm[^"]*" checked=""/);
  assert.match(text(out), /Tylko bez opłaty za prowadzenie konta/);
});

test("FilterFields: a bank or minBonus from an old link that is not in the lists is still selectable (no silent reset)", () => {
  const state = parseListingParams({ bank: "stary-bank", minBonus: "75000" });
  const out = renderToStaticMarkup(h(FilterFields, { idPrefix: "t", banks: BANKS, state, onChange: noop }));
  assert.match(out, /<option value="stary-bank" selected="">stary-bank<\/option>/);
  assert.match(out, new RegExp(`<option value="75000" selected="">od ${zl(750)}<\/option>`));
});

function renderToolbar(search: string, props: Partial<React.ComponentProps<typeof Filters>> = {}) {
  const router = { push: noop, replace: noop, refresh: noop, back: noop, forward: noop, prefetch: noop };
  return renderToStaticMarkup(
    h(
      AppRouterContext.Provider,
      { value: router as never },
      h(
        PathnameContext.Provider,
        { value: "/promocje" },
        h(
          SearchParamsContext.Provider,
          { value: new URLSearchParams(search) },
          h(Filters, { banks: BANKS, resultCount: 23, shownCount: 23, segmentCounts: { all: 23, PERSONAL: 16, BUSINESS: 7 }, ...props }, h("p", { id: "results" }, "wyniki"))
        )
      )
    )
  );
}

test("toolbar: segment with counts, labelled search and sort, status counter, the results inside a busy-aware wrapper", () => {
  const out = renderToolbar("");
  assert.match(out, /role="radiogroup"[^>]*aria-label="Typ konta"/);
  assert.match(text(out), /Wszystkie \(23\).*Osobiste \(16\).*Firmowe \(7\)/);
  assert.match(out, /<label[^>]*for="([^"]+)"[^>]*>Szukaj banku lub oferty<\/label>\s*<input id="\1"[^>]*type="search"/);
  assert.match(out, /<label[^>]*for="([^"]+)"[^>]*>Sortuj<\/label>\s*<select id="\1"/);
  // the default sort is selected and every option is offered
  assert.match(out, new RegExp(`<option value="recommended" selected="">${SORT_RECOMMENDED_LABEL.replace(/[()]/g, "\\$&")}</option>`));
  for (const value of SORT_VALUES) assert.match(out, new RegExp(`<option value="${value}"`));
  // live counter + busy wrapper
  assert.match(out, /<p role="status" aria-live="polite" aria-atomic="true"[^>]*>.*23 aktualne promocje/);
  assert.match(out, /class="pending-fade" aria-busy="false"><p id="results">wyniki<\/p>/);
  assert.match(out, /role="search"/);
});

test("toolbar: chips with a spoken remove button, 'Wyczyść filtry', and 'Filtry (n)' for the sheet", () => {
  const out = renderToolbar("q=karta&difficulty=EASY,HARD&noFees=1&accountType=BUSINESS", { resultCount: 4, shownCount: 4 });
  assert.match(out, /aria-label="Aktywne filtry"/);
  assert.match(out, /<button[^>]*aria-label="Usuń filtr: Trudność: Łatwa"/);
  assert.match(out, /<button[^>]*aria-label="Usuń filtr: Fraza: „karta”"/);
  assert.match(text(out), /Wyczyść filtry/);
  // 3 filters live in the sheet: two difficulties and noFees (the phrase and the segment do not count)
  assert.match(text(out), /Filtry \(3\)/);
  assert.match(text(out), /4 aktualne promocje/);
  // the segment shows the account type of the URL
  assert.match(out, /role="radio"[^>]*aria-checked="true"[^>]*>Firmowe/);
  // the search box shows the phrase
  assert.match(out, /type="search"[^>]*value="karta"/);
});

test("toolbar: no filters = no chips and no 'Wyczyść'; the sheet is a labelled <dialog>", () => {
  const out = renderToolbar("");
  assert.doesNotMatch(out, /Aktywne filtry/);
  assert.doesNotMatch(out, /Wyczyść filtry/);
  assert.match(out, /<dialog[^>]*aria-labelledby="([^"]+)"/);
  assert.match(out, /aria-label="Zamknij filtry"/);
  assert.match(text(out), /Pokaż 23 wyniki/);
});

test("toolbar: empty list and a partial page are counted honestly", () => {
  assert.match(text(renderToolbar("q=zzz", { resultCount: 0, shownCount: 0 })), /Brak promocji spełniających wybrane kryteria/);
  assert.match(text(renderToolbar("", { resultCount: 35, shownCount: 24 })), /Pokazujemy 24 z 35 aktualnych promocji/);
  assert.match(text(renderToolbar("", { resultCount: 1, shownCount: 1 })), /1 aktualna promocja/);
});

test("toolbar without counts still renders (no counter, generic sheet button)", () => {
  const out = renderToolbar("", { resultCount: undefined, shownCount: undefined, segmentCounts: undefined });
  assert.doesNotMatch(out, /role="status"/);
  assert.match(text(out), /Pokaż wyniki/);
  assert.match(text(out), /Wszystkie.*Osobiste.*Firmowe/);
});

/* ------------------------------------------------------------------ */
/* WP-LIST review fixes                                                */
/* ------------------------------------------------------------------ */

const LIST_PAGE_SOURCE = readFileSync(join(__dirname, "..", "src", "app", "promocje", "(lista)", "page.tsx"), "utf8");

test("withSelectedBank adds the bank of the URL when it has no offers, keeps the list sorted, never duplicates", () => {
  const pekao = { slug: "pekao", name: "Bank Pekao" };
  const out = withSelectedBank(BANKS, pekao);
  assert.deepEqual(out.map((b) => b.slug), ["pekao", "mbank", "pko-bp"], "sorted by name: Bank Pekao, mBank, PKO Bank Polski");
  assert.equal(out.length, BANKS.length + 1);
  // already listed / nothing selected: the list is returned as it is (a copy)
  assert.deepEqual(withSelectedBank(BANKS, { slug: "mbank", name: "mBank" }), BANKS);
  assert.deepEqual(withSelectedBank(BANKS, null), BANKS);
  assert.deepEqual(withSelectedBank(BANKS, undefined), BANKS);
  assert.notEqual(withSelectedBank(BANKS, null), BANKS, "never the same array");
  // Polish collation: "Ł" sorts after "L", before "M"
  const polish = withSelectedBank([{ slug: "a", name: "Mega Bank" }, { slug: "z", name: "Lokata Bank" }], { slug: "l", name: "Łódzki Bank" });
  assert.deepEqual(polish.map((b) => b.name), ["Lokata Bank", "Łódzki Bank", "Mega Bank"]);
});

test("a bank without offers shows its NAME (chip, select option, relaxation hint), not the slug", () => {
  const banks = withSelectedBank(BANKS, { slug: "pekao", name: "Bank Pekao" });
  const state = parseListingParams({ bank: "pekao" });
  assert.deepEqual(buildChips(state, banks).map((c) => c.label), ["Bank: Bank Pekao"]);
  assert.equal(relaxationCandidates(state, banks)[0]?.label, "Bank: Bank Pekao");
  const fields = renderToStaticMarkup(h(FilterFields, { idPrefix: "t", banks, state, onChange: noop }));
  assert.match(fields, /<option value="pekao" selected="">Bank Pekao<\/option>/);
  assert.doesNotMatch(fields, />pekao</, "no raw slug as visible text");
  const toolbar = renderToolbar("bank=pekao", { banks });
  assert.match(text(toolbar), /Bank: Bank Pekao/);
  assert.doesNotMatch(text(toolbar), /Bank: pekao/);
});

test("focusAfterChipRemoval: next chip, else the previous one, else the result counter", () => {
  const ids = ["q", "bank", "difficulty:EASY", "noFees"];
  assert.deepEqual(focusAfterChipRemoval(ids, "q"), { kind: "chip", id: "bank" });
  assert.deepEqual(focusAfterChipRemoval(ids, "bank"), { kind: "chip", id: "difficulty:EASY" });
  assert.deepEqual(focusAfterChipRemoval(ids, "noFees"), { kind: "chip", id: "difficulty:EASY" }, "the last chip hands focus back");
  // the only chip: the whole block goes away -> the counter
  assert.deepEqual(focusAfterChipRemoval(["bank"], "bank"), { kind: "status" });
  assert.deepEqual(focusAfterChipRemoval([], "bank"), { kind: "status" });
  // an id that is not there (stale click): first remaining chip, never a crash
  assert.deepEqual(focusAfterChipRemoval(["q", "bank"], "zzz"), { kind: "chip", id: "q" });
  // the target always names a chip that is still there after the removal
  for (const removed of ids) {
    const target = focusAfterChipRemoval(ids, removed);
    assert.equal(target.kind, "chip");
    if (target.kind === "chip") assert.ok(ids.includes(target.id) && target.id !== removed);
  }
});

test("toolbar: chips are findable for the focus move; the counter is focusable; no side panel at any width", () => {
  const out = renderToolbar("q=karta&difficulty=EASY&noFees=1", { resultCount: 4, shownCount: 4 });
  assert.match(out, /<button[^>]*data-chip-id="q"/);
  assert.match(out, /<button[^>]*data-chip-id="difficulty:EASY"/);
  assert.match(out, /<p role="status" aria-live="polite" aria-atomic="true" tabindex="-1"/);
  // filters live in the bar + sheet only (layout spec): no permanent panel, the button is not hidden from xl
  assert.doesNotMatch(out, /aria-label="Filtry ofert"/);
  assert.doesNotMatch(out, /xl:(grid|hidden|block|sticky)/);
  assert.match(out, /aria-haspopup="dialog"/);
});

test("sheet: 'Wyczyść' stays focusable (aria-disabled, not disabled) so the focus is not dropped to <body>", () => {
  const none = renderToolbar("q=karta"); // only the phrase: nothing lives in the sheet
  assert.match(none, /<button[^>]*aria-disabled="true"[^>]*>Wyczyść<\/button>/);
  assert.doesNotMatch(none, /<button[^>]*disabled=""[^>]*>Wyczyść<\/button>/);
  const some = renderToolbar("noFees=1");
  assert.doesNotMatch(some, /<button[^>]*aria-disabled="true"[^>]*>Wyczyść<\/button>/);
});

test("page: the strip is not rendered by the page from the server sort any more (it would disagree with the optimistic description)", () => {
  assert.doesNotMatch(LIST_PAGE_SOURCE, /<AffiliateDisclosure/);
  assert.match(LIST_PAGE_SOURCE, /<Filters[\s\S]*?disclosureStrip/);
});

test("ItemList only for the canonical list: no filter, default order, first page", () => {
  assert.equal(isCanonicalListing(EMPTY, 1), true);
  assert.equal(isCanonicalListing(parseListingParams({ sort: "recommended" }), 1), true, "sort=recommended is the default order");
  assert.equal(isCanonicalListing(parseListingParams({ utm_source: "x", gclid: "y" }), 1), true, "tracking parameters are not state");
  assert.equal(isCanonicalListing(EMPTY, 2), false);
  assert.equal(isCanonicalListing(parseListingParams({ sort: "newest" }), 1), false);
  assert.equal(isCanonicalListing(parseListingParams({ sort: "top-rated" }), 1), false);
  assert.equal(isCanonicalListing(parseListingParams({ q: "mbank" }), 1), false);
  assert.equal(isCanonicalListing(parseListingParams({ accountType: "BUSINESS" }), 1), false);
  assert.equal(isCanonicalListing(parseListingParams({ bank: "mbank" }), 1), false);
  assert.equal(isCanonicalListing(parseListingParams({ noFees: "1" }), 1), false);
  // the page also asks the SEO library, so anything it noindexes (niedostepna, sort=bogus) is out
  assert.match(LIST_PAGE_SOURCE, /isCanonicalListing\(state, page\) && !noindexForSearchParams\(params\)/);
  assert.doesNotMatch(LIST_PAGE_SOURCE, /commission|affiliateUrl/i, "the ItemList carries names and paths only");
});

test("Segment size sm: 36 px pill with a 44 px hit area; md stays 44 px; the list uses the compact one", () => {
  const options = [
    { value: "", label: "Wszystkie", count: 23 },
    { value: "PERSONAL", label: "Osobiste", count: 14 }
  ];
  const sm = renderToStaticMarkup(h(Segment, { label: "Typ konta", options, value: "", onChange: noop, size: "sm" }));
  assert.match(sm, /h-9/);
  assert.match(sm, /before:-inset-y-\[4px\]/);
  assert.doesNotMatch(sm, /h-11/);
  const md = renderToStaticMarkup(h(Segment, { label: "Typ konta", options, value: "", onChange: noop }));
  assert.match(md, /h-11/);
  assert.doesNotMatch(md, /h-9/);
  assert.match(renderToolbar(""), /<span class="[^"]*h-9[^"]*"><button[^>]*role="radio"/);
});

test("listing FAQ promises nothing the data does not back (no requires-referral flag, no payout date field)", () => {
  const all = LISTING_FAQ.map((item) => item.answer).join(" ");
  assert.doesNotMatch(all, /zaznaczamy to w warunkach/);
  assert.doesNotMatch(all, /podajemy go przy ofercie/);
  assert.match(all, /Termin wypłaty określa regulamin promocji/);
  assert.match(all, /Sprawdź w regulaminie banku i w warunkach oferty, czy konto trzeba otworzyć przez link lub kod/);
});
