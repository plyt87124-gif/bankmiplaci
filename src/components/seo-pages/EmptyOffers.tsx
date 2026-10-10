import { SearchX } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * "There is nothing to list right now" box of the landing pages: an honest
 * headline, one sentence on what to do next, and the way out (links/buttons as
 * `children`). The page around it (editorial text, FAQ) stays, so an empty
 * list is never a dead end. Server component.
 */
export function EmptyOffers({
  title,
  description,
  children,
  headingLevel = 3,
  className
}: {
  title: string;
  description: ReactNode;
  children?: ReactNode;
  /** Level of the title: 3 under a list heading (default), 2 when the box stands in for the whole list. */
  headingLevel?: 2 | 3;
  className?: string;
}) {
  const Heading = `h${headingLevel}` as "h2" | "h3";
  return (
    <div data-empty-state="true" className={cn("rounded-card border border-dashed border-line-strong bg-surface p-6 sm:p-8", className)}>
      <SearchX size={28} aria-hidden="true" className="text-ink-500" />
      <Heading className="mt-3 text-h4 text-ink-900">{title}</Heading>
      <p className="mt-1 max-w-prose text-ui text-ink-700">{description}</p>
      {children ? <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">{children}</div> : null}
    </div>
  );
}
