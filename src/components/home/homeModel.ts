/**
 * Pure model of the home page: one pool of public offer cards in, everything
 * the page shows out. No database, no React, no clock of its own (`now` is a
 * parameter), so every rule is covered by tests/home-model.test.tsx.
 *
 * The page reads the database ONCE (`listPromotionCards`, "Polecane" order) and
 * this module cuts the pool into the blocks of the layout spec
 * (docs/redesign-v2/02-layout-spec.md, HOME):
 *
 *   segments       "Polecane promocje": the first 3 offers of each segment
 *                  (Osobiste / Firmowe) in the pool's order. "Osobiste" is every
 *                  non-business account type, "Firmowe" is BUSINESS - the one
 *                  definition of src/lib/accountTypes.ts, so the number on the
 *                  home page is the number of the /promocje tab and of the hub.
 *                  The "Polecane" score of an offer only depends on offers of
 *                  its own REAL account type, so filtering the pool here gives
 *                  exactly what a database filter would (see applyAccountType in
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
import { HUBS, type HubKind } from "@/components/seo-pages/hubs";
import { ACCOUNT_SEGMENTS, isBusinessType, type AccountSegment } from "@/lib/accountTypes";
import { DIFFICULTY_LEVEL, daysUntil } from "@/lib/format";
import { isRouteLive } from "@/lib/seo/routes";
import type { PromotionCardData } from "@/lib/services/promotionCards";

/** The two segments of the home page (same values as `accountType` on /promocje). */
export type HomeSegment = AccountSegment;

/** Order of the segments in the control. */
export const HOME_SEGMENTS: readonly HomeSegment[] = ACCOUNT_SEGMENTS;

/** The hub that lists exactly the offers of a segment. */
const HUB_OF_SEGMENT: Record<HomeSegment, HubKind> = { PERSONAL: "personal", BUSINESS: "business" };

export const HOME_SEGMENT_LABEL: Record<HomeSegment, string> = {
  PERSONAL: "Konta osobiste",
  BUSINESS: "Konta firmowe"
};

/** Cards in "Polecane promocje" (per segment). */
export const FEATURED_COUNT = 3;
/**
 * Offers in the hero spotlight: 6 cards in "Polecane" order, usually 4 personal + 2 business, 3 + 3 when a third
 * business offer outranks the fourth personal one. Never fewer than 2 business offers while the pool has them.
 */
export const SPOTLIGHT_COUNT = 6;
const SPOTLIGHT_MAX_PERSONAL = 4;
const SPOTLIGHT_MAX_BUSINESS = 3;
const SPOTLIGHT_MIN_BUSINESS = 2;

export function pickSpotlight(pool: readonly PromotionCardData[]): PromotionCardData[] {
  const picked = new Set<PromotionCardData>();
  let personal = 0;
  let business = 0;
  for (const card of pool) {
    if (picked.size >= SPOTLIGHT_COUNT) break;
    if (isBusinessType(card.accountType)) {
      if (business < SPOTLIGHT_MAX_BUSINESS) {
        picked.add(card);
        business++;
      }
    } else if (personal < SPOTLIGHT_MAX_PERSONAL) {
      picked.add(card);
      personal++;
    }
  }
  // Too few business offers near the top of the pool: bring the best remaining ones in, replacing the weakest personal picks.
  for (const card of pool) {
    if (business >= SPOTLIGHT_MIN_BUSINESS) break;
    if (picked.has(card) || !isBusinessType(card.accountType)) continue;
    if (picked.size >= SPOTLIGHT_COUNT) {
      const weakest = [...picked].reverse().find((c) => !isBusinessType(c.accountType));
      if (!weakest) break;
      picked.delete(weakest);
      personal--;
    }
    picked.add(card);
    business++;
  }
  return pool.filter((card) => picked.has(card));
}
/** "Kończą się wkrótce" = at most this many days to the last sign-up day. */
export const ENDING_SOON_DAYS = 14;
/** Cards in "Kończą się wkrótce". */
export const ENDING_SOON_COUNT = 3;

/** The "see everything" link under "Polecane promocje": where it leads and what it says. */
export interface HomeSeeAll {
  href: string;
  /** Visible text including the number, e.g. "Wszystkie konta osobiste z premią (16)". */
  label: string;
}

export interface HomeSegmentModel {
  value: HomeSegment;
  label: string;
  /** Offers of this segment on the public list (Osobiste = every non-business type). */
  total: number;
  /** The first FEATURED_COUNT in "Polecane" order. */
  featured: PromotionCardData[];
  /** Where "Zobacz promocje" leads for this segment: the filtered /promocje list. */
  href: string;
  /** The number shown in "Zobacz wszystkie (N)" - what `href` lists. */
  count: number;
  /**
   * The link under the "Polecane" list. It always leads to the /promocje list (filtered to the segment), the
   * owner's decision; while the segment's hub page is live the text is the hub's ("Wszystkie konta osobiste
   * z premią (N)"), otherwise `"Zobacz wszystkie (count)"`.
   */
  seeAll: HomeSeeAll;
}

/** "Wszystkie konta osobiste z premią (16)" - the anchor of the link to a hub; N = what the hub lists. */
export function hubSeeAllLabel(kind: HubKind, count: number): string {
  return `Wszystkie ${HUBS[kind].label.toLowerCase()} (${count})`;
}

export interface HomeModel {
  /** Every active offer (the hero counter). */
  total: number;
  latestVerifiedAt: Date | null;
  /** Only segments that have at least one offer, in HOME_SEGMENTS order. */
  segments: HomeSegmentModel[];
  /** The most recommended offers of the whole pool (see pickSpotlight), for the hero. */
  spotlight: PromotionCardData[];
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

/**
 * `pool` = every active offer in "Polecane" order (listPromotionCards({ sort: "recommended" })).
 * `isLive` decides whether a hub is linked instead of the filtered list
 * (injectable for tests; the page leaves it out).
 */
export function buildHomeModel(
  pool: readonly PromotionCardData[],
  now: Date,
  isLive: (path: string) => boolean = isRouteLive
): HomeModel {
  const total = pool.length;
  const byType: Record<HomeSegment, PromotionCardData[]> = {
    PERSONAL: applyAccountType(pool, "PERSONAL"),
    BUSINESS: applyAccountType(pool, "BUSINESS")
  };
  const available = HOME_SEGMENTS.filter((value) => byType[value].length > 0);
  // With one segment there is nothing to choose: the links lead to the whole list.
  const choosable = available.length >= 2;

  const segments: HomeSegmentModel[] = available.map((value) => {
    const href = choosable ? listingHref({ ...EMPTY_STATE, accountType: value }) : "/promocje";
    const count = choosable ? byType[value].length : total;
    const hub = HUBS[HUB_OF_SEGMENT[value]];
    const seeAll: HomeSeeAll = isLive(hub.path)
      ? { href, label: hubSeeAllLabel(hub.kind, byType[value].length) }
      : { href, label: `Zobacz wszystkie (${count})` };
    return {
      value,
      label: HOME_SEGMENT_LABEL[value],
      total: byType[value].length,
      featured: byType[value].slice(0, FEATURED_COUNT),
      href,
      count,
      seeAll
    };
  });

  return {
    total,
    latestVerifiedAt: latestVerification(pool),
    segments,
    spotlight: pickSpotlight(pool),
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
  onError: (error: unknown) => void = (error) => console.error("[home] could not load the promotions", error),
  isLive: (path: string) => boolean = isRouteLive
): Promise<HomeModel | null> {
  try {
    return buildHomeModel(await read(), now, isLive);
  } catch (error) {
    onError(error);
    return null;
  }
}
