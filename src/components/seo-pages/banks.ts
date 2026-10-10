/**
 * Pure model of the bank pages, /banki and /banki/[slug]
 * (docs/redesign-v2/03-content-and-seo-plan.md, section E). No React, no
 * database: the loaders (bankData.ts) feed it with rows, the tests with fixtures.
 *
 * A bank page is PERMANENT: it does not disappear when the bank's offers end.
 *   - an unknown slug, or a bank with no public offer at all (no row, or only
 *     drafts), is a real 404 (resolveBankPage);
 *   - a bank with at least one ACTIVE or EXPIRED offer is indexable - exactly
 *     the rule src/app/sitemap.ts uses to list /banki/{slug} (BANK_PAGE_STATUSES
 *     is the same list; tests/seo-pages-banks.test.tsx compares them), so the
 *     sitemap can never advertise a noindex page;
 *   - a bank that has only ARCHIVED offers (manually retired) answers 200 but
 *     is noindex and not listed on /banki.
 * Facts only: names, dates and types come from the rows; nothing is invented.
 */
import { isBusinessType } from "@/lib/accountTypes";
import { LATEST_VERIFICATION_LABEL } from "@/lib/disclosureCopy";
import { ACCOUNT_TYPE_LABEL, formatDatePL, pluralizePl } from "@/lib/format";
import { isDeadlinePassed, robotsForStatus } from "@/lib/promotionAvailability";
import { formatAmountPlain } from "@/lib/seo";
import type { SeoFaqItem } from "./shared";

/** Offer statuses that make a bank indexable and listed (= the sitemap's OFFER_STATUSES). */
export const BANK_PAGE_STATUSES = ["ACTIVE", "EXPIRED"] as const;
/** Offer statuses that make a bank page exist at all (DRAFT never does). */
export const BANK_VISIBLE_STATUSES = ["ACTIVE", "EXPIRED", "ARCHIVED"] as const;

/** "Zakończone promocje banku" shows at most this many offers, newest first. */
export const ENDED_OFFERS_LIMIT = 6;

export interface BankRecord {
  slug: string;
  name: string;
  logoUrl: string | null;
  /** Bank.description: a short, factual text; shown only when it is not blank. */
  description: string | null;
}

/** The slim row the bank page needs about each non-draft offer of the bank. */
export interface BankOfferRow {
  slug: string;
  name: string;
  /** Prisma PromotionStatus. */
  status: string;
  /** Prisma AccountType. */
  accountType: string;
  /** Last sign-up day (00:00 UTC of that date). */
  endDate: Date;
}

/** Slugs are lower-case letters, digits and dashes (the admin form's rule); anything else cannot name a bank. */
export function isPlausibleBankSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= 80 && /^[a-z0-9-]+$/.test(slug);
}

export type BankPageState = { kind: "not-found" } | { kind: "page"; indexable: boolean };

/**
 * What /banki/[slug] does for the rows it found: 404 only when the bank does
 * not exist or has no public offer; otherwise a page, indexable when the bank
 * has an ACTIVE or EXPIRED offer.
 */
export function resolveBankPage(bank: BankRecord | null, offers: readonly BankOfferRow[]): BankPageState {
  if (!bank) return { kind: "not-found" };
  const visible = offers.filter((o) => (BANK_VISIBLE_STATUSES as readonly string[]).includes(o.status));
  if (visible.length === 0) return { kind: "not-found" };
  return { kind: "page", indexable: isBankIndexable(visible) };
}

/** True when the bank has an offer the sitemap lists (ACTIVE or EXPIRED). */
export function isBankIndexable(offers: readonly Pick<BankOfferRow, "status">[]): boolean {
  return offers.some((o) => (BANK_PAGE_STATUSES as readonly string[]).includes(o.status));
}

/* ------------------------------------------------------------------ */
/* Ended offers                                                        */
/* ------------------------------------------------------------------ */

/** An offer whose last sign-up day has passed (ACTIVE the cron has not flipped yet, or EXPIRED). */
export function isEndedOffer(row: Pick<BankOfferRow, "status" | "endDate">, now: Date): boolean {
  return (BANK_PAGE_STATUSES as readonly string[]).includes(row.status) && isDeadlinePassed(row.endDate, now);
}

export interface EndedOffers {
  /** Newest ended first, at most ENDED_OFFERS_LIMIT. */
  shown: BankOfferRow[];
  /** Ended offers not shown. */
  hidden: number;
  total: number;
}

