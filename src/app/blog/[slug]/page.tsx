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
  const article = await db.article.findUnique({
    where: { slug: params.slug },
    include: { author: true }
  });
  if (!article || !article.published) notFound();

  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/blog/${article.slug}`;
  const datePublished = article.publishedAt ?? article.createdAt;
  // Only worth reporting when the article was genuinely edited after
  // publishing — otherwise dateModified would just echo datePublished
  // (or drift from it by a few insert-time milliseconds), which isn't a
  // "sensible update date" per Article schema guidance. A day+ gap is a
  // real edit; anything closer is noise from how the row was created.
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const dateModified =
    article.updatedAt.getTime() - datePublished.getTime() > ONE_DAY_MS ? article.updatedAt : undefined;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.excerpt,
    datePublished: datePublished.toISOString(),
    ...(dateModified ? { dateModified: dateModified.toISOString() } : {}),
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    publisher: { "@type": "Organization", name: "Bankmiplaci.pl" },
    author: { "@type": "Person", name: article.author.name }
  };

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

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </article>
  );
}
