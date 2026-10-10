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
  const banks = `${bankCount} ${pluralizePl(bankCount, "bank", "banki", "banków")}`;
  return `Banki, których promocje analizujemy: ${banks}. Przy każdym z nich widzisz, ile aktualnych promocji mamy w serwisie; po wejściu na stronę banku zobaczysz też te, które już się zakończyły.`;
}

/* ------------------------------------------------------------------ */
/* FAQ made of the bank's data                                         */
/* ------------------------------------------------------------------ */

export interface BankFaqCard {
  accountType: string;
  maxBonusCents: number;
  endDate: Date | string;
}

const ACCUSATIVE = (n: number) => pluralizePl(n, "aktualną promocję", "aktualne promocje", "aktualnych promocji");

/**
 * Two questions whose answers are computed from the bank's current offers
 * (counts, the highest bonus, the nearest and the farthest deadline) - the page
 * is generated per request, so they are always true to the data. No question
 * for a bank without current offers.
 */
export function bankFaq(bankName: string, cards: readonly BankFaqCard[]): SeoFaqItem[] {
  if (cards.length === 0) return [];
  const n = cards.length;
  const business = cards.filter((c) => c.accountType === "BUSINESS").length;
  const personal = n - business;
  const parts = [personal > 0 ? `${personal} dla osób fizycznych` : null, business > 0 ? `${business} dla firm` : null].filter(
    (part): part is string => part !== null
  );
  const maxBonus = Math.max(...cards.map((c) => c.maxBonusCents));

  const split = n === 1 ? ` (${parts[0]?.replace(/^1 /, "") ?? ""})` : `, w tym ${parts.join(" i ")}`;
  const availableAnswer =
    `W serwisie mamy teraz ${n} ${ACCUSATIVE(n)} w ofercie: ${bankName}${split}. ` +
    (maxBonus > 0 ? `Najwyższa premia w tych ofertach to do ${formatAmountPlain(maxBonus)}. ` : "") +
    "Warunki, terminy i opłaty różnią się między ofertami, dlatego sprawdź każdą z nich.";

  const dates = cards.map((c) => new Date(c.endDate).getTime()).filter((t) => !Number.isNaN(t));
  const items: SeoFaqItem[] = [{ question: `Jakie promocje ma teraz ${bankName}?`, answer: availableAnswer }];
  if (dates.length > 0) {
    const first = formatDatePL(new Date(Math.min(...dates)));
    const last = formatDatePL(new Date(Math.max(...dates)));
    const when = first === last ? `Termin zapisów mija ${first}.` : `Najbliższy termin zapisów mija ${first}, a najdalszy ${last}.`;
    items.push({
      question: `Do kiedy trwają te promocje (${bankName})?`,
      answer: `${when} Bank może zakończyć promocję wcześniej, na przykład gdy wyczerpie się pula nagród, dlatego sprawdź termin także w regulaminie banku.`
    });
  }
  return items;
}
