/**
 * Article import (the logic behind `npm run import:articles`): articles are
 * written as markdown files with a YAML-like header in `content/articles/`,
 * reviewed in a pull request like code, and written to the database by an
 * explicit command. Kept in the library so it can be tested.
 *
 * Guarantees:
 *  - NOTHING is written unless `apply` is true (the default is a dry run).
 *  - ALL-OR-NOTHING: every file is planned (read-only) first; a problem in any
 *    file throws ArticleImportAbortError before a single write, and the writes
 *    run in one transaction.
 *  - Idempotent: a file identical to the stored article changes nothing.
 *  - `published` defaults to false. A file never un-publishes a live article
 *    (that is done deliberately in the admin panel).
 *  - Dates are honest: `publishedAt` is set once, when an article first goes
 *    live; `contentUpdatedAt` moves only when title, excerpt, body or category
 *    of an ALREADY LIVE article really changes (it feeds dateModified).
 *  - The author of an existing article is never changed by the import.
 */
import type { ArticleCategory, Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { ARTICLE_CATEGORIES } from "@/components/blog/categories";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KEY_RE = /^([A-Za-z_][A-Za-z0-9_]*):(?:\s+(.*)|\s*)$/;

/** SEO length guides from tresci/TEMPLATE-artykul.md; exceeding them is a warning, not an error. */
export const TITLE_MAX = 60;
export const EXCERPT_MAX = 155;

export class ArticleImportAbortError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Import artykułów przerwany, nic nie zapisano:\n- ${problems.join("\n- ")}`);
    this.name = "ArticleImportAbortError";
  }
}

/* ------------------------------------------------------------------ */
/* File parsing                                                        */
/* ------------------------------------------------------------------ */

type FrontmatterValue = string | boolean | string[];

/** Reads a double-quoted JSON-style string at the start of `text`; returns the value and the remainder. */
function readQuoted(text: string): { value: string; rest: string } | null {
  let i = 1;
  let escaped = false;
  for (; i < text.length; i++) {
    const ch = text[i];
    if (escaped) escaped = false;
    else if (ch === "\\") escaped = true;
    else if (ch === '"') break;
  }
  if (i >= text.length) return null;
  try {
    return { value: JSON.parse(text.slice(0, i + 1)) as string, rest: text.slice(i + 1) };
  } catch {
    return null;
  }
}

function onlyComment(rest: string): boolean {
  const t = rest.trim();
  return t === "" || t.startsWith("#");
}

/** One header value: "text", bare text, true/false, [] or ["a", "b"]; a trailing ` # comment` is dropped. */
function parseValue(raw: string, key: string): FrontmatterValue {
  const text = raw.trim();
  if (text.startsWith('"')) {
    const quoted = readQuoted(text);
    if (!quoted || !onlyComment(quoted.rest)) throw new Error(`pole "${key}": błędny tekst w cudzysłowie`);
    return quoted.value;
  }
  if (text.startsWith("[")) {
    const close = text.indexOf("]");
    if (close < 0 || !onlyComment(text.slice(close + 1))) throw new Error(`pole "${key}": lista bez zamknięcia ]`);
    const inner = text.slice(1, close).trim();
    if (inner === "") return [];
    const items: string[] = [];
    let rest = inner;
    while (rest.length > 0) {
      rest = rest.trimStart();
      if (rest.startsWith('"')) {
        const quoted = readQuoted(rest);
        if (!quoted) throw new Error(`pole "${key}": błędny element listy`);
        items.push(quoted.value);
        rest = quoted.rest.trimStart();
        if (rest.startsWith(",")) rest = rest.slice(1);
        else if (rest !== "") throw new Error(`pole "${key}": elementy listy rozdziela przecinek`);
      } else {
        const comma = rest.indexOf(",");
        const item = (comma < 0 ? rest : rest.slice(0, comma)).trim();
        if (item === "") throw new Error(`pole "${key}": pusty element listy`);
        items.push(item);
        rest = comma < 0 ? "" : rest.slice(comma + 1);
      }
    }
    return items;
  }
  const bare = text.replace(/\s+#.*$/, "").trim();
  if (bare.startsWith("#")) return "";
  if (bare === "true") return true;
  if (bare === "false") return false;
  return bare;
}

/**
 * Splits "---\nheader\n---\nbody" and parses the header. Only what the template
 * uses is supported (flat `key: value`); anything else is an error rather than
 * a silent misread.
 */
export function parseFrontmatter(raw: string): { data: Record<string, FrontmatterValue>; body: string } {
  const text = raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  if (!text.startsWith("---\n")) throw new Error("plik musi zaczynać się od linii --- (nagłówek)");
  const end = text.indexOf("\n---", 3);
  if (end < 0) throw new Error("brak zamykającej linii --- nagłówka");
  const afterClose = text.indexOf("\n", end + 1);
  const closing = text.slice(end + 1, afterClose < 0 ? text.length : afterClose).trim();
  if (closing !== "---") throw new Error("brak zamykającej linii --- nagłówka");
  const header = text.slice(4, end + 1);
  const body = afterClose < 0 ? "" : text.slice(afterClose + 1);

  const data: Record<string, FrontmatterValue> = {};
  for (const line of header.split("\n")) {
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    const match = KEY_RE.exec(line);
    if (!match) throw new Error(`nagłówek: nie rozumiem linii „${line.slice(0, 60)}”`);
    const key = match[1]!;
    if (key in data) throw new Error(`nagłówek: pole "${key}" występuje dwa razy`);
    data[key] = parseValue(match[2] ?? "", key);
  }
  return { data, body };
}

const emptyToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);

function isRealDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

const dateField = z
  .preprocess(emptyToUndefined, z.string().refine(isRealDate, "oczekiwany format RRRR-MM-DD (istniejąca data)").optional());

const headerSchema = z.strictObject({
  title: z.string().trim().min(5, "tytuł jest za krótki"),
  slug: z.string().regex(SLUG_RE, "slug: małe litery, cyfry i myślniki, bez polskich znaków").max(90),
  category: z.enum(ARTICLE_CATEGORIES),
  excerpt: z.string().trim().min(20, "zajawka (excerpt) jest za krótka"),
  zapytanie_glowne: z.string().trim().min(3, "wpisz jedno zapytanie główne"),
  zapytania_poboczne: z.array(z.string().trim().min(1)).default([]),
  promotionSlug: z.preprocess(emptyToUndefined, z.string().regex(SLUG_RE, "promotionSlug: zły format").optional()),
  wazna_do: dateField,
  stan_na: dateField,
  published: z.boolean().default(false)
});

export interface ParsedArticle {
  title: string;
  slug: string;
  category: ArticleCategory;
  excerpt: string;
  /** Markdown, trimmed, LF line endings. */
  body: string;
  promotionSlug?: string;
  published: boolean;
  /** RRRR-MM-DD; kept in the file and the register, not stored in the database. */
  validUntil?: string;
  asOf?: string;
  /** File name the article came from (messages only). */
  source: string;
  warnings: string[];
}

/** Parses and validates one article file. Throws an Error whose message lists every problem found. */
export function parseArticleFile(raw: string, source: string): ParsedArticle {
  const problems: string[] = [];
  let parsed: ReturnType<typeof parseFrontmatter>;
  try {
    parsed = parseFrontmatter(raw);
  } catch (error) {
    throw new Error(`${source}: ${(error as Error).message}`);
  }

  const result = headerSchema.safeParse(parsed.data);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path.join(".") || "nagłówek";
      problems.push(`${source}: pole "${field}": ${issue.message}`);
    }
    throw new Error(problems.join("\n"));
  }
  const header = result.data;

  const body = parsed.body.replace(/\s+$/, "").replace(/^\n+/, "");
  if (body.trim().length < 200) problems.push(`${source}: treść jest za krótka (poniżej 200 znaków)`);
  if (/<!--/.test(body)) problems.push(`${source}: w treści zostały komentarze szablonu <!-- ... -->`);
  if (/^##\s+Lista kontrolna przed oddaniem/m.test(body)) problems.push(`${source}: w treści została lista kontrolna z szablonu`);
  if (header.published && !header.stan_na) problems.push(`${source}: opublikowany artykuł musi mieć pole stan_na (data sprawdzenia liczb)`);
  if (header.wazna_do && header.stan_na && header.stan_na > header.wazna_do) {
    // Allowed (an article about an ended offer), but the reader must not be left guessing.
    if (!/zakończ|archiw|nieaktualn/i.test(body)) {
      problems.push(`${source}: stan_na jest po wazna_do, a treść nie mówi, że promocja się zakończyła`);
    }
  }
  if (problems.length > 0) throw new Error(problems.join("\n"));

  const warnings: string[] = [];
  if (header.title.length > TITLE_MAX) warnings.push(`tytuł ma ${header.title.length} znaków (zalecane do ${TITLE_MAX})`);
  if (header.excerpt.length > EXCERPT_MAX) warnings.push(`zajawka ma ${header.excerpt.length} znaków (zalecane do ${EXCERPT_MAX})`);
  if (!/^##\s+.*\?\s*$/m.test(body)) warnings.push("brak nagłówka w formie pytania (sekcja z pytaniem czytelnika lub FAQ)");

  return {
    title: header.title,
    slug: header.slug,
    category: header.category,
    excerpt: header.excerpt,
    body,
    promotionSlug: header.promotionSlug,
    published: header.published,
    validUntil: header.wazna_do,
    asOf: header.stan_na,
    source,
    warnings
  };
}

/* ------------------------------------------------------------------ */
/* Planning and writing                                                */
/* ------------------------------------------------------------------ */

export interface StoredArticle {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  category: ArticleCategory;
  published: boolean;
  publishedAt: Date | null;
  contentUpdatedAt: Date | null;
  promotionId: string | null;
}

export type PlannedAction = "create" | "update" | "unchanged";

export interface PlannedArticle {
  slug: string;
  action: PlannedAction;
  /** Text (title, excerpt, body, category) differs from what is stored. */
  contentChanged: boolean;
  /** This run makes the article public for the first time. */
  publishes: boolean;
  /** The text of an already public article changes: contentUpdatedAt moves. */
  touchesModifiedDate: boolean;
  /** What will be written (undefined for "unchanged"). */
  data?: Prisma.ArticleUncheckedUpdateInput;
  warnings: string[];
}

/** Compares text the way a reader would: LF endings, no trailing spaces on the ends. */
function sameText(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/\r\n?/g, "\n").trim();
  return norm(a) === norm(b);
}

