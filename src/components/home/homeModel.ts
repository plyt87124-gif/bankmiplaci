/**
 * Pure model of the home page: one pool of public offer cards in, everything
 * the page shows out. No database, no React, no clock of its own (`now` is a
 * parameter), so every rule is covered by tests/home-model.test.tsx.
 *
 * The page reads the database ONCE (`listPromotionCards`, "Polecane" order) and
 * this module cuts the pool into the blocks of the layout spec
 * (docs/redesign-v2/02-layout-spec.md, HOME):
 *
 *   segments       "Polecane promocje": the first 3 offers of each account type
 *                  (Osobiste / Firmowe) in the pool's order. The "Polecane"
 *                  score of an offer only depends on offers of its own account
 *                  type, so filtering the pool here gives exactly what a
 *                  database filter would (see applyAccountType in
 *                  components/promocje/listing.ts).
 *   endingSoon     "Kończą się wkrótce": offers whose last sign-up day is
 *                  today .. 14 days away, soonest deadline first.
 *   effortExamples "Ile wysiłku wymaga promocja?": the easiest and the hardest
 *                  real offer of the pool; ONE card when the pool has a single
 *                  difficulty level; never an invented one.
 *   total          the counter "N aktualnych promocji" (every active offer).
 *   latestVerifiedAt  newest `lastVerifiedAt` ("Aktualizacja: ...").
 *
 * What the pool contains is the public card (promotionCards.ts): no affiliate
 * URL, no commission. Nothing here adds a field, so nothing private can reach
 * the HTML or the props of the client island.
 */
import { EMPTY_STATE, listingHref } from "@/components/filters/filterParams";
import { applyAccountType } from "@/components/promocje/listing";
import { DIFFICULTY_LEVEL, daysUntil } from "@/lib/format";
import type { PromotionCardData } from "@/lib/services/promotionCards";

/** The two segments of the home page (same values as `accountType` on /promocje). */
export type HomeSegment = "PERSONAL" | "BUSINESS";

/** Order of the segments in the control. */
export const HOME_SEGMENTS: readonly HomeSegment[] = ["PERSONAL", "BUSINESS"];

export const HOME_SEGMENT_LABEL: Record<HomeSegment, string> = {
  PERSONAL: "Konta osobiste",
  BUSINESS: "Konta firmowe"
};

/** Cards in "Polecane promocje" (per segment). */
export const FEATURED_COUNT = 3;
/** "Kończą się wkrótce" = at most this many days to the last sign-up day. */
export const ENDING_SOON_DAYS = 14;
/** Cards in "Kończą się wkrótce". */
export const ENDING_SOON_COUNT = 3;

export interface HomeSegmentModel {
  value: HomeSegment;
  label: string;
  /** Offers of this account type on the public list. */
  total: number;
  /** The first FEATURED_COUNT in "Polecane" order. */
  featured: PromotionCardData[];
  /** Where "Zobacz promocje" / "Zobacz wszystkie" lead for this segment. */
  href: string;
  /** The number shown in "Zobacz wszystkie (N)" - what that href lists. */
  count: number;
}

export interface HomeModel {
  /** Every active offer (the hero counter). */
  total: number;
  latestVerifiedAt: Date | null;
  /** Only segments that have at least one offer, in HOME_SEGMENTS order. */
  segments: HomeSegmentModel[];
  /** The segment shown first: Osobiste when it has offers, otherwise Firmowe. */
  defaultSegment: HomeSegment | null;
  endingSoon: PromotionCardData[];
  effortExamples: PromotionCardData[];
}

function time(value: Date | string): number {
  return new Date(value).getTime();
}

/** Newest `lastVerifiedAt` of the pool (invalid dates are ignored); null for an empty pool. */
export function latestVerification(cards: readonly Pick<PromotionCardData, "lastVerifiedAt">[]): Date | null {
  let best: number | null = null;
  for (const card of cards) {
    const t = time(card.lastVerifiedAt);
    if (Number.isNaN(t)) continue;
    if (best === null || t > best) best = t;
  }
  return best === null ? null : new Date(best);
}

