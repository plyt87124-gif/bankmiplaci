/**
 * Metadata builders: the ONLY place that decides what a page's <title>,
 * description, canonical, Open Graph and Twitter tags look like
 * (docs/redesign-v2/03-content-and-seo-plan.md sections B and E).
 *
 * Rules every builder follows:
 * - Pure: the clock (`now`) is always a parameter; "{Rok}" / "{Miesiąc}" come
 *   from Poland's calendar (Europe/Warsaw), never from the server's zone.
 * - No invented facts: amounts, counts and dates are arguments that come from
 *   the database; a missing value drops the sentence instead of guessing.
 * - "Title" builders named `*Title` return the FINAL document title when the
 *   page is meant to be passed as `{ absolute }` (they already contain the
 *   brand); `promotionTitle` returns the part BEFORE the layout template
 *   ("%s | Bankmiplaci"), see titleTemplate().
 */
import type { Metadata } from "next";
import { absoluteUrl, siteName } from "./siteUrl";
import { formatDatePL, warsawMonthYear, warsawYear } from "./dates";
import { collapseWhitespace, foldPolish, pluralForm, truncateAtWord } from "./text";
import { daysSinceDeadline } from "../promotionAvailability";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

/** Hard ceiling for <meta name="description"> (Google shows ~155-160 chars). */
export const DESCRIPTION_MAX = 160;
/** Offer summaries are cut here so a "Ważna do ..." sentence can still fit. */
export const SUMMARY_SOFT_MAX = 155;
/** Offer titles are shortened to this many characters before the template. */
export const PROMOTION_TITLE_MAX = 60;
/** Default social image: the site-wide generated card (src/app/opengraph-image.tsx). */
export const DEFAULT_OG_IMAGE_PATH = "/opengraph-image";

/** `title.template` for the root layout, so `siteName` lives in one place. */
export function titleTemplate(): string {
  return `%s | ${siteName()}`;
}

/** Brand suffix used by builders that return a finished (absolute) title. */
function withBrand(title: string): string {
  return `${title} | ${siteName()}`;
}

/* ------------------------------------------------------------------ */
/* buildMetadata                                                       */
/* ------------------------------------------------------------------ */