export function endedOffersOf(rows: readonly BankOfferRow[], now: Date): EndedOffers {
  const ended = rows
    .filter((row) => isEndedOffer(row, now))
    .sort((a, b) => b.endDate.getTime() - a.endDate.getTime());
  const shown = ended.slice(0, ENDED_OFFERS_LIMIT);
  return { shown, hidden: ended.length - shown.length, total: ended.length };
}

/**
 * Link to an ended offer's page, only while that page is indexable
 * (robotsForStatus: ended up to 90 days ago); older ones are listed as plain
 * text so the page does not push visitors to a noindex archive.
 */
export function endedOfferHref(row: Pick<BankOfferRow, "slug" | "status" | "endDate">, now: Date): string | null {
  return robotsForStatus(row.status, row.endDate, now).index ? `/promocje/${row.slug}` : null;
}

export function endedOffersNote(ended: EndedOffers): string | null {
  if (ended.hidden <= 0) return null;
  return `Pokazujemy ${ended.shown.length} najnowszych z ${ended.total} zakończonych promocji tego banku.`;
}

/** "Konto osobiste" / "Konto firmowe" ... for a row; an unknown type gets no label. */
export function accountTypeLabel(accountType: string): string | null {
  return (ACCOUNT_TYPE_LABEL as Record<string, string>)[accountType] ?? null;
}

/* ------------------------------------------------------------------ */
/* Bank text                                                           */
/* ------------------------------------------------------------------ */

