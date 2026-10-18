/**
 * URL <-> filter state of the /promocje listing. Pure: no React, no database,
 * so the page (server), the Filters component (client) and the tests all use
 * the SAME rules.
 *
 * What the URL can carry (all of it already worked before the redesign):
 *   q            search text (bank, offer name or summary)
 *   bank         bank slug
 *   accountType  PERSONAL | BUSINESS (| SAVINGS | YOUNG | JOINT from old links).
 *                PERSONAL is the whole "osobiste" segment (every non-business
 *                type), BUSINESS only the business accounts - one definition for
 *                the tabs, their counters, the list and the database filter
 *                (src/lib/accountTypes.ts). SAVINGS / YOUNG / JOINT narrow to
 *                exactly that type.
 *   difficulty   comma list of VERY_EASY, EASY, MEDIUM, HARD
 *   minBonus     minimum bonus in grosze (the UI offers 20000 / 50000 / 100000)
 *   noFees       "1" = only offers with a confirmed 0 zl account fee
 *   sort         recommended | top-rated | highest-bonus | easiest | newest | ending-soon
 *   strona       page number of the "Pokaz wiecej" link (1 = first 24 offers)
 *   niedostepna  "1" (set by /out/[slug]); only read by the page, never written
 *
 * Everything is WHITELISTED: an unknown accountType / difficulty / sort used to
 * reach Prisma as-is and end in a 500; now it is simply ignored.
 */
import type { AccountType, Difficulty } from "@prisma/client";
import type { SortKey } from "@/lib/services/promotions";
import { isAccountSegment } from "@/lib/accountTypes";
import { SORT_RECOMMENDED_LABEL } from "@/lib/disclosureCopy";
import { ACCOUNT_TYPE_LABEL, DIFFICULTY_LABEL, formatPLN, pluralizePl } from "@/lib/format";

/* ------------------------------------------------------------------ */
/* Allowed values                                                      */
/* ------------------------------------------------------------------ */

export const DIFFICULTY_VALUES = ["VERY_EASY", "EASY", "MEDIUM", "HARD"] as const satisfies readonly Difficulty[];
export const ACCOUNT_TYPE_VALUES = [
  "PERSONAL",
  "BUSINESS",
  "SAVINGS",
  "YOUNG",
  "JOINT"
] as const satisfies readonly AccountType[];
export const SORT_VALUES = [
  "recommended",
  "top-rated",
  "highest-bonus",
  "easiest",
  "newest",
  "ending-soon"
] as const satisfies readonly SortKey[];

export type ListingSort = (typeof SORT_VALUES)[number];

/** The order used when `sort` is missing from the URL (the listing's long-standing default). */
export const DEFAULT_SORT: ListingSort = "recommended";

/** The two values the Osobiste / Firmowe segment can set (the segments of src/lib/accountTypes.ts). */
export type SegmentValue = "" | "PERSONAL" | "BUSINESS";

export const SORT_OPTIONS: readonly { value: ListingSort; label: string }[] = [
  { value: "recommended", label: SORT_RECOMMENDED_LABEL },
  { value: "top-rated", label: "Najlepsza ocena" },
  { value: "highest-bonus", label: "Najwyższa premia" },
  { value: "easiest", label: "Najłatwiejsze" },
  { value: "newest", label: "Najnowsze" },
  { value: "ending-soon", label: "Kończące się wkrótce" }
];

/** Choices of the "Minimalna premia" select, in grosze (labels as before the redesign). */
export const MIN_BONUS_OPTIONS: readonly { value: number; label: string }[] = [
  { value: 20000, label: "od 200 zł" },
  { value: 50000, label: "od 500 zł" },
  { value: 100000, label: "od 1000 zł" }
];

/** Page size of the listing and the largest `strona` that is honoured. */
export const PAGE_SIZE = 24;
export const MAX_PAGE = 20;

const MAX_QUERY_LENGTH = 100;
const MAX_BANK_SLUG_LENGTH = 80;
const MAX_MIN_BONUS_CENTS = 100_000_000;

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

