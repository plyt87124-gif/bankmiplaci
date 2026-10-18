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

/**
 * The bank named in `?bank=` when it has no active offers (so it is missing
 * from getBanksWithOffers): its real name for the chip, the select and the
 * empty-state hint. null for an unknown slug (the UI then falls back to the slug).
 */
export const getBankBySlug = cache(
  (slug: string): Promise<{ slug: string; name: string } | null> =>
    db.bank.findUnique({ where: { slug }, select: { slug: true, name: true } })
);

export interface ListingResult {
  /** Every offer matching the URL, in the requested order. */
  cards: PromotionCardData[];
  /** Osobiste / Firmowe counts under the other filters. */
  counts: SegmentCountsResult;
}

/**
 * One query serves the list and the segment counts: the cards are fetched
 * under every filter EXCEPT the account type, counted per segment (Osobiste =
 * every non-business type, so Osobiste + Firmowe = Wszystkie), and then
 * narrowed to the chosen account type in memory (same result and order as the
 * database filter, see applyAccountType and accountTypeWhere).
 *
 * TODO(WP-17): this loads EVERY matching offer into memory and the page cuts
 * the first 24 x `strona` out of it. Fine for the current catalogue (a few
 * dozen offers); move the paging (and the segment counts) into the database
 * query when the list grows - WP-17 owns that change.
 */
export async function loadListing(state: ListingState, excludeSlugs: ReadonlySet<string> = new Set()): Promise<ListingResult> {
  const all = await listPromotionCards(toServiceFilters(state, ["accountType"]));
  // `excludeSlugs`: offers a signed-in visitor chose to hide ("tylko te, w których mogę wziąć udział").
  const everyType = excludeSlugs.size > 0 ? all.filter((card) => !excludeSlugs.has(card.slug)) : all;
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
