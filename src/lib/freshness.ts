/**
 * Data-trust indicators computed from stored dates: how fresh the last
 * verification is (`lastVerifiedAt`) and how close the offer's deadline is
 * (`endDate`). Pure functions of (date, now): the clock is always passed in,
 * so tests are deterministic and so is a build running in UTC.
 *
 * All calendar arithmetic happens in Europe/Warsaw via the shared helpers
 * (seo/dates.ts for the calendar day, format.ts for dd.mm.rrrr and the
 * end-date convention), never with a local `new Date().getDate()`.
 *
 * Nothing here invents data: a missing or unparsable date yields "unknown",
 * never a default like "verified today" or "ends in 30 days".
 */
import { daysUntil, formatDatePL, pluralizePl } from "@/lib/format";
import { isoDatePL, toValidDate, warsawCalendarDate } from "@/lib/seo/dates";

const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Verification freshness
// ---------------------------------------------------------------------------

/** Verified at most this many calendar days ago = fresh. */
export const FRESH_MAX_DAYS = 14;
/** Up to this many days = aging; beyond it = stale. */
export const AGING_MAX_DAYS = 45;

export type FreshnessState = "fresh" | "aging" | "stale" | "unknown";

/** Index of a Warsaw calendar day (days since 1970-01-01), for exact day differences. */
function warsawDayIndex(instant: Date): number {
  const { year, month, day } = warsawCalendarDate(instant);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

/**
 * Whole calendar days (Europe/Warsaw) between the verification and `now`:
 * 0 = verified today. `null` when the date is missing/invalid. A date in the
 * future by up to a day (clock skew) counts as 0; further ahead it is invalid data (null).
 */
export function daysSinceVerified(
  lastVerifiedAt: Date | string | null | undefined,
  now: Date = new Date()
): number | null {
  const verified = toValidDate(lastVerifiedAt);
  const current = toValidDate(now);
  if (!verified || !current) return null;
  const diff = warsawDayIndex(current) - warsawDayIndex(verified);
  // More than a day ahead is a data error (typo in the admin), not "verified today".
  if (diff < -1) return null;
  return Math.max(0, diff);
}

/** fresh (<= 14 days), aging (15-45), stale (> 45), unknown (no usable date). */
export function freshnessState(lastVerifiedAt: Date | string | null | undefined, now: Date = new Date()): FreshnessState {
  const days = daysSinceVerified(lastVerifiedAt, now);
  if (days === null) return "unknown";
  if (days <= FRESH_MAX_DAYS) return "fresh";
  if (days <= AGING_MAX_DAYS) return "aging";
  return "stale";
}

export interface FreshnessInfo {
  state: FreshnessState;
  /** Whole days since the verification, null when unknown. */
  days: number | null;
  /** "Zweryfikowano" or, when there is no date, the whole sentence. */
  prefix: string;
  /** "6 paź 2026" (Warsaw calendar day), null when unknown. */
  dateText: string | null;
  /** `yyyy-mm-dd` for <time dateTime>, null when unknown. */
  iso: string | null;
  /** Extra clause after the date (stale only), null otherwise. */
  suffix: string | null;
  /** The whole line as a reader sees it. */
  text: string;
}

export const VERIFIED_PREFIX = "Zweryfikowano";
export const NO_VERIFICATION_DATE_TEXT = "Brak daty weryfikacji";
export const STALE_SUFFIX = "dane mogą być nieaktualne";

/**
 * Labels for the verification line (design spec, PromotionCard section 5):
 *   <= 14 days   "Zweryfikowano 6 paź 2026"
 *   15-45 days   "Zweryfikowano 6 paź 2026"
 *   > 45 days    "Zweryfikowano 6 paź 2026 – dane mogą być nieaktualne"
 *   no date      "Brak daty weryfikacji"
 */
export function describeFreshness(lastVerifiedAt: Date | string | null | undefined, now: Date = new Date()): FreshnessInfo {
  const state = freshnessState(lastVerifiedAt, now);
  const days = daysSinceVerified(lastVerifiedAt, now);
  if (state === "unknown" || days === null) {
    return {
      state: "unknown",
      days: null,
      prefix: NO_VERIFICATION_DATE_TEXT,
      dateText: null,
      iso: null,
      suffix: null,
      text: NO_VERIFICATION_DATE_TEXT
    };
  }
  const dateText = formatDatePL(lastVerifiedAt as Date | string, "short");
  const suffix = state === "stale" ? STALE_SUFFIX : null;
  return {
    state,
    days,
    prefix: VERIFIED_PREFIX,
    dateText,
    iso: isoDatePL(lastVerifiedAt),
    suffix,
    text: suffix ? `${VERIFIED_PREFIX} ${dateText} – ${suffix}` : `${VERIFIED_PREFIX} ${dateText}`
  };
}

// ---------------------------------------------------------------------------
// Deadline
// ---------------------------------------------------------------------------

/** At most this many days left = warning colour. */
export const DEADLINE_WARN_DAYS = 14;
/** At most this many days left = red. */
export const DEADLINE_URGENT_DAYS = 3;

/**
 * open    more than 14 days left (neutral)
 * soon    4-14 days left (warning)
 * urgent  0-3 days left (red); 0 = today is the last day
 * ended   the last day has passed
 * unknown no usable end date
 */
export type DeadlineState = "open" | "soon" | "urgent" | "ended" | "unknown";

export interface DeadlineInfo {
  state: DeadlineState;
  /** Calendar days to the last sign-up day (0 = today, negative = ended), null when unknown. */
  days: number | null;
  /** "31.10.2026", null when unknown. */
  dateText: string | null;
  /** `yyyy-mm-dd` for <time dateTime>, null when unknown. */
  iso: string | null;
  /** Short label: "Ważna do 31.10.2026" / "Koniec za 5 dni" / "Koniec dziś" / "Zakończona". */
  label: string;
  /** Label with the missing half added: the date for soon/urgent/ended, the days left for open. */
  detailedLabel: string;
}

const DAYS = (n: number) => `${n} ${pluralizePl(n, "dzień", "dni", "dni")}`;

/** "został 1 dzień" / "zostały 3 dni" / "zostało 22 dni" - the verb agrees with the number. */
function remainingText(n: number): string {
  const form = pluralizePl(n, "został", "zostały", "zostało");
  return `${form} ${DAYS(n)}`;
}

/**
 * Deadline state and wording. `endDate` is the LAST day the offer can be
 * joined (stored as 00:00 UTC of that date); `days` follows the shared
 * convention of format.ts#daysUntil, so this agrees with isDeadlinePassed()
 * and the /out gate. No countdowns and no urgency copy: just the facts.
 */
export function deadlineState(endDate: Date | string | null | undefined, now: Date = new Date()): DeadlineInfo {
  const days = daysUntil(endDate, now);
  if (days === null) {
    return { state: "unknown", days: null, dateText: null, iso: null, label: "", detailedLabel: "" };
  }
  const dateText = formatDatePL(endDate as Date | string, "numeric");
  const iso = isoDatePL(endDate);

  if (days < 0) {
    return {
      state: "ended",
      days,
      dateText,
      iso,
      label: "Zakończona",
      detailedLabel: `Zakończona ${dateText}`
    };
  }
  if (days <= DEADLINE_WARN_DAYS) {
    const label = days === 0 ? "Koniec dziś" : `Koniec za ${DAYS(days)}`;
    return {
      state: days <= DEADLINE_URGENT_DAYS ? "urgent" : "soon",
      days,
      dateText,
      iso,
      label,
      detailedLabel: `${label} (do ${dateText})`
    };
  }
  const label = `Ważna do ${dateText}`;
  return { state: "open", days, dateText, iso, label, detailedLabel: `${label}, ${remainingText(days)}` };
}
