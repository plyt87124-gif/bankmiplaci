import Link from "next/link";
import { cn } from "@/lib/cn";
import { ARTICLE_CATEGORIES, CATEGORY_INFO, type ArticleCategoryKey } from "@/components/blog/categories";

/**
 * Category links above a blog list: "Wszystkie" plus every category that has
 * at least one published article (an empty category is not advertised; its page
 * still exists, as noindex). The current page carries aria-current. Chips are
 * rectangular (8 px) and at least 44 px high.
 */
export function CategoryNav({
  counts,
  current,
  className
}: {
  /** Published articles per category. Missing key = 0. */
  counts: Partial<Record<ArticleCategoryKey, number>>;
  /** Category of the page, or null on /blog. */
  current: ArticleCategoryKey | null;
  className?: string;
}) {
  const visible = ARTICLE_CATEGORIES.filter((key) => (counts[key] ?? 0) > 0 || key === current);
  if (visible.length === 0) return null;
  const total = ARTICLE_CATEGORIES.reduce((sum, key) => sum + (counts[key] ?? 0), 0);

  const chip = (active: boolean) =>
    cn(
      "inline-flex min-h-11 items-center rounded-lg border px-4 text-small font-semibold transition-colors duration-150 ease-out",
      active
        ? "border-action bg-action text-on-action"
        : "border-line-strong bg-surface text-ink-900 hover:bg-sunken"
    );

  return (
    <nav aria-label="Kategorie artykułów" className={className}>
      <ul className="flex flex-wrap gap-2">
        <li>
          <Link href="/blog" aria-current={current === null ? "page" : undefined} className={chip(current === null)}>
            Wszystkie <span className="num ml-1.5">({total})</span>
          </Link>
        </li>
        {visible.map((key) => {
          const info = CATEGORY_INFO[key];
          return (
            <li key={key}>
              <Link
                href={`/blog/kategoria/${info.slug}`}
                aria-current={current === key ? "page" : undefined}
                className={chip(current === key)}
              >
                {info.label} <span className="num ml-1.5">({counts[key] ?? 0})</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
