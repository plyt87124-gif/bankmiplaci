import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { PromotionStatus } from "@prisma/client";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

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