/** Bank.description as paragraphs (blank lines separate them); [] when it is null or blank. */
export function bankDescriptionParagraphs(description: string | null | undefined): string[] {
  if (!description) return [];
  return description
    .split(/\r?\n\s*\r?\n/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** "4 aktualne promocje" / "Brak aktualnych promocji" - the line of a bank on /banki. */
export function activeCountText(count: number): string {
  if (count <= 0) return "Brak aktualnych promocji";
  return `${count} ${pluralizePl(count, "aktualna promocja", "aktualne promocje", "aktualnych promocji")}`;
}

export interface BankIndexRow {
  slug: string;
  name: string;
  logoUrl: string | null;
  activeCount: number;
}

/** Alphabetical by name (Polish collation, case-insensitive); a copy. */
export function sortBanks<T extends { name: string }>(banks: readonly T[]): T[] {
  return [...banks].sort((a, b) => a.name.localeCompare(b.name, "pl", { sensitivity: "base" }));
}

export function bankIndexLead(bankCount: number): string {
  if (bankCount <= 0) return "Na razie nie mamy banków z promocjami do pokazania.";
  const banks = `${bankCount} ${pluralizePl(bankCount, "banku", "banków", "banków")}`;
  return `Analizujemy promocje ${banks}. Przy każdym widzisz liczbę aktualnych ofert, a na stronie banku znajdziesz też promocje zakończone.`;
}

/* ------------------------------------------------------------------ */
/* FAQ made of the bank's data                                         */
/* ------------------------------------------------------------------ */

export interface BankFaqCard {
  accountType: string;
  maxBonusCents: number;
  endDate: Date | string;
}

/**
 * Two questions whose answers are computed from the bank's current offers
 * (counts, the highest bonus, the nearest and the farthest deadline) - the page
 * is generated per request, so they are always true to the data. No question
 * for a bank without current offers.
 *
 * Bank names are never inflected (the Polish case endings of "Alior Bank",
 * "mBank" or "Nest! BANK" cannot be guessed safely): the name is the subject in
 * the nominative ("{Bank} ma w serwisie ...") or follows a dash in the question
 * ("Do kiedy trwają promocje – {Bank}?"). One offer reads in the singular only.
 */
export function bankFaq(bankName: string, cards: readonly BankFaqCard[]): SeoFaqItem[] {
  if (cards.length === 0) return [];
  const n = cards.length;
  const business = cards.filter((c) => isBusinessType(c.accountType)).length;
  const personal = n - business;
  const maxBonus = Math.max(...cards.map((c) => c.maxBonusCents));
  const bonus = maxBonus > 0 ? formatAmountPlain(maxBonus) : null;

  let availableAnswer: string;
  if (n === 1) {
    const kind = business > 0 ? "dla firm" : "dla osób fizycznych";
    availableAnswer =
      `${bankName} ma w serwisie 1 aktualną promocję (${kind})` +
      (bonus ? `: premia do ${bonus}.` : ".") +
      " Sprawdź jej warunki, termin i opłaty.";
  } else {
    const count = pluralizePl(n, "aktualną promocję", "aktualne promocje", "aktualnych promocji");
    const split =
      personal > 0 && business > 0
        ? `: ${personal} dla osób fizycznych i ${business} dla firm`
        : personal > 0
          ? ", wszystkie dla osób fizycznych"
          : ", wszystkie dla firm";
    availableAnswer =
      `${bankName} ma w serwisie ${n} ${count}${split}. ` +
      (bonus ? `Najwyższa premia to do ${bonus}. ` : "") +
      "Warunki, terminy i opłaty różnią się między ofertami, dlatego sprawdź każdą z nich.";
  }

  const dates = cards.map((c) => new Date(c.endDate).getTime()).filter((t) => !Number.isNaN(t));
  const items: SeoFaqItem[] = [{ question: `Jakie promocje ma teraz ${bankName}?`, answer: availableAnswer }];
  if (dates.length > 0) {
    const first = formatDatePL(new Date(Math.min(...dates)));
    const last = formatDatePL(new Date(Math.max(...dates)));
    const when =
      first === last
        ? n === 1
          ? `Termin zapisów mija ${first}.`
          : `Termin zapisów na wszystkie aktualne promocje mija ${first}.`
        : `Najbliższy termin zapisów mija ${first}, a najdalszy ${last}.`;
    items.push({
      question: `Do kiedy trwają promocje – ${bankName}?`,
      answer: `${when} Bank może zakończyć promocję wcześniej, na przykład gdy wyczerpie się pula nagród, dlatego sprawdź termin także w regulaminie banku.`
    });
  }
  return items;
}

/* ------------------------------------------------------------------ */
/* Summary paragraph of a (thin) bank page                              */
/* ------------------------------------------------------------------ */

/** What the summary reads from a current offer (PromotionCardData has all of it). */
export interface BankSummaryCard {
  accountType: string;
  maxBonusCents: number;
  endDate: Date | string;
  lastVerifiedAt?: Date | string | null;
}

/** The kind of account in the genitive, singular and plural, for "Oferta dotyczy ...". */
const ACCOUNT_KIND_GENITIVE: Record<string, { one: string; many: string }> = {
  PERSONAL: { one: "konta osobistego", many: "kont osobistych" },
  BUSINESS: { one: "konta firmowego", many: "kont firmowych" },
  SAVINGS: { one: "konta oszczędnościowego", many: "kont oszczędnościowych" },
  YOUNG: { one: "konta dla młodych", many: "kont dla młodych" },
  JOINT: { one: "konta wspólnego", many: "kont wspólnych" }
};

function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} i ${items[items.length - 1]}`;
}

/**
 * A short paragraph made ONLY of the bank's current offers: the kinds of
 * accounts, the range of the maximum bonuses, the range of sign-up deadlines and
 * the date the newest offer was checked ("7 paź 2026"). What the data does not
 * have (no bonus above 0, no usable date) is left out - nothing is guessed.
 * `null` for a bank without current offers.
 */
export function bankSummary(cards: readonly BankSummaryCard[]): string | null {
  if (cards.length === 0) return null;
  const single = cards.length === 1;
  const sentences: string[] = [];

  const kinds = [...new Set(cards.map((c) => c.accountType))]
    .map((type) => ACCOUNT_KIND_GENITIVE[type])
    .filter((kind): kind is { one: string; many: string } => kind !== undefined)
    .map((kind) => (single ? kind.one : kind.many));
  if (kinds.length > 0) {
    sentences.push(single ? `Aktualna oferta dotyczy ${kinds[0]}.` : `Aktualne oferty dotyczą ${joinList(kinds)}.`);
  }

  const bonuses = cards.map((c) => c.maxBonusCents).filter((cents) => Number.isFinite(cents) && cents > 0);
  if (bonuses.length > 0) {
    const low = Math.min(...bonuses);
    const high = Math.max(...bonuses);
    sentences.push(
      low === high
        ? `Premia do ${formatAmountPlain(high)}.`
        : `Maksymalne kwoty premii: od ${formatAmountPlain(low)} do ${formatAmountPlain(high)}.`
    );
  }

  const ends = cards.map((c) => new Date(c.endDate).getTime()).filter((t) => !Number.isNaN(t));
  if (ends.length > 0) {
    const first = formatDatePL(new Date(Math.min(...ends)));
    const last = formatDatePL(new Date(Math.max(...ends)));
    sentences.push(first === last ? `Termin zapisów mija ${first}.` : `Terminy zapisów mijają od ${first} do ${last}.`);
  }

  const verified = cards
    .map((c) => (c.lastVerifiedAt ? new Date(c.lastVerifiedAt).getTime() : Number.NaN))
    .filter((t) => !Number.isNaN(t));
  if (verified.length > 0) {
    sentences.push(`${LATEST_VERIFICATION_LABEL}: ${formatDatePL(new Date(Math.max(...verified)), "short")}.`);
  }

  return sentences.length > 0 ? sentences.join(" ") : null;
}
