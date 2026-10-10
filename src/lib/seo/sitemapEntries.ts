/**
 * Pure assembly of sitemap.xml entries from already-loaded rows
 * (src/app/sitemap.ts does the DB reads). Keeping this free of I/O makes the
 * sitemap policy testable with a fixed clock.
 *
 * Policy (docs/redesign-v2/03-content-and-seo-plan.md section D):
 * - an offer is listed only if robotsForStatus() would index it, so the
 *   sitemap can never advertise a noindex page;
 * - open offers come first; ended offers still inside the 90-day window go
 *   last, with no extra signals (no changefreq/priority anywhere);
 * - <lastmod> is the real content date: contentUpdatedAt, else lastVerifiedAt
 *   (owner decision: the verification date is an honest lastmod). Static
 *   copy pages get none rather than an invented date;
 * - a blog category page (/blog/kategoria/{slug}) is listed only while the
 *   category has at least one published article, exactly when the page itself
 *   is indexable (an empty category is noindex); its lastmod is the newest
 *   article date in it.
 */
import { CATEGORY_INFO } from "../../components/blog/categories";
import { isSignupOpen, robotsForStatus } from "../promotionAvailability";
import { absoluteUrl } from "./siteUrl";
import { DYNAMIC_ROUTE_FLAGS, liveRoutes, type LastModSource } from "./routes";

export interface SitemapPromotionRow {
  slug: string;
  status: string;
  /** Last sign-up day (00:00 UTC of that date). */
  endDate: Date;
  /** Prisma AccountType. */
  accountType: string;
  contentUpdatedAt: Date | null;
  lastVerifiedAt: Date;
}

export interface SitemapArticleRow {
  slug: string;
  /** Prisma ArticleCategory; decides which category page the article keeps listed. */
  category?: string;
  contentUpdatedAt: Date | null;
  publishedAt: Date | null;
  updatedAt: Date;
}

export interface SitemapBankRow {
  slug: string;
  /** Newest change among the bank's non-draft offers; null if unknown. */
  lastModified: Date | null;
}

export interface SitemapInput {
  promotions: readonly SitemapPromotionRow[];
  articles: readonly SitemapArticleRow[];
  banks: readonly SitemapBankRow[];
}

export interface SitemapEntry {
  url: string;
  lastModified?: Date;
}

/** Honest last-change date of an offer: contentUpdatedAt ?? lastVerifiedAt. */
export function promotionLastModified(p: { contentUpdatedAt: Date | null; lastVerifiedAt: Date }): Date {
  return p.contentUpdatedAt ?? p.lastVerifiedAt;
}

/**
 * Honest last-change date of an article: an explicit content revision, else
 * the publication date. Not `updatedAt`, which Prisma bumps on any write
 * (see Article.contentUpdatedAt in schema.prisma); it is only the last resort
 * for a published article with no publication date.
 */
export function articleLastModified(a: Pick<SitemapArticleRow, "contentUpdatedAt" | "publishedAt" | "updatedAt">): Date {
  return a.contentUpdatedAt ?? a.publishedAt ?? a.updatedAt;
}

function maxDate(dates: readonly Date[]): Date | undefined {
  let best: Date | undefined;
  for (const d of dates) {
    if (Number.isNaN(d.getTime())) continue;
    if (!best || d.getTime() > best.getTime()) best = d;
  }
  return best;
}

function withLastMod(url: string, lastModified: Date | undefined): SitemapEntry {
  return lastModified ? { url, lastModified } : { url };
}

export function buildSitemapEntries(input: SitemapInput, now: Date): SitemapEntry[] {
  // Single classification shared with the offer page's <meta robots>.
  const indexable = input.promotions.filter((p) => robotsForStatus(p.status, p.endDate, now).index);
  const open = indexable.filter((p) => isSignupOpen(p, now));
  const ended = indexable.filter((p) => !isSignupOpen(p, now));

  const lastModBySource: Record<LastModSource, Date | undefined> = {
    none: undefined,
    openPromotions: maxDate(open.map(promotionLastModified)),
    openPersonalPromotions: maxDate(open.filter((p) => p.accountType !== "BUSINESS").map(promotionLastModified)),
    openBusinessPromotions: maxDate(open.filter((p) => p.accountType === "BUSINESS").map(promotionLastModified)),
    articles: maxDate(input.articles.map(articleLastModified))
  };

  const entries: SitemapEntry[] = [];

  for (const route of liveRoutes()) {
    // An empty blog is a thin page: it is noindex (see blog/(lista)/page.tsx) and stays out of the sitemap.
    if (route.path === "/blog" && input.articles.length === 0) continue;
    entries.push(withLastMod(absoluteUrl(route.path), lastModBySource[route.lastMod]));
  }

  if (DYNAMIC_ROUTE_FLAGS.bankPages) {
    for (const bank of input.banks) {
      entries.push(withLastMod(absoluteUrl(`/banki/${bank.slug}`), bank.lastModified ?? undefined));
    }
  }

  for (const p of open) {
    entries.push(withLastMod(absoluteUrl(`/promocje/${p.slug}`), promotionLastModified(p)));
  }

  for (const a of input.articles) {
    entries.push(withLastMod(absoluteUrl(`/blog/${a.slug}`), articleLastModified(a)));
  }

  // Category pages: only non-empty categories (the others are noindex), in the
  // fixed order of CATEGORY_INFO.
  for (const info of Object.values(CATEGORY_INFO)) {
    const inCategory = input.articles.filter((a) => a.category === info.key);
    if (inCategory.length === 0) continue;
    entries.push(withLastMod(absoluteUrl(`/blog/kategoria/${info.slug}`), maxDate(inCategory.map(articleLastModified))));
  }

  // Ended but still indexable (<= 90 days): last, same shape, nothing extra.
  for (const p of ended) {
    entries.push(withLastMod(absoluteUrl(`/promocje/${p.slug}`), promotionLastModified(p)));
  }

  return entries;
}
