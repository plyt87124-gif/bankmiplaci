/**
 * Paging of the blog lists: 20 articles per page, `?strona=N` in the URL
 * (page 1 is the clean path). Pure helpers, shared by the pages and the tests.
 */
export const BLOG_PAGE_SIZE = 20;

/** Highest page number honoured (keeps `skip` sane for hand-typed URLs). */
export const BLOG_MAX_PAGE = 10_000;

/** Page number from the raw `strona` search parameter: 1 for missing, junk or < 1. */
export function parsePage(raw: string | string[] | undefined | null): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number.parseInt(typeof value === "string" ? value.trim() : "", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, BLOG_MAX_PAGE);
}

/** Number of pages for `total` articles; at least 1 so an empty list still has "page 1". */
export function totalPagesFor(total: number, pageSize: number = BLOG_PAGE_SIZE): number {
  if (!Number.isFinite(total) || total <= 0) return 1;
  return Math.ceil(total / pageSize);
}

/** URL of page `page` of the list at `basePath` (page 1 = the clean path). */
export function pageHref(basePath: string, page: number): string {
  return page > 1 ? `${basePath}?strona=${Math.trunc(page)}` : basePath;
}
