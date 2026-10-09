import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";

/**
 * Loading state of an offer page: the same skeleton as the page - breadcrumbs,
 * logo tile (160 x 56), title, badges, lead, the five-fact bar, and below it the
 * long column with the sticky panel beside it from lg - so the content arrives
 * without the layout jumping. Shown after 200 ms (fast loads never flash) and
 * pulsing only when motion is allowed - see `.skeleton` in src/styles/motion.css.
 * One polite "Ładowanie" status for screen readers.
 */
function SectionSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div>
      {/* h2 */}
      <Skeleton className="h-7 w-2/3 max-w-sm" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: lines }, (_, index) => (
          <Skeleton key={index} className={index === lines - 1 ? "h-5 w-3/5" : "h-5 w-full"} />
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <SkeletonRegion label="Ładowanie promocji" className="container-page py-6 md:py-10">
      {/* breadcrumbs (32 px row) */}
      <div className="flex h-8 items-center">
        <Skeleton className="h-4 w-56" />
      </div>

      {/* logo tile + bank name */}
      <div className="mt-5 flex items-center gap-4 md:mt-6">
        <Skeleton className="h-14 w-40 rounded-lg" />
        <Skeleton className="h-4 w-28" />
      </div>
      {/* h1: two lines on a phone, one from md */}
      <div className="mt-4 max-w-3xl space-y-3">
        <Skeleton className="h-8 w-full max-w-xl md:h-10" />
        <Skeleton className="h-8 w-2/3 max-w-sm md:hidden" />
      </div>
      {/* badges */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-6 w-44" />
      </div>
      {/* lead */}
      <div className="mt-4 max-w-2xl space-y-3">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-4/5" />
      </div>

      {/* "W skrócie" bar: amount row + two rows of facts on a phone, one row from md */}
      <Skeleton className="mt-8 h-4 w-20" />
      <div className="mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line md:grid-cols-[minmax(0,1.25fr)_repeat(4,minmax(0,1fr))]">
        <div className="col-span-2 bg-surface p-4 md:col-span-1 md:p-5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-2 h-11 w-40" />
        </div>
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="bg-surface p-4 md:p-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-6 w-24" />
            <Skeleton className="mt-1.5 h-4 w-20" />
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_22.5rem] lg:items-start">
        {/* the panel: first on a phone (button right after the summary), right-hand column from lg */}
        <div className="rounded-card border border-line bg-surface p-4 sm:p-6 lg:col-start-2 lg:row-start-1">
          <div className="hidden lg:block">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-10 w-44" />
            <Skeleton className="mt-3 h-4 w-52" />
          </div>
          <Skeleton className="h-14 rounded-field lg:mt-5" />
          <Skeleton className="mt-3 h-10 w-full" />
          <Skeleton className="mt-3 h-11 rounded-field" />
          <div className="mt-5 border-t border-line pt-4">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-3 h-4 w-24" />
          </div>
        </div>

        <div className="min-w-0 space-y-12 md:space-y-14 lg:col-start-1 lg:row-start-1">
          <div>
            <Skeleton className="h-7 w-3/4 max-w-md" />
            <div className="mt-5 space-y-5">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="flex items-start gap-4">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2 pt-1">
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <SectionSkeleton lines={4} />
          <SectionSkeleton lines={3} />
          <SectionSkeleton lines={3} />
        </div>
      </div>
    </SkeletonRegion>
  );
}
