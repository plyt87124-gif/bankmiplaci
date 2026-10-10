// One definition of "konta osobiste" / "konta firmowe" (src/lib/accountTypes.ts) and the proof that
// every place that counts or lists them agrees: the /promocje tabs and their counters, the database
// filter, the home segments, the hubs, /porownaj and the quiz. Before, the tab said "Osobiste (14)"
// while the hub and /porownaj said 16, and two youth accounts belonged to no tab at all.
import test from "node:test";
import assert from "node:assert/strict";
import { AccountType } from "@prisma/client";
import {
  ACCOUNT_SEGMENTS,
  ALL_ACCOUNT_TYPES,
  BUSINESS_ACCOUNT_TYPES,
  PERSONAL_ACCOUNT_TYPES,
  accountTypeWhere,
  accountTypesOf,
  isAccountSegment,
  isBusinessType,
  isPersonalType,
  matchesAccountTypeFilter,
  segmentOf
} from "../src/lib/accountTypes";
import { buildActiveWhere } from "../src/lib/services/promotions";
import { parseListingParams, segmentOf as stateSegmentOf, toServiceFilters } from "../src/components/filters/filterParams";
import { applyAccountType, segmentCounts } from "../src/components/promocje/listing";
import { hubKindOf, selectHubCards } from "../src/components/seo-pages/hubs";
import { COMPARE_MAX, resolveSelection, segmentOf as compareSegmentOf } from "../src/app/porownaj/compareModel";
import { buildHomeModel } from "../src/components/home/homeModel";
import { matchOffers, toQuizOffers, type QuizAnswers } from "../src/lib/quiz";
import type { PromotionCardData } from "../src/lib/services/promotionCards";

const NOW = new Date("2026-10-10T10:00:00Z");

function card(slug: string, accountType: AccountType, rating = 8): PromotionCardData {
  return {
    slug,
    name: `Oferta ${slug}`,
    summary: null,
    maxBonusCents: 50_000,
    difficulty: "EASY",
    accountType,
    rating,
    ratingReason: null,
    endDate: new Date("2026-12-31T00:00:00Z"),
    lastVerifiedAt: new Date("2026-10-06T10:00:00Z"),
    fees: null,
    conditions: [],
    bank: { name: `Bank ${slug}`, slug: `bank-${slug}`, logoUrl: null }
  };
}

/** The catalogue of 2026-10-10: 14 PERSONAL + 2 YOUNG (mBank) + 7 BUSINESS = 23 offers. */
function catalogue(): PromotionCardData[] {
  const out: PromotionCardData[] = [];
  for (let i = 1; i <= 14; i++) out.push(card(`p${i}`, "PERSONAL", 9 - (i % 3)));
  for (let i = 1; i <= 2; i++) out.push(card(`y${i}`, "YOUNG"));
  for (let i = 1; i <= 7; i++) out.push(card(`b${i}`, "BUSINESS", 8 + (i % 2)));
  // The "Polecane" order interleaves types; the pool is shuffled on purpose.
  return out.sort((a, b) => (a.slug.charCodeAt(1) * 7) % 11 - (b.slug.charCodeAt(1) * 7) % 11 || a.slug.localeCompare(b.slug));
}

/* ------------------------------------------------------------------ */
/* The taxonomy                                                        */
/* ------------------------------------------------------------------ */

test("every Prisma account type is assigned to exactly one segment", () => {
  assert.deepEqual([...ALL_ACCOUNT_TYPES].sort(), Object.values(AccountType).sort(), "a new AccountType must be placed in a segment");
  assert.deepEqual([...BUSINESS_ACCOUNT_TYPES], ["BUSINESS"]);
  assert.deepEqual([...PERSONAL_ACCOUNT_TYPES].sort(), ["JOINT", "PERSONAL", "SAVINGS", "YOUNG"]);
  const union = [...PERSONAL_ACCOUNT_TYPES, ...BUSINESS_ACCOUNT_TYPES].sort();
  assert.deepEqual(union, [...ALL_ACCOUNT_TYPES].sort(), "the two segments cover every type");
  assert.equal(new Set(union).size, union.length, "and share none");
  assert.deepEqual([...ACCOUNT_SEGMENTS], ["PERSONAL", "BUSINESS"]);
  assert.deepEqual([...accountTypesOf("PERSONAL")], [...PERSONAL_ACCOUNT_TYPES]);
  assert.deepEqual([...accountTypesOf("BUSINESS")], [...BUSINESS_ACCOUNT_TYPES]);
});

