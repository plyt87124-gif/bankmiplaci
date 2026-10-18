import type { ComponentProps } from "react";
import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/cn";
import { siteUrl } from "@/lib/seo/siteUrl";
import { rehypeHeadingIds } from "@/components/blog/headingIds";
import { classifyHref, safeImageSrc } from "@/components/blog/links";

/**
 * Renders an article's markdown in the reading style of the design spec:
 * 17/28 text (18/30 from lg) in a column the page limits to 44 rem (~68
 * characters), serif h2, underlined links, sunken blockquotes with a rule on
 * the left, tables in a focusable scroll frame. Server component.
 *
 * The body is written by trusted admins and stored as markdown. react-markdown
 * does not inject raw HTML (no rehype-raw), unsafe URL schemes are removed by
 * its default urlTransform, and the links are classified once more here.
 *
 * Links (rules in blog/links.ts):
 *   internal  next/link, no target;
 *   partner   /out/... and the affiliate network host: a plain <a> (the click
 *             must not be prefetched), rel="sponsored nofollow noopener",
 *             opens in a new tab;
 *   external  rel="noopener noreferrer", opens in a new tab;
 *   anchor / mailto  plain <a>.
 * A link that opens a new tab says so to screen readers.
 *
 * Headings: the page's own <h1> is the article title, so a markdown "# ..."
 * is rendered as an <h2>, and levels 5-6 as <h4>. Every heading gets an id
 * made from its text (blog/headingIds.ts), so "[spis](#sekcja)" links work.
 * Images: https (or a path on this site) only, otherwise the alt text is shown.
 * Footnotes (GFM) are labelled in Polish.
 */
const LINK_CLASS = "link-inline font-medium [overflow-wrap:anywhere]";

export const ARTICLE_PARTNER_REL = "sponsored nofollow noopener";
export const ARTICLE_EXTERNAL_REL = "noopener noreferrer";

const SR_NEW_TAB = " (otwiera się w nowej karcie)";
const SR_PARTNER = " (link partnerski, otwiera się w nowej karcie)";

/** Host of this site (with port), used to recognise absolute links to ourselves. */
export function siteHost(): string | undefined {
  try {
    return new URL(siteUrl()).host;
  } catch {
    return undefined;
  }
}

// react-markdown passes the syntax-tree node as a `node` prop; it must not reach the DOM.
type WithNode<T> = T & { node?: unknown };

/**
 * Attributes of a link that the page itself relies on: the footnote markers
 * and back-links of GFM footnotes (id, aria-label, aria-describedby, data-footnote-*),
 * which only work together. Everything else from the markdown is dropped.
 */
function keptLinkAttributes(rest: Record<string, unknown>): Record<string, unknown> {
  const kept: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (key === "id" || key === "aria-label" || key === "aria-describedby" || key.startsWith("data-footnote")) {
      kept[key] = value;
    }
  }
  return kept;
}

