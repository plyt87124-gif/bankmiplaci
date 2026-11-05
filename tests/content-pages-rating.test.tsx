import test from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { recomputeRatings } from "../src/lib/services/ratings";
import { buildRatingInput, stepTurnover, TURNOVER_OVERRIDES_ZL, type RatingSource } from "../src/lib/ratingInputs";
import {
  COMPONENT_KEYS,
  CURVE_EXPONENT,
  DIFFICULTY_SCORE,
  MIN_PEERS_OF_KIND,
  NEUTRAL_SCORE,
  RATING_CEILING,
  RATING_FLOOR,
  RATING_MEDIAN,
  RATING_WEIGHTS,
  curveRating,
  rateOffers,
  roundRating,
  type DifficultyKey,
  type RatingInput
} from "../src/lib/ratingModel";

/**
 * The "ocena serwisu": the pure model (lib/ratingModel.ts), the numbers it is fed
 * (lib/ratingInputs.ts) and the service that stores the result
 * (services/ratings.ts, database stubbed). /metodologia reads the same constants,
 * so there is no second copy that could drift.
 */

const NOW = new Date("2026-11-04T10:00:00Z");

function input(id: string, over: Partial<RatingInput> = {}): RatingInput {
  return {
    id,
    accountType: "PERSONAL",
    difficulty: "EASY",
    fixedPremiumZl: 500,
    fixedTurnoverZl: 500,
    cashbackParts: [],
    unconditionalFeesZl: 0,
    feeBurdenZl: 0,
    cooldownMonths: 12,
    durationMonths: 3,
    commissionZl: 100,
    ...over
  };
}

/** A varied personal set so the standardisation has a real spread. */
function personalSet(): RatingInput[] {
  return [
    input("a", { fixedPremiumZl: 300, fixedTurnoverZl: 0, commissionZl: 60, durationMonths: 1 }),
    input("b", { fixedPremiumZl: 800, fixedTurnoverZl: 2000, commissionZl: 150, difficulty: "MEDIUM" }),
    input("c", { fixedPremiumZl: 1500, fixedTurnoverZl: 9000, commissionZl: 220, difficulty: "HARD", durationMonths: 10 }),
    input("d", { fixedPremiumZl: 100, fixedTurnoverZl: 0, commissionZl: 40, cooldownMonths: null }),
    input("e", { fixedPremiumZl: 600, fixedTurnoverZl: 600, commissionZl: 300, feeBurdenZl: 120, unconditionalFeesZl: 60 })
  ];
}

const rating = (set: RatingInput[], id: string) => rateOffers(set).get(id)!.rating;

// ---------------------------------------------------------------------------
// Constants and the curve
// ---------------------------------------------------------------------------

test("weights add up to 100% and the owner's weights are the ones in use", () => {
  assert.ok(Math.abs(Object.values(RATING_WEIGHTS).reduce((a, b) => a + b, 0) - 1) < 1e-12);
  assert.deepEqual(
    { ...RATING_WEIGHTS },
    { efficiency: 0.3, netPremium: 0.2, partner: 0.2, effort: 0.1, duration: 0.1, cooldown: 0.05, fees: 0.05 }
  );
  assert.equal(COMPONENT_KEYS.length, 7);
  assert.deepEqual(DIFFICULTY_SCORE, { VERY_EASY: 1, EASY: 0.82, MEDIUM: 0.55, HARD: 0.3 });
});

