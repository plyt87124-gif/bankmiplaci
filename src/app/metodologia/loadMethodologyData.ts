import { PromotionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { signupCutoff } from "@/lib/promotionAvailability";

export interface MethodologyData {
  /** Ratings currently shown on the site (open, ACTIVE offers). null when there are none or the read failed. */
  ratingStats: { count: number; min: number; max: number } | null;
  /** Newest `lastVerifiedAt` among those offers. */
  latestVerifiedAt: Date | null;
}

export const EMPTY_METHODOLOGY_DATA: MethodologyData = { ratingStats: null, latestVerifiedAt: null };

/**
 * Read-only data for /metodologia. It selects ONLY the stored rating and the
 * verification date - never the partner commission or the affiliate URL, so the
 * page cannot leak them. Any failure (no database in a build, a connection
 * hiccup) yields the empty result and the page simply shows the explanation
 * without live numbers.
 */
export async function loadMethodologyData(now: Date = new Date()): Promise<MethodologyData> {
  try {
    const rows = await db.promotion.findMany({
      where: { status: PromotionStatus.ACTIVE, endDate: { gte: signupCutoff(now) } },
      select: { rating: true, lastVerifiedAt: true }
    });
    if (rows.length === 0) return EMPTY_METHODOLOGY_DATA;

    const ratings = rows.map((row) => Number(row.rating)).filter((r) => Number.isFinite(r));
    const latest = rows.reduce<Date | null>(
      (acc, row) => (acc === null || row.lastVerifiedAt > acc ? row.lastVerifiedAt : acc),
      null
    );

    return {
      ratingStats: ratings.length > 0 ? { count: ratings.length, min: Math.min(...ratings), max: Math.max(...ratings) } : null,
      latestVerifiedAt: latest
    };
  } catch (error) {
    console.error("[metodologia] nie udało się odczytać danych:", error instanceof Error ? error.message : error);
    return EMPTY_METHODOLOGY_DATA;
  }
}
