/**
 * How an offer's verification date ("Zweryfikowano ...") is earned and kept fresh.
 *
 * The promise to readers is that an active offer is compared with the bank's own
 * documents at least every VERIFY_TARGET_HOURS (two days). The date is only worth
 * something if it cannot move without a comparison, so:
 *
 *  - every check is recorded (PromotionVerification) with the documents it covered;
 *  - Promotion.lastVerifiedAt moves only together with a CONFIRMED record;
 *  - a document that cannot be read, or that differs from the last confirmed
 *    version, NEVER confirms anything - it is sent to a person/agent to read;
 *  - a watchdog raises an admin notification for any offer older than
 *    VERIFY_ALERT_HOURS, i.e. when the daily run did not manage to refresh it.
 *
 * Pure functions: no I/O, the clock is always passed in.
 */

/** The promise: no active offer goes longer than this without a verification. */
export const VERIFY_TARGET_HOURS = 48;
/** The daily run should have refreshed everything by now; older = the watchdog speaks up. */
export const VERIFY_ALERT_HOURS = 36;
/** A page that yields less text than this is a shell (script-rendered, blocked) - it proves nothing. */
export const MIN_DOCUMENT_CHARS = 400;

export type VerificationResult = "CONFIRMED" | "CHANGED" | "UNREACHABLE";
export type VerificationMethod = "SOURCE_UNCHANGED" | "REVIEW";

/** One document as read during a check; the stored list is the baseline of the next check. */
export interface SourceSnapshot {
  url: string;
  ok: boolean;
  status: number | null;
  /** sha256 of the normalised text of the document; null when it could not be read. */
  sha256: string | null;
  chars: number | null;
  /** Why it is not ok (HTTP status, too little text, timeout ...). */
  problem?: string;
  /** Read by an agent in a browser because the script is blocked; carries no hash. */
  viaBrowser?: boolean;
}

export type CheckDecision =
  | { decision: "NO_SOURCES" }
  | { decision: "UNREACHABLE"; unreachableUrls: string[] }
  | { decision: "NO_BASELINE" }
  | { decision: "CHANGED"; changedUrls: string[] }
  | { decision: "UNCHANGED" };

/** Tracking redirects are not documents. */
const NOT_A_DOCUMENT = /ebrokerpartner\.pl\/short\//i;

/** The documents an offer rests on: its regulamin, the extra sources and the fee table (https only, no duplicates). */
export function sourceUrlsOf(offer: {
  sourceUrl?: string | null;
  additionalSourceUrls?: readonly string[] | null;
  feesSourceUrl?: string | null;
}): string[] {
  const all = [offer.sourceUrl, ...(offer.additionalSourceUrls ?? []), offer.feesSourceUrl];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of all) {
    const url = raw?.trim();
    if (!url || !/^https:\/\//i.test(url) || NOT_A_DOCUMENT.test(url) || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

/**
 * What the documents say now versus the last CONFIRMED check.
 * Order matters: an unreadable document beats everything (nothing can be said
 * about it), and "unchanged" requires a baseline over exactly the same documents.
 */
export function decideFromSnapshots(current: readonly SourceSnapshot[], baseline: readonly SourceSnapshot[] | null): CheckDecision {
  if (current.length === 0) return { decision: "NO_SOURCES" };
  const unreadable = current.filter((s) => !s.ok || !s.sha256);
  if (unreadable.length > 0) return { decision: "UNREACHABLE", unreachableUrls: unreadable.map((s) => s.url) };
  if (!baseline || baseline.length === 0) return { decision: "NO_BASELINE" };

  const before = new Map(baseline.map((s) => [s.url, s]));
  const changed: string[] = [];
  for (const s of current) {
    const old = before.get(s.url);
    // a document the last confirmed check did not cover, or one attested only through a browser, has no hash to compare
    if (!old || !old.ok || !old.sha256 || old.sha256 !== s.sha256) changed.push(s.url);
  }
  // a document that used to be part of the offer and no longer is also needs a look
  const now = new Set(current.map((s) => s.url));
  for (const old of baseline) if (!now.has(old.url)) changed.push(old.url);

  if (changed.length > 0) return { decision: "CHANGED", changedUrls: [...new Set(changed)] };
  return { decision: "UNCHANGED" };
}

const HOUR_MS = 60 * 60 * 1000;

/** Whole hours since the verification; null when the date is missing/invalid. */
export function hoursSinceVerified(lastVerifiedAt: Date | string | null | undefined, now: Date = new Date()): number | null {
  if (!lastVerifiedAt) return null;
  const t = new Date(lastVerifiedAt).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / HOUR_MS));
}

/** Older than `thresholdHours` (or never verified). */
export function isVerificationOverdue(
  lastVerifiedAt: Date | string | null | undefined,
  now: Date = new Date(),
  thresholdHours: number = VERIFY_ALERT_HOURS
): boolean {
  const hours = hoursSinceVerified(lastVerifiedAt, now);
  return hours === null || hours >= thresholdHours;
}

/** Offers that must be checked in this run: everything older than `minAgeHours` (default: all of it, once a day). */
export function dueForCheck<T extends { lastVerifiedAt: Date | string | null }>(
  offers: readonly T[],
  now: Date = new Date(),
  minAgeHours = 12
): T[] {
  return offers.filter((o) => isVerificationOverdue(o.lastVerifiedAt, now, minAgeHours));
}
