import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { importPromotions, ImportAbortError, type ImportFees, type ImportEntry } from "../../src/lib/services/promotionImport";
import { client, cleanup, makePromotion, reload, PREFIX } from "./helpers";

before(cleanup);
after(async () => { await cleanup(); await client.$disconnect(); });

function entryFor(row: Awaited<ReturnType<typeof reload>>, fees?: ImportFees): ImportEntry {
  return {
    bank: { name: "DBT Bank", slug: `${PREFIX}bank` },
    promotion: {
      slug: row.slug, name: row.name, accountType: row.accountType,
      maxBonusCents: row.maxBonusCents, difficulty: row.difficulty, rating: 9, status: row.status,
      startDate: row.startDate.toISOString(), endDate: row.endDate.toISOString(),
      affiliateUrl: row.affiliateUrl, lastVerifiedAt: row.lastVerifiedAt.toISOString(),
      summary: row.summary, conditions: [], bonusParts: [], fees
    }
  };
}

test("import with missing fees creates unknown amounts, never default zeros", async () => {
  const row = await makePromotion("import-unknown");
  await importPromotions(client, [entryFor(row)]);
  const fees = (await reload(row.id)).fees!;
  assert.deepEqual([fees.accountFeeCents, fees.cardFeeCents, fees.atmFeeCents], [null, null, null]);
});

test("omitting fee fields preserves amounts, waiver and source without inventing a content update", async () => {
  const stamp = new Date("2026-10-01T12:00:00Z");
  const row = await makePromotion("import-preserves-fees", {
    contentUpdatedAt: stamp,
    fees: { create: { accountFeeCents: 1500, accountFeeWaiverCondition: "wpływ", cardFeeCents: 0, sourceUrl: "https://example.com/taryfa.pdf" } }
  });
  await importPromotions(client, [entryFor(row)]);
  const after = await reload(row.id);
  assert.equal(after.fees!.accountFeeCents, 1500);
  assert.equal(after.fees!.accountFeeWaiverCondition, "wpływ");
  assert.equal(after.fees!.cardFeeCents, 0);
  assert.equal(after.fees!.sourceUrl, "https://example.com/taryfa.pdf");
  assert.equal(after.contentUpdatedAt!.getTime(), stamp.getTime());
});

test("explicit NULL clears a fee; a conditional rate and its source round-trip", async () => {
  const row = await makePromotion("import-sets-fees", { fees: { create: { accountFeeCents: 0, cardFeeCents: 100 } } });
  await importPromotions(client, [entryFor(row, { accountFeeCents: null, cardFeeCents: 900, cardFeeWaiverCondition: "transakcje 350 zł", sourceUrl: "https://example.com/taryfa.pdf" })]);
  const fees = (await reload(row.id)).fees!;
  assert.equal(fees.accountFeeCents, null);
  assert.equal(fees.cardFeeCents, 900);
  assert.equal(fees.cardFeeWaiverCondition, "transakcje 350 zł");
  assert.equal(fees.sourceUrl, "https://example.com/taryfa.pdf");
});

test("contradictory zero plus a preserved waiver aborts the whole batch before writes", async () => {
  const first = await makePromotion("import-fee-first");
  const second = await makePromotion("import-fee-invalid", { fees: { create: { accountFeeCents: 1500, accountFeeWaiverCondition: "wpływ" } } });
  const good = entryFor(first);
  good.promotion.summary = "Ta zmiana nie może zostać zapisana";
  await assert.rejects(importPromotions(client, [good, entryFor(second, { accountFeeCents: 0 })]), ImportAbortError);
  assert.equal((await reload(first.id)).summary, first.summary);
  assert.equal((await reload(second.id)).fees!.accountFeeCents, 1500);
});

test("duplicate slugs are rejected before any changes", async () => {
  const row = await makePromotion("import-duplicate-fee", { fees: { create: { cardFeeCents: 100 } } });
  await assert.rejects(importPromotions(client, [entryFor(row, { cardFeeCents: 900 }), entryFor(row)]), ImportAbortError);
  assert.equal((await reload(row.id)).fees!.cardFeeCents, 100);
});

test("a concurrent admin fee edit survives; the stale import aborts instead of overwriting it", async () => {
  const row = await makePromotion("import-fee-concurrent", { fees: { create: { accountFeeCents: 1500, accountFeeWaiverCondition: "A" } } });
  let edited = false;
  const importing = client.$extends({ query: { promotion: { async findUnique({ args, query }) {
    const result = await query(args);
    if (!edited && args.where.slug === row.slug) {
      edited = true;
      // Another connection commits after the import's read, before its write.
      await client.fees.update({ where: { promotionId: row.id }, data: { accountFeeWaiverCondition: "B" } });
    }
    return result;
  } } } });
  await assert.rejects(importPromotions(importing as unknown as PrismaClient, [entryFor(row, { cardFeeCents: 900 })]),
    (error: unknown) => (error as { code?: string }).code === "P2034");
  const after = await reload(row.id);
  assert.equal(edited, true);
  assert.equal(after.fees!.accountFeeWaiverCondition, "B");
  assert.equal(after.fees!.cardFeeCents, null, "the failed import made no partial fee change");
});
