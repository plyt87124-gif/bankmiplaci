/**
 * Pure decisions of the offer page (/promocje/[slug]): which state the offer is
 * in, how a fee / a deadline / a cooldown is worded, which lines of a free-text
 * field to show. No React, no database - the page, the components and the tests
 * all use the SAME rules.
 *
 * Hard rules encoded here (docs/redesign-v2/03 and 04):
 *  - nothing is invented: a missing value is "Brak danych", never 0 zl;
 *  - dates are the stored ones, days are counted on Poland's calendar;
 *  - the partner commission is not an input of anything on this page.
 */
import { formatDatePL, formatPLN, pluralizePl } from "@/lib/format";
import { deadlineState } from "@/lib/freshness";
import { isDeadlinePassed } from "@/lib/promotionAvailability";
import { formatCooldownWindow } from "@/lib/cooldownText";

/* ------------------------------------------------------------------ */
/* Offer state                                                         */
/* ------------------------------------------------------------------ */

export interface OfferStateInput {
  status: string;
  endDate: Date | string;
  /** Promotion.affiliateLinkEnabled */
  affiliateLinkEnabled: boolean;
}

export interface OfferState {
  /** Unpublished offer, visible only to a signed-in admin. */
  draft: boolean;
  /** The whole last sign-up day (Polish calendar) is over. */
  deadlinePassed: boolean;
  /** EXPIRED / ARCHIVED although the bank's deadline has not passed (we stopped promoting it). */
  notPromoted: boolean;
  /** No new sign-ups through us: ended, archived or not promoted. The CTA is off. */
  expired: boolean;
  /** Current offer, but our partner link is switched off (campaign not confirmed). */
  affiliateOff: boolean;
  /** The partner CTA (aside, bottom, sticky bar) is shown. */
  ctaLive: boolean;
}

/**
 * Same availability rule as /out/[slug] (promotionAvailability.ts), split into
 * the cases the page words differently. DRAFT keeps the CTA visible on purpose:
 * the admin preview shows the page as it will look.
 */
export function deriveOfferState(input: OfferStateInput, now: Date = new Date()): OfferState {
  const deadlinePassed = isDeadlinePassed(input.endDate, now);
  const inactive = input.status === "EXPIRED" || input.status === "ARCHIVED";
  const notPromoted = inactive && !deadlinePassed;
  const expired = inactive || deadlinePassed;
  const affiliateOff = !expired && !input.affiliateLinkEnabled;
  return {
    draft: input.status === "DRAFT",
    deadlinePassed,
    notPromoted,
    expired,
    affiliateOff,
    ctaLive: !expired && !affiliateOff
  };
}

/* ------------------------------------------------------------------ */
/* Fees                                                                */
/* ------------------------------------------------------------------ */

export type FeeKind = "free" | "conditional" | "paid" | "unknown";

export interface FeeLine {
  kind: FeeKind;
  /** The rate to print; null when unknown (print "Brak danych"). */
  cents: number | null;
  /** Waiver condition, trimmed; null when there is none. */
  waiver: string | null;
}

/**
 * The Fees row stores the rate charged WHEN the waiver condition is NOT met;
 * the waived rate is always 0 (see Fees in prisma/schema.prisma). So:
 *
 *   null (no Fees row / not verified)        -> unknown   "Brak danych" (never 0 zl)
 *   0 zl and no condition                    -> free      "0 zl"
 *   0 zl WITH a condition (contradictory)    -> unknown   (the real rate is not known)
 *   12 zl with a condition                   -> conditional "12 zl", "0 zl po spelnieniu warunku"
 *   12 zl and no condition                   -> paid      "12 zl"
 */
export function describeFee(cents: number | null | undefined, waiverCondition?: string | null): FeeLine {
  const waiver = waiverCondition?.trim() ? waiverCondition.trim() : null;
  if (cents == null || !Number.isFinite(cents) || cents < 0) return { kind: "unknown", cents: null, waiver };
  if (cents === 0) return waiver ? { kind: "unknown", cents: null, waiver } : { kind: "free", cents: 0, waiver: null };
  return waiver ? { kind: "conditional", cents, waiver } : { kind: "paid", cents, waiver: null };
}

