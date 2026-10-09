import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ArticleCard } from "@/components/blog/ArticleCard";
import { BlogEmpty } from "@/components/blog/BlogEmpty";
import { CategoryNav } from "@/components/blog/CategoryNav";
import { Pagination } from "@/components/blog/Pagination";
import { parsePage, totalPagesFor } from "@/components/blog/paging";
import { breadcrumbLd, noindexForSearchParams, STATIC_PAGE_META, staticPageMetadata } from "@/lib/seo";
import { countArticlesByCategory, listArticlePage } from "./data";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * /blog - the list of guides. Title and description come from the SEO library;
 * a page above the first (?strona=2) is noindex,follow with the canonical on
 * the clean /blog.
 */
export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const searchParams = await props.searchParams;
  return staticPageMetadata("blog", { robots: noindexForSearchParams(searchParams) ?? null });
}

export default async function BlogPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const page = parsePage(searchParams.strona);

  const [{ articles, total }, counts] = await Promise.all([listArticlePage(null, page), countArticlesByCategory()]);
  if (page > totalPagesFor(total)) notFound();
  const totalPages = totalPagesFor(total);

  return (
    <div className="container-page py-8 sm:py-12">
      <JsonLd
        data={breadcrumbLd([
          { name: "Start", path: "/" },
          { name: "Poradniki", path: "/blog" }
        ])}
      />
      <div className="container-reading">
        <Breadcrumbs items={[{ label: "Start", href: "/" }, { label: "Poradniki" }]} />
        <h1 className="type-h1 mt-4 text-ink-900">{STATIC_PAGE_META.blog.title}</h1>
        <p className="type-lead mt-4 text-ink-700">
          Artykuły o promocjach bankowych, kontach i finansach osobistych.
        </p>

        <CategoryNav counts={counts} current={null} className="mt-6" />

        {articles.length === 0 ? (
          <div className="mt-8">
            <BlogEmpty
              title="Nie ma jeszcze żadnych artykułów"
              description="Poradniki pojawią się tutaj po opublikowaniu. Tymczasem sprawdź aktualne promocje bankowe."
            >
              <Link href="/promocje" className="link-inline inline-flex min-h-11 items-center font-semibold">
                Zobacz promocje
              </Link>
            </BlogEmpty>
          </div>
        ) : (
          <>
            <ul className="mt-8 space-y-4">
              {articles.map((article) => (
                <li key={article.slug}>
                  <ArticleCard article={article} />
                </li>
              ))}
            </ul>
            <Pagination basePath="/blog" page={page} totalPages={totalPages} className="mt-10" />
            <p className="mt-10 text-ui text-ink-700">
              Szukasz konkretnej oferty?{" "}
              <Link href="/promocje" className="link-inline font-medium">
                Zobacz aktualne promocje bankowe
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </div>
  );
}
