import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Loading placeholder block. Give it the SAME geometry as the real element
 * (width/height/radius) so nothing shifts when the content arrives (CLS 0).
 * The pulse and the 200 ms "don't flash on fast loads" delay come from
 * `.skeleton` in src/styles/motion.css and only run under `.motion-ok`;
 * with reduced motion (or no JS) it is a static block.
 */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div aria-hidden="true" className={cn("skeleton", className)} {...props} />;
}

/**
 * Wrap a group of skeletons (a whole loading.tsx): one polite status for
 * screen readers instead of a silent grey page.
 */
export function SkeletonRegion({
  label = "Ładowanie",
  className,
  children
}: {
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
