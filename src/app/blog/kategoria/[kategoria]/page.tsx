import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ArticleCard } from "@/components/blog/ArticleCard";
import { BlogEmpty } from "@/components/blog/BlogEmpty";
import { CategoryNav } from "@/components/blog/CategoryNav";
import { Pagination } from "@/components/blog/Pagination";
import { categoryFromSlug } from "@/components/blog/categories";
import { parsePage, totalPagesFor } from "@/components/blog/paging";
import { breadcrumbLd, buildMetadata, noindexForSearchParams } from "@/lib/seo";
import { countArticlesByCategory, listArticlePage } from "../../data";

interface PageProps {
  params: Promise<{ kategoria: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * /blog/kategoria/[kategoria] - the articles of one category (slugs in
 * blog/categories.ts). An empty category is a real page (200) but noindex, and
 * so is every page above the first; the canonical is always the clean path.
 */
export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { kategoria } = await props.params;
  const info = categoryFromSlug(kategoria);
  if (!info) return { title: "Nie znaleziono kategorii", robots: { index: false, follow: true } };

  const searchParams = await props.searchParams;
  const page = parsePage(searchParams.strona);
  const { total } = await listArticlePage(info.key, page);
  const robots = total === 0 ? { index: false as const, follow: true as const } : (noindexForSearchParams(searchParams) ?? null);

  return buildMetadata({
    title: info.title,
    description: info.description,
    path: `/blog/kategoria/${info.slug}`,
    robots
  });
}

export default async function BlogCategoryPage(props: PageProps) {
  const { kategoria } = await props.params;
  const info = categoryFromSlug(kategoria);
  if (!info) notFound();

  const searchParams = await props.searchParams;
  const page = parsePage(searchParams.strona);
  const basePath = `/blog/kategoria/${info.slug}`;

  const [{ articles, total }, counts] = await Promise.all([listArticlePage(info.key, page), countArticlesByCategory()]);
  const totalPages = totalPagesFor(total);
  if (page > totalPages) notFound();

  return (
    <div className="container-page py-8 sm:py-12">
      <JsonLd
        data={breadcrumbLd([
          { name: "Start", path: "/" },
          { name: "Poradniki", path: "/blog" },
          { name: info.label, path: basePath }
        ])}
      />
      <div className="container-reading">
        <Breadcrumbs
          items={[{ label: "Start", href: "/" }, { label: "Poradniki", href: "/blog" }, { label: info.label }]}
        />
        <h1 className="type-h1 mt-4 text-ink-900">{info.title}</h1>
        <p className="type-lead mt-4 text-ink-700">{info.description}</p>

        <CategoryNav counts={counts} current={info.key} className="mt-6" />

        {articles.length === 0 ? (
          <div className="mt-8">
            <BlogEmpty
              title="W tej kategorii nie ma jeszcze artykułów"
              description="Zajrzyj do pozostałych poradników albo sprawdź aktualne promocje bankowe."
            >
              <Link href="/blog" className="link-inline inline-flex min-h-11 items-center font-semibold">
                Wszystkie poradniki
              </Link>
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
                  <ArticleCard article={article} showCategory={false} />
                </li>
              ))}
            </ul>
            <Pagination basePath={basePath} page={page} totalPages={totalPages} className="mt-10" />
          </>
        )}
      </div>
    </div>
  );
}