/** "0 zl" / "12 zl" / "Brak danych" - the value as one string (FAQ, notes). */
export function feeValueText(fee: FeeLine): string {
  return fee.cents == null ? "Brak danych" : formatPLN(fee.cents);
}

/** One sentence per fee for the FAQ answer: "12 zl (0 zl po spelnieniu warunku)" / "brak danych - sprawdz tabele oplat banku". */
export function feeFaqText(fee: FeeLine): string {
  switch (fee.kind) {
    case "unknown":
      return "brak danych – sprawdź tabelę opłat banku";
    case "conditional":
      return `${formatPLN(fee.cents ?? 0)} (0 zł po spełnieniu warunku)`;
    default:
      return formatPLN(fee.cents ?? 0);
  }
}

/* ------------------------------------------------------------------ */
/* Deadline                                                            */
/* ------------------------------------------------------------------ */

export type FactTone = "neutral" | "warn" | "danger";

export interface TermFact {
  /** "do 31.10.2026" / "Zakończona 30.09.2026" / "Brak danych". */
  primary: string;
  /** "zostało 22 dni" / "ostatni dzień zapisów"; null when there is nothing to add. */
  secondary: string | null;
  tone: FactTone;
}

/** "został 1 dzień" / "zostały 3 dni" / "zostało 5 dni" - the verb agrees with the number (same rule as freshness.ts). */
export function remainingDaysText(days: number): string {
  const verb = pluralizePl(days, "został", "zostały", "zostało");
  return `${verb} ${days} ${pluralizePl(days, "dzień", "dni", "dni")}`;
}

/** The "Termin" fact of the summary bar and the aside. No countdown, no urgency copy: the date and the days left. */
export function termFact(endDate: Date | string | null | undefined, now: Date = new Date()): TermFact {
  const info = deadlineState(endDate, now);
  if (info.state === "unknown" || info.days === null) return { primary: "Brak danych", secondary: null, tone: "neutral" };
  if (info.state === "ended") return { primary: `Zakończona ${info.dateText}`, secondary: null, tone: "danger" };
  const tone: FactTone = info.state === "urgent" ? "danger" : info.state === "soon" ? "warn" : "neutral";
  return {
    primary: `do ${info.dateText}`,
    secondary: info.days === 0 ? "ostatni dzień zapisów" : remainingDaysText(info.days),
    tone
  };
}

/* ------------------------------------------------------------------ */
/* Cooldown (karencja) and cut-off date                                */
/* ------------------------------------------------------------------ */

export interface CooldownRule {
  /** Promotion.cooldownMonths (0 = a rule that adds no waiting time). */
  months: number | null;
  /** Promotion.cooldownCutoffDate. */
  cutoff: Date | null;
}

/** null when the promotion has no rule of either kind. */
export function cooldownRule(p: {
  cooldownMonths?: number | null;
  cooldownCutoffDate?: Date | string | null;
}): CooldownRule | null {
  const months = typeof p.cooldownMonths === "number" && Number.isFinite(p.cooldownMonths) ? p.cooldownMonths : null;
  const cutoffDate = p.cooldownCutoffDate ? new Date(p.cooldownCutoffDate) : null;
  const cutoff = cutoffDate && !Number.isNaN(cutoffDate.getTime()) ? cutoffDate : null;
  return months === null && cutoff === null ? null : { months, cutoff };
}

/** The short "Karencja" fact of the summary bar. */
export function cooldownShort(rule: CooldownRule): string {
  if (rule.months !== null) return rule.months === 0 ? "Bez karencji" : `Karencja ${rule.months} mies.`;
  return `Bez konta w banku od ${formatDatePL(rule.cutoff as Date)}`;
}

/**
 * The full sentences of the "Kiedy możesz otworzyć konto?" block (also used by
 * the FAQ). Wording kept from the pre-redesign page; "w banku X" avoids
 * declining the bank's name.
 */
