import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import {
  parseArticleFile,
  parseFrontmatter,
  planArticle,
  type ParsedArticle,
  type StoredArticle
} from "../src/lib/services/articleImport";

const LONG_BODY =
  "Odpowiedź na pytanie czytelnika, stan na 05.11.2026. ".repeat(6) + "\n\n## Czy to działa?\nTak, w przykładzie z testu.\n";

function file(header: Record<string, string>, body: string = LONG_BODY): string {
  const base: Record<string, string> = {
    title: '"Karencja w promocjach bankowych"',
    slug: "karencja-w-promocjach",
    category: "PORADNIKI",
    excerpt: '"Karencja to okres, w którym nie możesz być klientem banku, żeby wziąć udział w promocji."',
    zapytanie_glowne: '"co to karencja"',
    zapytania_poboczne: "[]",
    promotionSlug: '""',
    wazna_do: '""',
    stan_na: '"2026-11-05"',
    published: "false"
  };
  const merged = { ...base, ...header };
  const lines = Object.entries(merged).map(([k, v]) => `${k}: ${v}`);
  return `---\n${lines.join("\n")}\n---\n\n${body}`;
}

const NOW = new Date("2026-11-06T10:00:00Z");

function entry(over: Partial<ParsedArticle> = {}): ParsedArticle {
  return {
    title: "Tytuł artykułu",
    slug: "tytul",
    category: "PORADNIKI",
    excerpt: "Zajawka, która jest odpowiedzią na pytanie czytelnika.",
    body: "Treść.",
    published: false,
    source: "tytul.md",
    warnings: [],
    ...over
  };
}

function stored(over: Partial<StoredArticle> = {}): StoredArticle {
  return {
    id: "a1",
    title: "Tytuł artykułu",
    excerpt: "Zajawka, która jest odpowiedzią na pytanie czytelnika.",
    body: "Treść.",
    category: "PORADNIKI",
    published: false,
    publishedAt: null,
    contentUpdatedAt: null,
    promotionId: null,
    ...over
  };
}

/* ---------------- parsing ---------------- */

test("parseFrontmatter reads quoted, bare, boolean and list values and drops trailing comments", () => {
  const { data, body } = parseFrontmatter(
    [
      "---",
      'title: "Jak: działa # karencja"   # komentarz',
      "slug: karencja",
      "published: true",
      'zapytania_poboczne: ["a, b", c]',
      "wazna_do:",
      "# cała linia komentarza",
      "---",
      "",
      "Treść"
    ].join("\r\n")
  );
  assert.equal(data.title, "Jak: działa # karencja");
  assert.equal(data.slug, "karencja");
  assert.equal(data.published, true);
  assert.deepEqual(data.zapytania_poboczne, ["a, b", "c"]);
  assert.equal(data.wazna_do, "");
  assert.equal(body.trim(), "Treść");
});

test("parseFrontmatter rejects a missing header, a missing close and duplicate keys", () => {
  assert.throws(() => parseFrontmatter("Treść bez nagłówka"), /zaczynać się od linii/);
  assert.throws(() => parseFrontmatter("---\ntitle: x\nTreść"), /zamykającej/);
  assert.throws(() => parseFrontmatter("---\ntitle: a\ntitle: b\n---\nx"), /dwa razy/);
  assert.throws(() => parseFrontmatter('---\ntitle: "bez końca\n---\nx'), /cudzysłowie/);
});

test("parseArticleFile accepts a valid draft, defaults published to false and keeps the body", () => {
  const parsed = parseArticleFile(file({}), "karencja-w-promocjach.md");
  assert.equal(parsed.slug, "karencja-w-promocjach");
  assert.equal(parsed.category, "PORADNIKI");
  assert.equal(parsed.published, false);
  assert.equal(parsed.asOf, "2026-11-05");
  assert.equal(parsed.validUntil, undefined);
  assert.equal(parsed.promotionSlug, undefined);
  assert.ok(parsed.body.startsWith("Odpowiedź"));
  assert.ok(!parsed.body.endsWith("\n"));
});

test("parseArticleFile reports every problem class: unknown field, bad slug, bad category, bad date", () => {
  assert.throws(() => parseArticleFile(file({ extra: "1" }), "x.md"), /extra/);
  assert.throws(() => parseArticleFile(file({ slug: "Zły Slug" }), "x.md"), /slug/);
  assert.throws(() => parseArticleFile(file({ category: "INNE" }), "x.md"), /category/);
  assert.throws(() => parseArticleFile(file({ stan_na: '"05.11.2026"' }), "x.md"), /stan_na/);
  assert.throws(() => parseArticleFile(file({ stan_na: '"2026-02-31"' }), "x.md"), /stan_na/);
});

test("parseArticleFile refuses template leftovers, short bodies and a published article without stan_na", () => {
  assert.throws(() => parseArticleFile(file({}, `${LONG_BODY}\n<!-- komentarz szablonu -->`), "x.md"), /komentarze szablonu/);
  assert.throws(() => parseArticleFile(file({}, "Za krótko."), "x.md"), /za krótka/);
  assert.throws(() => parseArticleFile(file({}, `${LONG_BODY}\n## Lista kontrolna przed oddaniem\n- [ ] x`), "x.md"), /lista kontrolna/);
  assert.throws(() => parseArticleFile(file({ published: "true", stan_na: '""' }), "x.md"), /stan_na/);
});