export interface ListingState {
  /** Search text, trimmed; "" = none. */
  q: string;
  /** Bank slug; "" = all banks. */
  bank: string;
  /** "" = all account types. */
  accountType: AccountType | "";
  /** Selected difficulties in canonical order; [] = any. */
  difficulty: Difficulty[];
  /** Minimum bonus in grosze; null = any. */
  minBonus: number | null;
  /** Only offers with a confirmed, unconditional 0 zl account fee. */
  noFees: boolean;
  /** Signed-in visitors only: hide offers their karencja / current-client data rules out ("dostepne=1"). */
  eligibleOnly: boolean;
  /** The sort order named in the URL; "" = not named (= DEFAULT_SORT). */
  sort: ListingSort | "";
}

export const EMPTY_STATE: ListingState = {
  q: "",
  bank: "",
  accountType: "",
  difficulty: [],
  minBonus: null,
  noFees: false,
  eligibleOnly: false,
  sort: ""
};

/** Anything with `.get(name)` - URLSearchParams and Next's ReadonlyURLSearchParams. */
export interface ParamReader {
  get(name: string): string | null;
}
export type RawSearchParams = ParamReader | Record<string, string | string[] | undefined>;

function isReader(input: RawSearchParams): input is ParamReader {
  return typeof (input as ParamReader).get === "function";
}

function reader(input: RawSearchParams): (name: string) => string {
  if (isReader(input)) return (name) => input.get(name) ?? "";
  return (name) => {
    const value = input[name];
    const first = Array.isArray(value) ? value[0] : value;
    return typeof first === "string" ? first : "";
  };
}

function oneOf<T extends string>(allowed: readonly T[], value: string): T | null {
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/** Whitelisting parser. Never throws; unknown or malformed values are dropped. */
export function parseListingParams(input: RawSearchParams): ListingState {
  const get = reader(input);

  const q = get("q").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH);
  const bank = /^[a-z0-9][a-z0-9_-]*$/i.test(get("bank").trim()) ? get("bank").trim().slice(0, MAX_BANK_SLUG_LENGTH) : "";
  const accountType = oneOf(ACCOUNT_TYPE_VALUES, get("accountType")) ?? "";

  const requested = new Set(get("difficulty").split(",").map((part) => part.trim()));
  const difficulty = DIFFICULTY_VALUES.filter((value) => requested.has(value));

  const rawMin = get("minBonus").trim();
  const minBonus =
    /^\d{1,9}$/.test(rawMin) && Number(rawMin) > 0 && Number(rawMin) <= MAX_MIN_BONUS_CENTS ? Number(rawMin) : null;

  const sort = oneOf(SORT_VALUES, get("sort")) ?? "";

  return { q, bank, accountType, difficulty: [...difficulty], minBonus, noFees: get("noFees") === "1", eligibleOnly: get("dostepne") === "1", sort };
}

/** Page number from `strona`: 1 when missing or junk, capped at MAX_PAGE. */
export function parsePage(input: RawSearchParams): number {
  const value = Number.parseInt(reader(input)("strona"), 10);
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.min(value, MAX_PAGE);
}

/** The order that is really in force. */
export function effectiveSort(state: Pick<ListingState, "sort">): ListingSort {
  return state.sort || DEFAULT_SORT;
}

/**
 * Query string (no leading "?") for a state, in a stable order. The default
 * sort is left out so the clean URL stays clean; `page` > 1 adds `strona`.
 */
export function toQueryString(state: ListingState, page = 1): string {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.bank) params.set("bank", state.bank);
  if (state.accountType) params.set("accountType", state.accountType);
  if (state.difficulty.length) params.set("difficulty", state.difficulty.join(","));
  if (state.minBonus) params.set("minBonus", String(state.minBonus));
  if (state.noFees) params.set("noFees", "1");
  if (state.eligibleOnly) params.set("dostepne", "1");
  if (state.sort && state.sort !== DEFAULT_SORT) params.set("sort", state.sort);
  if (page > 1) params.set("strona", String(Math.min(Math.trunc(page), MAX_PAGE)));
  // A comma needs no escaping in a query and keeps the long-standing look of
  // the links ("difficulty=EASY,HARD"); both spellings parse the same.
  return params.toString().replace(/%2C/gi, ",");
}

/** `/promocje` plus the query for a state. */
export function listingHref(state: ListingState, page = 1, basePath = "/promocje"): string {
  const qs = toQueryString(state, page);
  return qs ? `${basePath}?${qs}` : basePath;
}

