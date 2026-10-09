import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

/**
 * Shell for "something is not here / went wrong" pages (404, error boundary):
 * big calm headline, one honest sentence, ways forward. Server-compatible.
 */
export function StatusPage({
  code,
  title,
  description,
  detail,
  actions,
  children
}: {
  /** Short code shown above the title, e.g. "404". */
  code?: string;
  title: string;
  description: ReactNode;
  /** Small technical line (error digest). */
  detail?: ReactNode;
  /** Buttons / links row. */
  actions?: ReactNode;
  /** Extra content under the actions (search form). */
  children?: ReactNode;
}) {
  return (
    <div className="container-page py-12 md:py-20">
      <div className="container-reading">
        {code ? <p className="type-label text-ink-500">{code}</p> : null}
        <h1 className="type-h1 mt-2">{title}</h1>
        <p className="type-lead mt-4 text-ink-700">{description}</p>
        {detail ? <p className="mt-3 text-caption text-ink-500">{detail}</p> : null}
        {actions ? <div className="mt-8 flex flex-wrap gap-3">{actions}</div> : null}
        {children}
      </div>
    </div>
  );
}

/**
 * Search by bank or offer name. A plain GET form to /promocje?q=..., so it
 * works without JavaScript - which matters on an error page.
 */
export function StatusSearch() {
  return (
    <form action="/promocje" method="get" role="search" className="mt-10 border-t border-line pt-8">
      <Label htmlFor="status-search">Szukaj banku lub oferty</Label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          id="status-search"
          name="q"
          type="search"
          autoComplete="off"
          placeholder="np. nazwa banku"
          className="sm:max-w-sm"
        />
        <Button type="submit" variant="secondary" className="h-12 sm:w-auto">
          Szukaj
        </Button>
      </div>
    </form>
  );
}
