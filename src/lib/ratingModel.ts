/**
 * "Ocena serwisu": the pure arithmetic (no database, no clock), shared by
 * services/ratings.ts (which stores the result) and /metodologia (which
 * describes it from the same constants). Inputs are built by ratingInputs.ts.
 *
 * Offers are only ever compared with offers of the same kind: personal-like
 * accounts (osobiste, młodzi, oszczędnościowe, wspólne) with each other,
 * business accounts with each other, never across.
 *
 * Seven components, each 0..1, then a weighted sum (the "composite"):
 *
 *   efficiency  30%  premium per zł of the MINIMUM own turnover needed to earn it
 *                    (log scale; "3 payments of any amount" costs nothing, a % cashback
 *                    needs amount / rate of spending);
 *   netPremium  20%  premium that counts (terminal, credit, loan, leasing and factoring
 *                    parts excluded) less the fees that cannot be waived, against the
 *                    median of the same kind;
 *   partner     20%  PARTNER REMUNERATION: what a new client is worth to the site
 *                    (commission + contest, a business commission counts at half), log scale;
 *   effort      10%  difficulty level set per offer;
 *   duration    10%  over how many months the conditions have to be kept;
 *   cooldown     5%  karencja (months since closing / the date the bank looks back to);
 *   fees         5%  account and card fees per month of the promotion.
 *
 * The composite becomes the public number in two steps: it is standardised
 * against the median and the spread of its own kind (z-score, clamped to +-2),
 * then put on a convex curve between RATING_FLOOR and RATING_FLOOR + RATING_SPAN,
 * so the weak half is compressed just under 9 and the best offers are lifted.
 * An unknown input is neutral (0.5): it neither helps nor hurts.
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
  /** 30%: premium per zł of the minimum own turnover (the biggest weight). */
  efficiency: 0.3,
  /** 20%: premium that counts, less fees that cannot be waived. */
  netPremium: 0.2,
  /** 20%: PARTNER REMUNERATION, i.e. the commission + contests we are paid per client ("Wynagrodzenie partnerskie serwisu"). */
  partner: 0.2,
  /** 10%: difficulty. */
  effort: 0.1,
  /** 10%: over how many months the conditions run. */
  duration: 0.1,
  /** 5%: karencja. */
  cooldown: 0.05,
  /** 5%: account and card fees. */
  fees: 0.05
} as const;

export type ComponentKey = keyof typeof RATING_WEIGHTS;
export const COMPONENT_KEYS = Object.keys(RATING_WEIGHTS) as ComponentKey[];

/** Value of a component whose input is unknown. */
export const NEUTRAL_SCORE = 0.5;
/** With fewer offers of one kind than this there is no meaningful spread: the rating is the neutral middle. */
export const MIN_PEERS_OF_KIND = 3;

/** The lowest rating the curve gives, the rating of the median offer, and the span up to the best one. */
export const RATING_FLOOR = 8.7;
export const RATING_MEDIAN = 9.15;
export const RATING_SPAN = 1.2;
export const RATING_CEILING = RATING_FLOOR + RATING_SPAN;
/** Curve exponent chosen so that the median (t = 0.5) lands exactly on RATING_MEDIAN. */
export const CURVE_EXPONENT = Math.log((RATING_MEDIAN - RATING_FLOOR) / RATING_SPAN) / Math.log(0.5);
/** The composite is standardised to z = (composite - median) / spread and clamped to +-Z_LIMIT. */
export const Z_LIMIT = 2;

/** log scales of the two components that span orders of magnitude */
export const EFFICIENCY_SCALE = { lowZl: 0.01, highZl: 8 } as const; // premium per 1 zł of turnover (or a cashback rate)
export const PARTNER_SCALE_ZL = { low: 30, high: 400 } as const; // commission + contest per client
export const BUSINESS_PARTNER_FACTOR = 0.5;
/** Fee burden (zł over the promotion) at which the fee component reaches 0, and the karencja (months) at which it does. */
export const FEE_BURDEN_ZERO_AT_ZL = 300;
export const COOLDOWN_ZERO_AT_MONTHS = 36;
/** A fee that can be waived but only on a condition counts at this share of its value. */
export const CONDITIONAL_FEE_SHARE = 0.5;

export interface CashbackPart {
  /** What the part can pay in total, zł. */
  premiumZl: number;
  /** Share of the spending that comes back (0.2 = 20%). */
  rate: number;
}

export interface RatingInput {
  id: string;
  accountType: string;
  difficulty: DifficultyKey;
  /** Premium paid as fixed amounts (counted parts only), zł. */
  fixedPremiumZl: number;
  /** Own money that has to be moved or spent for the fixed parts, zł. */
  fixedTurnoverZl: number;
  /** Parts paid as a share of spending. */
  cashbackParts: readonly CashbackPart[];
  /** Account + card fees over the promotion that cannot be waived, zł. */
  unconditionalFeesZl: number;
  /** The same, plus CONDITIONAL_FEE_SHARE of the fees that can be waived on a condition; null = fees not verified. */
  feeBurdenZl: number | null;
  /** Karencja in months (from closing, or since the date the bank looks back to); null = unknown. */
  cooldownMonths: number | null;
  /** Months the conditions run (>= 1); null = no checklist. */
  durationMonths: number | null;
  /** Commission + contest per client, zł, before the business discount; null = unknown. */
  commissionZl: number | null;
}

export type RatingKind = "PERSONAL" | "BUSINESS";

