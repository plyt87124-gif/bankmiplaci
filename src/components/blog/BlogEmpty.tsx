import type { ReactNode } from "react";

/**
 * "Nothing here yet" block of the blog lists. Visitor-facing wording only
 * (no hints about the admin panel). Border line-strong, text ink-700/900.
 * Left-aligned like the heading above it; the way out is a real button.
 */
export function BlogEmpty({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line-strong bg-surface p-6 sm:p-8">
      <p className="text-h4 font-semibold text-ink-900">{title}</p>
      <p className="mt-2 max-w-[34rem] text-ui text-ink-700">{description}</p>
      {children ? <div className="mt-5 flex flex-wrap items-center gap-3">{children}</div> : null}
    </div>
  );
}
