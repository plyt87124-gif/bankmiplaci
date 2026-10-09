import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";

/** Article skeleton: breadcrumbs, category, title, lead, byline and a few paragraphs of the reading column. */
export default function ArticleLoading() {
  return (
    <SkeletonRegion className="container-page py-8 sm:py-12">
      <div className="container-reading">
        <Skeleton className="h-5 w-64 max-w-full" />
        <Skeleton className="mt-6 h-5 w-32" />
        <Skeleton className="mt-3 h-24 w-full sm:h-20" />
        <Skeleton className="mt-4 h-16 w-full" />
        <Skeleton className="mt-5 h-5 w-72 max-w-full" />
        <div className="mt-8 space-y-5">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <Skeleton className="h-5 w-full" />
              <Skeleton className="mt-2 h-5 w-full" />
              <Skeleton className="mt-2 h-5 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}
