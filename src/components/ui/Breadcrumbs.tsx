import Link from "next/link";
import { cn } from "@/lib/cn";

export interface BreadcrumbItem {
  label: string;
  /** Omit on the last (current) item. */
  href?: string;
}

/**
 * Visual breadcrumb trail: 14 px ink-500, "/" separators, last item ink-900
 * with aria-current="page". UI ONLY - the page adds the BreadcrumbList JSON-LD
 * (src/lib/seo) from the same items. On a phone the trail stays on ONE line:
 * the earlier items keep their width and the current page (usually a long
 * offer name, repeated in the h1 right below) is cut with an ellipsis.
 */
export function Breadcrumbs({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Ścieżka nawigacji" className={cn("text-small text-ink-500", className)}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 max-sm:flex-nowrap">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className={cn("flex max-w-full items-center gap-2", isLast ? "min-w-0" : "max-sm:shrink-0")}>
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="inline-flex min-h-[2rem] items-center rounded-sm underline-offset-[3px] hover:text-ink-900 hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? "page" : undefined} className={cn("min-w-0 break-words [overflow-wrap:anywhere]", isLast && "font-medium text-ink-900 max-sm:truncate")}>
                  {item.label}
                </span>
              )}
              {isLast ? null : (
                <span aria-hidden="true" className="text-ink-400">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