test("the curve: floor, median and ceiling are where the scale says, and it is convex", () => {
  assert.equal(curveRating(-2), RATING_FLOOR);
  assert.ok(Math.abs(curveRating(0) - RATING_MEDIAN) < 1e-12);
  assert.ok(Math.abs(curveRating(2) - RATING_CEILING) < 1e-12);
  assert.equal(curveRating(-9), RATING_FLOOR);
  assert.equal(curveRating(9), RATING_CEILING);
  assert.ok(CURVE_EXPONENT > 1, "convex: the top is stretched, the bottom compressed");
  // the best step up is bigger than the worst step down
  assert.ok(curveRating(2) - curveRating(1) > curveRating(-1) - curveRating(-2));
  let previous = -Infinity;
  for (let z = -3; z <= 3; z += 0.25) {
    const r = curveRating(z);
    assert.ok(r >= previous);
    previous = r;
  }
  assert.ok(RATING_FLOOR >= 8.5 && RATING_MEDIAN > 9 && RATING_MEDIAN < 9.3, "nothing near 8,0; the middle offer just above 9");
});

// ---------------------------------------------------------------------------
// The model
// ---------------------------------------------------------------------------

test("every computed rating stays inside the scale, and the components add up to the composite", () => {
  for (const r of rateOffers(personalSet()).values()) {
    assert.ok(r.rating >= RATING_FLOOR && r.rating <= RATING_CEILING + 1e-9);
    assert.equal(r.components.length, 7);
    assert.ok(r.components.every((c) => c.score >= 0 && c.score <= 1));
    assert.ok(Math.abs(r.components.reduce((a, c) => a + c.contribution, 0) - r.composite) < 1e-12);
  }
});

test("a higher commission + contest raises the rating, everything else equal", () => {
  const base = personalSet();
  const low = base.map((o) => (o.id === "b" ? { ...o, commissionZl: 30 } : o));
  const high = base.map((o) => (o.id === "b" ? { ...o, commissionZl: 400 } : o));
  assert.ok(rating(high, "b") > rating(low, "b"));
});

test("a business commission counts at half next to a personal one", () => {
  const solo = (type: string, zl: number) => {
    const r = rateOffers([input("x", { accountType: type, commissionZl: zl }), input("y", { accountType: type }), input("z", { accountType: type })]);
    return r.get("x")!.components.find((c) => c.key === "partner")!.score;
  };
  assert.ok(solo("PERSONAL", 200) > solo("BUSINESS", 200));
  assert.ok(Math.abs(solo("PERSONAL", 100) - solo("BUSINESS", 200)) < 1e-12);
  assert.equal(solo("PERSONAL", 0), 0);
  const unknown = rateOffers([input("x", { commissionZl: null }), input("y"), input("z")]).get("x")!;
  assert.equal(unknown.components.find((c) => c.key === "partner")!.score, NEUTRAL_SCORE);
});

test("the efficiency component: 'any amount' payments beat a spending threshold, a low cashback rate beats nothing but not a fixed bonus", () => {
  const eff = (o: Partial<RatingInput>) => rateOffers([input("x", o), input("y"), input("z")]).get("x")!.components.find((c) => c.key === "efficiency")!.score;
  const free = eff({ fixedPremiumZl: 500, fixedTurnoverZl: 0 });
  const spend500 = eff({ fixedPremiumZl: 500, fixedTurnoverZl: 500 });
  const spend5000 = eff({ fixedPremiumZl: 500, fixedTurnoverZl: 5000 });
  assert.ok(free > spend500 && spend500 > spend5000);
  const cash20 = eff({ fixedPremiumZl: 0, cashbackParts: [{ premiumZl: 2400, rate: 0.2 }] });
  const cash1 = eff({ fixedPremiumZl: 0, cashbackParts: [{ premiumZl: 1200, rate: 0.01 }] });
  assert.ok(cash20 > cash1);
  assert.ok(free > cash20, "a bonus that needs no spending beats one that needs 12 000 zł spent");
  assert.equal(cash1, 0);
  assert.equal(eff({ fixedPremiumZl: 0 }), 0);
});

