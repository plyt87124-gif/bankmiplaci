import { siteName } from "@/lib/seo/siteUrl";

/**
 * Who an article is "by". Every Article row needs an AdminUser (the account
 * that saved it), but a generic account such as "Administrator" says nothing to
 * a reader or a search engine and is not a person. Such accounts are shown as
 * the editorial team of the site, and in structured data as an Organization.
 *
 * A real person is shown only when the AdminUser's name is one: rename the
 * account in the database and the byline follows. This module never invents a
 * name, a role or a qualification.
 */
export interface ArticleByline {
  name: string;
  kind: "organization" | "person";
}

/** Account names that are roles or placeholders, not people (compared lower-case). */
const PLACEHOLDER_NAMES = new Set(["administrator", "admin", "administracja", "redakcja", "editor", "test", "demo"]);

/** "Redakcja Bankmiplaci" (the site name is configurable). */
export function editorialName(): string {
  return `Redakcja ${siteName()}`;
}

export function articleByline(adminName: string | null | undefined): ArticleByline {
  const name = (adminName ?? "").replace(/\s+/g, " ").trim();
  const lower = name.toLocaleLowerCase("pl-PL");
  if (!name || PLACEHOLDER_NAMES.has(lower) || lower.startsWith("redakcja ")) {
    return { name: editorialName(), kind: "organization" };
  }
  return { name, kind: "person" };
}
