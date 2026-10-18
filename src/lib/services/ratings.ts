import { Difficulty, PromotionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { signupCutoff } from "@/lib/promotionAvailability";
import { estimateRequiredTurnoverCents } from "@/lib/requiredTurnover";

/**
 * Self-updating "ocena serwisu" algorithm.
 *
 * Scores every currently ACTIVE, not-yet-expired promotion relative to
 * offers of the SAME account type (personal and business offers are never
 * compared with each other) on five factors:
 *   1. maxBonusCents - how much (30%).
 *   2. required turnover relative to the bonus - the estimated money you
 *      have to move or spend (wpływy, płatności kartą; see
 *      requiredTurnover.ts) per 1 zł of bonus; less is better (25%). Unknown
 *      when the conditions name no threshold: neutral.
 *   3. duration - over how many months the bonus is spread, from the
 *      highest ChecklistStep month-group; fewer = better (20%).
 *   4. difficulty - assigned per promotion by weighing the required
 *      payments and thresholds (20%).
 *   5. cooldownMonths - shorter karencja = better (5%, low because most
 *      promotions don't have it recorded).
 *
 * With fewer than 3 offers of one account type there is no meaningful
 * spread, so the relative factors (1, 2, 3, 5) are neutral (0.5) rather than
 * borrowing offers of the other type.
 *
 * The composite (0..1) is mapped onto the public 0..10 scale with a
 * front-loaded curve so a merely-decent promotion already lands ~9,
 * while a weak one can fall into the 7s/8s.
 *
 * Runs after every write that can change the active set (see call sites
 * in admin actions, the import script, and expirePastPromotions) — never
 * on a timer, since nothing here depends on the passage of time beyond
 * status/endDate, which those call sites already own.
 */

const DIFFICULTY_SCORE: Record<Difficulty, number> = {
  VERY_EASY: 1.0,
  EASY: 0.82,
  MEDIUM: 0.55,
  HARD: 0.3
};

const BONUS_WEIGHT = 0.3;
const DIFFICULTY_WEIGHT = 0.2;
const DURATION_WEIGHT = 0.2;
const COST_WEIGHT = 0.25;
const COOLDOWN_WEIGHT = 0.05;

const NEUTRAL_SCORE = 0.5;

function compositeToRating(composite: number): number {
  const clamped = Math.min(1, Math.max(0, composite));
  return 6.5 + 3.5 * Math.sqrt(clamped);
}

interface RatablePromotion {
  id: string;
  accountType: string;
  maxBonusCents: number;
  difficulty: Difficulty;
  rating: unknown; // Prisma Decimal
  ratingOverride: unknown; // Prisma Decimal | null
  cooldownMonths: number | null;
  /** Highest checklist month-group index, i.e. how many months the promotion's requirements span. Null when it has no checklist yet. */
  durationMonths: number | null;
  /** Estimated required turnover in grosze (see requiredTurnover.ts); null when unknown. */
  costCents: number | null;
}

/** Percentile of `value` among peers (same accountType, or the whole active set if too few peers) — higher value = higher score unless `invert`. */
function percentileScore(
  value: number,
  peers: RatablePromotion[],
  pick: (p: RatablePromotion) => number,
  invert = false
): number {
  const values = peers.map(pick);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return 1;
  const raw = (value - min) / (max - min);
  return invert ? 1 - raw : raw;
}

/**
 * Recomputes `rating` for every currently-active promotion and persists
 * any changes. Returns how many rows were actually updated. Safe to call
 * as often as needed — a no-op when nothing in the active set changed.
 */
export async function recomputeRatings(): Promise<number> {
  const rows = await db.promotion.findMany({
    where: { status: PromotionStatus.ACTIVE, endDate: { gte: signupCutoff() } },
    select: {
      id: true,
      accountType: true,
      maxBonusCents: true,
      difficulty: true,
      rating: true,
      ratingOverride: true,
      cooldownMonths: true,
      checklistSteps: { select: { order: true } },
      conditions: { select: { title: true, description: true } }
    }
  });

  if (rows.length === 0) return 0;

  const active: RatablePromotion[] = rows.map((p) => {
    const groupIndexes = p.checklistSteps.map((s) => Math.floor(s.order / 10));
    const maxGroupIndex = groupIndexes.length > 0 ? Math.max(...groupIndexes) : null;
    const durationMonths = maxGroupIndex !== null ? Math.max(1, maxGroupIndex) : null;
    return {
      id: p.id,
      accountType: p.accountType,
      maxBonusCents: p.maxBonusCents,
      difficulty: p.difficulty,
      rating: p.rating,
      ratingOverride: p.ratingOverride,
      cooldownMonths: p.cooldownMonths,
      durationMonths,
      costCents: estimateRequiredTurnoverCents(p.conditions, durationMonths)
    };
  });

  const byType = new Map<string, RatablePromotion[]>();
  for (const p of active) {
    const list = byType.get(p.accountType) ?? [];
    list.push(p);
    byType.set(p.accountType, list);
  }
  const peersFor = (p: RatablePromotion) => byType.get(p.accountType) ?? [p];

  const updates: { id: string; rating: number }[] = [];
  for (const p of active) {
    const override = p.ratingOverride === null ? null : Number(p.ratingOverride);
    let effective: number;
    if (override !== null) {
      effective = override;
    } else {
      const peers = peersFor(p);
      const enoughPeers = peers.length >= 3;

      const bonusScore = enoughPeers ? percentileScore(p.maxBonusCents, peers, (x) => x.maxBonusCents) : NEUTRAL_SCORE;

      const durationPeers = peers.filter((x) => x.durationMonths !== null);
      const durationScore =
        enoughPeers && p.durationMonths !== null && durationPeers.length >= 2
          ? percentileScore(p.durationMonths, durationPeers, (x) => x.durationMonths!, true)
          : NEUTRAL_SCORE;

      const costRatio = (x: RatablePromotion) => x.costCents! / Math.max(1, x.maxBonusCents);
      const costPeers = peers.filter((x) => x.costCents !== null);
      const costScore =
        enoughPeers && p.costCents !== null && costPeers.length >= 2
          ? percentileScore(costRatio(p), costPeers, costRatio, true)
          : NEUTRAL_SCORE;

      const cooldownPeers = peers.filter((x) => x.cooldownMonths !== null);
      const cooldownScore =
        enoughPeers && p.cooldownMonths !== null && cooldownPeers.length >= 2
          ? percentileScore(p.cooldownMonths, cooldownPeers, (x) => x.cooldownMonths!, true)
          : NEUTRAL_SCORE;

      const composite =
        BONUS_WEIGHT * bonusScore +
        DIFFICULTY_WEIGHT * DIFFICULTY_SCORE[p.difficulty] +
        DURATION_WEIGHT * durationScore +
        COST_WEIGHT * costScore +
        COOLDOWN_WEIGHT * cooldownScore;

      effective = Math.round(compositeToRating(composite) * 10) / 10;
    }

    if (Number(p.rating) !== effective) {
      updates.push({ id: p.id, rating: effective });
    }
  }

  if (updates.length === 0) return 0;

  await db.$transaction(updates.map((u) => db.promotion.update({ where: { id: u.id }, data: { rating: u.rating } })));

  return updates.length;
}
