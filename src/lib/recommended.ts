/**
 * "Polecane" ordering.
 *
 * Multiplies the site's own rating by a factor driven by the partner
 * commission we receive (0.6 for the lowest-paying offer up to 1.0 for the
 * best-paying one in its group), so better-paying offers rank higher.
 *
 * The influence is substantial, NOT a tie-breaker: the factor spans 0.4 of the
 * score while the public ratings sit between 6.5 and 10. An offer rated 6.5
 * with the highest commission scores 0.65 and overtakes an offer rated 10
 * whose commission is zero (0.60). The disclosure copy
 * (lib/disclosureCopy.ts), /jak-zarabiamy and the FAQ must therefore say that a
 * lower-rated offer can rank higher, never that commission only nudges the
 * order. This is NOT the public "ocena serwisu" (that stays commission-free,
 * see services/ratings.ts); the influence is disclosed on /jak-zarabiamy, in
 * the strip above the lists and next to the sort control.
 *
 * Commission is compared only within the same account type (a business
 * sign-up bonus pays far more than a personal one), normalised to the best
 * commission in that group. A missing commission gets a neutral 0.5, so
 * data we simply don't have yet neither helps nor hurts an offer.
 */

export const COMMISSION_WEIGHT = 0.4;
const NEUTRAL = 0.5;

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
  const maxByType = new Map<string, number>();
  for (const it of items) {
    const c = it.commissionCents ?? 0;
    if (c > 0) maxByType.set(it.accountType, Math.max(maxByType.get(it.accountType) ?? 0, c));
  }
  return items.map((it) => {
    const max = maxByType.get(it.accountType);
    const c = it.commissionCents;
    const commissionN = max && c != null && c > 0 ? c / max : c === 0 ? 0 : NEUTRAL;
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
