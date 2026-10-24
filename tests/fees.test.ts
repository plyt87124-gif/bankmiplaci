import test from "node:test";
import assert from "node:assert/strict";
import { isConfirmedFreeAccount } from "../src/lib/format";
import { resolveFee } from "../src/lib/feeModel";
import { feesSchema } from "../src/lib/validation/promotion";
import { feesWriteData } from "../src/lib/services/promotionWrite";

test("unknown fee is never shown as free", () => {
  assert.equal(resolveFee(null).label, "Brak danych");
  assert.equal(resolveFee(undefined).label, "Brak danych");
  assert.equal(isConfirmedFreeAccount(null), false);
  assert.equal(isConfirmedFreeAccount(undefined), false);
  assert.equal(isConfirmedFreeAccount({ accountFeeCents: null }), false);
});

test("confirmed zero, fixed cost, and conditional waiver read differently", () => {
  assert.equal(resolveFee(0).kind, "free");
  assert.equal(isConfirmedFreeAccount({ accountFeeCents: 0 }), true);
  assert.match(resolveFee(900).label, /9/);
  assert.equal(resolveFee(900).kind, "paid");
  assert.equal(resolveFee(900, "min. 350 zł kartą").kind, "conditional");
  assert.equal(isConfirmedFreeAccount({ accountFeeCents: 4500 }), false);
});

test("legacy zero with a waiver is ambiguous, never an unconditional free account", () => {
  assert.equal(resolveFee(0, "wpływ 500 zł").kind, "unknown");
  assert.equal(isConfirmedFreeAccount({ accountFeeCents: 0, accountFeeWaiverCondition: "wpływ 500 zł" }), false);
  assert.equal(isConfirmedFreeAccount({ accountFeeCents: 0, accountFeeWaiverCondition: "  " }), true);
  assert.equal(resolveFee(0, "  ").kind, "free");
});

test("admin rejects zero with a waiver and accepts unknown or the actual non-waived rate", () => {
  for (const [amount, condition] of [["accountFeeCents", "accountFeeWaiverCondition"], ["cardFeeCents", "cardFeeWaiverCondition"]] as const) {
    assert.equal(feesSchema.safeParse({ [amount]: 0, [condition]: "warunek" }).success, false);
    assert.equal(feesSchema.safeParse({ [amount]: null, [condition]: "warunek" }).success, true);
    assert.equal(feesSchema.safeParse({ [amount]: 900, [condition]: "warunek" }).success, true);
    assert.equal(feesSchema.safeParse({ [amount]: 0, [condition]: "  " }).success, true);
  }
});

test("a blank fee input becomes an explicit NULL (never undefined, never 0) - Prisma skips undefined on update", () => {
  const parsed = feesSchema.parse({ accountFeeCents: NaN, cardFeeCents: "", atmFeeCents: null });
  assert.equal(parsed.accountFeeCents, null);
  assert.equal(parsed.cardFeeCents, null);
  assert.equal(parsed.atmFeeCents, null);
  // an absent key is "not verified" too (zod 4 leaves it undefined here; the write path turns it into NULL), and an entered 0 stays 0
  assert.equal(feesWriteData(feesSchema.parse({})).accountFeeCents, null);
  assert.equal(feesWriteData(feesSchema.parse({ cardFeeCents: 0 })).cardFeeCents, 0);
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

test("the old compact fee formatter is gone: the shared fee model (feeModel.ts) is the only wording of a fee", async () => {
  const format = (await import("../src/lib/format")) as Record<string, unknown>;
  assert.equal("formatFeeCompact" in format, false);
  assert.equal(typeof format.isConfirmedFreeAccount, "function");
});
