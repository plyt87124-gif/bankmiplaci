import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { EmptyState } from "@/components/States";

export const metadata: Metadata = {
  title: "Centrum wiedzy",
  description: "Poradniki o promocjach bankowych, kontach i finansach osobistych.",
  alternates: { canonical: "/blog" }
};

const CATEGORY_LABEL: Record<string, string> = {
  PROMOCJE_BANKOWE: "Promocje bankowe",
  KONTA_BANKOWE: "Konta bankowe",
  FINANSE_OSOBISTE: "Finanse osobiste",
  CASHBACK: "Cashback",
  PORADNIKI: "Poradniki"
};

export default async function BlogPage() {
  const articles = await db.article.findMany({
    where: { published: true },
    orderBy: { publishedAt: "desc" }
  });

  return (
    <div className="container-page max-w-3xl py-14">
      <h1 className="text-3xl font-semibold">Centrum wiedzy</h1>
      <p className="mt-3 text-ink-500">Poradniki o promocjach bankowych, kontach i finansach osobistych.</p>

      {articles.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="Brak opublikowanych artykułów" description="Dodaj pierwszy artykuł w panelu administracyjnym." />
        </div>
      ) : (
        <div className="mt-8 space-y-5">
          {articles.map((article) => (
            <Link
              key={article.id}
              href={`/blog/${article.slug}`}
              className="block rounded-xl2 border border-ink-100 bg-surface p-5 hover:border-teal-500"
            >
              <p className="text-xs font-medium text-teal-700">{CATEGORY_LABEL[article.category]}</p>
              <h2 className="mt-1 font-display text-lg font-semibold">{article.title}</h2>
              <p className="mt-2 text-sm text-ink-500">{article.excerpt}</p>
              {article.publishedAt && (
                <p className="mt-3 text-xs text-ink-300">{formatDate(article.publishedAt)}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
