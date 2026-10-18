import { PromotionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { signupCutoff } from "@/lib/promotionAvailability";
import { estimateRequiredTurnoverCents } from "@/lib/requiredTurnover";
import {
  exampleCandidates,
  explainRating,
  type DifficultyKey,
  type RatableOffer,
  type RatingBreakdown
} from "./ratingModel";

export interface RatingExample {
  slug: string;
  name: string;
  bankName: string;
  accountType: string;
  difficulty: DifficultyKey;
  /** The rating stored in the database; equals `breakdown.rating` by construction (otherwise there is no example). */
  storedRating: number;
  breakdown: RatingBreakdown;
}

export interface MethodologyData {
  example: RatingExample | null;
  /** Ratings currently shown on the site (open, ACTIVE offers). null when there are none or the read failed. */
  ratingStats: { count: number; min: number; max: number } | null;
  /** Newest `lastVerifiedAt` among those offers. */
  latestVerifiedAt: Date | null;
}

export const EMPTY_METHODOLOGY_DATA: MethodologyData = { example: null, ratingStats: null, latestVerifiedAt: null };

/**
 * Read-only data for /metodologia. It selects ONLY the rating inputs, names and
 * dates - never the partner commission or the affiliate URL (the rating does
 * not use them and the page must not be able to leak them). Any failure (no
 * database in a build, a connection hiccup) yields the empty result and the
 * page simply shows the explanation without live numbers.
 */
export async function loadMethodologyData(now: Date = new Date()): Promise<MethodologyData> {
  try {
    const rows = await db.promotion.findMany({
      where: { status: PromotionStatus.ACTIVE, endDate: { gte: signupCutoff(now) } },
      select: {
        id: true,
        slug: true,
        name: true,
        accountType: true,
        maxBonusCents: true,
        difficulty: true,
        rating: true,
        ratingOverride: true,
        cooldownMonths: true,
        lastVerifiedAt: true,
        bank: { select: { name: true } },
        checklistSteps: { select: { order: true } },
        conditions: { select: { title: true, description: true } }
      }
    });
    if (rows.length === 0) return EMPTY_METHODOLOGY_DATA;

    const offers = rows.map((row) => {
      const groups = row.checklistSteps.map((s) => Math.floor(s.order / 10));
      const maxGroup = groups.length > 0 ? Math.max(...groups) : null;
      const durationMonths = maxGroup !== null ? Math.max(1, maxGroup) : null;
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        bankName: row.bank.name,
        accountType: row.accountType as string,
        maxBonusCents: row.maxBonusCents,
        difficulty: row.difficulty as DifficultyKey,
        cooldownMonths: row.cooldownMonths,
        durationMonths,
        costCents: estimateRequiredTurnoverCents(row.conditions, durationMonths),
        rating: Number(row.rating),
        hasOverride: row.ratingOverride !== null
      };
    });
    const active: RatableOffer[] = offers;

    let example: RatingExample | null = null;
    for (const candidate of exampleCandidates(offers)) {
      const breakdown = explainRating(candidate, active);
      // Only show the example when the replica reproduces the stored rating.
      if (Math.abs(breakdown.rating - candidate.rating) < 1e-9) {
        example = {
          slug: candidate.slug,
          name: candidate.name,
          bankName: candidate.bankName,
          accountType: candidate.accountType,
          difficulty: candidate.difficulty,
          storedRating: candidate.rating,
          breakdown
        };
        break;
      }
    }

    const ratings = offers.map((o) => o.rating).filter((r) => Number.isFinite(r));
    const latest = rows.reduce<Date | null>(
      (acc, row) => (acc === null || row.lastVerifiedAt > acc ? row.lastVerifiedAt : acc),
      null
    );

    return {
      example,
      ratingStats: ratings.length > 0 ? { count: ratings.length, min: Math.min(...ratings), max: Math.max(...ratings) } : null,
      latestVerifiedAt: latest
    };
  } catch (error) {
    console.error("[metodologia] nie udało się odczytać danych do przykładu:", error instanceof Error ? error.message : error);
    return EMPTY_METHODOLOGY_DATA;
  }
}
