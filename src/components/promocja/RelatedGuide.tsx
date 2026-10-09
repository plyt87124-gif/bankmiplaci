import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";

/**
 * Deep-dive guide written for this specific offer (Article.promotionId), if
 * there is one: internal linking from the offer to the article (the article
 * links back to the offer).
 */
export function RelatedGuide({ article }: { article: { slug: string; excerpt: string } | null }) {
  if (!article) return null;

  return (
    <section aria-labelledby="poradnik-h" className="rounded-card border border-line bg-sunken p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <BookOpen size={22} aria-hidden="true" className="mt-0.5 shrink-0 text-action" />
        <div className="min-w-0">
          <h2 id="poradnik-h" className="font-body text-h3">
            Dowiedz się więcej o tej promocji
          </h2>
          <p className="mt-2 text-article text-ink-700">{article.excerpt}</p>
          <Link
            href={`/blog/${article.slug}`}
            className="link-inline mt-3 inline-flex min-h-11 items-center gap-1 font-medium"
          >
            Przeczytaj poradnik
            <ArrowRight size={16} aria-hidden="true" className="shrink-0" />
          </Link>
        </div>
      </div>
    </section>
  );
}