test("segmentOf: only BUSINESS is firmowe; everything else, even an unknown value, is osobiste", () => {
  assert.equal(segmentOf("BUSINESS"), "BUSINESS");
  for (const type of ["PERSONAL", "SAVINGS", "YOUNG", "JOINT", "", "UNKNOWN"]) assert.equal(segmentOf(type), "PERSONAL", type);
  assert.equal(segmentOf(null), "PERSONAL");
  assert.equal(segmentOf(undefined), "PERSONAL");
  assert.equal(isBusinessType("BUSINESS"), true);
  assert.equal(isPersonalType("BUSINESS"), false);
  for (const type of PERSONAL_ACCOUNT_TYPES) {
    assert.equal(isPersonalType(type), true, type);
    assert.equal(isBusinessType(type), false, type);
  }
  assert.equal(isAccountSegment("PERSONAL"), true);
  assert.equal(isAccountSegment("BUSINESS"), true);
  assert.equal(isAccountSegment("YOUNG"), false);
  assert.equal(isAccountSegment(""), false);
});

test("compareModel.segmentOf is the shared one", () => {
  for (const type of [...ALL_ACCOUNT_TYPES, "UNKNOWN"]) assert.equal(compareSegmentOf(type), segmentOf(type), type);
});

/* ------------------------------------------------------------------ */
/* The filter: memory and database say the same                        */
/* ------------------------------------------------------------------ */

test("the in-memory filter and the Prisma where select the same account types", () => {
  for (const filter of ["", "PERSONAL", "BUSINESS", "SAVINGS", "YOUNG", "JOINT"]) {
    const where = accountTypeWhere(filter).accountType as undefined | AccountType | { in: AccountType[] };
    for (const type of ALL_ACCOUNT_TYPES) {
      const inDatabase =
        where === undefined ? true : typeof where === "string" ? where === type : (where.in ?? []).includes(type);
      assert.equal(matchesAccountTypeFilter(type, filter), inDatabase, `filter "${filter}" on ${type}`);
    }
  }
});

test("accountTypeWhere: no filter = no condition; PERSONAL = every non-business type; the rest = exactly that type", () => {
  assert.deepEqual(accountTypeWhere(""), {});
  assert.deepEqual(accountTypeWhere(undefined), {});
  assert.deepEqual(accountTypeWhere("PERSONAL"), { accountType: { in: ["PERSONAL", "SAVINGS", "YOUNG", "JOINT"] } });
  assert.deepEqual(accountTypeWhere("BUSINESS"), { accountType: "BUSINESS" });
  assert.deepEqual(accountTypeWhere("YOUNG"), { accountType: "YOUNG" });
});

test("buildActiveWhere (every public read path) uses the shared definition and keeps its other conditions", () => {
  const personal = buildActiveWhere({ accountType: "PERSONAL" });
  assert.deepEqual(personal.accountType, { in: ["PERSONAL", "SAVINGS", "YOUNG", "JOINT"] });
  assert.ok(personal.status && personal.endDate, "still only open, ACTIVE offers");
  assert.deepEqual(buildActiveWhere({ accountType: "BUSINESS" }).accountType, "BUSINESS");
  assert.equal("accountType" in buildActiveWhere({}), false);
  assert.equal("accountType" in buildActiveWhere({ accountType: "" }), false);

  const combined = buildActiveWhere({ accountType: "PERSONAL", bankSlug: "mbank", difficulty: ["EASY"], minBonusCents: 20000 });
  assert.deepEqual(combined.bank, { slug: "mbank" });
  assert.deepEqual(combined.difficulty, { in: ["EASY"] });
  assert.deepEqual(combined.maxBonusCents, { gte: 20000 });

  // Straight from the URL: ?accountType=PERSONAL reaches the database as the whole segment.
  const fromUrl = toServiceFilters(parseListingParams({ accountType: "PERSONAL" }));
  assert.deepEqual(buildActiveWhere(fromUrl).accountType, { in: ["PERSONAL", "SAVINGS", "YOUNG", "JOINT"] });
  // The link parameter is still accepted as it always was, and old links with a single type still narrow to it.
  assert.equal(parseListingParams({ accountType: "PERSONAL" }).accountType, "PERSONAL");
  assert.equal(parseListingParams({ accountType: "YOUNG" }).accountType, "YOUNG");
  assert.deepEqual(buildActiveWhere(toServiceFilters(parseListingParams({ accountType: "YOUNG" }))).accountType, "YOUNG");
});

test("the Osobiste tab is selected by the segment values only; a single old type selects no tab", () => {
  assert.equal(stateSegmentOf(parseListingParams({ accountType: "PERSONAL" })), "PERSONAL");
  assert.equal(stateSegmentOf(parseListingParams({ accountType: "BUSINESS" })), "BUSINESS");
  for (const accountType of ["SAVINGS", "YOUNG", "JOINT", ""]) assert.equal(stateSegmentOf(parseListingParams({ accountType })), "", accountType);
});

/* ------------------------------------------------------------------ */
/* The numbers agree everywhere                                        */
/* ------------------------------------------------------------------ */

