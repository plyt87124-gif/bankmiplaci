/**
 * Admin form: deliberately clearing "Źródło warunków" (sourceUrl), "Okres karencji"
 * (cooldownMonths) and "Data graniczna" (cooldownCutoffDate) must write NULL, a typed
 * 0 months must stay 0, and none of it may touch additionalSourceUrls, fees.sourceUrl
 * or the importer's meaning of an omitted field. Real database, real zod schema, the
 * same save path as the "Zapisz zmiany" button (updatePromotionRecord).
 */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { updatePromotionRecord } from "../../src/lib/services/promotionWrite";
import { importPromotions, type ImportEntry } from "../../src/lib/services/promotionImport";
import { promotionFormSchema } from "../../src/lib/validation/promotion";
import { promotionToFormDefaults } from "../../src/lib/promotionForm";
import { client, cleanup, makePromotion, reload, submit, PREFIX } from "./helpers";

before(cleanup);
after(async () => {
  await cleanup();
  await client.$disconnect();
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const FIXED = new Date("2026-10-01T10:00:00Z");
const URL1 = "https://example.com/regulamin.pdf";
const URL2 = "https://example.com/nowy-regulamin.pdf";
const EXTRA = ["https://example.com/kantor.pdf", "https://example.com/lokata.pdf"];

/** All three fields filled, extra sources + fees.sourceUrl present, contentUpdatedAt pinned to a known value. */
function filled(slug: string, extra: Record<string, unknown> = {}) {
  return makePromotion(slug, {
    sourceUrl: URL1,
    additionalSourceUrls: EXTRA,
    cooldownMonths: 12,
    cooldownCutoffDate: new Date("2024-08-01T00:00:00Z"),
    contentUpdatedAt: FIXED,
    fees: { create: { accountFeeCents: 0, cardFeeCents: 100, atmFeeCents: 200, sourceUrl: "https://example.com/taryfa.pdf" } },
    ...extra
  });
}

async function save(id: string, edits: Parameters<typeof submit>[1] = {}) {
  await updatePromotionRecord(client, id, submit(await reload(id), edits));
  return reload(id);
}

const untouched = (r: Awaited<ReturnType<typeof reload>>) => ({
  additionalSourceUrls: r.additionalSourceUrls,
  feesSourceUrl: r.fees?.sourceUrl,
  fees: [r.fees?.accountFeeCents, r.fees?.cardFeeCents, r.fees?.atmFeeCents]
});
const moved = (r: Awaited<ReturnType<typeof reload>>) => r.contentUpdatedAt?.getTime() !== FIXED.getTime();

// ---------------------------------------------------------------- stored values round-trip

test("existing values are read back into the form and an unedited save keeps all three (contentUpdatedAt does not move)", async () => {
  const row = await filled("roundtrip");
  const defaults = promotionToFormDefaults(row);
  assert.equal(defaults.sourceUrl, URL1);
  assert.equal(defaults.cooldownMonths, 12);
  assert.equal(String(defaults.cooldownCutoffDate), "2024-08-01");

  const r = await save(row.id);
  assert.equal(r.sourceUrl, URL1);
  assert.equal(r.cooldownMonths, 12);
  assert.equal(r.cooldownCutoffDate?.toISOString(), "2024-08-01T00:00:00.000Z");
  assert.equal(moved(r), false);
  assert.deepEqual(untouched(r), untouched(row));
});

// ---------------------------------------------------------------- clearing

test("clearing 'Źródło warunków' writes NULL; extra sources, fees.sourceUrl and the other two fields stay", async () => {
  const row = await filled("clear-source");
  const r = await save(row.id, { sourceUrl: "" });
  assert.equal(r.sourceUrl, null);
  assert.equal(r.cooldownMonths, 12);
  assert.equal(r.cooldownCutoffDate?.toISOString(), "2024-08-01T00:00:00.000Z");
  assert.deepEqual(untouched(r), untouched(row));
  assert.equal(moved(r), true, "a real change moves contentUpdatedAt");
});

test("clearing 'Okres karencji' writes NULL (not 0); the other two fields stay", async () => {
  const row = await filled("clear-months");
  const r = await save(row.id, { cooldownMonths: NaN });
  assert.equal(r.cooldownMonths, null);
  assert.equal(r.sourceUrl, URL1);
  assert.equal(r.cooldownCutoffDate?.toISOString(), "2024-08-01T00:00:00.000Z");
  assert.deepEqual(untouched(r), untouched(row));
  assert.equal(moved(r), true);
});

test("clearing 'Data graniczna' writes NULL (not 1970-01-01); the other two fields stay", async () => {
  const row = await filled("clear-cutoff");
  const r = await save(row.id, { cooldownCutoffDate: "" });
  assert.equal(r.cooldownCutoffDate, null);
  assert.equal(r.sourceUrl, URL1);
  assert.equal(r.cooldownMonths, 12);
  assert.deepEqual(untouched(r), untouched(row));
  assert.equal(moved(r), true);
});

test("a whitespace-only 'Źródło warunków' counts as blank", async () => {
  const row = await filled("clear-source-spaces");
  assert.equal((await save(row.id, { sourceUrl: "   " })).sourceUrl, null);
});

test("all three cleared at once, then re-entered - read back after each step", async () => {
  const row = await filled("all-three");
  let r = await save(row.id, { sourceUrl: "", cooldownMonths: NaN, cooldownCutoffDate: "" });
  assert.deepEqual([r.sourceUrl, r.cooldownMonths, r.cooldownCutoffDate], [null, null, null]);
  assert.deepEqual(untouched(r), untouched(row));

  r = await save(row.id, { sourceUrl: URL2, cooldownMonths: 24, cooldownCutoffDate: "2025-02-03" });
  assert.equal(r.sourceUrl, URL2);
  assert.equal(r.cooldownMonths, 24);
  assert.equal(r.cooldownCutoffDate?.toISOString(), "2025-02-03T00:00:00.000Z");
  assert.deepEqual(untouched(r), untouched(row));
});

// ---------------------------------------------------------------- zero months

test("0 months is a real zero: typed 0 stays 0, clearing gives NULL, 0 again gives 0", async () => {
  const row = await filled("zero-months");
  let r = await save(row.id, { cooldownMonths: 0 });
  assert.equal(r.cooldownMonths, 0, "12 -> 0");
  const afterZero = r.contentUpdatedAt!.getTime();

  await sleep(15);
  r = await save(row.id); // no edit: the form hands the stored 0 back
  assert.equal(r.cooldownMonths, 0, "an unedited save keeps 0 (0 is not 'blank')");
  assert.equal(r.contentUpdatedAt!.getTime(), afterZero, "no-edit save with 0 does not move contentUpdatedAt");

  r = await save(row.id, { cooldownMonths: NaN });
  assert.equal(r.cooldownMonths, null, "0 -> cleared");

  r = await save(row.id, { cooldownMonths: 0 });
  assert.equal(r.cooldownMonths, 0, "NULL -> 0 is a real change and stores 0");
});

test("0 months and NULL are different content (the switch moves contentUpdatedAt)", async () => {
  const row = await filled("zero-vs-null", { cooldownMonths: null });
  const r = await save(row.id, { cooldownMonths: 0 });
  assert.equal(r.cooldownMonths, 0);
  assert.equal(moved(r), true);
});

// ---------------------------------------------------------------- re-entering

test("re-entering a different value after clearing stores it", async () => {
  const row = await filled("reenter");
  await save(row.id, { sourceUrl: "", cooldownMonths: NaN, cooldownCutoffDate: "" });
  const r = await save(row.id, { sourceUrl: URL2 });
  assert.equal(r.sourceUrl, URL2);
  assert.equal(r.cooldownMonths, null);
  assert.equal(r.cooldownCutoffDate, null);
});

// ---------------------------------------------------------------- contentUpdatedAt

test("after clearing, further no-edit saves do not move contentUpdatedAt again; neither does clearing an already-empty field", async () => {
  const row = await filled("lastmod-after-clear");
  let r = await save(row.id, { sourceUrl: "", cooldownMonths: NaN, cooldownCutoffDate: "" });
  const t1 = r.contentUpdatedAt!.getTime();
  assert.notEqual(t1, FIXED.getTime(), "the clear itself is a real change");

  await sleep(15);
  r = await save(row.id);
  assert.equal(r.contentUpdatedAt!.getTime(), t1, "1st no-edit save");
  await sleep(15);
  r = await save(row.id, { sourceUrl: "", cooldownMonths: NaN, cooldownCutoffDate: "" });
  assert.equal(r.contentUpdatedAt!.getTime(), t1, "clearing again / 2nd no-edit save");
  assert.deepEqual([r.sourceUrl, r.cooldownMonths, r.cooldownCutoffDate], [null, null, null]);
});

test("two consecutive no-edit saves of a record with all three filled leave contentUpdatedAt exactly where it was", async () => {
  const row = await filled("lastmod-two-saves");
  let r = await save(row.id);
  assert.equal(moved(r), false, "1st");
  r = await save(row.id);
  assert.equal(moved(r), false, "2nd");
});

test("a record that never had the three fields: no-edit saves keep NULL and do not move contentUpdatedAt", async () => {
  const row = await filled("never-had", { sourceUrl: null, cooldownMonths: null, cooldownCutoffDate: null });
  let r = await save(row.id);
  r = await save(row.id);
  assert.deepEqual([r.sourceUrl, r.cooldownMonths, r.cooldownCutoffDate], [null, null, null]);
  assert.equal(moved(r), false);
});

// ---------------------------------------------------------------- an ABSENT key is not a clear

test("a payload that lacks the keys altogether (not blank - absent) keeps the stored values", async () => {
  const row = await filled("absent-keys");
  const input = { ...promotionToFormDefaults(row) } as Record<string, unknown>;
  delete input.sourceUrl;
  delete input.cooldownMonths;
  delete input.cooldownCutoffDate;
  await updatePromotionRecord(client, row.id, promotionFormSchema.parse(input));
  const r = await reload(row.id);
  assert.equal(r.sourceUrl, URL1);
  assert.equal(r.cooldownMonths, 12);
  assert.equal(r.cooldownCutoffDate?.toISOString(), "2024-08-01T00:00:00.000Z");
  assert.equal(moved(r), false);
});

test("an invalid URL is rejected by the schema and nothing is stored", async () => {
  const row = await filled("bad-url");
  assert.throws(() => submit(row, { sourceUrl: "to nie jest adres" }));
  assert.equal((await reload(row.id)).sourceUrl, URL1);
});

// ---------------------------------------------------------------- importer semantics unchanged

function importOf(row: Awaited<ReturnType<typeof reload>>, omit: boolean): ImportEntry {
  return {
    bank: { name: "DBT Bank", slug: `${PREFIX}bank` },
    promotion: {
      slug: row.slug,
      name: row.name,
      accountType: row.accountType,
      maxBonusCents: row.maxBonusCents,
      difficulty: row.difficulty,
      rating: 9,
      status: row.status,
      startDate: row.startDate.toISOString().slice(0, 10),
      endDate: row.endDate.toISOString().slice(0, 10),
      affiliateUrl: row.affiliateUrl,
      lastVerifiedAt: row.lastVerifiedAt.toISOString().slice(0, 10),
      ...(omit ? {} : { sourceUrl: row.sourceUrl, cooldownMonths: row.cooldownMonths, cooldownCutoffDate: row.cooldownCutoffDate?.toISOString().slice(0, 10) }),
      summary: row.summary,
      conditions: [],
      bonusParts: [],
      fees: { accountFeeCents: 0, cardFeeCents: 100, atmFeeCents: 200 }
    }
  } as ImportEntry;
}

test("importer: fields omitted from the file keep the stored values (unchanged meaning), extra sources survive, no lastmod move", async () => {
  const row = await filled("import-omitted");
  const result = await importPromotions(client, [importOf(row, true)]);
  const r = await reload(row.id);
  assert.equal(r.sourceUrl, URL1);
  assert.equal(r.cooldownMonths, 12);
  assert.equal(r.cooldownCutoffDate?.toISOString(), "2024-08-01T00:00:00.000Z");
  assert.deepEqual(r.additionalSourceUrls, EXTRA);
  assert.equal(r.fees?.sourceUrl, "https://example.com/taryfa.pdf");
  assert.equal(result.contentChanged, 0);
  assert.equal(moved(r), false);
});

test("importer: a file that states the same values is identical content too", async () => {
  const row = await filled("import-same");
  const result = await importPromotions(client, [importOf(row, false)]);
  assert.equal(result.contentChanged, 0);
  assert.equal(moved(await reload(row.id)), false);
});

test("importer: a cleared-in-admin record (NULL) is not refilled by a file that omits the fields", async () => {
  const row = await filled("import-after-clear");
  const cleared = await save(row.id, { sourceUrl: "", cooldownMonths: NaN, cooldownCutoffDate: "" });
  await importPromotions(client, [importOf(cleared, true)]);
  const r = await reload(row.id);
  assert.deepEqual([r.sourceUrl, r.cooldownMonths, r.cooldownCutoffDate], [null, null, null]);
  assert.deepEqual(r.additionalSourceUrls, EXTRA);
});