/**
 * Pure planning step: what writing `entry` over `stored` does. Throws nothing;
 * conflicts come back as `problems`.
 */
export function planArticle(
  entry: ParsedArticle,
  stored: StoredArticle | null,
  promotionId: string | null | undefined,
  now: Date
): { plan: PlannedArticle; problems: string[] } {
  const problems: string[] = [];
  const base = { slug: entry.slug, warnings: entry.warnings };

  if (!stored) {
    const data: Prisma.ArticleUncheckedUpdateInput = {
      title: entry.title,
      category: entry.category,
      excerpt: entry.excerpt,
      body: entry.body,
      published: entry.published,
      publishedAt: entry.published ? now : null,
      promotionId: promotionId ?? null
    };
    return {
      plan: { ...base, action: "create", contentChanged: true, publishes: entry.published, touchesModifiedDate: false, data },
      problems
    };
  }

  if (stored.published && !entry.published) {
    problems.push(
      `${entry.source}: artykuł „${entry.slug}” jest opublikowany, a plik ma published: false. Import nie cofa publikacji (zrób to w panelu).`
    );
  }

  const contentChanged =
    stored.title !== entry.title ||
    stored.category !== entry.category ||
    !sameText(stored.excerpt, entry.excerpt) ||
    !sameText(stored.body, entry.body);
  const publishes = entry.published && !stored.published;
  // promotionSlug omitted in the file = keep the stored link.
  const nextPromotionId = entry.promotionSlug === undefined ? stored.promotionId : (promotionId ?? null);
  const promotionChanged = nextPromotionId !== stored.promotionId;
  const touchesModifiedDate = contentChanged && stored.published;

  const data: Prisma.ArticleUncheckedUpdateInput = {};
  if (contentChanged) {
    data.title = entry.title;
    data.category = entry.category;
    data.excerpt = entry.excerpt;
    data.body = entry.body;
  }
  if (promotionChanged) data.promotionId = nextPromotionId;
  if (publishes) {
    data.published = true;
    data.publishedAt = stored.publishedAt ?? now;
  }
  if (touchesModifiedDate) data.contentUpdatedAt = now;

  const action: PlannedAction = Object.keys(data).length === 0 ? "unchanged" : "update";
  return {
    plan: {
      ...base,
      action,
      contentChanged,
      publishes,
      touchesModifiedDate,
      data: action === "unchanged" ? undefined : data
    },
    problems
  };
}