export interface SocialImage {
  /** Absolute URL or site path. */
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface BuildMetadataInput {
  /**
   * Plain string = goes through the layout template ("... | Bankmiplaci").
   * `{ absolute }` = used as is (home, lists, hubs - their builders already
   * append the brand).
   */
  title: string | { absolute: string };
  description: string;
  /** Canonical path WITHOUT query string, e.g. "/promocje" or "/promocje/alior-konto". */
  path: string;
  type?: "website" | "article";
  /** Defaults to the site-wide /opengraph-image (a page-level openGraph would otherwise drop it). */
  image?: string | SocialImage;
  /** Shortcut for `robots: { index: false, follow: true }`. */
  noindex?: boolean;
  /** Explicit robots (e.g. from robotsForStatus / noindexForSearchParams). Wins over `noindex`. */
  robots?: { index: boolean; follow: boolean } | null;
  /** Article only (ISO strings or Dates). */
  publishedTime?: Date | string | null;
  modifiedTime?: Date | string | null;
}

function toSocialImage(image: string | SocialImage | undefined): SocialImage {
  if (!image) {
    return { url: absoluteUrl(DEFAULT_OG_IMAGE_PATH), width: 1200, height: 630, alt: `${siteName()} - porównywarka promocji bankowych` };
  }
  const img = typeof image === "string" ? { url: image } : image;
  return { ...img, url: absoluteUrl(img.url) };
}

function iso(value: Date | string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * Canonical + Open Graph + Twitter for one page. `alternates.canonical` is an
 * ABSOLUTE url of the clean path, so a filtered URL (?sort=..., ?strona=2)
 * always points search engines at the unfiltered page.
 *
 * Does NOT set `robots` unless the page asks for it - the root layout no
 * longer sets one, so the default is index,follow.
 */
export function buildMetadata(input: BuildMetadataInput): Metadata {
  const description = collapseWhitespace(input.description);
  const canonical = absoluteUrl(input.path);
  const ogTitle = typeof input.title === "string" ? input.title : input.title.absolute;
  const image = toSocialImage(input.image);
  const type = input.type ?? "website";

  const common = {
    url: canonical,
    title: ogTitle,
    description,
    siteName: siteName(),
    locale: "pl_PL",
    images: [image]
  };

  const published = iso(input.publishedTime);
  const modified = iso(input.modifiedTime);
  const openGraph: NonNullable<Metadata["openGraph"]> =
    type === "article"
      ? {
          ...common,
          type: "article",
          ...(published ? { publishedTime: published } : {}),
          ...(modified ? { modifiedTime: modified } : {})
        }
      : { ...common, type: "website" };

  const metadata: Metadata = {
    title: input.title,
    description,
    alternates: { canonical },
    openGraph,
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: [image.url]
    }
  };

  const robots = input.robots ?? (input.noindex ? { index: false, follow: true } : null);
  if (robots) metadata.robots = robots;
  return metadata;
}

/* ------------------------------------------------------------------ */
/* Index control for parameterised URLs                                */
/* ------------------------------------------------------------------ */

/**
 * Query parameters that filter/sort/paginate a list. A URL carrying any of
 * them (with a non-empty value) is a duplicate view of the clean page and must
 * be noindex,follow with canonical = clean path. Covers /promocje
 * (q, bank, accountType, difficulty, minBonus, noFees, sort, niedostepna,
 * strona) and /porownaj (typ, liczba). Tracking parameters (utm_*, ref,
 * gclid ...) are deliberately NOT here: the canonical handles those and they
 * must not make the page lose its index status.
 */
export const INDEX_BLOCKING_PARAMS = [
  "q",
  "bank",
  "accountType",
  "difficulty",
  "minBonus",
  "noFees",
  "dostepne",
  "sort",
  "niedostepna",
  "typ",
  "liczba"
] as const;

type SearchParamValue = string | string[] | undefined | null;

function firstValue(value: SearchParamValue): string {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === "string" ? v.trim() : "";
}

/**
 * `robots` value for a list page given its searchParams: noindex,follow when
 * any filter/sort parameter is set or the page number is above 1; otherwise
 * `undefined` (= leave the default, index). Do NOT also block these URLs in
 * robots.txt - a crawler has to fetch the page to see the noindex.
 */
export function noindexForSearchParams(
  searchParams: Record<string, SearchParamValue> | URLSearchParams | undefined | null,
  extraBlockingParams: readonly string[] = []
): { index: false; follow: true } | undefined {
  if (!searchParams) return undefined;
  const get = (key: string): string =>
    searchParams instanceof URLSearchParams ? (searchParams.get(key) ?? "").trim() : firstValue(searchParams[key]);

  for (const key of [...INDEX_BLOCKING_PARAMS, ...extraBlockingParams]) {
    if (get(key) !== "") return { index: false, follow: true };
  }
  const page = Number.parseInt(get("strona"), 10);
  if (Number.isFinite(page) && page > 1) return { index: false, follow: true };
  // `?strona=abc`/`?strona=0` is junk but not a distinct page: stays indexable
  // through its canonical.
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Offers                                                              */
/* ------------------------------------------------------------------ */

export interface PromotionTitleInput {
  /** Offer name (Promotion.name). */
  name: string;
  /** Bank display name (Bank.name). */
  bankName: string;
  /** Prisma AccountType; BUSINESS adds "(konto firmowe)" when the name lacks it. */
  accountType?: string | null;
  /** Promotion.maxBonusCents; 0/null/undefined = no amount in the title. */
  maxBonusCents?: number | null;
}

const GENERIC_BANK_WORDS = new Set(["bank", "polski", "polska", "s.a.", "sa", "banku"]);

/** The part of a bank's name that identifies it ("PKO Bank Polski" -> "pko"). */
function bankKey(bankName: string): string {
  const words = foldPolish(bankName)
    .replace(/[!.,]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const meaningful = words.filter((w) => !GENERIC_BANK_WORDS.has(w));
  return (meaningful.length > 0 ? meaningful : words).join(" ");
}

/** Does the offer name already mention its bank ("Nest Konto", "w mBanku", "Alior Konto ...")? */
export function nameMentionsBank(name: string, bankName: string): boolean {
  const key = bankKey(bankName);
  if (!key) return false;
  const haystack = foldPolish(name).replace(/[!.,]/g, " ");
  // Match at a word start so "mbank" also matches the declined "mBanku".
  return new RegExp(`(^|[^a-z0-9])${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(haystack);
}

/**
 * "{Bank}: {nazwa}" unless the name already contains the bank. The long,
 * untruncated form - use it as the offer's H1 (distinct for every offer, so
 * two Alior or two PKO offers never share a heading).
 */
export function promotionHeading(p: Pick<PromotionTitleInput, "name" | "bankName">): string {
  const name = collapseWhitespace(p.name);
  return nameMentionsBank(name, p.bankName) ? name : `${collapseWhitespace(p.bankName)}: ${name}`;
}

/** "800 zł", "1 200 zł", "10,50 zł" - regular spaces (safe in <title>). */
export function formatAmountPlain(cents: number): string {
  const zl = cents / 100;
  const text = Number.isInteger(zl)
    ? new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(zl)
    : new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(zl);
  return `${text.replace(/\s/g, " ")} zł`;
}

const AMOUNT_IN_NAME = /\d[\d\s.,]*\s*(zł|zl|pln|tys)/i;
/**
 * Does the name already say that this is a business account? "firmow" (konto
 * firmowe), "biznes", "business", "JDG", "dla firm", "przedsiębiorc..." - but NOT
 * a bare "firma"/"firmę" ("Załóż firmę i konto..." names an action, not the kind
 * of account), so that offer still gets "(konto firmowe)".
 */
const BUSINESS_IN_NAME = /firmow|biznes|business|\bjdg\b|dla firm|przedsiębiorc/i;
/** A product name taken from before the first ": " must be at least this long (otherwise the whole name is kept). */
const PRODUCT_NAME_MIN = 8;
/** A trailing "(edycja 2)" / "(edycja I)": the one part of the cut-off remainder that tells two editions of a product apart. */
const EDITION_TAIL = /\(\s*edycj[a-z]*\s[^()]*\)\s*$/i;

/* ----- shortening helpers (titles and descriptions) ----- */

/** Words that must not end a shortened text ("... konto własne i" reads like a bug). Same list as text.ts#truncateAtWord. */
const DANGLING_WORDS = new Set([
  "a", "i", "o", "u", "w", "z", "do", "na", "po", "za", "od", "ze", "we", "ku", "oraz", "lub", "albo", "że", "to", "co"
]);
const TRAILING_SEPARATORS = /[\s,;:–—\-+(\[/&|]+$/;

/** Strips separators and dangling short words from the end of a cut text. */
function tidyTail(text: string): string {
  let cut = text;
  for (;;) {
    const before = cut;
    cut = cut.replace(TRAILING_SEPARATORS, "");
    const lastSpace = cut.lastIndexOf(" ");
    if (lastSpace > 0 && DANGLING_WORDS.has(cut.slice(lastSpace + 1).toLowerCase())) cut = cut.slice(0, lastSpace);
    if (cut === before) return cut;
  }
}

const CLOSER_OF: Record<string, string> = { "(": ")", "[": "]", "„": "”" };

/** Index of the outermost bracket or quote ("(", "[", "„", a straight ") that is still open at the end of `text`, or -1. */
function unclosedIndex(text: string): number {
  const open: Array<{ index: number; closer: string }> = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    const top = open[open.length - 1];
    if (ch === '"') {
      // a straight quote opens a quotation, or closes the one that is open
      if (top?.closer === '"') open.pop();
      else open.push({ index: i, closer: '"' });
      continue;
    }
    const closer = CLOSER_OF[ch];
    if (closer) open.push({ index: i, closer });
    else if (top && ch === top.closer) open.pop();
  }
  return open.length > 0 ? open[0]!.index : -1;
}

/**
 * Shortens `text` to `max` characters on a word boundary with "…" (like
 * truncateAtWord) but never inside a parenthesis or a quotation: an unclosed
 * "(" / "„" at the cut is removed together with what follows it.
 */
function shortenAtWord(text: string, max: number): string {
  const cut = truncateAtWord(text, max);
  if (!cut.endsWith("…")) return cut;
  const head = cut.slice(0, -1);
  const open = unclosedIndex(head);
  if (open < 0) return cut;
  const before = tidyTail(head.slice(0, open));
  return before.length > 0 ? `${before}…` : cut;
}

/* ----- offer title ----- */

/** Where a name can end without leaving half a phrase: before "za", "dla", "oraz", a dash, a comma, a semicolon, a plus, a parenthesis. */
const CLAUSE_BOUNDARY = /\s(?:za|dla|oraz|bez)\s|\s[–—-]\s|[,;]\s|\s\+\s|\s\(/g;
/** A clean cut shorter than this would throw away too much of the name. */
const CLAUSE_CUT_MIN = 10;

/**
 * The longest head of `name` that ends at a clause boundary and fits `budget`
 * characters - a complete phrase, so it needs no ellipsis ("Letni Bonus – do
 * 900 zł" out of "Letni Bonus – do 900 zł za konto własne i konto dla
 * dziecka"). null when there is no such boundary.
 */
function cutAtClause(name: string, budget: number): string | null {
  let best: string | null = null;
  for (const match of name.matchAll(CLAUSE_BOUNDARY)) {
    const head = tidyTail(name.slice(0, match.index));
    if (head.length < CLAUSE_CUT_MIN || head.length > budget) continue;
    if (unclosedIndex(head) >= 0) continue;
    if (best === null || head.length > best.length) best = head;
  }
  return best;
}

/**
 * The product name used in a title. Many offer names are "{produkt}: {kwoty i
 * warunki}" ("Konto Przekorzystne: do 300 zł + do 2400 zł w Promocji Podróżnej
 * III"): the part before the first ": " is the product (when it is at least 8
 * characters and has no open parenthesis) and the rest only repeats amounts and
 * conditions the page shows anyway. An "(edycja N)" at the end of the rest is
 * kept - it is what tells two editions of one product apart.
 */
function productName(name: string): string {
  const colon = name.search(/:\s/);
  if (colon < 0) return name;
  const prefix = name.slice(0, colon).trim();
  if (prefix.length < PRODUCT_NAME_MIN || unclosedIndex(prefix) >= 0) return name;
  const rest = name.slice(colon + 1);
  const edition = EDITION_TAIL.exec(rest.trim());
  return edition && !EDITION_TAIL.test(prefix) ? `${prefix} ${edition[0].trim()}` : prefix;
}

interface TitleBase {
  /** "{Bank}: " or "" when the name already contains the bank. */
  prefix: string;
  /** The product name, with no colon left when a bank prefix is added (never "Bank: Produkt: ..."). */
  name: string;
}

/** Turns every ": " of a name into " – ", except the first one when `keepFirst` (the name has no bank prefix, so the title has no other colon). */
function dashesForColons(name: string, keepFirst: boolean): string {
  let seen = 0;
  return name.replace(/\s*:\s+/g, () => (keepFirst && seen++ === 0 ? ": " : " – "));
}

function titleBase(p: Pick<PromotionTitleInput, "name" | "bankName">, whole = false): TitleBase {
  const full = collapseWhitespace(p.name).replace(/\s*:$/, "");
  const name = whole ? full : productName(full);
  if (nameMentionsBank(name, p.bankName)) return { prefix: "", name: dashesForColons(name, true) };
  return { prefix: `${collapseWhitespace(p.bankName)}: `, name: dashesForColons(name, false) };
}

/** The name cut to `budget` characters: at a clause boundary when there is one, else on a word boundary with "…". */
function fitName(name: string, budget: number): string {
  if (name.length <= budget) return name;
  return cutAtClause(name, budget) ?? shortenAtWord(name, budget);
}

/** The title with its notes, longest first: base + business note + amount, base + business note, base. */
function withNotes(base: TitleBase, p: PromotionTitleInput): string[] {
  const businessNote = p.accountType === "BUSINESS" && !BUSINESS_IN_NAME.test(base.name) ? " (konto firmowe)" : "";
  const amountNote =
    p.maxBonusCents != null && p.maxBonusCents > 0 && !AMOUNT_IN_NAME.test(base.name)
      ? ` — do ${formatAmountPlain(p.maxBonusCents)}`
      : "";
  const text = base.prefix + base.name;
  return [text + businessNote + amountNote, text + businessNote, text];
}

/**
 * Title of an offer page, BEFORE the layout template adds " | Bankmiplaci".
 * Always <= PROMOTION_TITLE_MAX (60) characters.
 *
 *   base    = "{Bank}: {nazwa}" (bank omitted when the name already has it; a
 *             ": " inside the name becomes " – " so there are never two colons)
 *   + " (konto firmowe)" for BUSINESS offers whose name doesn't say so
 *   + " — do {kwota}"    when maxBonusCents > 0 and the name carries no amount
 *                        of its own (never the word "premii": it may be a
 *                        refund or cashback)
 *
 * What gives way when it is too long, in this order:
 *   1. the amount note, then the business note;
 *   2. the rest of the name after its first ": ". Many names are
 *      "{produkt}: {kwoty i warunki}" ("Konto Przekorzystne: do 300 zł + do
 *      2400 zł w Promocji Podróżnej III"); the part before the colon is the
 *      product (when it is at least 8 characters), the rest repeats amounts
 *      and conditions the page shows anyway, so the amount note (from
 *      maxBonusCents) and the business note are tried again on the product;
 *   3. the product name itself: cut at a clause boundary (a complete phrase,
 *      no ellipsis; the business note stays if it still fits) and only
 *      without one on a word boundary with "…" - never inside a parenthesis.
 *
 * Examples: "Alior Bank: Konto z Premią — do 800 zł",
 *           "Bank Pekao: Konto Przekorzystne — do 2700 zł".
 */
export function promotionTitle(p: PromotionTitleInput, maxLength: number = PROMOTION_TITLE_MAX): string {
  const whole = titleBase(p, true);
  const product = titleBase(p);
  for (const candidate of [...withNotes(whole, p), ...(product.name === whole.name ? [] : withNotes(product, p))]) {
    if (candidate.length <= maxLength) return candidate;
  }

  // Even the product name is too long: shorten it, keeping the business note when a clean cut leaves room for it.
  const { prefix, name } = product;
  const room = Math.max(CLAUSE_CUT_MIN, maxLength - prefix.length);
  const businessNote = p.accountType === "BUSINESS" && !BUSINESS_IN_NAME.test(name) ? " (konto firmowe)" : "";
  if (businessNote) {
    const cut = cutAtClause(name, room - businessNote.length);
    if (cut) return prefix + cut + businessNote;
  }
  const title = prefix + fitName(name, room);
  return title.length <= maxLength ? title : truncateAtWord(title, maxLength);
}

/**
 * Title for an offer that has ended: "{Bank}: {nazwa} (zakończona)".
 * The fixed tail is kept whole and only the name part is shortened (as in
 * promotionTitle: product name before the first ": ", clean cut at a clause
 * boundary, "…" only as the last resort), so "(zakończona)" always survives. The date of
 * the end stays in the H1, the body and the description ("Zakończona dd.mm.rrrr."): a
 * date in the title only crowded out the name. Budget 60 characters, like a live offer.
 */
export function expiredPromotionTitle(
  p: Pick<PromotionTitleInput, "name" | "bankName">,
  endDate: Date | string | null | undefined,
  maxLength = 60
): string {
  void endDate; // part of the signature (callers pass it); the date lives in the H1/body/description, not in the title
  const tail = " (zakończona)";
  const budget = Math.max(20, maxLength - tail.length);
  // The whole name when it fits (without a second colon), otherwise the product name, shortened.
  const whole = titleBase(p, true);
  if (whole.prefix.length + whole.name.length <= budget) return whole.prefix + whole.name + tail;
  const { prefix, name } = titleBase(p);
  const room = Math.max(CLAUSE_CUT_MIN, budget - prefix.length);
  const head = prefix + fitName(name, room);
  return (head.length <= budget ? head : truncateAtWord(head, budget)) + tail;
}

export interface MakeDescriptionContext {
  bankName: string;
  /** Offer name; used only by the fallback (empty summary). */
  name: string;
  /** Last sign-up day. Missing/invalid = no "Ważna do" sentence. */
  endDate?: Date | string | null;
  /** Promotion.lastVerifiedAt; used by the fallback sentence. */
  lastVerifiedAt?: Date | string | null;
  /** Injectable clock: decides "Ważna do" (open) vs "Zakończona" (ended). */
  now?: Date;
}

function endsWithSentencePunctuation(text: string): boolean {
  return /[.!?…]$/.test(text);
}

/** A summary is cut at a sentence or a clause only when that keeps at least this many characters. */
const SUMMARY_CUT_MIN = 80;

/** Words that end in a full stop without ending a sentence ("min. 500 zł", "maks. 120 zł", "np. karta"). */
const NOT_A_SENTENCE_END = new Set([
  "min", "max", "maks", "np", "tj", "tzw", "tys", "mln", "mld", "ok", "godz", "ul", "nr", "pkt", "wg", "ws",
  "art", "ust", "poz", "dr", "mgr", "inż", "prof", "św", "im", "zob", "por", "ds", "m.in"
]);

/**
 * Index of the last real sentence end (".", "!" or "?") in the first `limit`
 * characters of `text`, or -1. A full stop counts only when it is followed by a
 * space and a capital letter, digit or opening quote, does not close an
 * abbreviation ("min.", "maks.") or a list number ("12."), and no parenthesis
 * or quotation is still open before it.
 */
function lastSentenceEnd(text: string, limit: number): number {
  for (let i = Math.min(limit, text.length) - 1; i >= 0; i--) {
    const ch = text.charAt(i);
    if (ch !== "." && ch !== "!" && ch !== "?") continue;
    if (text.charAt(i + 1) !== " " || !/[\p{Lu}\p{N}„"(]/u.test(text.charAt(i + 2))) continue;
    if (ch === ".") {
      const word = /([\p{L}\p{N}.]+)$/u.exec(text.slice(0, i))?.[1]?.toLowerCase() ?? "";
      if (NOT_A_SENTENCE_END.has(word) || /^\d{1,2}$/.test(word)) continue;
    }
    if (unclosedIndex(text.slice(0, i + 1)) >= 0) continue;
    return i;
  }
  return -1;
}

/**
 * The text up to the last comma or semicolon before `limit` (a decimal comma
 * such as "5,3%" is not one), without the separator and without a dangling
 * conjunction, or null when that would keep fewer than SUMMARY_CUT_MIN
 * characters or the comma sits inside a parenthesis.
 */
function lastClauseCut(text: string, limit: number): string | null {
  for (let i = Math.min(limit, text.length) - 1; i >= SUMMARY_CUT_MIN; i--) {
    const ch = text.charAt(i);
    if ((ch !== "," && ch !== ";") || text.charAt(i + 1) !== " ") continue;
    const head = text.slice(0, i);
    if (unclosedIndex(head) >= 0) continue;
    const tidy = tidyTail(head);
    return tidy.length >= SUMMARY_CUT_MIN ? tidy : null;
  }
  return null;
}

/**
 * Cuts a long summary to at most SUMMARY_SOFT_MAX characters, in this order:
 *   1. after the last full sentence (>= 80 characters kept);
 *   2. else before the last comma/semicolon (>= 80 kept), closed with a full stop;
 *   3. else on a word boundary with "…" - the only case that shows an ellipsis.
 * Never inside a parenthesis or quotation (an open one is cut off together
 * with what follows it) and never with a dangling comma or conjunction.
 */
function cutSummary(text: string): string {
  if (text.length <= SUMMARY_SOFT_MAX) return text;
  const stop = lastSentenceEnd(text, SUMMARY_SOFT_MAX);
  if (stop + 1 >= SUMMARY_CUT_MIN) return text.slice(0, stop + 1);
  const clause = lastClauseCut(text, SUMMARY_SOFT_MAX);
  if (clause) return `${clause}.`;
  return shortenAtWord(text, SUMMARY_SOFT_MAX);
}

/**
 * <meta description> of an offer page, always <= DESCRIPTION_MAX (160).
 *
 * - summary present: whitespace collapsed, cut at ~155 characters on the last
 *   full sentence, else on the last comma/semicolon, else on a word boundary
 *   with "…" (see cutSummary: never inside a parenthesis), then
 *   " Ważna do dd.mm.rrrr." (or " Zakończona dd.mm.rrrr." once the deadline
 *   has passed) when it still fits.
 * - summary empty: "Promocja {bank}: {nazwa}. Warunki krok po kroku, koszty i
 *   termin zapisów. Zweryfikowano {data}." (name dropped if that would exceed
 *   the limit, the "Zweryfikowano" sentence dropped if the date is unknown).
 */
export function makeDescription(summary: string | null | undefined, ctx: MakeDescriptionContext): string {
  const text = collapseWhitespace(summary ?? "");
  const now = ctx.now ?? new Date();

  if (!text) return fallbackDescription(ctx);

  let body = cutSummary(text);
  if (!endsWithSentencePunctuation(body) && body.length < SUMMARY_SOFT_MAX) body += ".";

  const date = formatDatePL(ctx.endDate);
  if (date) {
    const days = daysSinceDeadline(ctx.endDate, now);
    const sentence = days != null && days > 0 ? `Zakończona ${date}.` : `Ważna do ${date}.`;
    if (body.length + 1 + sentence.length <= DESCRIPTION_MAX && endsWithSentencePunctuation(body)) {
      return `${body} ${sentence}`;
    }
  }
  return body.length <= DESCRIPTION_MAX ? body : truncateAtWord(body, DESCRIPTION_MAX);
}

function fallbackDescription(ctx: MakeDescriptionContext): string {
  const bank = collapseWhitespace(ctx.bankName);
  const name = collapseWhitespace(ctx.name);
  const verified = formatDatePL(ctx.lastVerifiedAt);
  const middle = "Warunki krok po kroku, koszty i termin zapisów.";
  const tail = verified ? ` Zweryfikowano ${verified}.` : "";
  const full = `Promocja ${bank}: ${name}. ${middle}${tail}`;
  if (full.length <= DESCRIPTION_MAX) return full;
  const noName = `Promocja ${bank}. ${middle}${tail}`;
  return noName.length <= DESCRIPTION_MAX ? noName : truncateAtWord(noName, DESCRIPTION_MAX);
}

/* ------------------------------------------------------------------ */
/* Home, lists, hubs                                                   */
/* ------------------------------------------------------------------ */

/** "Aktualnych promocji" in the genitive after "Porównanie N ...": 1 -> "aktualnej promocji". */
function currentPromotionsGenitive(count: number): string {
  return Math.trunc(count) === 1 ? "aktualnej promocji" : "aktualnych promocji";
}

/** Home <title> (pass as `{ absolute }`): "Promocje bankowe 2026 – konta z premią do odebrania | Bankmiplaci". */
export function homeTitle(now: Date): string {
  return withBrand(`Promocje bankowe ${warsawYear(now)} – konta z premią do odebrania`);
}

/**
 * Home description. `updatedAt` = newest lastVerifiedAt among active offers;
 * without it the "Najnowsza weryfikacja oferty" sentence is simply left out (it is the newest
 * check among the offers, not a review of the whole set).
 */
export function homeDescription(updatedAt?: Date | string | null): string {
  const date = formatDatePL(updatedAt);
  // No "ściąga" here: the word is the site's own and means nothing in a search result.
  const lead = "Aktualne promocje bankowe w Polsce: konta osobiste i firmowe z premią. Sprawdź kwotę, warunki, koszt i termin zapisów.";
  return date ? `${lead} Najnowsza weryfikacja oferty: ${date}.` : lead;
}

/**
 * /promocje <title> (pass as `{ absolute }`): "Promocje bankowe – październik 2026: zestawienie | Bankmiplaci".
 * "Zestawienie", not "ranking": the default order ("Polecane") depends on the partner
 * remuneration as well as on the site rating, so the page must not call itself a ranking.
 */
export function promotionsListTitle(now: Date): string {
  return withBrand(`Promocje bankowe – ${warsawMonthYear(now)}: zestawienie`);
}

/** /promocje H1: "Promocje bankowe – październik 2026". */
export function promotionsListHeading(now: Date): string {
  return `Promocje bankowe – ${warsawMonthYear(now)}`;
}

/** /promocje description; `count` = number of currently listed offers (omitted when unknown). */
export function promotionsListDescription(count?: number | null): string {
  const subject = count != null && count > 0 ? `${Math.trunc(count)} ${currentPromotionsGenitive(count)}` : "aktualnych promocji";
  return `Porównanie ${subject}: premia, trudność, koszt konta i termin zapisów. Konta osobiste i firmowe, aktualizowane na bieżąco.`;
}

export type HubKind = "personal" | "business";

/** /konta-osobiste-z-premia and /konta-firmowe-z-premia <title> (pass as `{ absolute }`). */
export function hubTitle(kind: HubKind, now: Date): string {
  const year = warsawYear(now);
  return withBrand(
    kind === "personal"
      ? `Konta osobiste z premią ${year} – aktualne promocje`
      : `Konta firmowe z premią ${year} – promocje dla firm i JDG`
  );
}

export function hubHeading(kind: HubKind): string {
  return kind === "personal"
    ? "Konta osobiste z premią – aktualne promocje"
    : "Konta firmowe z premią – promocje dla przedsiębiorców";
}

export function hubDescription(kind: HubKind, count?: number | null): string {
  const subject = count != null && count > 0 ? `${Math.trunc(count)} ${currentPromotionsGenitive(count)}` : "aktualnych promocji";
  return kind === "personal"
    ? `Zestawienie ${subject} na konta osobiste z premią – kwota, trudność, koszt konta i termin zapisów. Sprawdź warunki krok po kroku.`
    : `Porównanie ${subject} na konta firmowe z premią dla firm i JDG – kwota, warunki, koszt konta i termin zapisów. Sprawdź, co trzeba spełnić.`;
}

/** /banki/[slug] <title> (pass as `{ absolute }`): "PKO Bank Polski – promocje i konta z premią 2026 | Bankmiplaci". */
export function bankTitle(bankName: string, now: Date): string {
  return withBrand(`${collapseWhitespace(bankName)} – promocje i konta z premią ${warsawYear(now)}`);
}

/** /banki/[slug] H1: "{Bank}: aktualne promocje bankowe". */
export function bankHeading(bankName: string): string {
  return `${collapseWhitespace(bankName)}: aktualne promocje bankowe`;
}

/**
 * /banki/[slug] description. `activeCount` = open offers of that bank; with 0
 * (the page is permanent) the sentence says nothing false about "current" offers.
 */
export function bankDescription(bankName: string, activeCount: number): string {
  const bank = collapseWhitespace(bankName);
  const tail = "konta osobiste i firmowe. Premie, warunki, koszty i terminy zapisów – sprawdź, zanim założysz konto.";
  if (activeCount > 0) {
    const noun = pluralForm(activeCount, "aktualna promocja", "aktualne promocje", "aktualnych promocji");
    return `${Math.trunc(activeCount)} ${noun} ${bank}: ${tail}`;
  }
  return `Promocje ${bank} – ${tail}`;
}

/** /promocje/konczace-sie <title> (pass as `{ absolute }`). */
export function endingSoonTitle(now: Date): string {
  return withBrand(`Promocje bankowe kończące się wkrótce – ${warsawMonthYear(now)}`);
}

export function endingSoonHeading(now: Date): string {
  return `Promocje bankowe kończące się wkrótce – ${warsawMonthYear(now)}`;
}

export const ENDING_SOON_DESCRIPTION =
  "Promocje bankowe, których termin zapisów kończy się w ciągu 30 dni, z liczbą pozostałych dni. Bank może zakończyć promocję wcześniej.";

/* ------------------------------------------------------------------ */
/* Static pages                                                        */
/* ------------------------------------------------------------------ */

export interface StaticPageMeta {
  path: string;
  /** Plain title - goes through the layout template ("... | Bankmiplaci"). */
  title: string;
  description: string;
}

/**
 * Titles come verbatim from the content plan (section B). Descriptions are
 * neutral and make no claim that isn't a fact about the page's purpose; a
 * page owner may pass a better one to buildMetadata.
 */
export const STATIC_PAGE_META = {
  porownaj: {
    path: "/porownaj",
    title: "Porównanie promocji bankowych – tabela premii i opłat",
    description:
      "Porównaj promocje bankowe w jednej tabeli: premia, trudność, opłaty za konto i kartę oraz termin zapisów. Wybierz oferty i sprawdź różnice."
  },
  quiz: {
    path: "/quiz",
    title: "Quiz: dobierz promocję bankową do siebie",
    description:
      "Odpowiedz na kilka pytań i zobacz promocje bankowe z naszego zestawienia, które najlepiej pasują do Twoich odpowiedzi."
  },
  faq: {
    path: "/faq",
    title: "Najczęstsze pytania o promocje bankowe",
    description:
      "Najczęstsze pytania o promocje bankowe: kto może dostać premię, co to karencja, jak działa Bankmiplaci i jak zarabiamy."
  },
  jakToDziala: {
    path: "/jak-to-dziala",
    title: "Jak działają promocje bankowe – krok po kroku",
    description:
      "Jak działa promocja bankowa: od wyboru oferty i założenia konta po spełnienie warunków i odebranie premii. Wyjaśniamy też pojęcia, np. karencję."
  },
  jakZarabiamy: {
    path: "/jak-zarabiamy",
    title: "Jak zarabiamy",
    description:
      "Korzystanie z Bankmiplaci jest bezpłatne. Możemy otrzymywać wynagrodzenie od banków lub sieci partnerskich za polecenie ich ofert."
  },
  metodologia: {
    path: "/metodologia",
    title: "Jak liczymy ocenę serwisu",
    description:
      "Z czego składa się ocena serwisu, skąd bierzemy dane, co znaczy „Zweryfikowano” i czego nie uwzględniamy w ocenie (np. prowizji)."
  },
  oNas: {
    path: "/o-nas",
    title: "O nas i zasady redakcyjne",
    description:
      "Kto prowadzi Bankmiplaci, jak weryfikujemy promocje, jak się finansujemy i jak zgłosić błąd lub korektę."
  },
  blog: {
    path: "/blog",
    title: "Poradniki o promocjach bankowych",
    description:
      "Poradniki o promocjach bankowych i kontach z premią: warunki, terminy, karencja i najczęstsze pułapki regulaminów."
  },
  kontakt: {
    path: "/kontakt",
    title: "Kontakt",
    description:
      "Nieaktualna promocja bankowa albo błąd w warunkach? Napisz do nas – każde zgłoszenie trafia do weryfikacji przed aktualizacją."
  },
  // Legal pages: the title stays the page's own heading; the description only says what the document is
  // (so they no longer inherit the home page's description). The legal text itself is not touched.
  regulamin: {
    path: "/regulamin",
    title: "Regulamin",
    description:
      "Regulamin serwisu Bankmiplaci: zasady korzystania z porównywarki promocji bankowych, charakter serwisu, odpowiedzialność i reklamacje."
  },
  polityka: {
    path: "/polityka-prywatnosci",
    title: "Polityka prywatności",
    description:
      "Polityka prywatności Bankmiplaci: administrator danych, jakie dane przetwarzamy, w jakim celu, jak długo je przechowujemy i jakie prawa Ci przysługują."
  },
  cookies: {
    path: "/cookies",
    title: "Polityka cookies",
    description:
      "Polityka cookies Bankmiplaci: z jakich plików cookies korzystamy, do czego służą i jak zarządzać zgodą na ich używanie."
  }
} as const satisfies Record<string, StaticPageMeta>;

export type StaticPageKey = keyof typeof STATIC_PAGE_META;

/** Ready metadata for one of the static pages above. */
export function staticPageMetadata(key: StaticPageKey, overrides: Partial<Omit<BuildMetadataInput, "path">> = {}): Metadata {
  const page: StaticPageMeta = STATIC_PAGE_META[key];
  return buildMetadata({ title: page.title, description: page.description, path: page.path, ...overrides });
}
