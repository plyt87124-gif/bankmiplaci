import test from "node:test";
import assert from "node:assert/strict";
import { COMMISSION_WEIGHT, recommendedScores, sortRecommended, type RecommendInput } from "../src/lib/recommended";
import { stripPrivateFields } from "../src/lib/services/promotions";

const p = (id: string, rating: number, commissionCents: number | null, accountType = "PERSONAL", maxBonusCents = 50000) => ({
  id,
  accountType,
  rating,
  maxBonusCents,
  commissionCents
});

test("without any commission data the order equals the rating order", () => {
  const out = sortRecommended([p("a", 8.1, null), p("b", 9.4, null), p("c", 8.8, null)]);
  assert.deepEqual(out.map((x) => x.id), ["b", "c", "a"]);
});

test("a higher commission lifts an offer above a slightly better-rated one", () => {
  const out = sortRecommended([p("high-rating", 9.5, 5000), p("high-commission", 9.0, 20000)]);
  assert.equal(out[0]!.id, "high-commission");
});

test("a better offer that also pays something stays ahead of a much weaker, better-paying one", () => {
  const out = sortRecommended([p("good", 9.6, 5000), p("weak", 6.5, 20000)]);
  assert.equal(out[0]!.id, "good");
});

test("the influence is NOT small: top commission at the rating floor beats a perfect rating that pays nothing", () => {
  // The disclosure copy says "oferta o niższej ocenie może znaleźć się wyżej"; this pins the fact behind it.
  // 6.5 / 10 * 1.0 = 0.65 against 10 / 10 * (1 - COMMISSION_WEIGHT) = 0.60.
  const [weakButPaying, perfectButFree] = recommendedScores([p("weak", 6.5, 20000), p("perfect", 10, 0)]);
  assert.ok(Math.abs(weakButPaying! - 0.65) < 1e-9);
  assert.ok(Math.abs(perfectButFree! - (1 - COMMISSION_WEIGHT)) < 1e-9);
  assert.ok(weakButPaying! > perfectButFree!);
  assert.equal(sortRecommended([p("perfect", 10, 0), p("weak", 6.5, 20000)])[0]!.id, "weak");
});

test("commission is compared only within the same account type", () => {
  const items: RecommendInput[] = [p("personal", 9.0, 12000, "PERSONAL"), p("business", 9.0, 90000, "BUSINESS")];
  const [a, b] = recommendedScores(items);
  assert.equal(a, b); // each is the best commission in its own group
});

test("an unknown commission is neutral, not a penalty or a boost", () => {
  const [known, unknown] = recommendedScores([p("k", 9, 10000), p("u", 9, null)]);
  assert.ok(known! > unknown!);
  assert.ok(Math.abs(unknown! - 0.9 * (1 - COMMISSION_WEIGHT + COMMISSION_WEIGHT * 0.5)) < 1e-9);
});

test("the sort does not mutate its input", () => {
  const input = [p("a", 8, 1000), p("b", 9, 2000)];
  const copy = JSON.stringify(input);
  sortRecommended(input);
  assert.equal(JSON.stringify(input), copy);
});

test("stripPrivateFields removes the partner commission and keeps the rest", () => {
  const row = { id: "x", name: "Promocja", affiliateCommissionCents: 12000 };
  const out = stripPrivateFields(row);
  assert.deepEqual(out, { id: "x", name: "Promocja" });
  assert.equal("affiliateCommissionCents" in out, false);
});
