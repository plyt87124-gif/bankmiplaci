/**
 * Self-test of lib.js (transaction, compare-and-set, revert) against the LOCAL
 * dev database only - it uses the normal .env DATABASE_URL and refuses to run
 * if that is not localhost. Creates throw-away rows, deletes them at the end.
 *
 *   node scripts/data-corrections/selftest.js
 */
const fs = require("fs");
const path = require("path");
const assert = require("node:assert/strict");

// CI passes DATABASE_URL in the environment; locally it comes from .env.
if (!process.env.DATABASE_URL && fs.existsSync(".env")) {
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^DATABASE_URL="?([^"]+)"?$/);
    if (m) process.env.DATABASE_URL = m[1];
  }
}
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "")) {
  console.error("Refusing to run: DATABASE_URL is not a local database.");
  process.exit(1);
}

const { PrismaClient } = require("@prisma/client");
const { existingColumns, applyChanges, revertFrom, writePlan, assertMatchesPlan } = require("./lib");
const db = new PrismaClient();

async function main() {
  const bank = await db.bank.create({ data: { name: "SELFTEST", slug: `selftest-${Date.now()}` } });
  const promo = await db.promotion.create({
    data: {
      bankId: bank.id, name: "SELFTEST", slug: `selftest-promo-${Date.now()}`, maxBonusCents: 1000, difficulty: "EASY",
      rating: 9, status: "EXPIRED", startDate: new Date("2026-01-01"), endDate: new Date("2026-09-30"),
      affiliateUrl: "https://example.com", lastVerifiedAt: new Date("2026-09-01"), ratingReason: "A",
      bonusParts: { create: [{ label: "part", amountCents: 100 }] }
    },
    include: { bonusParts: true }
  });
  const part = promo.bonusParts[0];
  const columns = await existingColumns(db, ["promotions", "bonus_parts"]);
  const readPromo = () => db.promotion.findUnique({ where: { id: promo.id } });
  const readPart = () => db.bonusPart.findUnique({ where: { id: part.id } });
  const mk = () => [
    {
      table: "promotions", id: promo.id, label: "promo",
      set: { ratingReason: "B", endDate: new Date("2026-11-30T00:00:00Z") },
      expect: { ratingReason: "A", endDate: new Date("2026-09-30T00:00:00Z") },
      stamp: ["contentUpdatedAt"], oldStamp: { contentUpdatedAt: null }, touchUpdatedAt: true
    },
    {
      table: "bonus_parts", id: part.id, label: "part",
      set: { availableUntil: new Date("2026-09-30T00:00:00Z") }, expect: { availableUntil: null },
      requires: ["bonus_parts.availableUntil"]
    }
  ];
  const latestBackup = () =>
    fs.readdirSync(".").filter((f) => f.startsWith("revert-selftest-")).sort().pop();

  try {
    // 1. apply works, stamps bookkeeping columns
    await applyChanges(db, "selftest", mk(), columns);
    let p = await readPromo();
    assert.equal(p.ratingReason, "B");
    assert.equal(p.endDate.toISOString(), "2026-11-30T00:00:00.000Z");
    assert.ok(p.contentUpdatedAt, "contentUpdatedAt stamped");
    assert.equal((await readPart()).availableUntil.toISOString(), "2026-09-30T00:00:00.000Z");
    console.log("ok 1  apply: values written, contentUpdatedAt stamped, all in one transaction");

    // 2. revert restores everything, incl. contentUpdatedAt back to NULL and Dates intact
    await revertFrom(db, latestBackup(), false);
    p = await readPromo();
    assert.equal(p.ratingReason, "A");
    assert.equal(p.endDate.toISOString(), "2026-09-30T00:00:00.000Z");
    assert.equal(p.contentUpdatedAt, null);
    assert.equal((await readPart()).availableUntil, null);
    console.log("ok 2  revert: previous values restored exactly");

    // 3. compare-and-set: row changed since the dry run -> nothing is written, even the valid sibling change
    await db.promotion.update({ where: { id: promo.id }, data: { ratingReason: "edited by someone else" } });
    await assert.rejects(() => applyChanges(db, "selftest", mk().reverse(), columns), /Compare-and-set failed/);
    assert.equal((await readPart()).availableUntil, null, "sibling change rolled back (atomic)");
    assert.equal((await readPromo()).ratingReason, "edited by someone else", "later edit not overwritten");
    console.log("ok 3  compare-and-set: concurrent edit not overwritten, whole transaction rolled back");

    // 4. ranking recompute only touches rating/updatedAt -> must NOT make the correction fail
    await db.promotion.update({ where: { id: promo.id }, data: { ratingReason: "A", rating: 9.4 } });
    await applyChanges(db, "selftest", mk(), columns);
    assert.equal((await readPromo()).ratingReason, "B");
    console.log("ok 4  a rating-only change in between does not block the correction");

    // 5. revert guard: someone edited after apply -> revert refuses, --force overrides
    await db.promotion.update({ where: { id: promo.id }, data: { ratingReason: "later edit" } });
    await assert.rejects(() => revertFrom(db, latestBackup(), false), /Revert refused/);
    assert.equal((await readPromo()).ratingReason, "later edit");
    await revertFrom(db, latestBackup(), true);
    assert.equal((await readPromo()).ratingReason, "A");
    console.log("ok 5  revert refuses to clobber later edits unless --force");

    // 7. plan binding: data moved on after the reviewed dry run -> apply is refused
    await db.promotion.update({ where: { id: promo.id }, data: { ratingReason: "A" } });
    const reviewed = mk();
    const planFile = writePlan("selftest-plan", reviewed);
    assertMatchesPlan(planFile, mk()); // unchanged data: accepted
    await db.promotion.update({ where: { id: promo.id }, data: { ratingReason: "A2" } });
    const drifted = mk();
    drifted[0].expect.ratingReason = "A2"; // what a fresh read now sees
    assert.throws(() => assertMatchesPlan(planFile, drifted), /changed since the dry run/);
    fs.unlinkSync(planFile);
    console.log("ok 6  --apply is bound to the reviewed plan: drifted data is refused");

    // 7. enum column (Postgres enum "PromotionStatus"): bound with an explicit cast, reverts too
    await applyChanges(db, "selftest", [{ table: "promotions", id: promo.id, label: "status", set: { status: "ACTIVE" }, expect: { status: "EXPIRED" } }], columns);
    assert.equal((await readPromo()).status, "ACTIVE");
    await revertFrom(db, latestBackup(), false);
    assert.equal((await readPromo()).status, "EXPIRED");
    console.log("ok 7  enum columns (status) are written and reverted");

    // 8. --apply refuses when a required column does not exist
    const fake = mk();
    fake[1].requires = ["bonus_parts.doesNotExistYet"];
    await assert.rejects(() => applyChanges(db, "selftest", fake, columns), /do not exist in the database yet/);
    console.log("ok 8  --apply refuses when the schema migration is not deployed");
  } finally {
    await db.promotion.delete({ where: { id: promo.id } }).catch(() => {});
    await db.bank.delete({ where: { id: bank.id } }).catch(() => {});
    for (const f of fs.readdirSync(".")) if (f.startsWith("revert-selftest-")) fs.unlinkSync(path.join(".", f));
    await db.$disconnect();
  }
}

main().then(() => console.log("\nself-test passed")).catch((e) => {
  console.error("\nSELF-TEST FAILED:", e);
  process.exit(1);
});
