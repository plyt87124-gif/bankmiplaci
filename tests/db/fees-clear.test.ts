import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { updatePromotionRecord } from "../../src/lib/services/promotionWrite";
import { formatFeeCompact } from "../../src/lib/format";
import { client, cleanup, makePromotion, reload, submit } from "./helpers";

const AMOUNTS = ["accountFeeCents", "cardFeeCents", "atmFeeCents"] as const;

before(cleanup);
after(async () => {
  await cleanup();
  await client.$disconnect();
});

async function fresh(slug: string) {
  return makePromotion(slug, {
    fees: {
      create: {
        accountFeeCents: 111,
        cardFeeCents: 222,
        atmFeeCents: 333,
        otherFee: "uwaga",
        sourceUrl: "https://example.com/taryfa.pdf"
      }
    }
  });
}

async function save(id: string, fees: Record<string, number | string | undefined>) {
  const row = await reload(id);
  await updatePromotionRecord(client, id, submit(row, { fees }));
  return reload(id);
}

for (const field of AMOUNTS) {
  test(`clearing ${field} on an existing record writes NULL (others untouched, UI says "Nieustalone")`, async () => {
    const row = await fresh(`clear-${field.toLowerCase()}`);
    const after = await save(row.id, { [field]: NaN });
    assert.equal(after.fees![field], null, `${field} must be NULL after clearing`);
    for (const other of AMOUNTS.filter((f) => f !== field)) {
      assert.equal(after.fees![other], { accountFeeCents: 111, cardFeeCents: 222, atmFeeCents: 333 }[other]);
    }
    assert.equal(formatFeeCompact(after.fees![field]), "Nieustalone");
    assert.equal(after.fees!.sourceUrl, "https://example.com/taryfa.pdf", "fees.sourceUrl is not part of the form and must survive");
  });

  test(`entering 0 in ${field} keeps a real zero (not NULL)`, async () => {
    const row = await fresh(`zero-${field.toLowerCase()}`);
    const after = await save(row.id, { [field]: 0 });
    assert.equal(after.fees![field], 0);
    assert.equal(formatFeeCompact(after.fees![field]), "0 zł");
  });
}

test("all three cleared at once, then re-entered, then set to 0 - read back each time", async () => {
  const row = await fresh("all-three");
  let after = await save(row.id, { accountFeeCents: NaN, cardFeeCents: NaN, atmFeeCents: NaN });
  assert.deepEqual([after.fees!.accountFeeCents, after.fees!.cardFeeCents, after.fees!.atmFeeCents], [null, null, null]);
  after = await save(row.id, { accountFeeCents: 400, cardFeeCents: 500, atmFeeCents: 600 });
  assert.deepEqual([after.fees!.accountFeeCents, after.fees!.cardFeeCents, after.fees!.atmFeeCents], [400, 500, 600]);
  after = await save(row.id, { accountFeeCents: 0, cardFeeCents: 0, atmFeeCents: 0 });
  assert.deepEqual([after.fees!.accountFeeCents, after.fees!.cardFeeCents, after.fees!.atmFeeCents], [0, 0, 0]);
});

test("mixed: cleared + zero + amount in one save", async () => {
  const row = await fresh("mixed");
  const after = await save(row.id, { accountFeeCents: NaN, cardFeeCents: 0, atmFeeCents: 750 });
  assert.deepEqual([after.fees!.accountFeeCents, after.fees!.cardFeeCents, after.fees!.atmFeeCents], [null, 0, 750]);
});

test("text fields: a cleared waiver condition / otherFee is stored as NULL, not left behind", async () => {
  const row = await makePromotion("text-clear", {
    fees: { create: { accountFeeCents: 4500, accountFeeWaiverCondition: "wpływ 10 000 zł", otherFee: "stara uwaga" } }
  });
  const after = await save(row.id, { accountFeeWaiverCondition: "", otherFee: "" });
  assert.equal(after.fees!.accountFeeWaiverCondition, null);
  assert.equal(after.fees!.otherFee, null);
  assert.equal(after.fees!.accountFeeCents, 4500);
});

test("a promotion without any fees row: blank fees create NULLs, never zeros", async () => {
  const row = await makePromotion("no-fees-row");
  assert.equal(row.fees, null);
  const after = await save(row.id, {});
  assert.deepEqual([after.fees!.accountFeeCents, after.fees!.cardFeeCents, after.fees!.atmFeeCents], [null, null, null]);
});
