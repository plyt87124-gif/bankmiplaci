/**
 * READ-ONLY replica of the "ocena serwisu" arithmetic in
 * src/lib/services/ratings.ts, used only to explain the rating on /metodologia
 * with a worked example. ratings.ts stays the single source of truth (it is not
 * ours to change and does not export its pure parts), so this file copies the
 * constants and the formula - and the page protects itself against drift twice:
 *
 *  1. tests/content-pages.test.tsx reads ratings.ts and fails when a weight, a
 *     difficulty score or the 6.5 + 3.5 * sqrt(x) mapping differs from here;
 *  2. the example is shown only when this replica reproduces the rating stored
 *     in the database for that offer (see loadRatingExample.ts), so a changed
 *     algorithm silently hides the example instead of showing a wrong one.
 *
 * Pure: no database, no clock. Commission is not an input - it is not part of
 * the rating, and the types here have no field for it.
 */

export type DifficultyKey = "VERY_EASY" | "EASY" | "MEDIUM" | "HARD";

export const DIFFICULTY_SCORE: Record<DifficultyKey, number> = {
  VERY_EASY: 1.0,
  EASY: 0.82,
  MEDIUM: 0.55,
  HARD: 0.3
};

export const DIFFICULTY_LABEL_PL: Record<DifficultyKey, string> = {
  VERY_EASY: "bardzo łatwa",
  EASY: "łatwa",
  MEDIUM: "średnia",
  HARD: "trudna"
};

export const RATING_WEIGHTS = {
  bonus: 0.3,
  cost: 0.25,
  duration: 0.2,
  difficulty: 0.2,
  cooldown: 0.05
} as const;

export type ComponentKey = keyof typeof RATING_WEIGHTS;

/** Value of a component whose input is unknown: neither helps nor hurts. */
export const NEUTRAL_SCORE = 0.5;
/** With fewer same-type offers than this the relative components are neutral (offers of the other account type are never used). */
export const MIN_PEERS_OF_TYPE = 3;
/** Lowest possible rating (composite 0) and the span above it. */
export const RATING_FLOOR = 6.5;
export const RATING_SPAN = 3.5;

export function compositeToRating(composite: number): number {
  const clamped = Math.min(1, Math.max(0, composite));
  return RATING_FLOOR + RATING_SPAN * Math.sqrt(clamped);
}

export function roundRating(rating: number): number {
  return Math.round(rating * 10) / 10;
}

export interface RatableOffer {
  id: string;
  accountType: string;
  maxBonusCents: number;
  difficulty: DifficultyKey;
  cooldownMonths: number | null;
  /** Months spanned by the checklist (>= 1), null when the offer has no checklist. */
  durationMonths: number | null;
  /** Estimated required turnover in grosze; null = unknown. */
  costCents: number | null;
}

function minMaxScore(value: number, values: number[], invert: boolean): number {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return 1;
  const raw = (value - min) / (max - min);
  return invert ? 1 - raw : raw;
}

export interface ComponentBreakdown {
  key: ComponentKey;
  /** The offer's own value (cents for the bonus, months, cost-to-bonus ratio, score for difficulty); null = unknown. */
  value: number | null;
  /** Lowest/highest value among the offers it was compared with; null for difficulty (fixed scale) and neutral components. */
  range: { min: number; max: number } | null;
  /** 0..1 */
  score: number;
  /** True when the input was unknown or there were too few offers to compare, so the neutral 0.5 was used. */
  neutral: boolean;
  weight: number;
  contribution: number;
}

export interface RatingBreakdown {
  components: ComponentBreakdown[];
  composite: number;
  /** Rating before rounding. */
  rawRating: number;
  /** Rating rounded to 0.1, the number shown on the site. */
  rating: number;
  /** Offers the example was compared with. */
  peerCount: number;
  /** True when there were too few offers of this type to compare, so the relative components are neutral. */
  tooFewPeers: boolean;
}

/** Same grouping as recomputeRatings(): offers of the same account type only. */
export function peersOf(offer: RatableOffer, active: readonly RatableOffer[]): { peers: RatableOffer[]; tooFewPeers: boolean } {
  const sameType = active.filter((o) => o.accountType === offer.accountType);
  const group = sameType.length === 0 ? [offer] : sameType;
  return { peers: group, tooFewPeers: group.length < MIN_PEERS_OF_TYPE };
}

