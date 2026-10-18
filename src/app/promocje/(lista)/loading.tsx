import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";

/**
 * Loading state of /promocje: the same skeleton as the page (breadcrumbs,
 * title, lead, strip, segment, toolbar) and six placeholders with the geometry
 * of an offer card, so almost nothing moves when the content arrives. The
 * heights of the text blocks are the heights of the real ones at the three
 * layouts (phone / tablet / desktop, all without a side panel); the card is
 * the height of a typical card (cards in a row stretch to the tallest one).
 * The skeleton appears after 200 ms (fast loads never flash) and pulses only
 * when motion is allowed - see `.skeleton` in src/styles/motion.css. One
 * polite "Ładowanie" status for screen readers.
 *
 * It sits in the (lista) route group so that it wraps only the list: the offer
 * page [slug] has no loading file, which keeps an unknown slug a real HTTP 404.
 */
function CardSkeleton() {
  return (
    <div className="flex h-full min-h-[27.5rem] flex-col rounded-card border border-line bg-surface p-4 sm:p-5">
      {/* logo tile + account-type badge */}
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-10 w-28 rounded-lg" />
        <Skeleton className="h-6 w-28" />
      </div>
      {/* offer name: two lines (min-h 3rem) */}
      <div className="mt-3 min-h-[3rem] space-y-2 pt-0.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/5" />
      </div>
      {/* "PREMIA DO" label + amount */}
      <div className="mt-3 min-h-[3.5rem]">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-2 h-9 w-40" />
      </div>
      {/* first step */}
      <div className="mt-1 flex h-[22px] items-center">
        <Skeleton className="h-4 w-4/5" />
      </div>
      {/* effort + deadline: two rows (as in the card) */}
      <div className="mt-4 flex flex-col items-start gap-2">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-6 w-40" />
      </div>
      {/* fee */}
      <div className="mt-2 flex h-[22px] items-center">
        <Skeleton className="h-4 w-48" />
      </div>
      {/* verification */}
      <div className="mt-2 flex h-6 items-center">
        <Skeleton className="h-4 w-40" />
      </div>
      {/* rating + details */}
      <div className="mt-auto pt-4">
        <div className="flex items-end justify-between gap-3 border-t border-line pt-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <SkeletonRegion label="Ładowanie promocji" className="container-page py-6 md:py-10">
      {/* breadcrumbs (32 px row) */}
      <div className="flex h-8 items-center">
        <Skeleton className="h-4 w-40" />
      </div>
      {/* h1: two lines on a phone, one from sm (46 px from md) */}
      <div className="mt-4 flex h-[76px] max-w-3xl flex-col justify-center gap-3 sm:h-[38px] md:h-[46px]">
        <Skeleton className="h-6 w-full max-w-md sm:h-7" />
        <Skeleton className="h-6 w-2/3 max-w-xs sm:hidden" />
      </div>
      {/* lead: three lines on a phone, two from sm */}
      <div className="mt-3 flex h-[90px] max-w-2xl flex-col justify-center gap-2.5 sm:h-[64px] sm:gap-3">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/5 sm:hidden" />
      </div>
      {/* "Dane zaktualizowano" */}
      <div className="mt-2 flex h-[22px] items-center">
        <Skeleton className="h-4 w-48" />
      </div>
      {/* disclosure strip: 114 px on a phone, 70 px from sm */}
      <Skeleton className="mt-6 h-[114px] max-w-3xl rounded-field sm:h-[70px]" />

      <div className="min-w-0">
        {/* segment (compact, 36 px): one row on most phones, two on the narrowest */}
        <div className="mt-6 flex flex-wrap gap-2">
          <Skeleton className="h-9 w-32 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
        {/* search + sort + "Filtry" button */}
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-[1_1_11rem]">
            <Skeleton className="mb-2 h-5 w-40" />
            <Skeleton className="h-11 rounded-field" />
          </div>
          <div className="min-w-0 flex-[2_1_19rem]">
            <Skeleton className="mb-2 h-5 w-16" />
            <Skeleton className="h-11 rounded-field" />
          </div>
          <Skeleton className="h-11 w-full rounded-field sm:w-[7.5rem]" />
        </div>
        {/* description of the active sort: three lines on a phone, two from sm */}
        <div className="mt-3 flex h-[66px] max-w-[68ch] flex-col justify-center gap-1.5 sm:h-[44px]">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-1/2 sm:hidden" />
        </div>
        {/* counter */}
        <div className="mt-4 flex h-[22px] items-center">
          <Skeleton className="h-4 w-40" />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {Array.from({ length: 6 }, (_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}
