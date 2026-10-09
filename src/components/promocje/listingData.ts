/**
 * Server-side data of /promocje. Everything goes through the services layer
 * (listPromotionCards / countActive: explicit column list, no affiliate URL,
 * no commission), so nothing private can reach the HTML.
 *
 * `cache()` de-duplicates within one request: generateMetadata and the page
 * both need the active count.
 */
import { cache } from "react";
import { db } from "@/lib/db";
import { activeWhere } from "@/lib/services/promotions";
import { countActive, listPromotionCards, type PromotionCardData } from "@/lib/services/promotionCards";
import {
  listingHref,
  toServiceFilters,
  type ListingState
} from "@/components/filters/filterParams";
import {
  applyAccountType,
  relaxationCandidates,
  segmentCounts,
  type SegmentCountsResult
} from "@/components/promocje/listing";
import type { Relaxation } from "@/components/NoResultsState";

/** Offers on the public list (no filters). */
export const getActiveCount = cache((): Promise<number> => countActive());

/** Newest `lastVerifiedAt` among the offers on the public list; null when there are none. */
export const getLatestVerification = cache(async (): Promise<Date | null> => {
  const { _max } = await db.promotion.aggregate({ where: activeWhere(), _max: { lastVerifiedAt: true } });
  return _max.lastVerifiedAt;
});

/** Banks that have at least one offer on the list (the "Bank" select). */
export const getBanksWithOffers = cache(
  (): Promise<{ slug: string; name: string }[]> =>
    db.bank.findMany({
      where: { promotions: { some: activeWhere() } },
      orderBy: { name: "asc" },
      select: { slug: true, name: true }
    })
);

export interface ListingResult {
  /** Every offer matching the URL, in the requested order. */
  cards: PromotionCardData[];
  /** Osobiste / Firmowe counts under the other filters. */
  counts: SegmentCountsResult;
}

/**
 * One query serves the list and the segment counts: the cards are fetched
 * under every filter EXCEPT the account type, counted per segment, and then
 * narrowed to the chosen account type in memory (same result and order as the
 * database filter, see applyAccountType).
 */
export async function loadListing(state: ListingState): Promise<ListingResult> {
  const everyType = await listPromotionCards(toServiceFilters(state, ["accountType"]));
  return { cards: applyAccountType(everyType, state.accountType), counts: segmentCounts(everyType) };
}

export interface EmptyStateHelp {
  relaxations: Relaxation[];
  suggestions?: { caption: string; cards: PromotionCardData[] };
}

/**
 * For an empty result: which single filter, once removed, brings offers back
 * (counted in the database with the same rules as the list), and the first
 * three offers of the best such relaxation. Runs only on the empty path.
 */
export async function loadEmptyStateHelp(
  state: ListingState,
  banks: readonly { slug: string; name: string }[],
  basePath = "/promocje"
): Promise<EmptyStateHelp> {
  const candidates = relaxationCandidates(state, banks);
  const counted = await Promise.all(
    candidates.map(async (candidate) => {
      const relaxed: ListingState = { ...state, ...candidate.patch };
      return { candidate, relaxed, count: await countActive(toServiceFilters(relaxed)) };
    })
  );
  const useful = counted.filter((item) => item.count > 0).sort((a, b) => b.count - a.count);
  const best = useful[0];
  if (!best) return { relaxations: [] };

  const cards = (await listPromotionCards(toServiceFilters(best.relaxed))).slice(0, 3);
  return {
    relaxations: useful.slice(0, 4).map((item) => ({
      label: item.candidate.label,
      href: listingHref(item.relaxed, 1, basePath),
      count: item.count
    })),
    suggestions: {
      caption: `Najbliższe wyniki po usunięciu filtra: ${best.candidate.label}`,
      cards
    }
  };
}
