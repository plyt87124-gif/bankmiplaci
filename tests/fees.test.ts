import test from "node:test";
import assert from "node:assert/strict";
import { formatFeeCompact, isConfirmedFreeAccount } from "../src/lib/format";
import { feesSchema } from "../src/lib/validation/promotion";

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

test("a blank fee input stays 'not verified' and is not coerced to 0", () => {
  const parsed = feesSchema.parse({ accountFeeCents: NaN, cardFeeCents: NaN, atmFeeCents: NaN });
  assert.equal(parsed.accountFeeCents, undefined);
  assert.equal(parsed.cardFeeCents, undefined);
  assert.equal(feesSchema.parse({ cardFeeCents: 0 }).cardFeeCents, 0);
  assert.deepEqual(feesSchema.parse({}), {});
});
