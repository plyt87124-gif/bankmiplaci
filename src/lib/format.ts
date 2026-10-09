/** All monetary amounts are stored as integer grosze (PLN * 100). */
export function formatPLN(cents: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2
  }).format(cents / 100);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

/** Full precision (down to the second) — used for admin notification feeds, where "which exact moment did this happen" matters more than a bare date. */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(d);
}

import type { Difficulty, AccountType } from "@prisma/client";
import { isDeadlinePassed, signupCutoff } from "@/lib/promotionAvailability";

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  VERY_EASY: "Bardzo łatwa",
  EASY: "Łatwa",
  MEDIUM: "Średnia",
  HARD: "Trudna"
};

/**
 * @deprecated Legacy 1-5 score from the old 5-segment meter (HARD = 5). The
 * v2 EffortMeter has 4 segments mapped 1:1 - use DIFFICULTY_LEVEL or pass
 * `difficulty` to <EffortMeter>. Kept unchanged for not-yet-migrated callers
 * (EffortMeter clamps 5 down to 4).
 */
export const DIFFICULTY_EFFORT: Record<Difficulty, number> = {
  VERY_EASY: 1,
  EASY: 2,
  MEDIUM: 3,
  HARD: 5
};

/** v2 EffortMeter level: 4 segments, one per Difficulty value. */
export const DIFFICULTY_LEVEL: Record<Difficulty, 1 | 2 | 3 | 4> = {
  VERY_EASY: 1,
  EASY: 2,
  MEDIUM: 3,
  HARD: 4
};

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  PERSONAL: "Konto osobiste",
  SAVINGS: "Konto oszczędnościowe",
  YOUNG: "Konto dla młodych",
  BUSINESS: "Konto firmowe",
  JOINT: "Konto wspólne"
};

/** Whole last day (Polish calendar) has passed — see promotionAvailability.ts. */
export function isExpired(endDate: Date | string): boolean {
  return isDeadlinePassed(endDate);
}

/**
 * Single source of truth for rendering a nullable fee amount, used by
 * every card/table that shows a fee without room for the waiver
 * condition's full text (PromotionCard, /porownaj, admin promotions
 * list). `null`/`undefined` means "not verified yet" and must never
 * read as free — see Fees in prisma/schema.prisma. A `*` is appended
 * when a waiver condition exists, matching this site's existing
 * footnote convention (full text shown wherever there's room, e.g. the
 * promotion detail page).
 */
export function formatFeeCompact(cents: number | null | undefined, waiverCondition?: string | null): string {
  if (cents == null) return "Nieustalone";
  const hasWaiver = Boolean(waiverCondition?.trim());
  if (cents === 0) return hasWaiver ? "Nieustalone" : "0 zł";
  return hasWaiver ? `${formatPLN(cents)}*` : formatPLN(cents);
}

/**
 * True only when the account fee has actually been verified as 0 zł
 * with no condition attached — never when it's simply unknown (no Fees
 * row, or accountFeeCents left blank). Powers the "Bez opłat za
 * prowadzenie*" badge; a missing/unverified fee must not earn it.
 */
export function isConfirmedFreeAccount(fees: { accountFeeCents: number | null; accountFeeWaiverCondition?: string | null } | null | undefined): boolean {
  return fees != null && fees.accountFeeCents === 0 && !fees.accountFeeWaiverCondition?.trim();
}

// ---------------------------------------------------------------------------
// v2 helpers (redesign "Papier i tusz"). Additive: nothing above changed.
// ---------------------------------------------------------------------------

const RATING_FORMAT = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * Site rating with a decimal COMMA and exactly one decimal place:
 * `formatRating(9.4)` -> "9,4", `formatRating(9)` -> "9,0". Accepts the
 * Prisma Decimal (anything with `toNumber`/numeric string) as well. A missing
 * or non-numeric value yields "Brak danych" - never a made-up number.
 * Use instead of `Number(x).toFixed(1)` (which prints a dot).
 */
export function formatRating(value: number | string | { toNumber(): number } | null | undefined): string {
  if (value == null || (typeof value === "string" && value.trim() === "")) return "Brak danych";
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : value.toNumber();
  if (!Number.isFinite(n)) return "Brak danych";
  return RATING_FORMAT.format(n);
}

/** "9,4/10" - the form used on cards, offer pages and in the comparison. */
export function formatRatingOutOf10(value: number | string | { toNumber(): number } | null | undefined): string {
  const text = formatRating(value);
  return text === "Brak danych" ? text : `${text}/10`;
}

/**
 * Polish plural form (the WORD only - compose `${n} ${pluralizePl(...)}`):
 *   n = 1                                  -> one   (1 promocja)
 *   n ends in 2-4 and NOT in 12-14         -> few   (2 promocje, 23 promocje)
 *   everything else, incl. 0, 5-21, 12-14  -> many  (0 promocji, 12 promocji)
 * Non-integers use `many` ("1,5 promocji" is not meant to be pluralised here).
 */
export function pluralizePl(n: number, one: string, few: string, many: string): string {
  if (!Number.isInteger(n)) return many;
  const abs = Math.abs(n);
  if (abs === 1) return one;
  const lastTwo = abs % 100;
  const last = abs % 10;
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return few;
  return many;
}

const WARSAW_TZ = "Europe/Warsaw";
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_PL_NUMERIC = new Intl.DateTimeFormat("pl-PL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: WARSAW_TZ
});
const DATE_PL_SHORT = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: WARSAW_TZ
});
const DATE_PL_LONG = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: WARSAW_TZ
});

/**
 * Calendar date on Poland's clock (Europe/Warsaw), independent of the server's
 * time zone:
 *   "numeric" (default) -> "06.10.2026"      (dd.mm.rrrr)
 *   "short"             -> "6 paź 2026"      (verification line on cards)
 *   "long"              -> "6 października 2026"
 * Returns "" for an invalid date - check for null/undefined BEFORE calling and
 * show the proper empty-state copy ("Brak daty weryfikacji") instead.
 */
export function formatDatePL(date: Date | string | number, style: "numeric" | "short" | "long" = "numeric"): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const formatter = style === "short" ? DATE_PL_SHORT : style === "long" ? DATE_PL_LONG : DATE_PL_NUMERIC;
  return formatter.format(d);
}

/**
 * Whole calendar days (Europe/Warsaw) from today to the offer's LAST sign-up
 * day: 0 = the last day is today, 1 = tomorrow, negative = already ended.
 * `null` when `endDate` is missing/invalid. Same day convention as
 * promotionAvailability.ts (endDate = last day, stored as 00:00 UTC); `now` is
 * injectable for tests.
 */
export function daysUntil(endDate: Date | string | null | undefined, now: Date = new Date()): number | null {
  if (endDate == null) return null;
  const end = new Date(endDate).getTime();
  if (Number.isNaN(end)) return null;
  const days = Math.floor((end - signupCutoff(now).getTime()) / DAY_MS);
  return days === 0 ? 0 : days;
}

/**
 * Initials for a bank that has no logo (or whose logo failed to load):
 * "Alior Bank" -> "AB", "mBank" -> "M", "PKO Bank Polski" -> "PB", "" -> "?".
 * Lives here, not in BankLogo.tsx, so server code and tests can use it
 * without importing a client component.
 */
export function bankMonogram(name: string): string {
  const letters = name
    .trim()
    .split(/[\s\-–—/]+/)
    .map((word) => Array.from(word).find((ch) => /[\p{L}\p{N}]/u.test(ch)) ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("");
  return letters.toLocaleUpperCase("pl-PL") || "?";
}
