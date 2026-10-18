/**
 * "Polecane" ordering.
 *
 * Multiplies the site's own rating by a factor driven by the partner
 * commission we receive (0.6 for the lowest-paying offer up to 1.0 for the
 * best-paying one in its group), so better-paying offers rank higher.
 *
 * The influence is substantial, NOT a tie-breaker: the factor spans 0.4 of the
 * score while the public ratings sit between 6.5 and 10, so an offer rated 6.5
 * with the highest commission (0.65) overtakes an offer rated 10 whose
 * commission is zero (0.60). This is NOT the public "ocena serwisu" (that
 * stays commission-free, see services/ratings.ts). The site does not explain
 * the order or the commission influence in its copy (owner decision).
 *
 * Commission is compared across the whole list, but a business commission
 * counts at half its value (BUSINESS_COMMISSION_FACTOR): business sign-up
 * bonuses naturally pay much more than personal ones, and without the
 * discount they would always take the top of a mixed list. The values are
 * normalised to the best (discounted) commission in the list. A missing
 * commission gets a neutral 0.5, so data we simply don't have yet neither
 * helps nor hurts an offer.
 */

export const COMMISSION_WEIGHT = 0.4;
const NEUTRAL = 0.5;
export const BUSINESS_COMMISSION_FACTOR = 0.5;

function effectiveCommission(accountType: string, cents: number): number {
  return accountType === "BUSINESS" ? cents * BUSINESS_COMMISSION_FACTOR : cents;
}

export interface RecommendInput {
  accountType: string;
  /** 0..10 public rating */
  rating: number;
  maxBonusCents: number;
  /** grosze, null/undefined = unknown */
  commissionCents?: number | null;
  /** Last tie-break, so equal offers keep one order on every page (the database returns ties in any order). */
  slug?: string;
}

export function recommendedScores(items: RecommendInput[]): number[] {
  let max = 0;
  for (const it of items) {
    const c = it.commissionCents ?? 0;
    if (c > 0) max = Math.max(max, effectiveCommission(it.accountType, c));
  }
  return items.map((it) => {
    const c = it.commissionCents;
    const commissionN = max > 0 && c != null && c > 0 ? effectiveCommission(it.accountType, c) / max : c === 0 ? 0 : NEUTRAL;
    const ratingN = Math.min(1, Math.max(0, it.rating / 10));
    return ratingN * (1 - COMMISSION_WEIGHT + COMMISSION_WEIGHT * commissionN);
  });
}

/** Returns a new array ordered by the "Polecane" score (ties: rating, then bonus, then slug). */
export function sortRecommended<T extends RecommendInput>(items: T[]): T[] {
  const scores = recommendedScores(items);
  return items
    .map((item, i) => ({ item, score: scores[i] ?? 0 }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.item.rating - a.item.rating ||
        b.item.maxBonusCents - a.item.maxBonusCents ||
        (a.item.slug ?? "").localeCompare(b.item.slug ?? "")
    )
    .map((x) => x.item);
}
