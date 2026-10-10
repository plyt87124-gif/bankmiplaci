/**
 * Pure decisions of the offer page (/promocje/[slug]): which state the offer is
 * in, how a deadline / a cooldown is worded, which lines of a free-text field to
 * show. No React, no database - the page, the components and the tests all use
 * the SAME rules. (Fees are read by the shared model in src/lib/feeModel.ts.)
 *
 * Hard rules encoded here (docs/redesign-v2/03 and 04):
 *  - nothing is invented: a missing value is "Brak danych", never 0 zl;
 *  - dates are the stored ones, days are counted on Poland's calendar;
 *  - the partner commission is not an input of anything on this page.
 */
import { formatDatePL, pluralizePl } from "@/lib/format";
import { deadlineState } from "@/lib/freshness";
import { isDeadlinePassed } from "@/lib/promotionAvailability";
import { formatCooldownWindow } from "@/lib/cooldownText";
import { KARENCJA_DEFINITION } from "@/lib/glossary";

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
 * The availability rules of promotionAvailability.ts, split into the cases the
 * page words differently. For a published offer `ctaLive` equals
 * isAffiliateLinkLive() - what /out/[slug] enforces (open sign-up, then the
 * campaign switch). The ONE deliberate difference is DRAFT: the admin preview
 * keeps the CTA so the page looks as it will once published, although /out/[slug]
 * sends a DRAFT to /promocje?niedostepna=1 (OfferCta says so under the button).
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

/**
 * THE rule for wording a cooldown in short form; the summary bar
 * (cooldownShort) and the comparison table (compareModel.cooldownLines) both
 * read it, so one offer never says two different things.
 *
 *   months > 0             "Karencja N mies. od zamknięcia konta" (a rolling period)
 *   a cut-off date         "Wymagane: brak konta w tym banku od <date>" (a fixed date)
 *   months === 0, no date  "Bez karencji"
 *   months === 0 + date    ONLY the date line: the date is a concrete
 *                          requirement, and "Bez karencji" next to it would
 *                          contradict it
 *   months > 0 + date      both lines (two different checks)
 *   nothing stored         [] - callers print "Brak danych"; we never claim
 *                          that there is no karencja without data
 */
export function cooldownLines(rule: CooldownRule): string[] {
  const lines: string[] = [];
  if (rule.months !== null && !(rule.months === 0 && rule.cutoff)) {
    lines.push(rule.months === 0 ? "Bez karencji" : `Karencja ${rule.months} mies. od zamknięcia konta`);
  }
  if (rule.cutoff) lines.push(`Wymagane: brak konta w tym banku od ${formatDatePL(rule.cutoff)}`);
  return lines;
}

/**
 * The short "Karencja" fact of the summary bar: the first line of
 * cooldownLines (the months rule, or the date when it is the only requirement
 * or when "0 months" would contradict it).
 */
export function cooldownShort(rule: CooldownRule): string {
  return cooldownLines(rule)[0] ?? "Brak danych";
}

/**
 * What "konto w tym banku" covers is the regulation's business: Pekao excludes
 * any "umowa o produkty i usługi", Alior speaks of ROR, PKO of an account in
 * zloty. We store only the date or the number of months, so the text never
 * says WHICH products count and points to the regulation instead.
 */
export const COOLDOWN_SCOPE_NOTE = "Szczegółowy zakres (jakie produkty się liczą) podaje regulamin promocji.";

/**
 * The full sentences of the "Kiedy możesz otworzyć konto?" block (also used by
 * the FAQ). Impersonal wording, and "w tym banku" instead of the bank's name
 * ("w banku Bank Pekao" was a tautology and the name cannot be declined). When a
 * date or a period is stored, the last sentence is COOLDOWN_SCOPE_NOTE. The
 * `bankName` argument is no longer used; it stays so that callers do not change.
 */
export function cooldownSentences(rule: CooldownRule, _bankName?: string): string[] {
  const out: string[] = [];
  if (rule.cutoff) {
    out.push(`Z promocji mogą skorzystać osoby, które od ${formatDatePL(rule.cutoff)} nie miały konta w tym banku.`);
  }
  if (rule.months !== null && !(rule.months === 0 && rule.cutoff)) {
    // months === 0 next to a date: the date line above is the whole requirement, "no extra period" would contradict it.
    out.push(
      rule.months === 0
        ? "Według naszych danych po zamknięciu konta w tym banku nie obowiązuje dodatkowy okres karencji."
        : `Z promocji mogą skorzystać osoby, które ${formatCooldownWindow(rule.months)} przed złożeniem wniosku nie miały konta w tym banku.`
    );
  }
  if (rule.cutoff || (rule.months !== null && rule.months > 0)) out.push(COOLDOWN_SCOPE_NOTE);
  return out;
}

/** The plain-language definition used wherever "karencja" first appears (same meaning as the FAQ). */
export const COOLDOWN_EXPLAINER = KARENCJA_DEFINITION;

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

/** "200" and "1 200" for whole zloty, "10,50" and "1 200,50" with grosze: how the amount may be typed inside a label. */
function amountForms(cents: number): string[] {
  const zloty = cents / 100;
  const whole = String(Math.trunc(zloty));
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  if (cents % 100 === 0) return [...new Set([whole, grouped])];
  const decimals = zloty.toFixed(2).slice(-2);
  return [...new Set([`${whole},${decimals}`, `${grouped},${decimals}`])];
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Part labels of a bonus are often stored WITH their amount ("Nagroda za 1.
 * miesiąc po złożeniu wniosku — 200 zł"), while the page prints the amount in a
 * column of its own. This cuts a trailing "— 200 zł" or "(200 zł)" that equals
 * `amountCents` (the amount formatPLN prints), so it is not said twice.
 * The same goes for "Nagroda I — 200 zł (10 dni po zawarciu umów)": the amount
 * before a closing remark in parentheses is cut, the remark stays.
 * Nothing else is touched: an amount that differs from the part's ("(4× 100 zł)"
 * for 400 zł), one with a qualifier ("— do 120 zł") or one elsewhere in the
 * label stays, and a label that would become empty is returned whole.
 */
export function labelWithoutAmount(label: string, amountCents: number): string {
  // \s also covers the non-breaking and narrow no-break spaces Intl puts into amounts.
  const text = label.replace(/\s+/g, " ").trim();
  if (!Number.isFinite(amountCents) || amountCents <= 0) return text;
  for (const form of amountForms(amountCents)) {
    const amount = escapeRegExp(form);
    const money = String.raw`${amount}\s?(?:zł|zl|PLN)`;
    const trailing = new RegExp(String.raw`(?:\s+[—–-]\s+${money}|\s*\(\s*${money}\s*\))$`, "i").exec(text);
    if (trailing) {
      const rest = text.slice(0, trailing.index).replace(/[\s,;:—–-]+$/, "");
      return rest || text;
    }
    // "— 200 zł (remark)": drop the dash and the amount, keep the closing remark.
    const beforeRemark = new RegExp(String.raw`\s+[—–-]\s+${money}(?=\s*\([^()]*\)$)`, "i").exec(text);
    if (beforeRemark) {
      const rest = (text.slice(0, beforeRemark.index) + text.slice(beforeRemark.index + beforeRemark[0].length)).trim();
      return rest || text;
    }
  }
  return text;
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
