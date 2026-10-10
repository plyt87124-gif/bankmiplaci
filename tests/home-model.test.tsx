// The model of the home page: one pool of public cards in, every block out
// (segments, ending soon, effort examples, counter, update date), plus the
// failure path of the loader. Pure: no database, no React render.
import test from "node:test";
import assert from "node:assert/strict";
import {
  ENDING_SOON_COUNT,
  ENDING_SOON_DAYS,
  FEATURED_COUNT,
  buildHomeModel,
  hubSeeAllLabel,
  latestVerification,
  pickEffortExamples,
  pickEndingSoon,
  readHomeModel
} from "../src/components/home/homeModel";
import { isRouteLive } from "../src/lib/seo/routes";
import type { PromotionCardData } from "../src/lib/services/promotionCards";

// 2026-10-10 12:00 in Warsaw is 10:00 UTC. endDate = last sign-up day at 00:00 UTC.
const NOW = new Date("2026-10-10T10:00:00Z");
const day = (offset: number) => new Date(Date.UTC(2026, 9, 10 + offset));

function card(slug: string, overrides: Partial<PromotionCardData> = {}): PromotionCardData {
  return {
    slug,
    name: `Oferta ${slug}`,
    summary: null,
    maxBonusCents: 50_000,
    difficulty: "EASY",
    accountType: "PERSONAL",
    rating: 8,
    ratingReason: null,
    endDate: day(60),
    lastVerifiedAt: new Date("2026-10-06T10:00:00Z"),
    fees: { accountFeeCents: 0, accountFeeWaiverCondition: null, cardFeeCents: 0, cardFeeWaiverCondition: null },
    conditions: [],
    bank: { name: `Bank ${slug}`, slug: `bank-${slug}`, logoUrl: null },
    ...overrides
  };
}

const slugs = (cards: readonly PromotionCardData[]) => cards.map((c) => c.slug);

/* ------------------------------------------------------------------ */
/* buildHomeModel                                                      */
/* ------------------------------------------------------------------ */

test("model: the counter is every active offer, the date is the newest verification", () => {
  const pool = [
    card("a", { lastVerifiedAt: new Date("2026-10-01T08:00:00Z") }),
    card("b", { lastVerifiedAt: new Date("2026-10-07T08:00:00Z") }),
    card("c", { accountType: "SAVINGS", lastVerifiedAt: new Date("2026-10-03T08:00:00Z") })
  ];
  const model = buildHomeModel(pool, NOW);
  assert.equal(model.total, 3, "offers of other account types are counted, like on /promocje");
  assert.equal(model.latestVerifiedAt?.toISOString(), "2026-10-07T08:00:00.000Z");
});

test("model: segments keep the pool's order and show the first three of each", () => {
  const personal = ["p1", "p2", "p3", "p4", "p5"].map((s) => card(s));
  const business = ["b1", "b2"].map((s) => card(s, { accountType: "BUSINESS" }));
  // The pool is interleaved: the order inside a segment must be the pool's order.
  const pool = [personal[0]!, business[0]!, personal[1]!, personal[2]!, business[1]!, personal[3]!, personal[4]!];
  const model = buildHomeModel(pool, NOW);

  assert.deepEqual(
    model.segments.map((s) => s.value),
    ["PERSONAL", "BUSINESS"]
  );
  const [first, second] = model.segments;
  assert.deepEqual(slugs(first!.featured), ["p1", "p2", "p3"]);
  assert.equal(first!.featured.length, FEATURED_COUNT);
  assert.deepEqual(slugs(second!.featured), ["b1", "b2"]);
  assert.equal(model.defaultSegment, "PERSONAL");
});

test("model: with both segments the links lead to the segment's list and carry its count (Osobiste = every non-business type)", () => {
  const pool = [
    card("p1"),
    card("p2"),
    card("b1", { accountType: "BUSINESS" }),
    card("s1", { accountType: "SAVINGS" }),
    card("y1", { accountType: "YOUNG" })
  ];
  const model = buildHomeModel(pool, NOW, () => false);
  const personal = model.segments.find((s) => s.value === "PERSONAL")!;
  const business = model.segments.find((s) => s.value === "BUSINESS")!;
  assert.equal(personal.href, "/promocje?accountType=PERSONAL");
  assert.equal(personal.count, 4, "PERSONAL + SAVINGS + YOUNG, as on the /promocje tab");
  assert.equal(personal.total, 4);
  assert.deepEqual(slugs(personal.featured), ["p1", "p2", "s1"], "a savings or a youth account is a personal offer on the home page too");
  assert.equal(business.href, "/promocje?accountType=BUSINESS");
  assert.equal(business.count, 1);
  assert.equal(personal.total + business.total, model.total, "the two segments add up to every offer");
});

