import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const article = await db.article.findUnique({ where: { slug: params.slug } });
  if (!article || !article.published) return { title: "Artykuł nie znaleziony" };
  return {
    title: article.title,
    description: article.excerpt,
    alternates: { canonical: `/blog/${article.slug}` }
  };
}

export default async function ArticlePage(props0: PageProps) {
  const params = await props0.params;
  const article = await db.article.findUnique({
    where: { slug: params.slug },
    include: { author: true }
  });
  if (!article || !article.published) notFound();

  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/blog/${article.slug}`;
  const datePublished = article.publishedAt ?? article.createdAt;
  // contentUpdatedAt is set explicitly only when the article's actual
  // content was revised — unlike `updatedAt`, which Prisma bumps on any
  // write at all (see Article in prisma/schema.prisma). No time-since-
  // publish threshold: a same-day correction is just as real an update
  // as one a month later, so it's shown exactly when the field is set.
  const dateModified = article.contentUpdatedAt ?? undefined;

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
      {/* Real byline from the actual authoring AdminUser — never a name,
          credential, or review date that isn't backed by a DB field. */}
      <p className="mt-2 text-sm text-ink-500">
        {article.author.name}
        {article.publishedAt && <> · {formatDate(article.publishedAt)}</>}
        {dateModified && <> · zaktualizowano {formatDate(dateModified)}</>}
      </p>
      {/* `body` is authored by trusted admins in the panel, stored as markdown.
          react-markdown never injects raw HTML by default (no rehype-raw
          plugin), so this stays safe even without further sanitization. */}
      <div className="article-body article-body-sm mt-8">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Links inside article bodies open in a new tab — clicking
            // "Sprawdź promocję..." shouldn't navigate away from the
            // article itself, whether the link is internal or external.
            a: ({ href, children, ...props }) => (
              <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                {children}
              </a>
            )
          }}
        >
          {article.body}
        </ReactMarkdown>
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </article>
  );
}
