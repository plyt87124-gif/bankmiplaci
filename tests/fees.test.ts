import test from "node:test";
import assert from "node:assert/strict";
import { formatFeeCompact, isConfirmedFreeAccount } from "../src/lib/format";
import { feesSchema } from "../src/lib/validation/promotion";
import { feesWriteData } from "../src/lib/services/promotionWrite";

test("unknown fee is never shown as free", () => {
  assert.equal(formatFeeCompact(null), "Nieustalone");
  assert.equal(formatFeeCompact(undefined), "Nieustalone");
  assert.equal(isConfirmedFreeAccount(null), false);
  assert.equal(isConfirmedFreeAccount(undefined), false);
  assert.equal(isConfirmedFreeAccount({ accountFeeCents: null }), false);
});

test("confirmed zero, fixed cost, and conditional waiver read differently", () => {
  assert.equal(formatFeeCompact(0), "0 zł");
  assert.equal(isConfirmedFreeAccount({ accountFeeCents: 0 }), true);
  assert.match(formatFeeCompact(900), /9/);
  assert.equal(formatFeeCompact(900).includes("*"), false);
  assert.equal(formatFeeCompact(900, "min. 350 zł kartą").endsWith("*"), true);
  assert.equal(isConfirmedFreeAccount({ accountFeeCents: 4500 }), false);
});

test("a blank fee input becomes an explicit NULL (never undefined, never 0) - Prisma skips undefined on update", () => {
  const parsed = feesSchema.parse({ accountFeeCents: NaN, cardFeeCents: "", atmFeeCents: null });
  assert.equal(parsed.accountFeeCents, null);
  assert.equal(parsed.cardFeeCents, null);
  assert.equal(parsed.atmFeeCents, null);
  // an absent key is "not verified" too, and an entered 0 stays 0
  assert.deepEqual(
    [feesSchema.parse({}).accountFeeCents, feesSchema.parse({ cardFeeCents: 0 }).cardFeeCents],
    [null, 0]
  );
});

test("feesWriteData: amounts are number|null, blank text is null, fees.sourceUrl is never in the payload", () => {
  const data = feesWriteData(
    feesSchema.parse({ accountFeeCents: NaN, cardFeeCents: 0, atmFeeCents: 750, accountFeeWaiverCondition: "  ", otherFee: "" })
  );
  assert.deepEqual(data, {
    accountFeeCents: null,
    accountFeeWaiverCondition: null,
    cardFeeCents: 0,
    cardFeeWaiverCondition: null,
    atmFeeCents: 750,
    otherFee: null
  });
  for (const value of Object.values(data)) assert.notEqual(value, undefined);
  assert.ok(!("sourceUrl" in data));
});
