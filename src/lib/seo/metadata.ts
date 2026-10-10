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
const BUSINESS_IN_NAME = /firm|biznes|business/i;

/**
 * Title of an offer page, BEFORE the layout template adds " | Bankmiplaci".
 * Always <= PROMOTION_TITLE_MAX (60) characters.
 *
 *   base   = "{Bank}: {name}" (bank omitted when the name already has it)
 *   + " (konto firmowe)" for BUSINESS offers whose name doesn't say so
 *   + " — do {kwota}"    when maxBonusCents > 0 and the name carries no amount
 *                        of its own (never the word "premii": it may be a
 *                        refund or cashback)
 * When it is too long the amount goes first, then the business note, and only
 * then the name itself is shortened on a word boundary with "…".
 *
 * Example: "Alior Bank: Konto z Premią — do 800 zł".
 */
export function promotionTitle(p: PromotionTitleInput, maxLength: number = PROMOTION_TITLE_MAX): string {
  const base = promotionHeading(p);
  const name = collapseWhitespace(p.name);
  const businessNote = p.accountType === "BUSINESS" && !BUSINESS_IN_NAME.test(name) ? " (konto firmowe)" : "";
  const amountNote =
    p.maxBonusCents != null && p.maxBonusCents > 0 && !AMOUNT_IN_NAME.test(name)
      ? ` — do ${formatAmountPlain(p.maxBonusCents)}`
      : "";

  const candidates = [base + businessNote + amountNote, base + businessNote, base];
  for (const c of candidates) {
    if (c.length <= maxLength) return c;
  }
  return truncateAtWord(base, maxLength);
}

/**
 * Title for an offer that has ended: "{Bank}: {nazwa} (zakończona dd.mm.rrrr) – co dalej?".
 * The fixed tail is kept whole and only the name part is shortened, so the
 * date and the question always survive (default budget 75 characters).
 */
export function expiredPromotionTitle(
  p: Pick<PromotionTitleInput, "name" | "bankName">,
  endDate: Date | string | null | undefined,
  maxLength = 75
): string {
  const date = formatDatePL(endDate);
  const tail = date ? ` (zakończona ${date}) – co dalej?` : " (zakończona) – co dalej?";
  const heading = promotionHeading(p);
  if (heading.length + tail.length <= maxLength) return heading + tail;
  return truncateAtWord(heading, Math.max(20, maxLength - tail.length)) + tail;
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

/**
 * <meta description> of an offer page, always <= DESCRIPTION_MAX (160).
 *
 * - summary present: whitespace collapsed, cut on a sentence (or word)
 *   boundary at ~155 characters, then " Ważna do dd.mm.rrrr." (or
 *   " Zakończona dd.mm.rrrr." once the deadline has passed) when it still fits.
 * - summary empty: "Promocja {bank}: {nazwa}. Warunki krok po kroku, koszty i
 *   termin zapisów. Zweryfikowano {data}." (name dropped if that would exceed
 *   the limit, the "Zweryfikowano" sentence dropped if the date is unknown).
 */
export function makeDescription(summary: string | null | undefined, ctx: MakeDescriptionContext): string {
  const text = collapseWhitespace(summary ?? "");
  const now = ctx.now ?? new Date();

  if (!text) return fallbackDescription(ctx);

  let body = text;
  if (body.length > SUMMARY_SOFT_MAX) {
    const window = body.slice(0, SUMMARY_SOFT_MAX);
    const lastStop = Math.max(window.lastIndexOf(". "), window.lastIndexOf("! "), window.lastIndexOf("? "));
    body = lastStop >= 80 ? window.slice(0, lastStop + 1) : truncateAtWord(body, SUMMARY_SOFT_MAX);
  }
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
 * without it the "Aktualizacja" sentence is simply left out.
 */
export function homeDescription(updatedAt?: Date | string | null): string {
  const date = formatDatePL(updatedAt);
  const lead = "Aktualne promocje bankowe w Polsce: konta osobiste i firmowe z premią. Sprawdź kwotę, warunki, koszt i termin zapisów";
  const full = `${lead} – ze ściągą krok po kroku.`;
  if (!date) return full;
  const withDate = `${full} Aktualizacja: ${date}.`;
  // The plan's full wording is 170 characters with the date; keep the date
  // (freshness signal) and shorten the middle so the whole fits in 160.
  return withDate.length <= DESCRIPTION_MAX ? withDate : `${lead} – ze ściągą. Aktualizacja: ${date}.`;
}

/** /promocje <title> (pass as `{ absolute }`): "Ranking promocji bankowych – październik 2026 | Konta z premią". */
export function promotionsListTitle(now: Date): string {
  return `Ranking promocji bankowych – ${warsawMonthYear(now)} | Konta z premią`;
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
      ? `Konta osobiste z premią ${year} – ranking promocji`
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
    ? `Ranking ${subject} na konta osobiste z premią – kwota, trudność, koszt konta i termin zapisów. Sprawdź warunki i ściągę krok po kroku.`
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
    title: "Jak działają promocje bankowe – krok po kroku od wyboru do premii",
    description:
      "Jak działa promocja bankowa: od wyboru oferty i założenia konta po spełnienie warunków i odebranie premii. Wyjaśniamy też pojęcia, np. karencję."
  },
  jakZarabiamy: {
    path: "/jak-zarabiamy",
    title: "Jak zarabiamy – afiliacja i niezależność oceny",
    description:
      "Jak zarabia Bankmiplaci: linki partnerskie, wpływ wynagrodzenia na kolejność „Polecane” i niezależność oceny serwisu od prowizji."
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
    title: "Poradniki o promocjach bankowych i kontach z premią",
    description:
      "Poradniki o promocjach bankowych i kontach z premią: warunki, terminy, karencja i najczęstsze pułapki regulaminów."
  },
  kontakt: {
    path: "/kontakt",
    title: "Kontakt",
    description:
      "Nieaktualna promocja bankowa albo błąd w warunkach? Napisz do nas – każde zgłoszenie trafia do weryfikacji przed aktualizacją."
  }
} as const satisfies Record<string, StaticPageMeta>;

export type StaticPageKey = keyof typeof STATIC_PAGE_META;

/** Ready metadata for one of the static pages above. */
export function staticPageMetadata(key: StaticPageKey, overrides: Partial<Omit<BuildMetadataInput, "path">> = {}): Metadata {
  const page: StaticPageMeta = STATIC_PAGE_META[key];
  return buildMetadata({ title: page.title, description: page.description, path: page.path, ...overrides });
}
