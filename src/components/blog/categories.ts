import type { ArticleCategory } from "@prisma/client";

/**
 * Blog categories: the Prisma enum `ArticleCategory` mapped to the URL slug
 * (/blog/kategoria/[kategoria]), the label shown in the UI and a short,
 * neutral description of the TOPIC of the category. The descriptions say what
 * the category is about - never anything about the articles themselves (their
 * number, quality or authors), because the categories exist before the texts.
 *
 * Pure data, no database and no React: the pages, the sitemap and the tests
 * all read it.
 */
export const ARTICLE_CATEGORIES = [
  "PROMOCJE_BANKOWE",
  "KONTA_BANKOWE",
  "FINANSE_OSOBISTE",
  "CASHBACK",
  "PORADNIKI"
] as const;

export type ArticleCategoryKey = (typeof ARTICLE_CATEGORIES)[number];

// Compile-time guard: fails to build when the Prisma enum gains or loses a value
// and this list is not updated (both directions).
type SameKeys<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const enumInSync: SameKeys<ArticleCategoryKey, ArticleCategory> = true;
void enumInSync;

export interface CategoryInfo {
  key: ArticleCategoryKey;
  /** Path segment: /blog/kategoria/{slug}. */
  slug: string;
  /** Short name (chips, breadcrumbs, labels on cards). */
  label: string;
  /** Page title and H1 of the category page (the layout template adds the brand). */
  title: string;
  /** Lead under the H1 and <meta description> (<= 160 characters). */
  description: string;
}

export const CATEGORY_INFO: Record<ArticleCategoryKey, CategoryInfo> = {
  PROMOCJE_BANKOWE: {
    key: "PROMOCJE_BANKOWE",
    slug: "promocje-bankowe",
    label: "Promocje bankowe",
    title: "Artykuły o promocjach bankowych",
    description:
      "Artykuły o tym, jak działają promocje bankowe: warunki, terminy i to, na co zwrócić uwagę w regulaminie, zanim założysz konto."
  },
  KONTA_BANKOWE: {
    key: "KONTA_BANKOWE",
    slug: "konta-bankowe",
    label: "Konta bankowe",
    title: "Artykuły o kontach bankowych",
    description: "Artykuły o kontach osobistych i firmowych: opłaty, funkcje i różnice między ofertami banków."
  },
  FINANSE_OSOBISTE: {
    key: "FINANSE_OSOBISTE",
    slug: "finanse-osobiste",
    label: "Finanse osobiste",
    title: "Artykuły o finansach osobistych",
    description: "Artykuły o zarządzaniu domowymi finansami i o podstawowych pojęciach związanych z pieniędzmi."
  },
  CASHBACK: {
    key: "CASHBACK",
    slug: "cashback",
    label: "Cashback",
    title: "Artykuły o cashbacku",
    description: "Artykuły o cashbacku, czyli zwrocie części wydatków: jak to działa i na co uważać."
  },
  PORADNIKI: {
    key: "PORADNIKI",
    slug: "poradniki",
    label: "Poradniki",
    title: "Poradniki",
    description: "Praktyczne poradniki i odpowiedzi na pytania o konta, promocje i korzystanie z bankowości."
  }
};

const BY_SLUG = new Map<string, CategoryInfo>(Object.values(CATEGORY_INFO).map((info) => [info.slug, info]));

/** Category for a URL slug, or null for anything that is not one of ours. */
export function categoryFromSlug(slug: string | null | undefined): CategoryInfo | null {
  if (!slug) return null;
  return BY_SLUG.get(slug) ?? null;
}

/** Info for a value of the Prisma enum (what the database returns). */
export function categoryInfo(category: ArticleCategory): CategoryInfo {
  return CATEGORY_INFO[category];
}

export function categoryHref(category: ArticleCategory | ArticleCategoryKey): string {
  return `/blog/kategoria/${CATEGORY_INFO[category].slug}`;
}