/**
 * Offers whose last sign-up day is within `days` days (today included),
 * soonest deadline first; equal deadlines by rating, then by slug so the
 * order never depends on the input order. Offers that already ended or have no
 * usable date are left out.
 */
export function pickEndingSoon(
  cards: readonly PromotionCardData[],
  now: Date,
  days: number = ENDING_SOON_DAYS,
  limit: number = ENDING_SOON_COUNT
): PromotionCardData[] {
  return cards
    .filter((card) => {
      const left = daysUntil(card.endDate, now);
      return left !== null && left >= 0 && left <= days;
    })
    .sort(
      (a, b) =>
        time(a.endDate) - time(b.endDate) || b.rating - a.rating || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0)
    )
    .slice(0, limit);
}

/**
 * The easiest and the hardest offer of the pool (personal accounts when there
 * are any, so the comparison stays apples-to-apples; otherwise the whole
 * pool). Within one difficulty level the bigger bonus wins, then the better
 * rating, then the slug. One level in the pool = ONE card.
 */
export function pickEffortExamples(cards: readonly PromotionCardData[]): PromotionCardData[] {
  const personal = applyAccountType(cards, "PERSONAL");
  const pool = personal.length > 0 ? personal : [...cards];
  if (pool.length === 0) return [];

  const best = (a: PromotionCardData, b: PromotionCardData) =>
    b.maxBonusCents - a.maxBonusCents || b.rating - a.rating || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
  const easiest = [...pool].sort((a, b) => DIFFICULTY_LEVEL[a.difficulty] - DIFFICULTY_LEVEL[b.difficulty] || best(a, b))[0];
  const hardest = [...pool].sort((a, b) => DIFFICULTY_LEVEL[b.difficulty] - DIFFICULTY_LEVEL[a.difficulty] || best(a, b))[0];
  if (!easiest || !hardest) return [];
  return DIFFICULTY_LEVEL[easiest.difficulty] === DIFFICULTY_LEVEL[hardest.difficulty] ? [easiest] : [easiest, hardest];
}

/** `pool` = every active offer in "Polecane" order (listPromotionCards({ sort: "recommended" })). */
export function buildHomeModel(pool: readonly PromotionCardData[], now: Date): HomeModel {
  const total = pool.length;
  const byType: Record<HomeSegment, PromotionCardData[]> = {
    PERSONAL: applyAccountType(pool, "PERSONAL"),
    BUSINESS: applyAccountType(pool, "BUSINESS")
  };
  const available = HOME_SEGMENTS.filter((value) => byType[value].length > 0);
  // With one segment there is nothing to choose: the links lead to the whole list.
  const choosable = available.length >= 2;

  const segments: HomeSegmentModel[] = available.map((value) => ({
    value,
    label: HOME_SEGMENT_LABEL[value],
    total: byType[value].length,
    featured: byType[value].slice(0, FEATURED_COUNT),
    href: choosable ? listingHref({ ...EMPTY_STATE, accountType: value }) : "/promocje",
    count: choosable ? byType[value].length : total
  }));

  return {
    total,
    latestVerifiedAt: latestVerification(pool),
    segments,
    defaultSegment: segments[0]?.value ?? null,
    endingSoon: pickEndingSoon(pool, now),
    effortExamples: pickEffortExamples(pool)
  };
}

/**
 * Reads the pool through `read` and builds the model; a failing read (database
 * down, bad query) yields `null` instead of an exception, so the page can still
 * render its static blocks. `onError` is injectable so tests stay quiet.
 */
export async function readHomeModel(
  read: () => Promise<readonly PromotionCardData[]>,
  now: Date,
  onError: (error: unknown) => void = (error) => console.error("[home] could not load the promotions", error)
): Promise<HomeModel | null> {
  try {
    return buildHomeModel(await read(), now);
  } catch (error) {
    onError(error);
    return null;
  }
}
