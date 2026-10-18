import { cache } from "react";
import type { ArticleCategory } from "@prisma/client";
import { db } from "@/lib/db";
import { finalizeCards, PROMOTION_CARD_SELECT, type PromotionCardData } from "@/lib/services/promotionCards";
import type { ArticleListItem } from "@/components/blog/ArticleCard";
import { ARTICLE_CATEGORIES, type ArticleCategoryKey } from "@/components/blog/categories";
import { BLOG_PAGE_SIZE } from "@/components/blog/paging";

/**
 * Database reads of the blog. The list queries select the columns a card
 * needs and NEVER `body` (article texts are long; only the article page loads
 * one). Only `published: true` rows are ever returned.
 */
const LIST_SELECT = {
  slug: true,
  title: true,
  excerpt: true,
  category: true,
  publishedAt: true
} as const;

/** Newest first; an article without a publication date (should not happen) goes last. */
const NEWEST_FIRST = [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }] as const;

export interface ArticlePage {
  articles: ArticleListItem[];
  /** Published articles matching the filter (all pages). */
  total: number;
}

/** One page of the list, optionally limited to a category. */
export const listArticlePage = cache(async (category: ArticleCategory | null, page: number): Promise<ArticlePage> => {
  const where = { published: true, ...(category ? { category } : {}) };
  const [articles, total] = await Promise.all([
    db.article.findMany({
      where,
      select: LIST_SELECT,
      orderBy: [...NEWEST_FIRST],
      skip: (page - 1) * BLOG_PAGE_SIZE,
      take: BLOG_PAGE_SIZE
    }),
    db.article.count({ where })
  ]);
  return { articles, total };
});

/** Published articles per category (categories without any are absent). */
export const countArticlesByCategory = cache(async (): Promise<Partial<Record<ArticleCategoryKey, number>>> => {
  const rows = await db.article.groupBy({
    by: ["category"],
    where: { published: true },
    _count: { _all: true }
  });
  const counts: Partial<Record<ArticleCategoryKey, number>> = {};
  for (const row of rows) {
    if ((ARTICLE_CATEGORIES as readonly string[]).includes(row.category)) counts[row.category] = row._count._all;
  }
  return counts;
});

/** The article page's data: a published article with its author's name, or null. */
export const getPublishedArticle = cache(async (slug: string) => {
  const article = await db.article.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      body: true,
      category: true,
      published: true,
      publishedAt: true,
      contentUpdatedAt: true,
      promotionId: true,
      author: { select: { name: true } }
    }
  });
  return article && article.published ? article : null;
});

/** Up to `take` other published articles of the same category, newest first. */
export async function getRelatedArticles(
  article: { id: string; category: ArticleCategory },
  take = 3
): Promise<ArticleListItem[]> {
  return db.article.findMany({
    where: { published: true, category: article.category, id: { not: article.id } },
    select: LIST_SELECT,
    orderBy: [...NEWEST_FIRST],
    take
  });
}

/**
 * The offer an article is a guide to (Article.promotionId), as the public card
 * every list uses (no affiliate URL, no commission). Drafts and archived offers
 * are not shown; an ended offer is (the card says it ended).
 */
export async function getRelatedPromotionCard(promotionId: string | null): Promise<PromotionCardData | null> {
  if (!promotionId) return null;
  const row = await db.promotion.findFirst({
    where: { id: promotionId, status: { in: ["ACTIVE", "EXPIRED"] } },
    select: PROMOTION_CARD_SELECT
  });
  if (!row) return null;
  // A sort other than "recommended" leaves the (single) row as it is.
  return finalizeCards([row], "top-rated")[0] ?? null;
}

/** Slugs for generateStaticParams. A database that cannot be reached at build time yields none (pages render on demand). */
export async function listPublishedSlugs(): Promise<string[]> {
  try {
    const rows = await db.article.findMany({ where: { published: true }, select: { slug: true } });
    return rows.map((row) => row.slug);
  } catch {
    return [];
  }
}
