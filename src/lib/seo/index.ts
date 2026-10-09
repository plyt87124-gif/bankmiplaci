/**
 * Public surface of the SEO library. Pages import from "@/lib/seo".
 *
 *   siteUrl.ts        siteUrl(), absoluteUrl(path), siteName()
 *   dates.ts          Europe/Warsaw calendar helpers (clock always injected)
 *   metadata.ts       buildMetadata, titles/descriptions, noindexForSearchParams
 *   jsonld.ts         organizationLd ... articleLd, serializeJsonLd
 *   routes.ts         which routes the sitemap lists (live flags)
 *   sitemapEntries.ts pure sitemap assembly
 */
export { siteUrl, siteName, absoluteUrl, resolveSiteUrl, DEFAULT_SITE_NAME, FALLBACK_SITE_URL } from "./siteUrl";
export type { ResolvedSiteUrl } from "./siteUrl";
export * from "./dates";
export * from "./metadata";
export * from "./jsonld";
export * from "./routes";
export { buildSitemapEntries, promotionLastModified, articleLastModified } from "./sitemapEntries";
export type { SitemapEntry, SitemapInput, SitemapPromotionRow, SitemapArticleRow, SitemapBankRow } from "./sitemapEntries";
export { collapseWhitespace, truncateAtWord, pluralForm } from "./text";