test("personal and business offers are never compared: adding business offers changes no personal rating", () => {
  const personal = personalSet();
  const before = new Map(personal.map((o) => [o.id, rating(personal, o.id)]));
  const business = [1, 2, 3, 4].map((i) => input(`biz${i}`, { accountType: "BUSINESS", fixedPremiumZl: i * 1000, commissionZl: i * 90 }));
  const mixed = rateOffers([...personal, ...business]);
  for (const o of personal) assert.equal(mixed.get(o.id)!.rating, before.get(o.id), o.id);
  // YOUNG / SAVINGS / JOINT are compared with the personal accounts
  const withYoung = rateOffers([...personal, input("young", { accountType: "YOUNG" })]);
  assert.equal(withYoung.get("young")!.kind, "PERSONAL");
  assert.equal(withYoung.get("young")!.peerCount, personal.length + 1);
});

test("with fewer offers of a kind than the minimum the rating is the neutral middle", () => {
  assert.equal(MIN_PEERS_OF_KIND, 3);
  const two = rateOffers([input("a"), input("b", { fixedPremiumZl: 5000 })]);
  for (const r of two.values()) {
    assert.equal(r.tooFewPeers, true);
    assert.equal(r.rating, roundRating(RATING_MEDIAN));
  }
  assert.equal(rateOffers([input("lone")]).get("lone")!.rating, roundRating(RATING_MEDIAN));
});

test("the result does not depend on the order of the offers", () => {
  const set = personalSet();
  const a = rateOffers(set);
  const b = rateOffers([...set].reverse());
  for (const o of set) assert.equal(a.get(o.id)!.rating, b.get(o.id)!.rating);
});

test("difficulty, duration, cooldown and fees move the rating in the expected direction", () => {
  const score = (o: Partial<RatingInput>, key: (typeof COMPONENT_KEYS)[number]) =>
    rateOffers([input("x", o), input("y"), input("z")]).get("x")!.components.find((c) => c.key === key)!.score;
  assert.ok(score({ difficulty: "VERY_EASY" }, "effort") > score({ difficulty: "HARD" }, "effort"));
  assert.ok(score({ durationMonths: 1 }, "duration") > score({ durationMonths: 12 }, "duration"));
  assert.equal(score({ durationMonths: 12 }, "duration"), 1 - 11 / 12);
  assert.ok(score({ cooldownMonths: 0.5 }, "cooldown") > score({ cooldownMonths: 24 }, "cooldown"));
  assert.equal(score({ cooldownMonths: null }, "cooldown"), NEUTRAL_SCORE);
  assert.ok(score({ feeBurdenZl: 0 }, "fees") > score({ feeBurdenZl: 150 }, "fees"));
  assert.equal(score({ feeBurdenZl: null }, "fees"), NEUTRAL_SCORE);
});

// ---------------------------------------------------------------------------
// The inputs read from the offer's texts
// ---------------------------------------------------------------------------

test("stepTurnover separates spending from inflow and ignores caps, optional steps, taxes and products", () => {
  assert.deepEqual(stepTurnover("Zrób min. 3 transakcje kartą w tym miesiącu"), { spend: 0, inflow: 0 });
  assert.deepEqual(stepTurnover("Zapłać kartą za min. 500 zł w miesiącu"), { spend: 500, inflow: 0 });
  assert.deepEqual(stepTurnover("Zapewnij wpływ wynagrodzenia min. 3000 zł"), { spend: 0, inflow: 3000 });
  assert.deepEqual(stepTurnover("Zapewnij wpływ (min. 1500 zł do 26 lat, 3000 zł od 26 lat)"), { spend: 0, inflow: 1500 });
  assert.deepEqual(stepTurnover("Cashback do 100 zł miesięcznie"), { spend: 0, inflow: 0 });
  assert.deepEqual(stepTurnover("Opcjonalnie: zapewnij wpływy min. 2000 zł"), { spend: 0, inflow: 0 });
  assert.deepEqual(stepTurnover("Podpisz umowę kredytu firmowego na min. 120 000 zł"), { spend: 0, inflow: 0 });
  assert.deepEqual(stepTurnover("Zrób przelew do ZUS na min. 300 zł"), { spend: 0, inflow: 0 });
  assert.deepEqual(stepTurnover("Zapłać kartą min. 1 200 zł"), { spend: 1200, inflow: 0 });
});