export function cooldownSentences(rule: CooldownRule, bankName: string): string[] {
  const out: string[] = [];
  if (rule.cutoff) {
    out.push(
      `Możesz skorzystać z tej promocji, jeśli nie miałeś/aś konta w banku ${bankName} od ${formatDatePL(rule.cutoff)}.`
    );
  }
  if (rule.months !== null) {
    out.push(
      rule.months === 0
        ? `Według naszych danych po zamknięciu konta w banku ${bankName} nie obowiązuje dodatkowy okres karencji.`
        : `Możesz skorzystać z tej promocji, jeśli ${formatCooldownWindow(rule.months)} przed złożeniem wniosku nie miałeś/aś konta w banku ${bankName}.`
    );
  }
  return out;
}

/** The plain-language definition used wherever "karencja" first appears (same meaning as the FAQ). */
export const COOLDOWN_EXPLAINER =
  "Karencja to okres, w którym bank nie przyznaje promocji osobie, która niedawno miała u niego konto.";

/* ------------------------------------------------------------------ */
/* Text helpers                                                        */
/* ------------------------------------------------------------------ */

/**
 * Lines of a free-text field (eligibleFor / notEligibleFor): one entry per
 * non-empty line, a leading bullet or "1." removed. A single-line text gives a
 * single entry, so the caller can show a paragraph instead of a list.
 */
export function splitLines(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-–—•*]|\d{1,2}[.)])\s+/, "").trim())
    .filter(Boolean);
}

/** http(s) URL or null: a link typed in the admin panel never reaches an href unchecked. */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Host of a URL without "www." for a link label ("aliorbank.pl"); "" when it cannot be parsed. */
export function hostLabel(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * `?ref=` of the offer page (token of the "you can join now" e-mail). The first
 * value only, trimmed and capped, so a crafted URL cannot stuff a huge string
 * into the tracked CTA link.
 */
export function normalizeRef(ref: string | string[] | undefined): string | undefined {
  const first = Array.isArray(ref) ? ref[0] : ref;
  if (typeof first !== "string") return undefined;
  const value = first.trim();
  return value ? value.slice(0, 120) : undefined;
}

/* ------------------------------------------------------------------ */
/* Links                                                               */
/* ------------------------------------------------------------------ */

/** Where "Jak liczymy?" leads: the methodology page once it is live, until then the rating section of "Jak zarabiamy". */
export function methodologyHref(isLive: boolean, anchor?: string): string {
  return isLive ? `/metodologia${anchor ? `#${anchor}` : ""}` : "/jak-zarabiamy#ocena";
}

/** "Zgłoś błąd w tej ofercie": the contact form with the offer's slug prefilled (see kontakt/initialMessage.ts). */
export function reportErrorHref(slug: string): string {
  return `/kontakt?oferta=${encodeURIComponent(slug)}`;
}

/** The bank's page of offers: /banki/{slug} once it exists, until then the filtered list. */
export function bankOffersListHref(bankSlug: string, bankPagesLive: boolean): string {
  return bankPagesLive ? `/banki/${encodeURIComponent(bankSlug)}` : `/promocje?bank=${encodeURIComponent(bankSlug)}`;
}

/* ------------------------------------------------------------------ */
/* Other offers of the same bank                                       */
/* ------------------------------------------------------------------ */

export const BANK_OFFERS_LIMIT = 4;
export const BANK_OFFERS_LIMIT_ENDED = 3;

/**
 * Offers to show under an offer: the bank's other CURRENT offers (the list is
 * already in the "Polecane" order). For an ended offer the same account type
 * comes first ("Aktualne promocje banku", 3 cards), then the rest.
 */
export function pickBankOffers<T extends { slug: string; accountType: string }>(
  cards: readonly T[],
  current: { slug: string; accountType: string },
  ended: boolean
): T[] {
  const others = cards.filter((c) => c.slug !== current.slug);
  if (!ended) return others.slice(0, BANK_OFFERS_LIMIT);
  const sameType = others.filter((c) => c.accountType === current.accountType);
  const rest = others.filter((c) => c.accountType !== current.accountType);
  return [...sameType, ...rest].slice(0, BANK_OFFERS_LIMIT_ENDED);
}