test("/promocje: Osobiste + Firmowe = Wszystkie, and a tab lists exactly as many offers as its counter says", () => {
  const cards = catalogue();
  assert.equal(cards.length, 23);
  const counts = segmentCounts(cards);
  assert.deepEqual(counts, { all: 23, PERSONAL: 16, BUSINESS: 7 });
  assert.equal(counts.PERSONAL + counts.BUSINESS, counts.all);
  assert.equal(applyAccountType(cards, "PERSONAL").length, counts.PERSONAL);
  assert.equal(applyAccountType(cards, "BUSINESS").length, counts.BUSINESS);
  assert.equal(applyAccountType(cards, "").length, counts.all);
  // The two youth accounts are on the Osobiste tab (they belonged to no tab before).
  assert.deepEqual(
    applyAccountType(cards, "PERSONAL").filter((c) => c.accountType === "YOUNG").map((c) => c.slug).sort(),
    ["y1", "y2"]
  );
  // Narrowing never reorders what is left (the "Polecane" order of the whole list is kept).
  const order = cards.map((c) => c.slug);
  const personalOrder = applyAccountType(cards, "PERSONAL").map((c) => c.slug);
  assert.deepEqual(personalOrder, order.filter((slug) => personalOrder.includes(slug)));
  // An old link with one type still narrows to exactly that type.
  assert.deepEqual(applyAccountType(cards, "YOUNG").map((c) => c.slug).sort(), ["y1", "y2"]);
  assert.equal(applyAccountType(cards, "SAVINGS").length, 0);
});

test("the home page, both hubs, /porownaj and the quiz count the same 16 and 7", () => {
  const cards = catalogue();

  // hubs
  assert.equal(selectHubCards(cards, "personal").length, 16);
  assert.equal(selectHubCards(cards, "business").length, 7);
  for (const type of ALL_ACCOUNT_TYPES) assert.equal(hubKindOf(type), segmentOf(type) === "BUSINESS" ? "business" : "personal", type);

  // home
  const home = buildHomeModel(cards, NOW, () => true);
  const personal = home.segments.find((s) => s.value === "PERSONAL")!;
  const business = home.segments.find((s) => s.value === "BUSINESS")!;
  assert.equal(personal.total, 16);
  assert.equal(business.total, 7);
  assert.equal(personal.seeAll.label, "Wszystkie konta osobiste z premią (16)");
  assert.equal(business.seeAll.label, "Wszystkie konta firmowe z premią (7)");
  // "Zobacz wszystkie (N)" is the number of the hub it leads to.
  assert.equal(personal.seeAll.label.includes(`(${selectHubCards(cards, "personal").length})`), true);
  assert.equal(business.seeAll.label.includes(`(${selectHubCards(cards, "business").length})`), true);
  // ... and, without a hub, the number of the tab it leads to.
  const noHubs = buildHomeModel(cards, NOW, () => false);
  assert.equal(noHubs.segments.find((s) => s.value === "PERSONAL")!.seeAll.label, `Zobacz wszystkie (${segmentCounts(cards).PERSONAL})`);
  assert.equal(noHubs.segments.find((s) => s.value === "BUSINESS")!.seeAll.label, `Zobacz wszystkie (${segmentCounts(cards).BUSINESS})`);

  // /porownaj: the pool of a segment is the whole segment
  const pools = {
    PERSONAL: resolveSelection(cards, { typ: "PERSONAL" }, COMPARE_MAX).pool.length,
    BUSINESS: resolveSelection(cards, { typ: "BUSINESS" }, COMPARE_MAX).pool.length
  };
  assert.deepEqual(pools, { PERSONAL: 16, BUSINESS: 7 });
  // a link that names only a youth offer lands on the Osobiste segment
  assert.equal(resolveSelection(cards, { oferty: "y1" }, COMPARE_MAX).segment, "PERSONAL");

  // quiz: "for me" ranks every non-business offer, "for my business" only business ones
  const offers = toQuizOffers(cards, new Map());
  const answers = (audience: QuizAnswers["audience"]): QuizAnswers => ({
    effort: "medium",
    audience,
    canCardPay: true,
    canInflow: true,
    topBonus: false
  });
  assert.equal(matchOffers(offers, answers("personal"), 100).length, 16);
  assert.equal(matchOffers(offers, answers("business"), 100).length, 7);
  assert.ok(matchOffers(offers, answers("personal"), 100).some((m) => m.offer.accountType === "YOUNG"));
});

test("the real account type of an offer is never rewritten (badges and the Polecane groups keep reading it)", () => {
  const cards = catalogue();
  const home = buildHomeModel(cards, NOW, () => true);
  const featured = home.segments.flatMap((s) => s.featured);
  for (const featuredCard of featured) {
    assert.equal(featuredCard, cards.find((c) => c.slug === featuredCard.slug), "same object, same accountType");
  }
  assert.ok(applyAccountType(cards, "PERSONAL").some((c) => c.accountType === "YOUNG"));
  assert.ok(!applyAccountType(cards, "PERSONAL").some((c) => c.accountType === "BUSINESS"));
});