test("model: one segment only = nothing to choose, the links lead to the whole list and count all of it", () => {
  const pool = [card("b1", { accountType: "BUSINESS" }), card("b2", { accountType: "BUSINESS" })];
  const model = buildHomeModel(pool, NOW, () => false);
  assert.deepEqual(
    model.segments.map((s) => s.value),
    ["BUSINESS"]
  );
  assert.equal(model.defaultSegment, "BUSINESS", "business is the default when there are no personal offers");
  assert.equal(model.segments[0]!.href, "/promocje");
  assert.equal(model.segments[0]!.count, 2);
  assert.deepEqual(model.segments[0]!.seeAll, { href: "/promocje", label: "Zobacz wszystkie (2)" });

  // A youth account alone is a personal offer: the home page then has a Osobiste segment, not "a segment missing".
  const young = buildHomeModel([card("y1", { accountType: "YOUNG" })], NOW, () => false);
  assert.deepEqual(young.segments.map((s) => s.value), ["PERSONAL"]);
  assert.equal(young.defaultSegment, "PERSONAL");
});

test("model: 'Zobacz wszystkie' leads to the segment's hub while the hub is live, with the hub's own number", () => {
  const pool = [
    card("p1"),
    card("p2"),
    card("y1", { accountType: "YOUNG" }),
    card("b1", { accountType: "BUSINESS" }),
    card("b2", { accountType: "BUSINESS" })
  ];
  const live = buildHomeModel(pool, NOW, () => true);
  const personal = live.segments.find((s) => s.value === "PERSONAL")!;
  const business = live.segments.find((s) => s.value === "BUSINESS")!;
  assert.deepEqual(personal.seeAll, { href: "/konta-osobiste-z-premia", label: "Wszystkie konta osobiste z premią (3)" });
  assert.deepEqual(business.seeAll, { href: "/konta-firmowe-z-premia", label: "Wszystkie konta firmowe z premią (2)" });
  // The list link of the hero button is unchanged (the filtered list), only the link under "Polecane" moves to the hub.
  assert.equal(personal.href, "/promocje?accountType=PERSONAL");
  assert.equal(business.href, "/promocje?accountType=BUSINESS");
  assert.equal(personal.count, 3);

  // The default liveness is the route registry: today both hubs are live.
  assert.equal(isRouteLive("/konta-osobiste-z-premia") && isRouteLive("/konta-firmowe-z-premia"), true);
  const byDefault = buildHomeModel(pool, NOW);
  assert.equal(byDefault.segments.find((s) => s.value === "PERSONAL")!.seeAll.href, "/konta-osobiste-z-premia");
  assert.equal(byDefault.segments.find((s) => s.value === "BUSINESS")!.seeAll.href, "/konta-firmowe-z-premia");

  // Only the page that is live is linked: with the business hub off, that segment keeps the link with the parameter.
  const half = buildHomeModel(pool, NOW, (path) => path === "/konta-osobiste-z-premia");
  assert.equal(half.segments.find((s) => s.value === "PERSONAL")!.seeAll.href, "/konta-osobiste-z-premia");
  assert.deepEqual(half.segments.find((s) => s.value === "BUSINESS")!.seeAll, {
    href: "/promocje?accountType=BUSINESS",
    label: "Zobacz wszystkie (2)"
  });

  // The anchor of the link to a hub: "Wszystkie {name of the hub in lower case} (N)".
  assert.equal(hubSeeAllLabel("personal", 16), "Wszystkie konta osobiste z premią (16)");
  assert.equal(hubSeeAllLabel("business", 7), "Wszystkie konta firmowe z premią (7)");
});

test("model: a single live segment still links to its own hub (the hub lists exactly that segment)", () => {
  const model = buildHomeModel([card("b1", { accountType: "BUSINESS" }), card("b2", { accountType: "BUSINESS" })], NOW, () => true);
  assert.deepEqual(model.segments[0]!.seeAll, { href: "/konta-firmowe-z-premia", label: "Wszystkie konta firmowe z premią (2)" });
});

