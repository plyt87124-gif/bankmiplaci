import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";

/**
 * /blog skeleton (also the fallback of the category pages): breadcrumbs, H1,
 * lead, category chips and four article cards in the 44 rem reading column.
 */
export default function BlogLoading() {
  return (
    <SkeletonRegion className="container-page py-8 sm:py-12">
      <div className="container-reading">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-4 h-24 w-full sm:h-20" />
        <Skeleton className="mt-4 h-14 w-full" />
        <div className="mt-6 flex flex-wrap gap-2">
          <Skeleton className="h-11 w-28 rounded-lg" />
          <Skeleton className="h-11 w-40 rounded-lg" />
          <Skeleton className="h-11 w-36 rounded-lg" />
        </div>
        <div className="mt-8 space-y-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-card border border-line bg-surface p-5">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="mt-3 h-7 w-full" />
              <Skeleton className="mt-3 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-4/5" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}