export interface ArticleImportOptions {
  /** Write to the database. Without it the run only reports. */
  apply?: boolean;
  /** AdminUser e-mail used as the author of NEW articles; default: the oldest ADMIN account. */
  authorEmail?: string;
  now?: Date;
}

export interface ArticleImportReport {
  applied: boolean;
  plans: PlannedArticle[];
  created: number;
  updated: number;
  unchanged: number;
}

export async function importArticles(
  db: PrismaClient,
  entries: readonly ParsedArticle[],
  options: ArticleImportOptions = {}
): Promise<ArticleImportReport> {
  const now = options.now ?? new Date();
  const apply = options.apply === true;

  const seen = new Set<string>();
  const dupes = entries.filter((e) => (seen.has(e.slug) ? true : (seen.add(e.slug), false)));
  if (dupes.length > 0) throw new ArticleImportAbortError(dupes.map((e) => `${e.source}: slug „${e.slug}” występuje w dwóch plikach`));

  return db.$transaction(
    async (tx) => {
      const problems: string[] = [];
      const plans: { plan: PlannedArticle; entry: ParsedArticle; stored: StoredArticle | null }[] = [];
      let authorId: string | null | undefined; // resolved lazily, only when a new article needs one

      for (const entry of entries) {
        const stored = await tx.article.findUnique({
          where: { slug: entry.slug },
          select: {
            id: true,
            title: true,
            excerpt: true,
            body: true,
            category: true,
            published: true,
            publishedAt: true,
            contentUpdatedAt: true,
            promotionId: true
          }
        });

        let promotionId: string | null | undefined;
        if (entry.promotionSlug !== undefined) {
          const promotion = await tx.promotion.findUnique({ where: { slug: entry.promotionSlug }, select: { id: true } });
          if (!promotion) problems.push(`${entry.source}: promotionSlug „${entry.promotionSlug}” nie istnieje w bazie`);
          promotionId = promotion?.id;
        }

        const planned = planArticle(entry, stored, promotionId, now);
        problems.push(...planned.problems);
        plans.push({ plan: planned.plan, entry, stored });
      }

      const needsAuthor = plans.some((p) => p.plan.action === "create");
      if (needsAuthor) {
        const admin = options.authorEmail
          ? await tx.adminUser.findUnique({ where: { email: options.authorEmail }, select: { id: true } })
          : await tx.adminUser.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true } });
        authorId = admin?.id ?? null;
        if (!authorId) {
          problems.push(
            options.authorEmail
              ? `nie ma konta administratora o adresie ${options.authorEmail} (autor nowych artykułów)`
              : "brak konta administratora, które mogłoby być autorem nowych artykułów"
          );
        }
      }

      if (problems.length > 0) throw new ArticleImportAbortError(problems);

      let created = 0;
      let updated = 0;
      let unchanged = 0;
      for (const { plan, entry } of plans) {
        if (plan.action === "unchanged") {
          unchanged++;
          continue;
        }
        if (plan.action === "create") created++;
        else updated++;
        if (!apply) continue;
        if (plan.action === "create") {
          await tx.article.create({
            data: {
              slug: entry.slug,
              title: entry.title,
              category: entry.category,
              excerpt: entry.excerpt,
              body: entry.body,
              published: entry.published,
              publishedAt: entry.published ? now : null,
              authorId: authorId as string,
              promotionId: (plan.data?.promotionId as string | null | undefined) ?? null
            }
          });
        } else {
          await tx.article.update({ where: { slug: entry.slug }, data: plan.data! });
        }
      }

      return { applied: apply, plans: plans.map((p) => p.plan), created, updated, unchanged };
    },
    { timeout: 60_000 }
  );
}
