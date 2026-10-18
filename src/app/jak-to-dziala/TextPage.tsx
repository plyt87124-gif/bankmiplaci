import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { breadcrumbLd } from "@/lib/seo";

/**
 * Shared layout of the editorial pages (jak-to-dziala, faq, jak-zarabiamy,
 * metodologia, o-nas, kontakt): breadcrumbs (+ BreadcrumbList JSON-LD), serif
 * H1, lead, reading column of 44 rem set in 17/28 and, from `lg`, a sticky
 * table of contents on the right (below `lg` it folds into a <details> block
 * above the text).
 *
 * It lives in the WP-13 folders (the only ones this work package owns); it is a
 * plain server component and can be moved to src/components without changes.
 *
 * Prose styling is applied to the content wrapper with arbitrary variants so
 * the pages can write plain <h2>/<p>/<ul>. Links WITHOUT a className get the
 * "inline link" look (action colour, underline offset 3 px); anything with its
 * own className (buttons, cards) is left alone. Every h2 that is listed in
 * `toc` must carry the same `id` - tests/content-pages.test.tsx checks it.
 */
export interface TocEntry {
  id: string;
  label: string;
}

const proseStyles = [
  "type-article text-ink-700",
  "[&_h2]:mt-12 [&_h2]:scroll-mt-20 [&_h2]:font-display [&_h2]:text-h2 [&_h2]:text-ink-900 md:[&_h2]:text-h2-lg",
  "[&_h3]:mt-8 [&_h3]:scroll-mt-20 [&_h3]:font-body [&_h3]:text-h3 [&_h3]:text-ink-900",
  "[&_h2+p]:mt-4 [&_h3+p]:mt-3 [&_p+p]:mt-4",
  "[&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_ul]:marker:text-ink-400",
  "[&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_ol]:marker:text-ink-500",
  "[&_p+ul]:mt-3 [&_p+ol]:mt-3 [&_ul+p]:mt-4 [&_ol+p]:mt-4 [&_dl+p]:mt-4",
  "[&_strong]:font-semibold [&_strong]:text-ink-900",
  "[&_a:not([class])]:font-medium [&_a:not([class])]:text-action [&_a:not([class])]:underline [&_a:not([class])]:decoration-1 [&_a:not([class])]:underline-offset-[3px] [&_a:not([class]):hover]:text-action-hover",
  "[&_dt]:mt-6 [&_dt]:font-semibold [&_dt]:text-ink-900 [&_dd]:mt-1",
  "[&_code]:rounded [&_code]:bg-sunken [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-small [&_code]:text-ink-900"
].join(" ");

function TocList({ toc }: { toc: readonly TocEntry[] }) {
  return (
    <ol className="space-y-1 text-small">
      {toc.map((entry) => (
        <li key={entry.id}>
          <a
            href={`#${entry.id}`}
            className="block rounded-md px-2 py-1.5 text-ink-700 underline decoration-1 underline-offset-[3px] hover:text-action"
          >
            {entry.label}
          </a>
        </li>
      ))}
    </ol>
  );
}

export function TextPage({
  path,
  breadcrumbLabel,
  title,
  lead,
  toc,
  children
}: {
  /** Canonical path of the page, e.g. "/o-nas" (last BreadcrumbList item). */
  path: string;
  /** Short name in the breadcrumb trail; defaults to the H1. */
  breadcrumbLabel?: string;
  title: string;
  lead?: ReactNode;
  toc?: readonly TocEntry[];
  children: ReactNode;
}) {
  const crumb = breadcrumbLabel ?? title;
  const hasToc = !!toc && toc.length > 1;

  return (
    <div className="container-page py-8 sm:py-12">
      <JsonLd
        data={breadcrumbLd([
          { name: "Start", path: "/" },
          { name: crumb, path }
        ])}
      />
      <div
        className={
          hasToc ? "lg:grid lg:grid-cols-[minmax(0,44rem)_15rem] lg:justify-center lg:gap-14" : "container-reading"
        }
      >
        <div className="min-w-0">
          <Breadcrumbs items={[{ label: "Start", href: "/" }, { label: crumb }]} />
          <h1 className="type-h1 mt-4 text-ink-900">{title}</h1>
          {lead ? <div className="type-lead mt-4 text-ink-700">{lead}</div> : null}

          {hasToc && (
            <details className="mt-6 rounded-card border border-line bg-sunken lg:hidden">
              <summary className="flex min-h-11 cursor-pointer items-center px-4 text-small font-semibold text-ink-900">
                Spis treści
              </summary>
              <nav aria-label="Spis treści" className="border-t border-line px-2 py-2">
                <TocList toc={toc!} />
              </nav>
            </details>
          )}

          <div className={`mt-8 ${proseStyles}`}>{children}</div>
        </div>

        {hasToc && (
          <div className="hidden lg:block">
            <nav
              aria-label="Spis treści"
              className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto border-l border-line pl-4"
            >
              <p className="mb-2 text-small font-semibold text-ink-900">Na tej stronie</p>
              <TocList toc={toc!} />
            </nav>
          </div>
        )}
      </div>
    </div>
  );
}

/** Quiet information block inside the text (sunken fill, hairline, icon + words). */
export function Callout({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div role="note" className="my-6 flex gap-3 rounded-card border border-line bg-sunken p-4 text-ui text-ink-700">
      <Info size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-500" />
      <div className="min-w-0 [&_p+p]:mt-2">
        {title ? <p className="font-semibold text-ink-900">{title}</p> : null}
        {children}
      </div>
    </div>
  );
}
