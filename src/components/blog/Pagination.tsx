import { ChevronLeft, ChevronRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { pageHref } from "@/components/blog/paging";

/**
 * Previous / next links for a blog list, real `?strona=N` links (they work
 * without JavaScript and are crawlable). Renders nothing for a single page.
 * On a phone the "Strona X z Y" line sits above two full-width buttons; from
 * sm they share one row.
 */
export function Pagination({
  basePath,
  page,
  totalPages,
  className
}: {
  /** Path of the list without query, e.g. "/blog". */
  basePath: string;
  page: number;
  totalPages: number;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Strony listy artykułów" className={className}>
      <div className="grid grid-cols-2 items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
        {page > 1 ? (
          <ButtonLink variant="secondary" href={pageHref(basePath, page - 1)} rel="prev" fullWidth className="sm:w-auto sm:justify-self-start">
            <ChevronLeft size={18} aria-hidden="true" />
            Poprzednia
          </ButtonLink>
        ) : (
          <span aria-hidden="true" />
        )}
        <p className="num order-first col-span-2 text-center text-small text-ink-700 sm:order-none sm:col-span-1">
          Strona {page} z {totalPages}
        </p>
        {page < totalPages ? (
          <ButtonLink variant="secondary" href={pageHref(basePath, page + 1)} rel="next" fullWidth className="sm:w-auto sm:justify-self-end">
            Następna
            <ChevronRight size={18} aria-hidden="true" />
          </ButtonLink>
        ) : (
          <span aria-hidden="true" />
        )}
      </div>
    </nav>
  );
}
