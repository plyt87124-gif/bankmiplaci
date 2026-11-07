// Owner rule (2026-11-07): two boilerplate sentences are gone from every offer page, and no generated promotion may
// bring them back. See src/lib/offerCopyRules.ts. These tests keep them out of the templates (src/), out of the
// candidate files that feed the importer, out of the admin form and out of the bulk import.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  BANNED_OFFER_SENTENCES,
  bannedSentenceIn,
  offerCopyIssues,
  offerCopyProblems
} from "../src/lib/offerCopyRules";
import { promotionFormSchema } from "../src/lib/validation/promotion";

const ROOT = join(__dirname, "..");
const STEPS = "Lista może zawierać także dodatkowe zasady i ograniczenia, a nie tylko czynności do wykonania.";
const MAX_BONUS =
  "Premia maksymalna nie jest gwarantowana – otrzymasz ją tylko po spełnieniu wszystkich warunków cząstkowych opisanych wyżej.";

function walk(dir: string, accept: (file: string) => boolean, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".git" || name === "worktrees") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, accept, out);
    else if (accept(full)) out.push(full);
  }
  return out;
}

test("the banned sentences are recognised, with and without Polish letters and with odd spacing", () => {
  assert.equal(bannedSentenceIn(STEPS)?.id, "steps-and-rules");
  assert.equal(bannedSentenceIn(MAX_BONUS)?.id, "max-bonus-not-guaranteed");
  assert.equal(bannedSentenceIn("Lista moze zawierac takze dodatkowe   zasady\ni ograniczenia")?.id, "steps-and-rules");
  assert.equal(bannedSentenceIn("premia MAKSYMALNA nie jest gwarantowana")?.id, "max-bonus-not-guaranteed");
  assert.equal(bannedSentenceIn("Otrzymasz ją po spełnieniu warunków cząstkowych opisanych wyżej.")?.id, "all-partial-conditions");
  // ordinary offer copy is not caught
  assert.equal(bannedSentenceIn("Do 800 zł premii: 200 zł na start i 4 × 100 zł za aktywność."), null);
  assert.equal(bannedSentenceIn("Premia maksymalna 800 zł"), null);
  assert.equal(bannedSentenceIn(null), null);
  assert.equal(bannedSentenceIn(""), null);
  // every entry carries the exact sentence it stands for, and that sentence matches its own pattern
  for (const banned of BANNED_OFFER_SENTENCES) {
    assert.ok(banned.pattern.test(banned.sentence), banned.id);
  }
});

test("offerCopyIssues finds a banned sentence in any free-text field and names the field", () => {
  const issues = offerCopyIssues({
    eligibleFor: "Nowi klienci.",
    notEligibleFor: `Pracownicy banku. ${STEPS}`,
    summary: MAX_BONUS,
    description: null,
    conditions: [{ title: "Otwórz konto", description: null }, { title: "Zrób 5 płatności", description: STEPS }],
    bonusParts: [{ label: "Premia za wpływ" }, { label: `Bonus. ${MAX_BONUS}` }]
  });
  assert.deepEqual(
    issues.map((i) => i.path.join(".")),
    ["notEligibleFor", "summary", "conditions.1.description", "bonusParts.1.label"]
  );
  assert.ok(issues.every((i) => /Usuń zdanie/.test(i.message)));
  assert.deepEqual(offerCopyIssues({}), []);
  assert.deepEqual(offerCopyIssues({ eligibleFor: "Nowi klienci.", conditions: [], bonusParts: [] }), []);

  const problems = offerCopyProblems("alior-test", { summary: STEPS });
  assert.equal(problems.length, 1);
  assert.match(problems[0] ?? "", /^alior-test: summary: Usuń zdanie/);
});

test("the admin form refuses a banned sentence in the fields it shows errors for", () => {
  const base = {
    bankId: "b1",
    name: "Promocja testowa",
    slug: "promocja-testowa",
    accountType: "PERSONAL",
    maxBonusCents: 10000,
    difficulty: "EASY",
    status: "ACTIVE",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    affiliateUrl: "https://example.com/a",
    lastVerifiedAt: "2026-11-01",
    fees: {}
  };
  assert.equal(promotionFormSchema.safeParse(base).success, true, "baseline is valid");
  for (const field of ["eligibleFor", "notEligibleFor", "summary"] as const) {
    const result = promotionFormSchema.safeParse({ ...base, [field]: STEPS });
    assert.equal(result.success, false, field);
    if (!result.success) {
      const hit = result.error.issues.find((i) => i.path[0] === field);
      assert.ok(hit, `${field}: the issue sits on the field the form shows`);
      assert.match(hit?.message ?? "", /Usuń zdanie/);
    }
  }
});

test("no template in src/ prints a banned sentence (only the rules file may spell them out)", () => {
  const files = walk(join(ROOT, "src"), (f) => /\.(ts|tsx|css|json|md)$/.test(f)).filter(
    (f) => relative(ROOT, f).replace(/\\/g, "/") !== "src/lib/offerCopyRules.ts"
  );
  assert.ok(files.length > 100, "the scan really walks src/");
  const hits = files.filter((f) => bannedSentenceIn(readFileSync(f, "utf8")));
  assert.deepEqual(hits.map((f) => relative(ROOT, f)), []);
});

test("no candidate or seed file with promotions carries a banned sentence (the generators write these files)", () => {
  const files = [
    ...walk(join(ROOT, "data"), (f) => /\.(json|py)$/.test(f)),
    join(ROOT, "prisma", "seed.ts")
  ];
  assert.ok(files.length > 10, "the scan really walks data/");
  const hits = files.filter((f) => bannedSentenceIn(readFileSync(f, "utf8")));
  assert.deepEqual(hits.map((f) => relative(ROOT, f)), []);
});
