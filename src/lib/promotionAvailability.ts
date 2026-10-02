/**
 * One definition of "is this promotion still open for sign-up", shared by
 * the public listing, sitemap, /out/[slug] redirect, the promotion page's
 * CTA and banners, the ratings pool and the expiry cron — so none of them
 * can disagree about the same promotion on the same day.
 *
 * Deliberately separate from the INDEXING decision (robotsForStatus
 * below): an offer past its deadline must not accept new sign-ups, but
 * leaving its description in the search index isn't an error by itself.
 *
 * Date convention: Promotion.endDate (and BonusPart.availableUntil) hold
 * the LAST DAY the offer can be joined, stored as that calendar date at
 * 00:00 UTC (what a <input type="date"> / `new Date("2026-11-30")`
 * produces). The offer is open for the whole of that day in Poland, so the
 * cut-off is the Warsaw calendar date, not the instant 00:00 UTC — comparing
 * `endDate >= new Date()` closed every promotion at the very start of its
 * own last day.
 */

export const POLAND_TIME_ZONE = "Europe/Warsaw";

/** Today's calendar date in Poland, expressed as 00:00 UTC of that date. */
export function warsawTodayAsUtcMidnight(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: POLAND_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
}

/**
 * Smallest `endDate` that is still open right now. Use as
 * `endDate: { gte: signupCutoff() }` for "open" and `{ lt: signupCutoff() }`
 * for "deadline passed" so DB filters match the in-code checks exactly.
 */
export function signupCutoff(now: Date = new Date()): Date {
  return warsawTodayAsUtcMidnight(now);
}

/** True once the whole last day (Polish calendar) has passed. */
export function isDeadlinePassed(endDate: Date | string, now: Date = new Date()): boolean {
  return new Date(endDate).getTime() < signupCutoff(now).getTime();
}

export function isSignupOpen(
  promotion: { status: string; endDate: Date | string },
  now: Date = new Date()
): boolean {
  return promotion.status === "ACTIVE" && !isDeadlinePassed(promotion.endDate, now);
}

/** Bonus part / extra reward that can still be joined (null = same as the promotion). */
export function isBonusPartOpen(part: { availableUntil?: Date | string | null }, now: Date = new Date()): boolean {
  return part.availableUntil == null || !isDeadlinePassed(part.availableUntil, now);
}

/**
 * Search-engine policy, independent of sign-up availability: only ACTIVE
 * promotions are indexed (unchanged); everything else is noindex but keeps
 * `follow` so links from an archived page to current offers can still be
 * discovered. An ACTIVE promotion past its deadline stays indexable — its
 * sign-up is blocked elsewhere (isSignupOpen), not by dropping it from the
 * index. Affiliate-link rel attributes are handled separately on the links.
 */
export function robotsForStatus(status: string): { index: boolean; follow: boolean } {
  return status === "ACTIVE" ? { index: true, follow: true } : { index: false, follow: true };
}