test("an article about an ended offer must say so when stan_na is after wazna_do", () => {
  const ended = { wazna_do: '"2026-10-13"', stan_na: '"2026-11-05"' };
  assert.throws(() => parseArticleFile(file(ended), "x.md"), /nie mówi, że promocja się zakończyła/);
  assert.doesNotThrow(() => parseArticleFile(file(ended, `${LONG_BODY}\nPromocja zakończyła się 13.10.2026.`), "x.md"));
});

test("length guides are warnings, not errors", () => {
  const parsed = parseArticleFile(
    file({ title: `"${"Bardzo długi tytuł ".repeat(5)}"`, excerpt: `"${"Bardzo długa zajawka ".repeat(10)}"` }),
    "x.md"
  );
  assert.ok(parsed.warnings.some((w) => w.includes("tytuł ma")));
  assert.ok(parsed.warnings.some((w) => w.includes("zajawka ma")));
});

/* ---------------- planning ---------------- */

test("a new article is created as a draft without dates; published: true sets publishedAt to now", () => {
  const draft = planArticle(entry(), null, null, NOW);
  assert.equal(draft.plan.action, "create");
  assert.equal(draft.plan.data?.published, false);
  assert.equal(draft.plan.data?.publishedAt, null);
  const live = planArticle(entry({ published: true }), null, null, NOW);
  assert.equal(live.plan.data?.publishedAt, NOW);
  assert.equal(live.plan.publishes, true);
  assert.equal(live.plan.touchesModifiedDate, false);
});

test("an identical file changes nothing (CRLF and trailing whitespace do not count as edits)", () => {
  const same = planArticle(entry({ body: "Treść." }), stored({ body: "Treść.\r\n\r\n" }), undefined, NOW);
  assert.equal(same.plan.action, "unchanged");
  assert.equal(same.plan.data, undefined);
  assert.deepEqual(same.problems, []);
});

test("editing a LIVE article moves contentUpdatedAt and keeps publishedAt; editing a draft does not", () => {
  const published = new Date("2026-09-01T00:00:00Z");
  const live = planArticle(
    entry({ body: "Nowa treść.", published: true }),
    stored({ published: true, publishedAt: published }),
    undefined,
    NOW
  );
  assert.equal(live.plan.action, "update");
  assert.equal(live.plan.touchesModifiedDate, true);
  assert.equal(live.plan.data?.contentUpdatedAt, NOW);
  assert.ok(!("publishedAt" in (live.plan.data ?? {})), "publishedAt is never rewritten");

  const draft = planArticle(entry({ body: "Nowa treść." }), stored(), undefined, NOW);
  assert.equal(draft.plan.action, "update");
  assert.ok(!("contentUpdatedAt" in (draft.plan.data ?? {})));
});

test("publishing a stored draft sets publishedAt once but is not a content update", () => {
  const first = planArticle(entry({ published: true }), stored(), undefined, NOW);
  assert.equal(first.plan.publishes, true);
  assert.equal(first.plan.data?.publishedAt, NOW);
  assert.ok(!("contentUpdatedAt" in (first.plan.data ?? {})));
  const earlier = new Date("2026-08-01T00:00:00Z");
  const again = planArticle(entry({ published: true }), stored({ publishedAt: earlier }), undefined, NOW);
  assert.equal(again.plan.data?.publishedAt, earlier, "an existing publishedAt is kept");
});

test("a file never un-publishes a live article", () => {
  const result = planArticle(entry({ published: false }), stored({ published: true, publishedAt: NOW }), undefined, NOW);
  assert.equal(result.problems.length, 1);
  assert.match(result.problems[0]!, /nie cofa publikacji/);
});

test("an omitted promotionSlug keeps the stored link; a given one replaces it", () => {
  const keep = planArticle(entry(), stored({ promotionId: "p1" }), undefined, NOW);
  assert.equal(keep.plan.action, "unchanged");
  const change = planArticle(entry({ promotionSlug: "inna" }), stored({ promotionId: "p1" }), "p2", NOW);
  assert.equal(change.plan.data?.promotionId, "p2");
  assert.equal(change.plan.touchesModifiedDate, false, "re-linking an offer is not a text revision");
});

/* ---------------- the repository's own articles ---------------- */

test("every article file in content/articles parses and its slug matches the file name", () => {
  const dir = path.join(process.cwd(), "content", "articles");
  const files = fs.readdirSync(dir).filter((name) => /^[a-z0-9][a-z0-9-]*\.md$/.test(name));
  for (const name of files) {
    const parsed = parseArticleFile(fs.readFileSync(path.join(dir, name), "utf-8"), name);
    assert.equal(parsed.slug, name.replace(/\.md$/, ""), `${name}: slug must equal the file name`);
  }
});