/** True when the state narrows the list in any way (the sort does not count). */
export function hasActiveFilters(state: ListingState): boolean {
  return Boolean(
    state.q || state.bank || state.accountType || state.difficulty.length || state.minBonus || state.noFees || state.eligibleOnly
  );
}

/**
 * The live counter above the list (role=status): "23 aktualne promocje",
 * "Pokazujemy 24 z 35 aktualnych promocji", "Brak promocji spełniających
 * wybrane kryteria". `shown` < `total` only while "Pokaż więcej" has more.
 */
export function describeResultCount(total: number, shown?: number): string {
  if (total === 0) return "Brak promocji spełniających wybrane kryteria";
  const noun = pluralizePl(total, "aktualna promocja", "aktualne promocje", "aktualnych promocji");
  if (shown != null && shown < total) return `Pokazujemy ${shown} z ${total} ${noun}`;
  return `${total} ${noun}`;
}

/* ------------------------------------------------------------------ */
/* Active-filter chips                                                 */
/* ------------------------------------------------------------------ */

export interface FilterChip {
  /** Stable key, e.g. "difficulty:EASY". */
  id: string;
  /** Visible text, e.g. "Trudność: Łatwa". */
  label: string;
  /** Spoken name of the button, e.g. "Usuń filtr: Trudność: Łatwa". */
  removeLabel: string;
  /** What removing the chip changes. */
  clear: Partial<ListingState>;
  /** True for the filters that live in the sheet (counted by "Filtry (n)"). */
  inPanel: boolean;
}