test("model: an empty pool gives an empty, honest model (no segments, no date, no examples)", () => {
  const model = buildHomeModel([], NOW);
  assert.equal(model.total, 0);
  assert.equal(model.latestVerifiedAt, null);
  assert.deepEqual(model.segments, []);
  assert.equal(model.defaultSegment, null);
  assert.deepEqual(model.endingSoon, []);
  assert.deepEqual(model.effortExamples, []);
});

test("model: the cards are the pool's own objects - nothing is added, nothing is copied with extra fields", () => {
  const pool = [card("p1")];
  const model = buildHomeModel(pool, NOW);
  assert.equal(model.segments[0]!.featured[0], pool[0], "same object, the model does not rebuild cards");
  const keys = new Set(["slug", "name", "summary", "maxBonusCents", "difficulty", "accountType", "rating", "ratingReason", "endDate", "lastVerifiedAt", "fees", "conditions", "bank"]);
  for (const key of Object.keys(model.segments[0]!.featured[0]!)) assert.ok(keys.has(key), `public card field: ${key}`);
});

/* ------------------------------------------------------------------ */
/* latestVerification                                                  */
/* ------------------------------------------------------------------ */

test("latestVerification: ignores invalid dates, null for nothing usable", () => {
  assert.equal(latestVerification([]), null);
  assert.equal(latestVerification([{ lastVerifiedAt: new Date("not a date") }]), null);
  const newest = latestVerification([
    { lastVerifiedAt: new Date("2026-09-01T00:00:00Z") },
    { lastVerifiedAt: new Date("garbage") },
    { lastVerifiedAt: new Date("2026-10-05T00:00:00Z") }
  ]);
  assert.equal(newest?.toISOString(), "2026-10-05T00:00:00.000Z");
});

/* ------------------------------------------------------------------ */
/* pickEndingSoon                                                      */
/* ------------------------------------------------------------------ */

test("ending soon: 0 to 14 days left, nearest deadline first, at most three", () => {
  assert.equal(ENDING_SOON_DAYS, 14);
  const pool = [
    card("late", { endDate: day(14) }),
    card("far", { endDate: day(15) }),
    card("ended", { endDate: day(-1) }),
    card("today", { endDate: day(0) }),
    card("soon", { endDate: day(3) }),
    card("mid", { endDate: day(9) }),
    card("mid2", { endDate: day(10) })
  ];
  const picked = pickEndingSoon(pool, NOW);
  assert.deepEqual(slugs(picked), ["today", "soon", "mid"]);
  assert.equal(picked.length, ENDING_SOON_COUNT);
  // The offer 14 days away is in, the one 15 days away and the ended one are not.
  assert.deepEqual(slugs(pickEndingSoon(pool, NOW, 14, 10)), ["today", "soon", "mid", "mid2", "late"]);
});

test("ending soon: equal deadlines are ordered by rating, then slug - never by input order", () => {
  const a = card("a", { endDate: day(5), rating: 8 });
  const b = card("b", { endDate: day(5), rating: 9 });
  const c = card("c", { endDate: day(5), rating: 9 });
  assert.deepEqual(slugs(pickEndingSoon([a, c, b], NOW)), ["b", "c", "a"]);
  assert.deepEqual(slugs(pickEndingSoon([c, b, a], NOW)), ["b", "c", "a"]);
});

test("ending soon: no offer inside the window = an empty list (the page then renders no block)", () => {
  assert.deepEqual(pickEndingSoon([card("far", { endDate: day(40) })], NOW), []);
  assert.deepEqual(pickEndingSoon([], NOW), []);
  assert.deepEqual(buildHomeModel([card("far", { endDate: day(40) })], NOW).endingSoon, []);
});

test("ending soon: counts Poland's calendar days (the last day itself is still open)", () => {
  // 2026-10-10 23:30 in Warsaw is 21:30 UTC: the offer ending on the 10th is still open.
  const lateEvening = new Date("2026-10-10T21:30:00Z");
  assert.deepEqual(slugs(pickEndingSoon([card("x", { endDate: day(0) })], lateEvening)), ["x"]);
  // One minute after midnight in Warsaw (22:01 UTC) the 10th is over.
  assert.deepEqual(pickEndingSoon([card("x", { endDate: day(0) })], new Date("2026-10-10T22:01:00Z")), []);
});

/* ------------------------------------------------------------------ */
/* pickEffortExamples                                                  */
/* ------------------------------------------------------------------ */

