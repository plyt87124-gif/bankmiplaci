import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";

interface PageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const article = await db.article.findUnique({ where: { slug: params.slug } });
  if (!article || !article.published) return { title: "Artykuł nie znaleziony" };
  return {
    title: article.title,
    description: article.excerpt,
    alternates: { canonical: `/blog/${article.slug}` }
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const article = await db.article.findUnique({ where: { slug: params.slug } });
  if (!article || !article.published) notFound();

  return (
    <article className="container-page max-w-2xl py-14">
      <h1 className="text-3xl font-semibold">{article.title}</h1>
      {article.publishedAt && <p className="mt-2 text-sm text-ink-500">{formatDate(article.publishedAt)}</p>}
      {/* `body` is authored by trusted admins in the panel, stored as markdown.
          react-markdown never injects raw HTML by default (no rehype-raw
          plugin), so this stays safe even without further sanitization. */}
      <div className="article-body article-body-sm mt-8">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{article.body}</ReactMarkdown>
      </div>
    </article>
  );
}
