import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";

/**
 * /porownaj skeleton, same geometry as the page: breadcrumbs, title, lead,
 * segment, picker, disclosure strip and a table with a label column and three
 * offer columns (the real table scrolls inside its own frame, so this never
 * widens the page).
 */
export default function CompareLoading() {
  return (
    <SkeletonRegion className="container-page py-8 md:py-12">
      <Skeleton className="h-5 w-52" />
      <Skeleton className="mt-4 h-10 w-72 max-w-full" />
      <Skeleton className="mt-3 h-14 w-full max-w-[44rem]" />
      <div className="mt-6 flex gap-2">
        <Skeleton className="h-11 w-32 rounded-full" />
        <Skeleton className="h-11 w-32 rounded-full" />
      </div>
      <Skeleton className="mt-4 h-14 w-full rounded-card" />
      <Skeleton className="mt-6 h-16 w-full rounded-field" />
      <div className="mt-6 overflow-hidden rounded-card border border-line">
        <div className="grid grid-cols-[104px_repeat(2,148px)] sm:grid-cols-[152px_repeat(3,1fr)]">
          <div className="p-3" />
          {[0, 1, 2].map((i) => (
            <div key={i} className={i === 2 ? "hidden p-3 sm:block" : "p-3"}>
              <Skeleton className="h-8 w-[88px] rounded-lg" />
              <Skeleton className="mt-3 h-4 w-24" />
              <Skeleton className="mt-2 h-4 w-28" />
            </div>
          ))}
          {Array.from({ length: 6 }).map((_, row) => (
            <div key={row} className="contents">
              <div className="p-3">
                <Skeleton className="h-4 w-16" />
              </div>
              {[0, 1, 2].map((i) => (
                <div key={i} className={i === 2 ? "hidden p-3 sm:block" : "p-3"}>
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}