export function explainRating(offer: RatableOffer, active: readonly RatableOffer[]): RatingBreakdown {
  const { peers, tooFewPeers } = peersOf(offer, active);

  const bonusValues = peers.map((p) => p.maxBonusCents);
  const bonus: ComponentBreakdown = {
    key: "bonus",
    value: offer.maxBonusCents,
    range: tooFewPeers ? null : { min: Math.min(...bonusValues), max: Math.max(...bonusValues) },
    score: tooFewPeers ? NEUTRAL_SCORE : minMaxScore(offer.maxBonusCents, bonusValues, false),
    neutral: tooFewPeers,
    weight: RATING_WEIGHTS.bonus,
    contribution: 0
  };

  const difficulty: ComponentBreakdown = {
    key: "difficulty",
    value: DIFFICULTY_SCORE[offer.difficulty],
    range: null,
    score: DIFFICULTY_SCORE[offer.difficulty],
    neutral: false,
    weight: RATING_WEIGHTS.difficulty,
    contribution: 0
  };

  const withDuration = peers.filter((p) => p.durationMonths !== null);
  const durationKnown = !tooFewPeers && offer.durationMonths !== null && withDuration.length >= 2;
  const duration: ComponentBreakdown = {
    key: "duration",
    value: offer.durationMonths,
    range: durationKnown
      ? {
          min: Math.min(...withDuration.map((p) => p.durationMonths!)),
          max: Math.max(...withDuration.map((p) => p.durationMonths!))
        }
      : null,
    score: durationKnown
      ? minMaxScore(offer.durationMonths!, withDuration.map((p) => p.durationMonths!), true)
      : NEUTRAL_SCORE,
    neutral: !durationKnown,
    weight: RATING_WEIGHTS.duration,
    contribution: 0
  };

  const ratio = (p: RatableOffer) => p.costCents! / Math.max(1, p.maxBonusCents);
  const withCost = peers.filter((p) => p.costCents !== null);
  const costKnown = !tooFewPeers && offer.costCents !== null && withCost.length >= 2;
  const cost: ComponentBreakdown = {
    key: "cost",
    value: offer.costCents !== null ? ratio(offer) : null,
    range: costKnown ? { min: Math.min(...withCost.map(ratio)), max: Math.max(...withCost.map(ratio)) } : null,
    score: costKnown ? minMaxScore(ratio(offer), withCost.map(ratio), true) : NEUTRAL_SCORE,
    neutral: !costKnown,
    weight: RATING_WEIGHTS.cost,
    contribution: 0
  };

  const withCooldown = peers.filter((p) => p.cooldownMonths !== null);
  const cooldownKnown = !tooFewPeers && offer.cooldownMonths !== null && withCooldown.length >= 2;
  const cooldown: ComponentBreakdown = {
    key: "cooldown",
    value: offer.cooldownMonths,
    range: cooldownKnown
      ? {
          min: Math.min(...withCooldown.map((p) => p.cooldownMonths!)),
          max: Math.max(...withCooldown.map((p) => p.cooldownMonths!))
        }
      : null,
    score: cooldownKnown
      ? minMaxScore(offer.cooldownMonths!, withCooldown.map((p) => p.cooldownMonths!), true)
      : NEUTRAL_SCORE,
    neutral: !cooldownKnown,
    weight: RATING_WEIGHTS.cooldown,
    contribution: 0
  };

  const components = [bonus, cost, duration, difficulty, cooldown].map((c) => ({
    ...c,
    contribution: c.weight * c.score
  }));
  const composite =
    RATING_WEIGHTS.bonus * bonus.score +
    RATING_WEIGHTS.difficulty * difficulty.score +
    RATING_WEIGHTS.duration * duration.score +
    RATING_WEIGHTS.cost * cost.score +
    RATING_WEIGHTS.cooldown * cooldown.score;
  const rawRating = compositeToRating(composite);

  return { components, composite, rawRating, rating: roundRating(rawRating), peerCount: peers.length, tooFewPeers };
}

/**
 * Which offer to use as the worked example. Deterministic and not "the best
 * looking one": among offers whose rating was computed (no manual override) and
 * that have a checklist, prefer those with a known cooldown (so all five
 * components are real (the example also needs a known cost)), then take the one whose rating is closest to the middle
 * of that group (ties: slug order). Returns candidates in that order, so the
 * caller can fall back to the next one when the replica does not match.
 */
export function exampleCandidates<T extends RatableOffer & { slug: string; rating: number; hasOverride: boolean }>(
  offers: readonly T[]
): T[] {
  const eligible = offers.filter((o) => !o.hasOverride && o.durationMonths !== null && o.costCents !== null);
  const withCooldown = eligible.filter((o) => o.cooldownMonths !== null);
  const pool = withCooldown.length > 0 ? withCooldown : eligible;
  if (pool.length === 0) return [];
  const sorted = [...pool].map((o) => o.rating).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  return [...pool].sort(
    (a, b) => Math.abs(a.rating - median) - Math.abs(b.rating - median) || a.slug.localeCompare(b.slug)
  );
}