test("effort examples: the easiest and the hardest offer, the bigger bonus within a level", () => {
  const pool = [
    card("easy-small", { difficulty: "VERY_EASY", maxBonusCents: 10_000 }),
    card("easy-big", { difficulty: "VERY_EASY", maxBonusCents: 30_000 }),
    card("mid", { difficulty: "MEDIUM", maxBonusCents: 99_000 }),
    card("hard-small", { difficulty: "HARD", maxBonusCents: 20_000 }),
    card("hard-big", { difficulty: "HARD", maxBonusCents: 90_000 })
  ];
  assert.deepEqual(slugs(pickEffortExamples(pool)), ["easy-big", "hard-big"]);
});

test("effort examples: a pool with one difficulty level gives ONE card, never an invented second", () => {
  const pool = [card("a", { maxBonusCents: 10_000 }), card("b", { maxBonusCents: 40_000 })];
  assert.deepEqual(slugs(pickEffortExamples(pool)), ["b"]);
  assert.deepEqual(slugs(pickEffortExamples([card("only")])), ["only"]);
  assert.deepEqual(pickEffortExamples([]), []);
});

test("effort examples: personal accounts are compared with each other; business only when there is nothing else", () => {
  const mixed = [
    card("p-easy", { difficulty: "EASY", maxBonusCents: 10_000 }),
    card("p-hard", { difficulty: "HARD", maxBonusCents: 10_000 }),
    card("b-very-easy", { accountType: "BUSINESS", difficulty: "VERY_EASY", maxBonusCents: 900_000 })
  ];
  assert.deepEqual(slugs(pickEffortExamples(mixed)), ["p-easy", "p-hard"]);
  const businessOnly = [
    card("b1", { accountType: "BUSINESS", difficulty: "EASY" }),
    card("b2", { accountType: "BUSINESS", difficulty: "HARD" })
  ];
  assert.deepEqual(slugs(pickEffortExamples(businessOnly)), ["b1", "b2"]);
});

test("effort examples: every non-business account counts as personal (a youth account is compared with the others)", () => {
  const pool = [
    card("p-easy", { difficulty: "EASY", maxBonusCents: 10_000 }),
    card("y-hard", { accountType: "YOUNG", difficulty: "HARD", maxBonusCents: 10_000 }),
    card("b-very-easy", { accountType: "BUSINESS", difficulty: "VERY_EASY", maxBonusCents: 900_000 })
  ];
  assert.deepEqual(slugs(pickEffortExamples(pool)), ["p-easy", "y-hard"]);
});

test("effort examples: the result does not depend on the order of the pool", () => {
  const pool = [
    card("a", { difficulty: "EASY", maxBonusCents: 20_000, rating: 9 }),
    card("b", { difficulty: "EASY", maxBonusCents: 20_000, rating: 9 }),
    card("c", { difficulty: "HARD", maxBonusCents: 20_000, rating: 7 }),
    card("d", { difficulty: "HARD", maxBonusCents: 20_000, rating: 7 })
  ];
  assert.deepEqual(slugs(pickEffortExamples(pool)), slugs(pickEffortExamples([...pool].reverse())));
  assert.deepEqual(slugs(pickEffortExamples(pool)), ["a", "c"]);
});

/* ------------------------------------------------------------------ */
/* readHomeModel (the loader's failure path)                           */
/* ------------------------------------------------------------------ */

test("readHomeModel: a database failure gives null (the page renders its static blocks), the error is reported", async () => {
  const errors: unknown[] = [];
  const failure = new Error("connection refused");
  const model = await readHomeModel(
    () => Promise.reject(failure),
    NOW,
    (error) => errors.push(error)
  );
  assert.equal(model, null);
  assert.deepEqual(errors, [failure]);
});

test("readHomeModel passes the liveness check on to the model", async () => {
  const model = await readHomeModel(async () => [card("p1")], NOW, undefined, () => false);
  assert.deepEqual(model?.segments[0]?.seeAll, { href: "/promocje", label: "Zobacz wszystkie (1)" });
});

test("readHomeModel: a working read builds the model from one call", async () => {
  let calls = 0;
  const model = await readHomeModel(
    async () => {
      calls += 1;
      return [card("p1"), card("b1", { accountType: "BUSINESS" })];
    },
    NOW
  );
  assert.equal(calls, 1, "ONE read feeds every block");
  assert.equal(model?.total, 2);
});
