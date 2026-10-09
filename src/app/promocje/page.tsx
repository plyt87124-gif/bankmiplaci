import type { Metadata } from "next";
import { Info } from "lucide-react";
import { AffiliateDisclosure } from "@/components/AffiliateDisclosure";
import { AttributionCapture } from "@/components/AttributionCapture";
import { Filters } from "@/components/Filters";
import { JsonLd } from "@/components/JsonLd";
import { NoResultsState } from "@/components/NoResultsState";
import { TrustNote } from "@/components/trust/TrustNote";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import {
  effectiveSort,
  hasActiveFilters,
  listingHref,
  parseListingParams,
  parsePage
} from "@/components/filters/filterParams";
import { ListingEditorial } from "@/components/promocje/ListingEditorial";
import { ListingGrid } from "@/components/promocje/ListingGrid";
import { LISTING_FAQ } from "@/components/promocje/editorialContent";
import { slicePage } from "@/components/promocje/listing";
import {
  getActiveCount,
  getBanksWithOffers,
  getLatestVerification,
  loadEmptyStateHelp,
  loadListing
} from "@/components/promocje/listingData";
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

  const [listing, banks, latestVerification, activeCount] = await Promise.all([
    loadListing(state),
    getBanksWithOffers(),
    getLatestVerification(),
    getActiveCount()
  ]);

  const slice = slicePage(listing.cards, page);
  const filtersOn = hasActiveFilters(state);
  const sort = effectiveSort(state);
  const isEmpty = listing.cards.length === 0;
  const emptyHelp = isEmpty && filtersOn && activeCount > 0 ? await loadEmptyStateHelp(state, banks) : null;
  const updatedText = latestVerification ? formatDatePL(latestVerification, "numeric") : "";

  const structuredData = [
    breadcrumbLd([
      { name: "Start", path: "/" },
      { name: "Promocje", path: "/promocje" }
    ]),
    // The list of the clean page only: a filtered list is a different list.
    filtersOn
      ? null
      : itemListLd(
          slice.visible.map((card) => ({
            name: promotionHeading({ name: card.name, bankName: card.bank.name }),
            path: `/promocje/${card.slug}`
          })),
          { name: "Aktualne promocje bankowe" }
        ),
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
          Dane zaktualizowano: <time dateTime={isoDatePL(latestVerification) ?? undefined}>{updatedText}</time>
        </p>
      ) : null}

      {/* Above EVERY list of offers; the wording follows the active sort. */}
      <AffiliateDisclosure variant="strip" sort={sort} className="mt-6 max-w-3xl" />

      <section aria-labelledby="lista-promocji" className="mt-8">
        <h2 id="lista-promocji" className="sr-only">
          Lista promocji
        </h2>
        <Filters
          banks={banks}
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
              clearHref={listingHref({ ...state, q: "", bank: "", accountType: "", difficulty: [], minBonus: null, noFees: false })}
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

      <TrustNote kind="scope" className="mt-10 max-w-[68ch]" />

      <div className="mt-16 border-t border-line pt-12 md:mt-20 md:pt-16">
        <ListingEditorial />
      </div>
    </div>
  );
}