function createComponents(host: string | undefined): Components {
  return {
    a: ({ node: _node, href, children, className: _className, ...rest }: WithNode<ComponentProps<"a">>) => {
      const link = classifyHref(href, host);
      const kept = keptLinkAttributes(rest as Record<string, unknown>);
      // Empty or unsafe target: keep the words, drop the link.
      if (!link) return <>{children}</>;

      if (link.kind === "internal") {
        return (
          <Link href={link.href} className={LINK_CLASS} title={rest.title} {...kept}>
            {children}
          </Link>
        );
      }
      if (link.kind === "partner") {
        return (
          <a href={link.href} target="_blank" rel={ARTICLE_PARTNER_REL} className={LINK_CLASS} title={rest.title} {...kept}>
            {children}
            <span className="sr-only">{SR_PARTNER}</span>
          </a>
        );
      }
      if (link.kind === "external") {
        return (
          <a href={link.href} target="_blank" rel={ARTICLE_EXTERNAL_REL} className={LINK_CLASS} title={rest.title} {...kept}>
            {children}
            <span className="sr-only">{SR_NEW_TAB}</span>
          </a>
        );
      }
      return (
        <a href={link.href} className={LINK_CLASS} title={rest.title} {...kept}>
          {children}
        </a>
      );
    },

    h1: ({ node: _node, id, children }: WithNode<ComponentProps<"h1">>) => (
      <h2 id={id} className="mt-12 scroll-mt-20 font-display text-h2 text-ink-900 md:text-h2-lg">
        {children}
      </h2>
    ),
    // The h2 that remark-gfm adds before the footnotes ("Przypisy", class sr-only,
    // id footnote-label) stays visually hidden; every other h2 is a section heading.
    h2: ({ node: _node, id, className, children }: WithNode<ComponentProps<"h2">>) =>
      className?.split(/\s+/).includes("sr-only") ? (
        <h2 id={id} className="sr-only">
          {children}
        </h2>
      ) : (
        <h2 id={id} className="mt-12 scroll-mt-20 font-display text-h2 text-ink-900 md:text-h2-lg">
          {children}
        </h2>
      ),
    h3: ({ node: _node, id, children }: WithNode<ComponentProps<"h3">>) => (
      <h3 id={id} className="mt-9 scroll-mt-20 font-body text-h3 text-ink-900">
        {children}
      </h3>
    ),
    h4: ({ node: _node, id, children }: WithNode<ComponentProps<"h4">>) => (
      <h4 id={id} className="mt-7 scroll-mt-20 font-body text-h4 text-ink-900">
        {children}
      </h4>
    ),
    h5: ({ node: _node, id, children }: WithNode<ComponentProps<"h5">>) => (
      <h4 id={id} className="mt-7 scroll-mt-20 font-body text-h4 text-ink-900">
        {children}
      </h4>
    ),
    h6: ({ node: _node, id, children }: WithNode<ComponentProps<"h6">>) => (
      <h4 id={id} className="mt-7 scroll-mt-20 font-body text-h4 text-ink-900">
        {children}
      </h4>
    ),

    // GFM footnotes: a quiet block at the end of the article.
    section: ({ node: _node, className, children, ...rest }: WithNode<ComponentProps<"section">>) =>
      "data-footnotes" in rest ? (
        <section data-footnotes="" className="footnotes mt-12 border-t border-line pt-6 text-small">
          {children}
        </section>
      ) : (
        <section className={className}>{children}</section>
      ),

    p: ({ node: _node, children }: WithNode<ComponentProps<"p">>) => <p className="mt-5">{children}</p>,
    strong: ({ node: _node, children }: WithNode<ComponentProps<"strong">>) => (
      <strong className="font-semibold text-ink-900">{children}</strong>
    ),
    ul: ({ node: _node, children, className }: WithNode<ComponentProps<"ul">>) => (
      <ul
        // GFM task lists get their own class; they have no bullets.
        className={cn(
          "mt-5 space-y-2 pl-6 marker:text-ink-400",
          className?.includes("contains-task-list") ? "list-none pl-0" : "list-disc"
        )}
      >
        {children}
      </ul>
    ),
    ol: ({ node: _node, children, start }: WithNode<ComponentProps<"ol">>) => (
      <ol start={start} className="mt-5 list-decimal space-y-2 pl-6 marker:text-ink-500">
        {children}
      </ol>
    ),
    blockquote: ({ node: _node, children }: WithNode<ComponentProps<"blockquote">>) => (
      <blockquote className="mt-6 rounded-r-field border-l-4 border-line-strong bg-sunken px-5 py-3 [&>p]:mt-3 [&>p:first-child]:mt-0">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="my-10 border-line" />,

    table: ({ node: _node, children }: WithNode<ComponentProps<"table">>) => (
      <div
        role="region"
        tabIndex={0}
        aria-label="Tabela, przewijana poziomo"
        className="mt-6 overflow-x-auto rounded-card border border-line"
      >
        <table className="w-full border-collapse text-ui">{children}</table>
      </div>
    ),
    th: ({ node: _node, children, style }: WithNode<ComponentProps<"th">>) => (
      <th
        scope="col"
        style={style}
        className="border-b border-line-strong bg-sunken px-3 py-2 text-left align-bottom font-semibold text-ink-900"
      >
        {children}
      </th>
    ),
    td: ({ node: _node, children, style }: WithNode<ComponentProps<"td">>) => (
      <td style={style} className="border-b border-line px-3 py-2 align-top">
        {children}
      </td>
    ),

    pre: ({ node: _node, children }: WithNode<ComponentProps<"pre">>) => (
      <pre
        tabIndex={0}
        role="region"
        aria-label="Fragment kodu, przewijany poziomo"
        className="mt-6 overflow-x-auto rounded-card border border-line bg-sunken p-4 text-small text-ink-900 [&_code]:bg-transparent [&_code]:p-0"
      >
        {children}
      </pre>
    ),
    code: ({ node: _node, children, className }: WithNode<ComponentProps<"code">>) => (
      <code className={cn("rounded bg-ink-100 px-1 py-0.5 text-[0.9em] text-ink-900", className)}>{children}</code>
    ),

    img: ({ node: _node, src, alt, title }: WithNode<ComponentProps<"img">>) => {
      // Only https (or a path on this site): plain http would be mixed content,
      // and the author cannot be asked to vouch for any host. Otherwise the alt text stays.
      const safe = safeImageSrc(typeof src === "string" ? src : null);
      if (!safe) return alt ? <>{alt}</> : null;
      return (
        // Images in articles come from the markdown with unknown dimensions, so the
        // optimiser of next/image (which needs width/height or a fixed host list) is not used.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={safe}
          alt={alt ?? ""}
          title={title}
          loading="lazy"
          decoding="async"
          className="mt-6 block h-auto max-w-full rounded-card border border-line"
        />
      );
    }
  };
}

export function ArticleBody({ markdown, className }: { markdown: string; className?: string }) {
  return (
    <div
      data-article-body=""
      className={cn(
        "type-article break-words text-ink-700",
        // The first block touches the top; a heading is followed by tighter text; list items sit close.
        "[&>:first-child]:mt-0 [&>h2+*]:mt-4 [&>h3+*]:mt-3 [&>h4+*]:mt-2",
        "[&_li>:first-child]:mt-0 [&_li>p+p]:mt-2 [&_li>ul]:!mt-2 [&_li>ol]:!mt-2",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHeadingIds]}
        // The footnote block remark-gfm appends has English defaults.
        remarkRehypeOptions={{
          footnoteLabel: "Przypisy",
          footnoteBackLabel: (referenceIndex, rereferenceIndex) =>
            // rereferenceIndex counts from 1: the first back-link needs no suffix
            rereferenceIndex > 1
              ? `Wróć do przypisu ${referenceIndex + 1} (odwołanie ${rereferenceIndex})`
              : `Wróć do przypisu ${referenceIndex + 1}`
        }}
        components={createComponents(siteHost())}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