export function ratingKind(accountType: string): RatingKind {
  return accountType === "BUSINESS" ? "BUSINESS" : "PERSONAL";
}

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function logScale(value: number, low: number, high: number): number {
  if (!(value > 0)) return 0;
  return clamp01((Math.log10(value) - Math.log10(low)) / (Math.log10(high) - Math.log10(low)));
}

export function countedPremiumZl(i: RatingInput): number {
  return i.fixedPremiumZl + i.cashbackParts.reduce((s, p) => s + p.premiumZl, 0);
}

export function netPremiumZl(i: RatingInput): number {
  return Math.max(0, countedPremiumZl(i) - i.unconditionalFeesZl);
}

/** Premium per zł of the minimum own turnover, premium-weighted over the parts, 0..1. */
export function efficiencyScore(i: RatingInput): number {
  const counted = countedPremiumZl(i);
  if (counted <= 0) return 0;
  const { lowZl, highZl } = EFFICIENCY_SCALE;
  const fixed =
    i.fixedPremiumZl > 0 ? i.fixedPremiumZl * logScale(i.fixedPremiumZl / Math.max(100, i.fixedTurnoverZl), lowZl, highZl) : 0;
  const cashback = i.cashbackParts.reduce((s, p) => s + p.premiumZl * logScale(p.rate, lowZl, highZl), 0);
  return (fixed + cashback) / counted;
}

export function partnerScore(i: Pick<RatingInput, "accountType" | "commissionZl">): number {
  if (i.commissionZl === null) return NEUTRAL_SCORE;
  const value = i.commissionZl * (ratingKind(i.accountType) === "BUSINESS" ? BUSINESS_PARTNER_FACTOR : 1);
  return value <= 0 ? 0 : logScale(value, PARTNER_SCALE_ZL.low, PARTNER_SCALE_ZL.high);
}

export function feesScore(i: Pick<RatingInput, "feeBurdenZl">): number {
  return i.feeBurdenZl === null ? NEUTRAL_SCORE : 1 - Math.min(1, i.feeBurdenZl / FEE_BURDEN_ZERO_AT_ZL);
}

export function cooldownScore(i: Pick<RatingInput, "cooldownMonths">): number {
  return i.cooldownMonths === null ? NEUTRAL_SCORE : 1 - Math.min(1, i.cooldownMonths / COOLDOWN_ZERO_AT_MONTHS);
}

export function durationScore(i: Pick<RatingInput, "durationMonths">): number {
  return 1 - Math.min(1, ((i.durationMonths ?? 1) - 1) / 12);
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

export interface ComponentResult {
  key: ComponentKey;
  /** 0..1 */
  score: number;
  weight: number;
  contribution: number;
}

export interface RatingResult {
  id: string;
  kind: RatingKind;
  components: ComponentResult[];
  /** Weighted sum of the components, 0..1. */
  composite: number;
  /** Rating before rounding. */
  rawRating: number;
  /** Rating rounded to 0.1, the number shown on the site. */
  rating: number;
  /** Offers of the same kind it was compared with (itself included). */
  peerCount: number;
  tooFewPeers: boolean;
}

export function roundRating(rating: number): number {
  return Math.round(rating * 10) / 10;
}

/** Composite z-score -> rating, on the convex curve. */
export function curveRating(z: number): number {
  const t = clamp01((z + Z_LIMIT) / (2 * Z_LIMIT));
  return RATING_FLOOR + RATING_SPAN * Math.pow(t, CURVE_EXPONENT);
}

/** Scores every offer against the others of its kind. Pure and order-independent. */
export function rateOffers(inputs: readonly RatingInput[]): Map<string, RatingResult> {
  const out = new Map<string, RatingResult>();
  for (const kind of ["PERSONAL", "BUSINESS"] as const) {
    const group = inputs.filter((i) => ratingKind(i.accountType) === kind);
    if (group.length === 0) continue;
    const medianNet = median(group.map(netPremiumZl));

    const scored = group.map((i) => {
      const scores: Record<ComponentKey, number> = {
        efficiency: efficiencyScore(i),
        netPremium: medianNet > 0 ? 1 - Math.exp(-netPremiumZl(i) / medianNet) : netPremiumZl(i) > 0 ? 1 : 0,
        partner: partnerScore(i),
        effort: DIFFICULTY_SCORE[i.difficulty],
        duration: durationScore(i),
        cooldown: cooldownScore(i),
        fees: feesScore(i)
      };
      const components = COMPONENT_KEYS.map((key) => ({
        key,
        score: scores[key],
        weight: RATING_WEIGHTS[key],
        contribution: RATING_WEIGHTS[key] * scores[key]
      }));
      return { input: i, components, composite: components.reduce((s, c) => s + c.contribution, 0) };
    });

    const composites = scored.map((s) => s.composite);
    const mid = median(composites);
    const mean = composites.reduce((a, b) => a + b, 0) / composites.length;
    const spread = Math.sqrt(composites.reduce((a, b) => a + (b - mean) ** 2, 0) / composites.length);
    const tooFewPeers = group.length < MIN_PEERS_OF_KIND;

    for (const s of scored) {
      const z = tooFewPeers || spread === 0 ? 0 : (s.composite - mid) / spread;
      const rawRating = curveRating(z);
      out.set(s.input.id, {
        id: s.input.id,
        kind,
        components: s.components,
        composite: s.composite,
        rawRating,
        rating: roundRating(rawRating),
        peerCount: group.length,
        tooFewPeers
      });
    }
  }
  return out;
}
