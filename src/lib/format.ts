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

export function isExpired(endDate: Date | string): boolean {
  return new Date(endDate).getTime() < Date.now();
}
