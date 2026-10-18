import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";

/** Quiz skeleton: same geometry as the real page (title, lead, progress bar, three answers, button). */
export default function QuizLoading() {
  return (
    <SkeletonRegion className="container-page py-8 md:py-12">
      <div className="container-reading">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-4 h-10 w-4/5 max-w-md" />
        <Skeleton className="mt-4 h-16 w-full" />
        <Skeleton className="mt-8 h-5 w-32" />
        <Skeleton className="mt-2 h-1 w-full rounded-full" />
        <Skeleton className="mt-8 h-7 w-3/4" />
        <div className="mt-5 space-y-3">
          <Skeleton className="h-14 w-full rounded-card" />
          <Skeleton className="h-14 w-full rounded-card" />
          <Skeleton className="h-14 w-full rounded-card" />
        </div>
        <Skeleton className="mt-8 h-11 w-28 rounded-field" />
      </div>
    </SkeletonRegion>
  );
}
