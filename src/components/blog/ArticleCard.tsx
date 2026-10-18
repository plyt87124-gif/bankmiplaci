import Link from "next/link";
import type { ArticleCategory } from "@prisma/client";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { formatDatePL } from "@/lib/format";
import { categoryInfo } from "@/components/blog/categories";

/** What a list needs of an article: never the body. */
export interface ArticleListItem {
  slug: string;
  title: string;
  excerpt: string;
  category: ArticleCategory;
  publishedAt: Date | null;
}

/**
 * One article in a list: the whole card is a single link (the title carries
 * the stretched ::after), so there is one tab stop per article. Flat: a hairline
 * border, no shadow; hover only changes the border and the tint.
 */
export function ArticleCard({
  article,
  headingLevel = 2,
  showCategory = true,
  className
}: {
  article: ArticleListItem;
  /** Level of the title: 2 on the list pages, 3 under a section heading. */
  headingLevel?: 2 | 3;
  showCategory?: boolean;
  className?: string;
}) {
  const Heading = `h${headingLevel}` as "h2" | "h3";
  const published = article.publishedAt ? formatDatePL(article.publishedAt) : "";

  return (
    <article
      data-card="article"
      className={cn(
        "relative rounded-card border border-line bg-surface p-5 transition-colors duration-150 ease-out",
        "hover:border-line-strong hover:bg-sunken/40",
        className
      )}
    >
      {showCategory || published ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {showCategory ? <Badge variant="neutral">{categoryInfo(article.category).label}</Badge> : null}
          {published && article.publishedAt ? (
            <time dateTime={article.publishedAt.toISOString()} className="num text-small text-ink-500">
              {published}
            </time>
          ) : null}
        </div>
      ) : null}
      <Heading className="mt-3 font-body text-h3 text-ink-900 [overflow-wrap:anywhere]">
        <Link
          href={`/blog/${article.slug}`}
          className={cn(
            "rounded-sm outline-none after:absolute after:inset-0 after:rounded-card after:content-['']",
            "focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus-ring"
          )}
        >
          {article.title}
        </Link>
      </Heading>
      {article.excerpt ? <p className="mt-2 line-clamp-3 text-ui text-ink-700">{article.excerpt}</p> : null}
    </article>
  );
}
