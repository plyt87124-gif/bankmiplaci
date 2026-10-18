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

/**
 * Is OUR partner link allowed to send people to the bank? Needs the offer to
 * be open (isSignupOpen) AND the affiliate campaign to be switched on
 * (Promotion.affiliateLinkEnabled). The two are different facts: an offer can
 * be current in the bank while the campaign is unconfirmed - then the page
 * presents the offer, with no partner link and /out/[slug] blocked.
 */
export function isAffiliateLinkLive(
  promotion: { status: string; endDate: Date | string; affiliateLinkEnabled?: boolean | null },
  now: Date = new Date()
): boolean {
  return isSignupOpen(promotion, now) && promotion.affiliateLinkEnabled !== false;
}

/** Bonus part / extra reward that can still be joined (null = same as the promotion). */
export function isBonusPartOpen(part: { availableUntil?: Date | string | null }, now: Date = new Date()): boolean {
  return part.availableUntil == null || !isDeadlinePassed(part.availableUntil, now);
}

/** How long (days after the last sign-up day) an ended offer stays indexable. */
export const EXPIRED_INDEX_WINDOW_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whole days since the offer's last sign-up day, counted on Poland's calendar:
 * 0 = today IS the last day, 1 = it ended yesterday, negative = still ahead.
 * Returns null when `endDate` is missing or not a valid date.
 */
export function daysSinceDeadline(endDate: Date | string | null | undefined, now: Date = new Date()): number | null {
  if (endDate == null) return null;
  const end = new Date(endDate).getTime();
  if (Number.isNaN(end)) return null;
  return Math.floor((signupCutoff(now).getTime() - end) / DAY_MS);
}

/**
 * Smallest `endDate` of an ended offer that is still inside the indexing
 * window. Use as `endDate: { gte: expiredIndexWindowStart() }` (together with
 * `lt: signupCutoff()`) so DB filters match `robotsForStatus` exactly.
 */
export function expiredIndexWindowStart(now: Date = new Date()): Date {
  return new Date(signupCutoff(now).getTime() - EXPIRED_INDEX_WINDOW_DAYS * DAY_MS);
}

/** Deadline passed, but not longer than EXPIRED_INDEX_WINDOW_DAYS ago. */
export function isInExpiredIndexWindow(endDate: Date | string | null | undefined, now: Date = new Date()): boolean {
  const days = daysSinceDeadline(endDate, now);
  return days != null && days > 0 && days <= EXPIRED_INDEX_WINDOW_DAYS;
}

/**
 * Search-engine policy (docs/redesign-v2/03-content-and-seo-plan.md section D),
 * independent of sign-up availability. `follow` is always true so links from
 * a noindex page to current offers can still be discovered.
 *
 * - DRAFT, ARCHIVED (and any unknown status): always noindex.
 * - ACTIVE: indexed while open. Past its deadline it behaves like an ended
 *   offer (the expire cron may simply not have run yet).
 * - EXPIRED / past deadline: indexed for EXPIRED_INDEX_WINDOW_DAYS (90) days
 *   after the last sign-up day (the page shows an "ended" banner and no CTA),
 *   noindex afterwards - it moves to the archive.
 * - `endDate` omitted/invalid: the age cannot be judged. ACTIVE stays indexed
 *   (the pre-redesign behaviour), EXPIRED is noindex (conservative).
 *   Pass it - every caller that has the promotion has the date.
 *
 * `now` is injectable for tests; the day boundary is Europe/Warsaw.
 */
export function robotsForStatus(
  status: string,
  endDate?: Date | string | null,
  now: Date = new Date()
): { index: boolean; follow: boolean } {
  const indexed = { index: true, follow: true };
  const hidden = { index: false, follow: true };
  if (status !== "ACTIVE" && status !== "EXPIRED") return hidden;

  const days = daysSinceDeadline(endDate, now);
  if (days == null) return status === "ACTIVE" ? indexed : hidden;
  // Still open (days <= 0), or - for an EXPIRED row - an end date that is
  // still ahead because the offer was closed early: nothing to age yet.
  if (days <= 0) return indexed;
  return days <= EXPIRED_INDEX_WINDOW_DAYS ? indexed : hidden;
}
