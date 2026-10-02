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
import { isDeadlinePassed } from "@/lib/promotionAvailability";

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  VERY_EASY: "Bardzo łatwa",
  EASY: "Łatwa",
  MEDIUM: "Średnia",
  HARD: "Trudna"
};

/** 1–5 effort score used by the "Ile wysiłku wymaga promocja?" meter. */
export const DIFFICULTY_EFFORT: Record<Difficulty, number> = {
  VERY_EASY: 1,
  EASY: 2,
  MEDIUM: 3,
  HARD: 5
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
  if (cents === 0) return "0 zł";
  return waiverCondition ? `${formatPLN(cents)}*` : formatPLN(cents);
}

/**
 * True only when the account fee has actually been verified as 0 zł
 * with no condition attached — never when it's simply unknown (no Fees
 * row, or accountFeeCents left blank). Powers the "Bez opłat za
 * prowadzenie*" badge; a missing/unverified fee must not earn it.
 */
export function isConfirmedFreeAccount(fees: { accountFeeCents: number | null } | null | undefined): boolean {
  return fees != null && fees.accountFeeCents === 0;
}
