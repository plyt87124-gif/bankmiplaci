import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/lib/db";
import { recomputeRatings } from "../src/lib/services/ratings";
import {
  DIFFICULTY_SCORE,
  MIN_PEERS_OF_TYPE,
  NEUTRAL_SCORE,
  RATING_FLOOR,
  RATING_SPAN,
  RATING_WEIGHTS,
  compositeToRating,
  exampleCandidates,
  explainRating,
  type DifficultyKey,
  type RatableOffer
} from "../src/app/metodologia/ratingModel";

/**
 * /metodologia explains the rating with a replica of the arithmetic in
 * src/lib/services/ratings.ts. These tests keep the two together: constants are
 * compared with the source text, and the replica is compared with the REAL
 * recomputeRatings() (database stubbed) on many generated sets of offers.
 */
const ratingsSource = readFileSync(join(process.cwd(), "src", "lib", "services", "ratings.ts"), "utf8");

test("weights, difficulty scores, neutral value and mapping equal the constants in ratings.ts", () => {
  const constant = (name: string) => Number(new RegExp(`const ${name} = ([0-9.]+);`).exec(ratingsSource)?.[1]);
  assert.equal(RATING_WEIGHTS.bonus, constant("BONUS_WEIGHT"));
  assert.equal(RATING_WEIGHTS.difficulty, constant("DIFFICULTY_WEIGHT"));
  assert.equal(RATING_WEIGHTS.duration, constant("DURATION_WEIGHT"));
  assert.equal(RATING_WEIGHTS.cost, constant("COST_WEIGHT"));
  assert.equal(RATING_WEIGHTS.cooldown, constant("COOLDOWN_WEIGHT"));
  assert.equal(NEUTRAL_SCORE, constant("NEUTRAL_SCORE"));
  assert.ok(Math.abs(Object.values(RATING_WEIGHTS).reduce((a, b) => a + b, 0) - 1) < 1e-12, "weights add up to 1");
  for (const key of Object.keys(DIFFICULTY_SCORE) as DifficultyKey[]) {
    const m = new RegExp(String.raw`^\s*${key}: ([0-9.]+)`, "m").exec(ratingsSource);
    assert.equal(DIFFICULTY_SCORE[key], Number(m?.[1]), key);
  }
  assert.ok(ratingsSource.includes(`${RATING_FLOOR} + ${RATING_SPAN} * Math.sqrt(clamped)`), "composite -> rating mapping");
  assert.ok(ratingsSource.includes(`peers.length >= ${MIN_PEERS_OF_TYPE}`), "minimum peers of one type");
  assert.ok(!/commission/i.test(ratingsSource.replace(/\/\*[\s\S]*?\*\//g, "")), "ratings.ts must not use the commission");
});

test("the 0-1 composite maps onto 6.5-10", () => {
  assert.equal(compositeToRating(0), 6.5);
  assert.equal(compositeToRating(1), 10);
  assert.ok(Math.abs(compositeToRating(0.25) - 8.25) < 1e-12);
  assert.equal(compositeToRating(-3), 6.5);
  assert.equal(compositeToRating(9), 10);
});

// Small deterministic PRNG so a failure is reproducible.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generate(seed: number): RatableOffer[] {
  const rnd = mulberry32(seed);
  const types = ["PERSONAL", "BUSINESS", "YOUNG"];
  const difficulties: DifficultyKey[] = ["VERY_EASY", "EASY", "MEDIUM", "HARD"];
  const count = 1 + Math.floor(rnd() * 14);
  return Array.from({ length: count }, (_, i) => ({
    id: `o${i}`,
    accountType: types[Math.floor(rnd() * types.length)]!,
    maxBonusCents: Math.floor(rnd() * 600) * 1000,
    difficulty: difficulties[Math.floor(rnd() * 4)]!,
    cooldownMonths: rnd() < 0.5 ? null : Math.floor(rnd() * 5) * 12,
    durationMonths: rnd() < 0.15 ? null : 1 + Math.floor(rnd() * 12),
    costCents: rnd() < 0.3 ? null : (1 + Math.floor(rnd() * 900)) * 10000
  }));
}

test("the replica gives the same rating as the real recomputeRatings() on 300 generated sets", async () => {
  const target = db as unknown as { promotion: unknown; $transaction: unknown };
  const original = { promotion: target.promotion, tx: target.$transaction };
  try {
    for (let seed = 1; seed <= 300; seed++) {
      const offers = generate(seed);
      const updates = new Map<string, number>();
      target.promotion = {
        findMany: async () =>
          offers.map((o) => ({
            id: o.id,
            accountType: o.accountType,
            maxBonusCents: o.maxBonusCents,
            difficulty: o.difficulty,
            rating: -1, // never equal to a computed rating, so every offer is "updated"
            ratingOverride: null,
            cooldownMonths: o.cooldownMonths,
            // the real code derives the duration from the highest step group: order / 10
            checklistSteps: o.durationMonths === null ? [] : [{ order: o.durationMonths * 10 }, { order: 0 }],
            // a single non-repeating threshold, which the real estimator reads back as exactly this amount
            conditions: o.costCents === null ? [] : [{ title: `Wpływ min. ${o.costCents / 100} zł`, description: null }]
          })),
        update: (args: { where: { id: string }; data: { rating: number } }) => {
          updates.set(args.where.id, args.data.rating);
          return args;
        }
      };
      target.$transaction = async (ops: unknown[]) => ops;

      await recomputeRatings();
      assert.equal(updates.size, offers.length, `seed ${seed}`);
      for (const o of offers) {
        assert.equal(explainRating(o, offers).rating, updates.get(o.id), `seed ${seed}, offer ${o.id}`);
      }
    }
  } finally {
    target.promotion = original.promotion;
    target.$transaction = original.tx;
  }
});

test("the breakdown adds up: contributions == composite, and a lone offer gets only neutral/own values", () => {
  const set = generate(7);
  for (const o of set) {
    const b = explainRating(o, set);
    assert.ok(Math.abs(b.components.reduce((a, c) => a + c.contribution, 0) - b.composite) < 1e-12);
    assert.ok(b.components.every((c) => c.score >= 0 && c.score <= 1));
    assert.equal(b.components.length, 5);
  }
  const lone: RatableOffer = { id: "x", accountType: "PERSONAL", maxBonusCents: 100, difficulty: "HARD", cooldownMonths: null, durationMonths: null, costCents: null };
  const alone = explainRating(lone, [lone]);
  assert.equal(alone.components.find((c) => c.key === "cooldown")!.neutral, true);
  assert.equal(alone.components.find((c) => c.key === "duration")!.score, NEUTRAL_SCORE);
});

test("example selection is deterministic, skips manual overrides and prefers a known cooldown", () => {
  const make = (id: string, extra: Record<string, unknown>) => ({
    id,
    slug: id,
    accountType: "PERSONAL",
    maxBonusCents: 1,
    difficulty: "EASY" as DifficultyKey,
    cooldownMonths: 12 as number | null,
    durationMonths: 2 as number | null,
    costCents: 100 as number | null,
    rating: 9,
    hasOverride: false,
    ...extra
  });
  const offers = [
    make("1", { cooldownMonths: null }),
    make("2", { rating: 8.4 }),
    make("3", { rating: 9.6, cooldownMonths: 24 }),
    make("4", { hasOverride: true, cooldownMonths: 24 }),
    make("5", { durationMonths: null }),
    make("6", { costCents: null, cooldownMonths: 24 })
  ];
  const picked = exampleCandidates(offers).map((o) => o.id);
  assert.ok(!picked.includes("4") && !picked.includes("5") && !picked.includes("6") && !picked.includes("1"));
  assert.deepEqual(picked, exampleCandidates([...offers].reverse()).map((o) => o.id));
  assert.deepEqual(exampleCandidates([]), []);
});
