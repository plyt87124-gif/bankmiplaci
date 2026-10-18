import type { Metadata } from "next";
import { Info } from "lucide-react";
import { AttributionCapture } from "@/components/AttributionCapture";
import { Filters } from "@/components/Filters";
import { JsonLd } from "@/components/JsonLd";
import { NoResultsState } from "@/components/NoResultsState";
import { TrustNote } from "@/components/trust/TrustNote";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import {
  hasActiveFilters,
  isCanonicalListing,
  listingHref,
  parseListingParams,
  parsePage,
  withSelectedBank
} from "@/components/filters/filterParams";
import { ListingEditorial } from "@/components/promocje/ListingEditorial";
import { ListingGrid } from "@/components/promocje/ListingGrid";
import { LISTING_FAQ } from "@/components/promocje/editorialContent";
import { slicePage } from "@/components/promocje/listing";
import {
  getActiveCount,
  getBankBySlug,
  getBanksWithOffers,
  getLatestVerification,
  loadEmptyStateHelp,
  loadListing
} from "@/components/promocje/listingData";
import { LATEST_VERIFICATION_LABEL } from "@/lib/disclosureCopy";
import { formatDatePL } from "@/lib/format";
import {
  breadcrumbLd,
  buildMetadata,
  faqLd,
  isoDatePL,
  itemListLd,
  noindexForSearchParams,
  promotionHeading,
  promotionsListDescription,
  promotionsListHeading,
  promotionsListTitle
} from "@/lib/seo";

import { getCurrentUser } from "@/lib/userSession";
import { listBlockedPromotionSlugs } from "@/lib/services/blockedPromotions";

type SearchParams = Record<string, string | string[] | undefined>;

interface PageProps {
  searchParams: Promise<SearchParams>;
}

/**
 * /promocje: the title, description and canonical come from the SEO library.
 * Any filter, sort, search, `niedostepna` or `strona` > 1 makes the page
 * `noindex,follow` with the canonical on the clean path (robots.txt does NOT
 * block those URLs - a crawler has to fetch them to see the noindex).
 */
export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const count = await getActiveCount();
  return buildMetadata({
    title: { absolute: promotionsListTitle(new Date()) },
    description: promotionsListDescription(count),
    path: "/promocje",
    robots: noindexForSearchParams(params) ?? null
  });
}

export default async function PromotionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const state = parseListingParams(params);
  const page = parsePage(params);
  const now = new Date();

  // "Tylko te, w których mogę wziąć udział": only for a signed-in visitor; their blocked offers are left out.
  const viewer = state.eligibleOnly ? await getCurrentUser() : null;
  const blocked = viewer ? new Set(await listBlockedPromotionSlugs(viewer.id)) : new Set<string>();

  const [listing, banks, latestVerification, activeCount] = await Promise.all([
    loadListing(state, blocked),
    getBanksWithOffers(),
    getLatestVerification(),
    getActiveCount()
  ]);

  // ?bank= naming a bank that has no active offers (link from an expired offer, the
  // eligibility redirect): the filter UI still shows its real name, not the slug.
  const selectedBank = state.bank && !banks.some((bank) => bank.slug === state.bank) ? await getBankBySlug(state.bank) : null;
  const bankOptions = withSelectedBank(banks, selectedBank);

  const slice = slicePage(listing.cards, page);
  const filtersOn = hasActiveFilters(state);
  const isEmpty = listing.cards.length === 0;
  const emptyHelp = isEmpty && filtersOn && activeCount > 0 ? await loadEmptyStateHelp(state, bankOptions) : null;
  const updatedText = latestVerification ? formatDatePL(latestVerification, "short") : "";

  const canonicalList = isCanonicalListing(state, page) && !noindexForSearchParams(params);

  const structuredData = [
    breadcrumbLd([
      { name: "Start", path: "/" },
      { name: "Promocje", path: "/promocje" }
    ]),
    // The list of the canonical page only (no filter, default order, first page, no
    // other parameter that makes the page noindex): any other URL shows a different
    // list or order than the one the canonical URL stands for.
    canonicalList
      ? itemListLd(
          slice.visible.map((card) => ({
            name: promotionHeading({ name: card.name, bankName: card.bank.name }),
            path: `/promocje/${card.slug}`
          })),
          { name: "Aktualne promocje bankowe" }
        )
      : null,
    faqLd(LISTING_FAQ)
  ].filter((node): node is Record<string, unknown> => node !== null);

  return (
    <div className="container-page py-6 md:py-10">
      <AttributionCapture />
      <JsonLd data={structuredData} />

      <Breadcrumbs
        items={[{ label: "Start", href: "/" }, { label: "Promocje" }]}
      />

      {/* Shown when /out/[slug] redirected here instead of to the partner
          because the promotion is no longer active (draft, expired,
          archived, or past its end date) - see src/app/out/[slug]/route.ts. */}
      {params.niedostepna === "1" ? (
        <p
          role="status"
          className="mt-4 flex items-start gap-2 rounded-card border border-line bg-coral-100 p-4 text-small text-ink-900"
        >
          <Info size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-coral-600" />
          Ta promocja nie jest już dostępna – sprawdź aktualne promocje poniżej.
        </p>
      ) : null}

      <h1 className="mt-4 max-w-3xl">{promotionsListHeading(now)}</h1>
      <p className="type-lead mt-3 max-w-2xl text-ink-700">
        Aktualne promocje bankowe w jednym miejscu: premia, trudność, koszt konta i termin zapisów.
      </p>
      {updatedText ? (
        <p className="mt-2 text-small text-ink-500">
          {LATEST_VERIFICATION_LABEL}: <time dateTime={isoDatePL(latestVerification) ?? undefined}>{updatedText}</time>
        </p>
      ) : null}

      <section aria-labelledby="lista-promocji" className="mt-6">
        <h2 id="lista-promocji" className="sr-only">
          Lista promocji
        </h2>
        {/* Filters renders the disclosure strip above the toolbar: it follows the same
            (optimistic) sort as the description under the sort control. */}
        <Filters
          banks={bankOptions}
          disclosureStrip
          resultCount={listing.cards.length}
          shownCount={slice.visible.length}
          segmentCounts={listing.counts}
        >
          {isEmpty ? (
            <NoResultsState
              query={state.q || undefined}
              hasFilters={filtersOn && activeCount > 0}
              relaxations={emptyHelp?.relaxations}
              suggestions={emptyHelp?.suggestions}
              clearHref={listingHref({ ...state, q: "", bank: "", accountType: "", difficulty: [], minBonus: null, noFees: false, eligibleOnly: false })}
            />
          ) : (
            <ListingGrid
              cards={slice.visible}
              remaining={slice.remaining}
              moreHref={slice.nextPage ? listingHref(state, slice.nextPage) : null}
            />
          )}
        </Filters>
      </section>


      <div className="mt-16 border-t border-line pt-12 md:mt-20 md:pt-16">
        <ListingEditorial />
      </div>
    </div>
  );
}
