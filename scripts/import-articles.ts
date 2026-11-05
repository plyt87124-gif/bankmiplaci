/**
 * Imports articles from content/articles/*.md into the database.
 *
 *   npm run import:articles                      dry run: reports what would change, writes nothing
 *   npm run import:articles -- --apply           writes
 *   npm run import:articles -- --apply --author-email=admin@example.com
 *
 * DATABASE_URL decides which database is touched. The production run is done
 * by the owner (bankmiplaci-ops), after reading the dry-run report.
 *
 * A file is "<slug>.md" with a header (title, slug, category, excerpt,
 * zapytanie_glowne, ..., published) and the markdown body: see
 * content/articles/README.md. New articles are created as drafts unless the
 * file says `published: true`. Re-running is safe (nothing changes when the
 * file did not). Logic and rules: src/lib/services/articleImport.ts.
 */
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { ArticleImportAbortError, importArticles, parseArticleFile, type ParsedArticle } from "../src/lib/services/articleImport";

const db = new PrismaClient();
const DIR = path.join(process.cwd(), "content", "articles");

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const authorEmail = argValue("author-email") ?? process.env.ARTICLE_AUTHOR_EMAIL;

  const files = fs
    .readdirSync(DIR)
    .filter((name) => /^[a-z0-9][a-z0-9-]*\.md$/.test(name))
    .sort();
  if (files.length === 0) {
    console.log(`Brak plików artykułów w ${DIR}.`);
    return;
  }

  const entries: ParsedArticle[] = [];
  const errors: string[] = [];
  for (const file of files) {
    try {
      const entry = parseArticleFile(fs.readFileSync(path.join(DIR, file), "utf-8"), file);
      if (entry.slug !== file.replace(/\.md$/, "")) {
        errors.push(`${file}: slug „${entry.slug}” musi być taki jak nazwa pliku`);
        continue;
      }
      entries.push(entry);
    } catch (error) {
      errors.push((error as Error).message);
    }
  }
  if (errors.length > 0) {
    console.error(`Błędy w plikach, nic nie zapisano:\n- ${errors.join("\n- ")}`);
    process.exitCode = 1;
    return;
  }

  const report = await importArticles(db, entries, { apply, authorEmail });

  const label = { create: "NOWY", update: "ZMIANA", unchanged: "bez zmian" } as const;
  for (const plan of report.plans) {
    const notes = [
      plan.publishes ? "wchodzi do publikacji" : null,
      plan.touchesModifiedDate ? "ustawi datę „Zaktualizowano”" : null
    ].filter(Boolean);
    console.log(`${label[plan.action].padEnd(9)} ${plan.slug}${notes.length ? ` (${notes.join(", ")})` : ""}`);
    for (const warning of plan.warnings) console.log(`           uwaga: ${warning}`);
  }
  console.log(
    `${apply ? "Zapisano" : "Tryb próbny, NIC nie zapisano"}: nowe ${report.created}, zmienione ${report.updated}, bez zmian ${report.unchanged}.` +
      (apply ? "" : " Dodaj --apply, żeby zapisać.")
  );
}

main()
  .catch((error) => {
    console.error(error instanceof ArticleImportAbortError ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
