import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { updatePromotionRecord } from "../../src/lib/services/promotionWrite";
import { importPromotions, type ImportEntry } from "../../src/lib/services/promotionImport";
import { client, cleanup, makePromotion, reload, submit, PREFIX } from "./helpers";

before(cleanup);
after(async () => {
  await cleanup();
  await client.$disconnect();
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A rich record: extra sources, fees.sourceUrl, description, waiver text, a bonus-part deadline, a condition. */
async function rich(slug: string) {
  return makePromotion(slug, {
    description: "Dłuższy opis, którego formularz nie edytuje",
    sourceUrl: "https://example.com/regulamin.pdf",
    additionalSourceUrls: ["https://example.com/kantor.pdf", "https://example.com/lokata.pdf"],
    cooldownMonths: 12,
    eligibleFor: "nowi klienci",
    conditions: { create: [{ title: "Warunek", description: "opis", type: "other", order: 0 }] },
    bonusParts: {
      create: [
        { label: "Konto", amountCents: 150000, order: 0 },
        { label: "Kantor", amountCents: 30000, order: 1, availableUntil: new Date("2026-09-30T00:00:00Z") }
      ]
    },
    fees: {
      create: {
        accountFeeCents: 4500,
        accountFeeWaiverCondition: "wpływ 10 000 zł",
        cardFeeCents: 0,
        atmFeeCents: 200,
        otherFee: "uwaga",
        sourceUrl: "https://example.com/taryfa.pdf"
      }
    }
  });
}

function identicalImport(row: Awaited<ReturnType<typeof reload>>, summary = row.summary): ImportEntry {
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
      sourceUrl: row.sourceUrl,
      eligibleFor: row.eligibleFor,
      cooldownMonths: row.cooldownMonths,
      summary,
      conditions: row.conditions.map((c) => ({ title: c.title, description: c.description, type: c.type, order: c.order })),
      bonusParts: row.bonusParts.map((b) => ({ label: b.label, amountCents: b.amountCents, order: b.order })),
      fees: {
        accountFeeCents: row.fees!.accountFeeCents!,
        cardFeeCents: row.fees!.cardFeeCents!,
        atmFeeCents: row.fees!.atmFeeCents!,
        otherFee: row.fees!.otherFee
      }
    }
  } as ImportEntry;
}

const preserved = (r: Awaited<ReturnType<typeof reload>>) => ({
  additionalSourceUrls: r.additionalSourceUrls,
  feesSourceUrl: r.fees?.sourceUrl,
  description: r.description,
  waiver: r.fees?.accountFeeWaiverCondition,
  kantor: r.bonusParts.find((b) => b.label === "Kantor")?.availableUntil?.toISOString()
});

test("two consecutive admin saves with NO edit do not move contentUpdatedAt, and keep everything the form does not send", async () => {
  const row = await rich("two-saves");
  assert.equal(row.contentUpdatedAt, null);
  const expected = preserved(row);

  await updatePromotionRecord(client, row.id, submit(row));
  let r = await reload(row.id);
  assert.equal(r.contentUpdatedAt, null, "first no-edit save");
  assert.deepEqual(preserved(r), expected);

  await updatePromotionRecord(client, row.id, submit(r));
  r = await reload(row.id);
  assert.equal(r.contentUpdatedAt, null, "second no-edit save");
  assert.deepEqual(preserved(r), expected);
  assert.deepEqual(expected.additionalSourceUrls, ["https://example.com/kantor.pdf", "https://example.com/lokata.pdf"]);
});

test("an identical import does not move contentUpdatedAt and keeps the fields it leaves alone", async () => {
  const row = await rich("identical-import");
  const expected = preserved(row);
  const result = await importPromotions(client, [identicalImport(row)]);
  const r = await reload(row.id);
  assert.equal(r.contentUpdatedAt, null);
  assert.equal(result.contentChanged, 0);
  assert.deepEqual(preserved(r), expected);
});

test("a real change moves it (admin edit and import); a no-edit save afterwards does not move it again", async () => {
  const row = await rich("real-change");
  assert.equal(row.contentUpdatedAt, null);

  await updatePromotionRecord(client, row.id, submit(row, { summary: "Nowy, inny opis oferty" }));
  let r = await reload(row.id);
  const t1 = r.contentUpdatedAt;
  assert.ok(t1, "admin edit sets it");
  assert.equal(r.summary, "Nowy, inny opis oferty");

  await sleep(15);
  await updatePromotionRecord(client, row.id, submit(r));
  r = await reload(row.id);
  assert.equal(r.contentUpdatedAt?.getTime(), t1!.getTime(), "no-edit save after an edit leaves it where it was");

  await sleep(15);
  const result = await importPromotions(client, [identicalImport(r, "Jeszcze inny opis z importu")]);
  r = await reload(row.id);
  assert.equal(result.contentChanged, 1);
  assert.ok(r.contentUpdatedAt!.getTime() > t1!.getTime(), "a real change through the import moves it");
  assert.deepEqual(preserved(r), preserved(row), "extra sources, fees.sourceUrl, description, waiver text, deadline all survive");
});

test("each kind of real change is detected (fee cleared, fee amount, waiver text, condition text)", async () => {
  const cases: [string, (row: Awaited<ReturnType<typeof reload>>) => Parameters<typeof submit>[1]][] = [
    ["fee cleared", () => ({ fees: { atmFeeCents: NaN } })],
    ["fee amount", () => ({ fees: { cardFeeCents: 900 } })],
    ["waiver text", () => ({ fees: { accountFeeWaiverCondition: "inny warunek" } })],
    ["condition text", (row) => ({ conditions: [{ title: row.conditions[0]!.title, description: "zmieniony", type: "other" as const, order: 0 }] })]
  ];
  for (const [name, edit] of cases) {
    const row = await rich(`change-${name.replace(/\W+/g, "-")}`);
    await updatePromotionRecord(client, row.id, submit(row, edit(row)));
    assert.ok((await reload(row.id)).contentUpdatedAt, `${name} must move contentUpdatedAt`);
  }
});
