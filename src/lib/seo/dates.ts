/**
 * Date helpers for titles/descriptions/JSON-LD. All of them take the clock as
 * an argument (`now`) and compute calendar facts in Europe/Warsaw, so tests
 * (and the "dzisiaj" of a build running in UTC) are deterministic.
 *
 * Self-contained on purpose: this package must not depend on helpers that
 * another work package adds to format.ts.
 */
import { POLAND_TIME_ZONE } from "../promotionAvailability";

/** Month names in the nominative case, index 0 = January. */
export const MONTHS_PL = [
  "styczeń",
  "luty",
  "marzec",
  "kwiecień",
  "maj",
  "czerwiec",
  "lipiec",
  "sierpień",
  "wrzesień",
  "październik",
  "listopad",
  "grudzień"
] as const;

export interface CalendarDate {
  year: number;
  /** 1-12 */
  month: number;
  day: number;
}

/** Coerces input to a valid Date or null (never throws, never returns Invalid Date). */
export function toValidDate(value: Date | string | number | null | undefined): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Calendar date of an instant, as seen in Poland. */
export function warsawCalendarDate(instant: Date): CalendarDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: POLAND_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** Current year in Poland, e.g. 2026 (the "{Rok}" in titles). */
export function warsawYear(now: Date): number {
  return warsawCalendarDate(now).year;
}

/** "październik 2026" - the "{Miesiąc} {Rok}" in titles, in Poland's calendar. */
export function warsawMonthYear(now: Date): string {
  const { year, month } = warsawCalendarDate(now);
  return `${MONTHS_PL[month - 1]} ${year}`;
}

/**
 * "dd.mm.rrrr" for a stored date. Works for both kinds of values in the DB:
 * `endDate` (a calendar date stored as 00:00 UTC) and `lastVerifiedAt`
 * (a real instant) - both land on the intended Warsaw calendar day.
 * Returns null for missing/invalid input so callers can skip the sentence
 * instead of printing "NaN.NaN.NaN".
 */
export function formatDatePL(value: Date | string | null | undefined): string | null {
  const d = toValidDate(value);
  if (!d) return null;
  const { year, month, day } = warsawCalendarDate(d);
  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
}

/** "yyyy-mm-dd" (Warsaw day) - for schema.org date-only fields such as validThrough. */
export function isoDatePL(value: Date | string | null | undefined): string | null {
  const d = toValidDate(value);
  if (!d) return null;
  const { year, month, day } = warsawCalendarDate(d);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Full ISO-8601 instant (UTC) or null - for dateModified/datePublished. */
export function isoInstant(value: Date | string | null | undefined): string | null {
  const d = toValidDate(value);
  return d ? d.toISOString() : null;
}
