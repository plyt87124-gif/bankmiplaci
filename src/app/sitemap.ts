import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { PromotionStatus } from "@prisma/client";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// sitemap.ts is a standalone metadata route, not part of the app's layout
// tree — it does NOT inherit the "force dynamic" behavior that RootLayout's
// cookie read gives every normal page. Without this, Next.js statically
// generates it once at build time and caches it until the next deploy, so
// every promotion/article added directly to the DB (the normal way content
// gets added on this site, via handoff scripts — no redeploy involved)
// silently never appeared in the live sitemap until whatever the next
// unrelated code deploy happened to be. Revalidating hourly keeps it fresh
// without hitting the DB on every crawler request.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [promotions, articles] = await Promise.all([
    db.promotion.findMany({
      where: { status: PromotionStatus.ACTIVE, endDate: { gte: new Date() } },
      select: { slug: true, updatedAt: true }
    }),
    db.article.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } })
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/promocje`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/porownaj`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/quiz`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/faq`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/jak-zarabiamy`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/blog`, changeFrequency: "weekly", priority: 0.5 }
  ];

  const promotionRoutes: MetadataRoute.Sitemap = promotions.map((p) => ({
    url: `${siteUrl}/promocje/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly",
    priority: 0.8
  }));

  const articleRoutes: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${siteUrl}/blog/${a.slug}`,
    lastModified: a.updatedAt,
    changeFrequency: "monthly",
    priority: 0.4
  }));

  return [...staticRoutes, ...promotionRoutes, ...articleRoutes];
}