function shorten(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Name of a bank for a chip: the real name when known, else the slug. */
function bankName(slug: string, banks: readonly { slug: string; name: string }[]): string {
  return banks.find((b) => b.slug === slug)?.name ?? slug;
}

/**
 * The chips under the toolbar. The Osobiste / Firmowe segment is NOT a chip
 * (it is visible in its own control); an account type the segment cannot show
 * (SAVINGS, YOUNG, JOINT from an old link) is.
 */
export function buildChips(state: ListingState, banks: readonly { slug: string; name: string }[] = []): FilterChip[] {
  const chips: FilterChip[] = [];
  const add = (chip: Omit<FilterChip, "removeLabel">) =>
    chips.push({ ...chip, removeLabel: `Usuń filtr: ${chip.label}` });

  if (state.q) add({ id: "q", label: `Fraza: „${shorten(state.q, 24)}”`, clear: { q: "" }, inPanel: false });
  if (state.accountType && !isAccountSegment(state.accountType)) {
    add({ id: "accountType", label: `Typ konta: ${ACCOUNT_TYPE_LABEL[state.accountType]}`, clear: { accountType: "" }, inPanel: false });
  }
  if (state.bank) {
    add({ id: "bank", label: `Bank: ${shorten(bankName(state.bank, banks), 28)}`, clear: { bank: "" }, inPanel: true });
  }
  for (const value of state.difficulty) {
    add({
      id: `difficulty:${value}`,
      label: `Trudność: ${DIFFICULTY_LABEL[value]}`,
      clear: { difficulty: state.difficulty.filter((d) => d !== value) },
      inPanel: true
    });
  }
  if (state.minBonus) {
    add({ id: "minBonus", label: `Premia od ${formatPLN(state.minBonus)}`, clear: { minBonus: null }, inPanel: true });
  }
  if (state.noFees) add({ id: "noFees", label: "Bez opłaty za konto", clear: { noFees: false }, inPanel: true });
  if (state.eligibleOnly) {
    add({ id: "eligibleOnly", label: "Tylko te, w których mogę wziąć udział", clear: { eligibleOnly: false }, inPanel: true });
  }
  return chips;
}

/** The number in "Filtry (n)": chips whose controls live in the sheet. */
export function panelFilterCount(chips: readonly FilterChip[]): number {
  return chips.filter((chip) => chip.inPanel).length;
}

/** The state with every chip removed (segment and sort stay). */
export function clearChips(state: ListingState): ListingState {
  return { ...state, q: "", bank: "", difficulty: [], minBonus: null, noFees: false, eligibleOnly: false, accountType: segmentOf(state) };
}

/**
 * The segment value that matches a state ("" when the account type is not one of
 * the two segments - no tab is selected for SAVINGS / YOUNG / JOINT). For the
 * segment of an offer's own account type see `segmentOf` in src/lib/accountTypes.ts.
 */
export function segmentOf(state: Pick<ListingState, "accountType">): SegmentValue {
  return isAccountSegment(state.accountType) ? state.accountType : "";
}

/* ------------------------------------------------------------------ */
/* Server side: state -> service filters                               */
/* ------------------------------------------------------------------ */

export interface ServiceFilters {
  q?: string;
  bankSlug?: string;
  accountType?: string;
  difficulty?: string[];
  minBonusCents?: number;
  maxAccountFeeCents?: number;
  sort?: SortKey;
}

/** Filters for listPromotionCards / countActive. `omit` leaves a filter out (relaxations, segment counts). */
export function toServiceFilters(state: ListingState, omit: readonly (keyof ListingState)[] = []): ServiceFilters {
  const skip = new Set<keyof ListingState>(omit);
  const filters: ServiceFilters = {};
  if (state.q && !skip.has("q")) filters.q = state.q;
  if (state.bank && !skip.has("bank")) filters.bankSlug = state.bank;
  if (state.accountType && !skip.has("accountType")) filters.accountType = state.accountType;
  if (state.difficulty.length && !skip.has("difficulty")) filters.difficulty = [...state.difficulty];
  if (state.minBonus && !skip.has("minBonus")) filters.minBonusCents = state.minBonus;
  if (state.noFees && !skip.has("noFees")) filters.maxAccountFeeCents = 0;
  if (state.sort && !skip.has("sort")) filters.sort = state.sort;
  return filters;
}

/* ------------------------------------------------------------------ */
/* Bank named in the URL but without active offers                     */
/* ------------------------------------------------------------------ */

/**
 * The bank list for the filter UI plus the bank named in the URL, when that
 * bank has no active offers (the "Aktualne promocje banku" link of an expired
 * offer, the redirect of /api/eligibility-link/[token]). `getBanksWithOffers`
 * only lists banks WITH offers, so without this the chip, the select option and
 * the empty-state hint would show the raw slug ("Bank: pekao"). The result
 * stays sorted by name (Polish collation); `selected` is ignored when null or
 * when the bank is already listed.
 */
export function withSelectedBank(
  banks: readonly { slug: string; name: string }[],
  selected: { slug: string; name: string } | null | undefined
): { slug: string; name: string }[] {
  if (!selected || banks.some((bank) => bank.slug === selected.slug)) return [...banks];
  return [...banks, selected].sort((a, b) => a.name.localeCompare(b.name, "pl"));
}

/* ------------------------------------------------------------------ */
/* Keyboard focus after a chip is removed                              */
/* ------------------------------------------------------------------ */

/** Where the keyboard focus goes when the focused chip disappears. */
export type ChipFocusTarget = { kind: "chip"; id: string } | { kind: "status" };

/**
 * A removed chip takes the focused button with it, and focus would fall to
 * <body> (WCAG 2.4.3). Rule: the NEXT chip; the last chip hands focus to the
 * PREVIOUS one; when no chip is left (the whole "Aktywne filtry" block goes
 * away) it moves to the results counter, which is focusable (tabIndex -1) and
 * is the live region that announces the new count.
 */
export function focusAfterChipRemoval(chipIds: readonly string[], removedId: string): ChipFocusTarget {
  const index = chipIds.indexOf(removedId);
  const remaining = chipIds.filter((id) => id !== removedId);
  if (remaining.length === 0) return { kind: "status" };
  if (index === -1) return { kind: "chip", id: remaining[0] as string };
  // after removal the chip that followed now sits at `index`; the last chip falls back to the one before it
  return { kind: "chip", id: remaining[Math.min(index, remaining.length - 1)] as string };
}

/* ------------------------------------------------------------------ */
/* Structured data                                                     */
/* ------------------------------------------------------------------ */

/**
 * True when the URL is the canonical, unfiltered first page of the list in
 * its default order. Only that list gets the ItemList JSON-LD: every other
 * variant (filter, search, segment, another sort, `strona` > 1) is `noindex`
 * and a different list, so an ItemList there would describe an order the
 * canonical page does not have. Tracking parameters are not part of the state
 * and do not matter.
 */
export function isCanonicalListing(state: ListingState, page: number): boolean {
  return !hasActiveFilters(state) && effectiveSort(state) === DEFAULT_SORT && page <= 1;
}