function source(over: Partial<RatingSource> = {}): RatingSource {
  return {
    id: "p1",
    slug: "p1",
    accountType: "PERSONAL",
    maxBonusCents: 100_000,
    difficulty: "EASY",
    cooldownMonths: null,
    cooldownCutoffDate: null,
    bonusParts: [],
    checklistSteps: [],
    fees: null,
    commissionCents: null,
    ...over
  };
}

test("buildRatingInput: product parts do not count, cashback rates come from the label or the monthly steps", () => {
  const built = buildRatingInput(
    source({
      bonusParts: [
        { label: "Kredyt firmowy (jednorazowo)", amountCents: 200_000 },
        { label: "Leasing (jednorazowo)", amountCents: 50_000 },
        { label: "Przelewy do ZUS/US (do 12 mies.)", amountCents: 60_000 },
        { label: "Cashback 5% od płatności kartą", amountCents: 180_000 },
        { label: "Zwrot za zakupy — 10 × do 50 zł", amountCents: 50_000 }
      ],
      checklistSteps: [
        { order: 0, title: "Otwórz konto", rewardCents: null },
        { order: 10, title: "Zrób min. 10 płatności kartą (zwrot 3% z zakupów)", rewardCents: null },
        { order: 12, title: "Odbierz: 150 zł", rewardCents: 15_000 }
      ]
    }),
    NOW
  );
  assert.equal(built.fixedPremiumZl, 600, "only the ZUS part is fixed; credit and leasing are excluded");
  assert.deepEqual(built.cashbackParts, [
    { premiumZl: 1800, rate: 0.05 },
    { premiumZl: 500, rate: 0.03 }
  ]);
});

test("buildRatingInput: an offer without parts counts its maximum bonus; the turnover is the monthly thresholds added up", () => {
  const built = buildRatingInput(
    source({
      maxBonusCents: 90_000,
      checklistSteps: [
        { order: 10, title: "Zapłać kartą min. 500 zł", rewardCents: null },
        { order: 20, title: "Zapłać kartą min. 500 zł", rewardCents: null },
        { order: 21, title: "Zapewnij wpływ min. 2000 zł", rewardCents: null }
      ]
    }),
    NOW
  );
  assert.equal(built.fixedPremiumZl, 900);
  assert.equal(built.fixedTurnoverZl, 500 + 500 + 0.1 * 2000);
  assert.equal(built.durationMonths, 2);
  assert.equal(buildRatingInput(source(), NOW).durationMonths, null);
});

test("buildRatingInput: fees (waivable ones at half), karencja from the date the bank looks back to, commission in zł", () => {
  const built = buildRatingInput(
    source({
      checklistSteps: [{ order: 30, title: "Zrób płatność", rewardCents: null }],
      fees: { accountFeeCents: 1000, accountFeeWaiverCondition: "wpływ 1000 zł", cardFeeCents: 500, cardFeeWaiverCondition: null },
      cooldownMonths: 6,
      cooldownCutoffDate: new Date("2025-11-04T00:00:00Z"),
      commissionCents: 25_000
    }),
    NOW
  );
  assert.equal(built.unconditionalFeesZl, 5 * 3, "the card fee, 3 months");
  assert.equal(built.feeBurdenZl, 5 * 3 + 0.5 * 10 * 3);
  assert.ok(built.cooldownMonths !== null && Math.abs(built.cooldownMonths - 12) < 0.1, "twelve months back beats the stated six");
  assert.equal(built.commissionZl, 250);
  assert.equal(buildRatingInput(source({ fees: null }), NOW).feeBurdenZl, null, "unverified fees are unknown, never zero");
  assert.equal(buildRatingInput(source(), NOW).commissionZl, null);
});

