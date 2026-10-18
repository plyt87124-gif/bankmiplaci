import type { MetadataRoute } from "next";
import { PromotionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { expiredIndexWindowStart } from "@/lib/promotionAvailability";
import { DYNAMIC_ROUTE_FLAGS } from "@/lib/seo/routes";
import { buildSitemapEntries, promotionLastModified, type SitemapBankRow } from "@/lib/seo/sitemapEntries";

// sitemap.ts is a standalone metadata route, not part of the app's layout
// tree - it does NOT inherit the "force dynamic" behavior that RootLayout's
// cookie read gives every normal page. Without this, Next.js statically
// generates it once at build time and caches it until the next deploy, so
// every promotion/article added directly to the DB (the normal way content
// gets added on this site, via handoff scripts - no redeploy involved)
// silently never appeared in the live sitemap until whatever the next
// unrelated code deploy happened to be. Revalidating hourly keeps it fresh
// without hitting the DB on every crawler request.
export const revalidate = 3600;

// What is listed is decided by the pure buildSitemapEntries() (tested with a
// fixed clock), using the same robotsForStatus() the offer page uses for its
// <meta robots>: open offers, plus ended offers for 90 days after their last
// sign-up day (placed last). Expiry still needs no manual record edit - the
// Polish calendar day is re-evaluated on each hourly regeneration.
//
// Which static routes are listed is controlled by the `live` flags in
// src/lib/seo/routes.ts, so the sitemap never links to a page that does not
// exist yet.
const OFFER_STATUSES = [PromotionStatus.ACTIVE, PromotionStatus.EXPIRED];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const [promotions, articles, banks] = await Promise.all([
    db.promotion.findMany({
      // Coarse DB filter (cheap, indexed); the exact decision is made in code.
      where: { status: { in: OFFER_STATUSES }, endDate: { gte: expiredIndexWindowStart(now) } },
      select: {
        slug: true,
        status: true,
        endDate: true,
        accountType: true,
        contentUpdatedAt: true,
        lastVerifiedAt: true
      }
    }),
    db.article.findMany({
      where: { published: true },
      select: { slug: true, category: true, contentUpdatedAt: true, publishedAt: true, updatedAt: true }
    }),
    loadBanks()
  ]);

  return buildSitemapEntries({ promotions, articles, banks }, now);
}

/** Bank pages are permanent: every bank that has (or had) a non-draft offer. */
async function loadBanks(): Promise<SitemapBankRow[]> {
  if (!DYNAMIC_ROUTE_FLAGS.bankPages) return [];
  const rows = await db.bank.findMany({
    where: { promotions: { some: { status: { in: OFFER_STATUSES } } } },
    select: {
      slug: true,
      promotions: {
        where: { status: { in: OFFER_STATUSES } },
        select: { contentUpdatedAt: true, lastVerifiedAt: true }
      }
    }
  });
  return rows.map((bank) => {
    const times = bank.promotions.map((p) => promotionLastModified(p).getTime());
    return { slug: bank.slug, lastModified: times.length > 0 ? new Date(Math.max(...times)) : null };
  });
}
