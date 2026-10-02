import test from "node:test";
import assert from "node:assert/strict";
import { promotionContentChanged, type PromotionContentLike } from "../src/lib/promotionContent";

const base = (): PromotionContentLike => ({
  bankId: "b1",
  name: "Konto",
  slug: "konto",
  accountType: "PERSONAL",
  maxBonusCents: 150000,
  difficulty: "MEDIUM",
  ratingOverride: "9.5",
  ratingReason: null,
  status: "ACTIVE",
  startDate: new Date("2026-09-01T00:00:00Z"),
  endDate: new Date("2026-11-30T00:00:00Z"),
  sourceUrl: "https://x/y.pdf",
  additionalSourceUrls: [],
  lastVerifiedAt: new Date("2026-10-02T00:00:00Z"),
  summary: "Do 1500 zl",
  conditions: [{ title: "A", description: "opis", type: "other", order: 0 }],
  bonusParts: [{ label: "200 zl", amountCents: 20000, order: 0, availableUntil: null }],
  fees: { accountFeeCents: 0, cardFeeCents: 0, otherFee: null }
});

test("identical data (admin save without edit / re-import) is not a change", () => {
  assert.equal(promotionContentChanged(base(), base()), false);
});

test("null, undefined and blank/whitespace text are the same 'empty'; ISO string equals Date", () => {
  const form = base();
  form.ratingReason = undefined;
  form.summary = "Do 1500 zl  ";
  form.endDate = "2026-11-30T00:00:00.000Z";
  form.fees = { accountFeeCents: 0, cardFeeCents: 0, otherFee: "" };
  form.conditions = [{ title: "A", description: "opis", type: "other" }]; // no explicit order
  assert.equal(promotionContentChanged(base(), form), false);
});

test("a stored 'fees: null' equals an all-blank fees form", () => {
  const a = base();
  a.fees = null;
  const b = base();
  b.fees = {};
  assert.equal(promotionContentChanged(a, b), false);
});

test("real edits are changes", () => {
  const edits: ((p: PromotionContentLike) => void)[] = [
    (p) => (p.maxBonusCents = 180000),
    (p) => (p.endDate = new Date("2026-12-15T00:00:00Z")),
    (p) => (p.status = "EXPIRED"),
    (p) => (p.summary = "Inny opis"),
    (p) => (p.conditions![0]!.description = "zmieniony warunek"),
    (p) => (p.bonusParts![0]!.availableUntil = new Date("2026-09-30T00:00:00Z")),
    (p) => (p.bonusParts![0]!.amountCents = 30000),
    (p) => (p.fees = { accountFeeCents: 4500, accountFeeWaiverCondition: "wplyw 10 000 zl", cardFeeCents: 0 }),
    (p) => (p.lastVerifiedAt = new Date("2026-10-03T00:00:00Z"))
  ];
  for (const [i, edit] of edits.entries()) {
    const after = base();
    edit(after);
    assert.equal(promotionContentChanged(base(), after), true, `edit #${i}`);
  }
});

test("reordering conditions counts as a change", () => {
  const a = base();
  a.conditions = [
    { title: "A", type: "other", order: 0 },
    { title: "B", type: "other", order: 1 }
  ];
  const b = base();
  b.conditions = [
    { title: "A", type: "other", order: 1 },
    { title: "B", type: "other", order: 0 }
  ];
  assert.equal(promotionContentChanged(a, b), true);
});

test("a ranking recompute only changes `rating`, which is not content", () => {
  const before = base() as PromotionContentLike & { rating?: number };
  const after = base() as PromotionContentLike & { rating?: number };
  before.rating = 9.1;
  after.rating = 9.7; // recomputeRatings() shifted it because a different promotion changed
  assert.equal(promotionContentChanged(before, after), false);
});
