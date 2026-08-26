import { Difficulty, PromotionStatus } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Self-updating "ocena serwisu" algorithm.
 *
 * Scores every currently ACTIVE, not-yet-expired promotion relative to
 * its peers on five factors:
 *   1. maxBonusCents — how much (30%).
 *   2. difficulty — how it's earned; assigned per-promotion by weighing
 *      required card payments and account-funding thresholds, so it
 *      doubles as the "sposób zdobycia" signal without a separate NLP
 *      pass over free-text conditions (30%).
 *   3. duration — how many months the checklist spans (fewer = better);
 *      derived from the highest ChecklistStep month-group, not a
 *      separate stored field (20%).
 *   4. avgRewardPerMonth — maxBonusCents / duration, i.e. how much
 *      you're actually earning per month of effort, not just the
 *      headline total (15%).
 *   5. cooldownMonths — shorter karencja = better (5%, kept low because
 *      most promotions don't have this recorded yet — see below).
 *
 * Bonus/duration/avgRewardPerMonth/cooldown are all normalized within
 * the same accountType (a 5000 zł business premium and a 900 zł
 * personal one aren't comparable on any of these axes), falling back to
 * the whole active set when a category has too few peers for a
 * meaningful spread.
 *
 * cooldownMonths is null for most promotions today (not every regulamin
 * states one, and not all have been back-filled) — a null gets a
 * neutral 0.5 rather than best- or worst-case, so this factor only
 * actually moves the needle for the promotions that do have it set,
 * which is also why it's weighted lowest of the five.
 *
 * The composite (0..1) is mapped onto the public 0..10 scale with a
 * front-loaded curve so a merely-decent promotion already lands ~9,
 * while a weak one (small bonus, hard to earn, long slog) can fall into
 * the 7s/8s — "raczej nie schodzimy poniżej 9, chyba że słaba premia
 * lub brak".
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
const DIFFICULTY_WEIGHT = 0.3;
const DURATION_WEIGHT = 0.2;
const AVG_PER_MONTH_WEIGHT = 0.15;
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
    where: { status: PromotionStatus.ACTIVE, endDate: { gte: new Date() } },
    select: {
      id: true,
      accountType: true,
      maxBonusCents: true,
      difficulty: true,
      rating: true,
      ratingOverride: true,
      cooldownMonths: true,
      checklistSteps: { select: { order: true } }
    }
  });

  if (rows.length === 0) return 0;

  const active: RatablePromotion[] = rows.map((p) => {
    const groupIndexes = p.checklistSteps.map((s) => Math.floor(s.order / 10));
    const maxGroupIndex = groupIndexes.length > 0 ? Math.max(...groupIndexes) : null;
    return {
      id: p.id,
      accountType: p.accountType,
      maxBonusCents: p.maxBonusCents,
      difficulty: p.difficulty,
      rating: p.rating,
      ratingOverride: p.ratingOverride,
      cooldownMonths: p.cooldownMonths,
      durationMonths: maxGroupIndex !== null ? Math.max(1, maxGroupIndex) : null
    };
  });

  const byType = new Map<string, RatablePromotion[]>();
  for (const p of active) {
    const list = byType.get(p.accountType) ?? [];
    list.push(p);
    byType.set(p.accountType, list);
  }
  const peersFor = (p: RatablePromotion) => {
    const sameType = byType.get(p.accountType) ?? [p];
    return sameType.length >= 3 ? sameType : active;
  };

  const updates: { id: string; rating: number }[] = [];
  for (const p of active) {
    const override = p.ratingOverride === null ? null : Number(p.ratingOverride);
    let effective: number;
    if (override !== null) {
      effective = override;
    } else {
      const peers = peersFor(p);

      const bonusScore = percentileScore(p.maxBonusCents, peers, (x) => x.maxBonusCents);

      const durationPeers = peers.filter((x) => x.durationMonths !== null);
      const durationScore =
        p.durationMonths !== null && durationPeers.length >= 2
          ? percentileScore(p.durationMonths, durationPeers, (x) => x.durationMonths!, true)
          : NEUTRAL_SCORE;

      const avgPerMonthPeers = peers.filter((x) => x.durationMonths !== null);
      const avgPerMonthScore =
        p.durationMonths !== null && avgPerMonthPeers.length >= 2
          ? percentileScore(p.maxBonusCents / p.durationMonths, avgPerMonthPeers, (x) => x.maxBonusCents / x.durationMonths!)
          : NEUTRAL_SCORE;

      const cooldownPeers = peers.filter((x) => x.cooldownMonths !== null);
      const cooldownScore =
        p.cooldownMonths !== null && cooldownPeers.length >= 2
          ? percentileScore(p.cooldownMonths, cooldownPeers, (x) => x.cooldownMonths!, true)
          : NEUTRAL_SCORE;

      const composite =
        BONUS_WEIGHT * bonusScore +
        DIFFICULTY_WEIGHT * DIFFICULTY_SCORE[p.difficulty] +
        DURATION_WEIGHT * durationScore +
        AVG_PER_MONTH_WEIGHT * avgPerMonthScore +
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