test("a hand-checked turnover wins over the one read from the text", () => {
  const slug = Object.keys(TURNOVER_OVERRIDES_ZL)[0]!;
  const built = buildRatingInput(
    source({ slug, bonusParts: [{ label: "Premia", amountCents: 100_000 }], checklistSteps: [{ order: 10, title: "Zapłać kartą min. 10 zł", rewardCents: null }] }),
    NOW
  );
  assert.equal(built.fixedTurnoverZl, TURNOVER_OVERRIDES_ZL[slug]);
});

// ---------------------------------------------------------------------------
// The service (database stubbed)
// ---------------------------------------------------------------------------

type Stub = { promotion: unknown; affiliateOffer: unknown; affiliateContest: unknown; $transaction: unknown };

async function withStubbedDb(
  rows: unknown[],
  offers: unknown[],
  contests: unknown[],
  run: (updates: Map<string, number>) => Promise<void>
): Promise<void> {
  const target = db as unknown as Stub;
  const original = { ...target };
  const updates = new Map<string, number>();
  try {
    target.promotion = {
      findMany: async () => rows,
      update: (args: { where: { id: string }; data: { rating: number } }) => {
        updates.set(args.where.id, args.data.rating);
        return args;
      }
    };
    target.affiliateOffer = { findMany: async () => offers };
    target.affiliateContest = { findMany: async () => contests };
    target.$transaction = async (ops: unknown[]) => ops;
    await run(updates);
  } finally {
    Object.assign(target, original);
  }
}

function promotionRow(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    slug: id,
    name: id,
    accountType: "PERSONAL",
    maxBonusCents: 50_000,
    difficulty: "EASY" as DifficultyKey,
    rating: -1, // never equal to a computed rating, so every offer is "updated"
    ratingOverride: null,
    cooldownMonths: null,
    cooldownCutoffDate: null,
    affiliateCommissionCents: null,
    bonusParts: [],
    checklistSteps: [{ order: 10, title: "Zapłać kartą min. 500 zł", rewardCents: null }],
    fees: null,
    ...over
  };
}

function campaign(slugId: string, externalId: string, cps: number) {
  return { network: "EBROKER", externalId, cpsCents: cps, cpaCents: null, missingSince: null, promotion: { id: slugId, slug: slugId } };
}

test("recomputeRatings: reads the commission and the per-account contest of the linked campaigns, and a manual rating wins", async () => {
  const rows = [promotionRow("a"), promotionRow("b"), promotionRow("c"), promotionRow("d", { ratingOverride: 7.7 })];
  const same = [campaign("a", "1", 10_000), campaign("b", "2", 10_000), campaign("c", "3", 10_000), campaign("d", "4", 10_000)];

  let flat = new Map<string, number>();
  await withStubbedDb(rows, same, [], async (updates) => {
    await recomputeRatings();
    flat = new Map(updates);
  });
  assert.equal(flat.get("d"), 7.7, "a manual rating is stored as set");
  assert.equal(flat.get("a"), flat.get("b"), "identical offers rate alike");

  // a contest paying 300 zł for EVERY account of campaign "1" is simply a higher commission for offer "a"
  const contest = { network: "EBROKER", offerExternalIds: ["1"], tiers: [{ everyN: 1, bonusCents: 30_000 }], missingSince: null };
  await withStubbedDb(rows, same, [contest], async (updates) => {
    await recomputeRatings();
    assert.ok(updates.get("a")! > flat.get("a")!, "the contest raises the rating of its offer");
    assert.ok(updates.get("a")! > updates.get("b")!);
  });
});

test("recomputeRatings: nothing to update when every stored rating is already what the model computes", async () => {
  const rows = [promotionRow("a"), promotionRow("b"), promotionRow("c")];
  let computed = new Map<string, number>();
  await withStubbedDb(rows, [], [], async (updates) => {
    assert.equal(await recomputeRatings(), 3);
    computed = new Map(updates);
  });
  const settled = rows.map((r) => ({ ...r, rating: computed.get(r.id)! }));
  await withStubbedDb(settled, [], [], async () => {
    assert.equal(await recomputeRatings(), 0);
  });
});
