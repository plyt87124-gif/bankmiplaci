import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AffiliateDisclosure } from "@/components/AffiliateDisclosure";
import { JsonLd } from "@/components/JsonLd";
import { PromotionCard } from "@/components/PromotionCard";
import { TrustNote } from "@/components/trust/TrustNote";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ArticleBody, siteHost } from "@/components/blog/ArticleBody";
import { ArticleCard } from "@/components/blog/ArticleCard";
import { categoryHref, categoryInfo } from "@/components/blog/categories";
import { containsPartnerLinks } from "@/components/blog/links";
import { formatDatePL } from "@/lib/format";
import { articleLd, breadcrumbLd, buildMetadata, collapseWhitespace, truncateAtWord, DESCRIPTION_MAX } from "@/lib/seo";
import { getPublishedArticle, getRelatedArticles, getRelatedPromotionCard } from "../data";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * The route is rendered per request. It must NOT export `revalidate` or
 * `generateStaticParams`: the root layout reads the session cookie, so Next treats the
 * page as dynamic, and an ISR-style export turns an unknown slug into HTTP 500
 * (DYNAMIC_SERVER_USAGE) in production instead of 404. WP-17 (session out of the
 * layout) can bring ISR back; tests/route-structure.test.ts guards this.
 */

/** Where the author line of the structured data points: the editorial page (there are no author profiles). */
const AUTHOR_URL = "/o-nas";

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const article = await getPublishedArticle(slug);
  if (!article) return { title: "Artykuł nie znaleziony", robots: { index: false, follow: true } };

  const metadata = buildMetadata({
    title: article.title,
    description: truncateAtWord(collapseWhitespace(article.excerpt), DESCRIPTION_MAX),
    path: `/blog/${article.slug}`,
    type: "article",
    publishedTime: article.publishedAt,
    // contentUpdatedAt is set only when the text was really revised (updatedAt changes on any write).
    modifiedTime: article.contentUpdatedAt
  });
  // buildMetadata already made this an og:type=article object (published/modified times);
  // add article:author. Next's OpenGraph type is a union that TypeScript cannot narrow here.
  metadata.openGraph = { ...metadata.openGraph, type: "article", authors: [article.author.name] } as Metadata["openGraph"];
  return metadata;
}

export default async function ArticlePage(props: PageProps) {
  const { slug } = await props.params;
  const article = await getPublishedArticle(slug);
  if (!article) notFound();

  const [related, promotion] = await Promise.all([
    getRelatedArticles(article, 3),
    getRelatedPromotionCard(article.promotionId)
  ]);

  const category = categoryInfo(article.category);
  const articlePath = `/blog/${article.slug}`;
  const hasPartnerLinks = containsPartnerLinks(article.body, siteHost());
  const published = article.publishedAt;
  const modified = article.contentUpdatedAt;

  return (
    <div className="container-page py-8 sm:py-12">
      <JsonLd
        data={articleLd({
          slug: article.slug,
          title: article.title,
          description: article.excerpt,
          publishedAt: published,
          modifiedAt: modified,
          authorName: article.author.name,
          authorUrl: AUTHOR_URL
        })}
      />
      <JsonLd
        data={breadcrumbLd([
          { name: "Start", path: "/" },
          { name: "Poradniki", path: "/blog" },
          { name: category.label, path: categoryHref(article.category) },
          { name: article.title, path: articlePath }
        ])}
      />

      <div className="container-reading">
        <Breadcrumbs
          items={[
            { label: "Start", href: "/" },
            { label: "Poradniki", href: "/blog" },
            { label: category.label, href: categoryHref(article.category) },
            { label: article.title }
          ]}
        />

        <article className="mt-4">
          <header>
            <p>
              <Link href={categoryHref(article.category)} className="link-inline text-small font-semibold">
                {category.label}
              </Link>
            </p>
            <h1 className="type-h1 mt-2 text-ink-900 [overflow-wrap:anywhere]">{article.title}</h1>
            {article.excerpt ? <p className="type-lead mt-4 text-ink-700">{article.excerpt}</p> : null}
            {/* Real byline from the actual authoring AdminUser and the database dates -
                never a name, credential or review date that isn't backed by a field. */}
            <p className="mt-5 flex flex-wrap gap-x-2 gap-y-1 text-small text-ink-500">
              <span>Autor: {article.author.name}</span>
              <span aria-hidden="true">·</span>
              {published ? (
                <span>
                  Opublikowano <time dateTime={published.toISOString()}>{formatDatePL(published)}</time>
                </span>
              ) : (
                <span>Brak daty publikacji</span>
              )}
              {modified ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    Zaktualizowano <time dateTime={modified.toISOString()}>{formatDatePL(modified)}</time>
                  </span>
                </>
              ) : null}
            </p>
          </header>

          {/* One note above the text, not one per link. */}
          {hasPartnerLinks ? <AffiliateDisclosure variant="compact" className="mt-4" /> : null}

          <div className="mt-8">
            <ArticleBody markdown={article.body} />
          </div>

          <TrustNote kind="notBank" className="mt-10 border-t border-line pt-4" />
        </article>

        {promotion ? (
          <section aria-labelledby="powiazana-promocja" className="mt-14">
            <h2 id="powiazana-promocja" className="text-ink-900">
              Powiązana promocja
            </h2>
            <p className="mt-2 text-ui text-ink-700">Oferta, której dotyczy ten artykuł.</p>
            <div className="mt-5 max-w-[26rem]">
              <PromotionCard promotion={promotion} headingLevel={3} />
            </div>
          </section>
        ) : null}

        {related.length > 0 ? (
          <section aria-labelledby="czytaj-dalej" className="mt-14">
            <h2 id="czytaj-dalej" className="text-ink-900">
              Czytaj dalej: {category.label}
            </h2>
            <ul className="mt-5 space-y-4">
              {related.map((item) => (
                <li key={item.slug}>
                  <ArticleCard article={item} headingLevel={3} showCategory={false} />
                </li>
              ))}
            </ul>
            <p className="mt-6 flex flex-wrap gap-x-6 gap-y-1 text-ui">
              <Link href={categoryHref(article.category)} className="link-inline inline-flex min-h-11 items-center font-medium">
                Wszystkie artykuły z kategorii
              </Link>
              <Link href="/blog" className="link-inline inline-flex min-h-11 items-center font-medium">
                Wszystkie poradniki
              </Link>
            </p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
