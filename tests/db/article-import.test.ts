/**
 * importArticles (src/lib/services/articleImport.ts) against a real database:
 * dry run writes nothing, all-or-nothing, honest dates, and a file never
 * un-publishes a live article. Rows use the slug/e-mail prefix `dbt-`.
 */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { ArticleImportAbortError, importArticles, type ParsedArticle } from "../../src/lib/services/articleImport";
import { PREFIX, cleanup, client, makePromotion } from "./helpers";

const AUTHOR_EMAIL = `${PREFIX}autor@example.test`;
const T1 = new Date("2026-11-06T10:00:00Z");
const T2 = new Date("2026-11-07T10:00:00Z");

async function wipe() {
  await client.article.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await cleanup();
  await client.adminUser.deleteMany({ where: { email: { startsWith: PREFIX } } });
}

before(async () => {
  await wipe();
  await client.adminUser.create({ data: { email: AUTHOR_EMAIL, name: "Administrator", passwordHash: "x", role: "ADMIN" } });
});
after(async () => {
  await wipe();
  await client.$disconnect();
});

const entry = (tag: string, over: Partial<ParsedArticle> = {}): ParsedArticle => ({
  title: `Artykuł ${tag}`,
  slug: `${PREFIX}${tag}`,
  category: "PORADNIKI",
  excerpt: "Zajawka, która jest odpowiedzią na pytanie czytelnika.",
  body: "Treść artykułu.",
  published: false,
  source: `${tag}.md`,
  warnings: [],
  ...over
});

const stored = (tag: string) => client.article.findUniqueOrThrow({ where: { slug: `${PREFIX}${tag}` } });

test("dry run reports a new article and writes nothing", async () => {
  const report = await importArticles(client, [entry("proba")], { authorEmail: AUTHOR_EMAIL, now: T1 });
  assert.equal(report.applied, false);
  assert.equal(report.created, 1);
  assert.equal(await client.article.count({ where: { slug: `${PREFIX}proba` } }), 0);
});

test("apply creates a draft by the given author, linked to the offer; re-running changes nothing", async () => {
  const promo = await makePromotion("art");
  const e = entry("nowy", { promotionSlug: promo.slug });
  const first = await importArticles(client, [e], { apply: true, authorEmail: AUTHOR_EMAIL, now: T1 });
  assert.equal(first.created, 1);
  const row = await stored("nowy");
  assert.equal(row.published, false);
  assert.equal(row.publishedAt, null);
  assert.equal(row.contentUpdatedAt, null);
  assert.equal(row.promotionId, promo.id);
  const author = await client.adminUser.findUniqueOrThrow({ where: { id: row.authorId } });
  assert.equal(author.email, AUTHOR_EMAIL);

  const again = await importArticles(client, [e], { apply: true, authorEmail: AUTHOR_EMAIL, now: T2 });
  assert.equal(again.unchanged, 1);
  assert.equal(again.created + again.updated, 0);
});

test("publishing sets publishedAt once; later edits set contentUpdatedAt and keep publishedAt and author", async () => {
  await importArticles(client, [entry("zywy")], { apply: true, authorEmail: AUTHOR_EMAIL, now: T1 });
  const published = await importArticles(client, [entry("zywy", { published: true })], { apply: true, now: T1 });
  assert.equal(published.updated, 1);
  let row = await stored("zywy");
  assert.equal(row.published, true);
  assert.equal(row.publishedAt?.toISOString(), T1.toISOString());
  assert.equal(row.contentUpdatedAt, null, "first publication is not an update");

  await importArticles(client, [entry("zywy", { published: true, body: "Poprawiona treść." })], { apply: true, now: T2 });
  row = await stored("zywy");
  assert.equal(row.body, "Poprawiona treść.");
  assert.equal(row.publishedAt?.toISOString(), T1.toISOString());
  assert.equal(row.contentUpdatedAt?.toISOString(), T2.toISOString());
  const author = await client.adminUser.findUniqueOrThrow({ where: { id: row.authorId } });
  assert.equal(author.email, AUTHOR_EMAIL, "the import never changes an existing author");
});

test("all or nothing: one bad file (unknown offer) stops the run before any write", async () => {
  await assert.rejects(
    importArticles(client, [entry("dobry"), entry("zly", { promotionSlug: `${PREFIX}nie-ma-takiej` })], {
      apply: true,
      authorEmail: AUTHOR_EMAIL,
      now: T1
    }),
    (error: unknown) => error instanceof ArticleImportAbortError && /promotionSlug/.test(error.message)
  );
  assert.equal(await client.article.count({ where: { slug: { in: [`${PREFIX}dobry`, `${PREFIX}zly`] } } }), 0);
});

test("a file with published: false cannot un-publish a live article", async () => {
  await assert.rejects(
    importArticles(client, [entry("zywy", { published: false })], { apply: true, now: T2 }),
    (error: unknown) => error instanceof ArticleImportAbortError && /nie cofa publikacji/.test(error.message)
  );
  assert.equal((await stored("zywy")).published, true);
});

test("a missing author account aborts instead of guessing", async () => {
  await assert.rejects(
    importArticles(client, [entry("bez-autora")], { apply: true, authorEmail: `${PREFIX}brak@example.test`, now: T1 }),
    (error: unknown) => error instanceof ArticleImportAbortError && /nie ma konta administratora/.test(error.message)
  );
});

test("two files with the same slug are rejected", async () => {
  await assert.rejects(
    importArticles(client, [entry("dup"), entry("dup")], { authorEmail: AUTHOR_EMAIL }),
    (error: unknown) => error instanceof ArticleImportAbortError && /dwóch plikach/.test(error.message)
  );
});
