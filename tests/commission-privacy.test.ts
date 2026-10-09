import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { Prisma } from "@prisma/client";
import { recommendedScores, sortRecommended } from "../src/lib/recommended";
import { finalizeCards, PROMOTION_CARD_SELECT, type CardRow } from "../src/lib/services/promotionCards";
import { stripPrivateFields } from "../src/lib/services/promotions";
import { db } from "../src/lib/db";

/**
 * Invariants of the partner commission (affiliateCommissionCents):
 *   1. it never influences the public "ocena serwisu";
 *   2. it never reaches a public function result, page prop or API response;
 *   3. offers without a commission still sort by rating.
 * No database is needed: the queries are covered through pure functions and a
 * stubbed Prisma delegate.
 */

const SECRET = 987_654_321; // easy to grep for in serialized output

function row(slug: string, rating: number, commission: number | null, over: Partial<CardRow> = {}): CardRow {
  return {
    slug,
    name: `Promocja ${slug}`,
    summary: "Opis",
    maxBonusCents: 50_000,
    difficulty: "EASY",
    accountType: "PERSONAL",
    rating: new Prisma.Decimal(rating),
    ratingReason: null,
    endDate: new Date("2099-01-31T00:00:00.000Z"),
    lastVerifiedAt: new Date("2026-10-01T00:00:00.000Z"),
    affiliateCommissionCents: commission,
    fees: { accountFeeCents: 0, accountFeeWaiverCondition: null, cardFeeCents: null, cardFeeWaiverCondition: null },
    conditions: [{ title: "Załóż konto" }],
    bank: { name: "Bank", slug: "bank", logoUrl: null },
    ...over
  };
}

// ---------------------------------------------------------------- invariant 1

test("the rating algorithm does not read the partner commission", () => {
  const src = readFileSync(join(__dirname, "..", "src", "lib", "services", "ratings.ts"), "utf8");
  assert.doesNotMatch(src, /commission/i);
  assert.doesNotMatch(src, /affiliate/i);
});

test("ordering by commission never changes the rating values of the offers", () => {
  const items = [
    { id: "a", accountType: "PERSONAL", rating: 9.1, maxBonusCents: 50_000, commissionCents: 1_000 },
    { id: "b", accountType: "PERSONAL", rating: 9.0, maxBonusCents: 50_000, commissionCents: 50_000 }
  ];
  const before = JSON.stringify(items.map((i) => [i.id, i.rating]));
  const sorted = sortRecommended(items);
  assert.equal(sorted[0]!.id, "b"); // the commission did lift b above a ...
  const ratingsById = new Map(sorted.map((i) => [i.id, i.rating]));
  assert.equal(JSON.stringify(items.map((i) => [i.id, ratingsById.get(i.id)])), before); // ... but no rating moved
});

test("the card's rating is the stored rating, whatever the commission", () => {
  const withCommission = finalizeCards([row("x", 9.2, 90_000)], "top-rated")[0]!;
  const without = finalizeCards([row("x", 9.2, null)], "top-rated")[0]!;
  assert.equal(withCommission.rating, 9.2);
  assert.equal(withCommission.rating, without.rating);
});

// ---------------------------------------------------------------- invariant 2

test("card data carries no commission and no affiliate link, for every sort", () => {
  const rows = [row("a", 9.3, SECRET), row("b", 8.4, null), row("c", 9.0, 5_000)];
  for (const sort of [undefined, "recommended", "top-rated", "highest-bonus", "easiest", "newest", "ending-soon"] as const) {
    const cards = finalizeCards(rows, sort);
    assert.equal(cards.length, 3);
    const json = JSON.stringify(cards);
    assert.doesNotMatch(json, /commission/i, `sort=${sort}`);
    assert.doesNotMatch(json, /affiliate/i, `sort=${sort}`);
    assert.equal(json.includes(String(SECRET)), false, `sort=${sort}`);
    for (const card of cards) {
      assert.equal("affiliateCommissionCents" in card, false);
      assert.equal("affiliateUrl" in card, false);
    }
  }
});

test("a card has exactly the documented public fields", () => {
  const [card] = finalizeCards([row("a", 9.3, SECRET)], "top-rated");
  assert.deepEqual(Object.keys(card!).sort(), [
    "accountType",
    "bank",
    "conditions",
    "difficulty",
    "endDate",
    "fees",
    "lastVerifiedAt",
    "maxBonusCents",
    "name",
    "rating",
    "ratingReason",
    "slug",
    "summary"
  ]);
  assert.deepEqual(Object.keys(card!.bank).sort(), ["logoUrl", "name", "slug"]);
  assert.deepEqual(Object.keys(card!.fees!).sort(), [
    "accountFeeCents",
    "accountFeeWaiverCondition",
    "cardFeeCents",
    "cardFeeWaiverCondition"
  ]);
});

test("the card query never selects the affiliate link and reads only the commission it needs for ordering", () => {
  const selected = Object.keys(PROMOTION_CARD_SELECT);
  assert.equal(selected.includes("affiliateUrl"), false);
  assert.equal(selected.includes("affiliateLinkEnabled"), false);
  assert.equal(selected.includes("sourceUrl"), false);
  assert.equal(selected.includes("affiliateCommissionCents"), true); // ordering input, stripped in finalizeCards
});

test("a fee row that is missing stays null instead of becoming a free account", () => {
  const [card] = finalizeCards([row("a", 9, null, { fees: null })], "top-rated");
  assert.equal(card!.fees, null);
});

test("stripPrivateFields drops the commission and nothing else", () => {
  const out = stripPrivateFields({ id: "1", affiliateUrl: "https://x", affiliateCommissionCents: SECRET });
  assert.deepEqual(out, { id: "1", affiliateUrl: "https://x" });
});

test("/api/promotions/active returns public cards with a CDN cache header", async () => {
  // The Prisma delegate is a lazy proxy, so swap the whole delegate rather than one method.
  const findMany = mock.fn(async () => [row("a", 9.3, SECRET), row("b", 9.5, null)]);
  const original = Object.getOwnPropertyDescriptor(db, "promotion");
  Object.defineProperty(db, "promotion", { value: { findMany }, configurable: true, writable: true });
  try {
    const { GET } = await import("../src/app/api/promotions/active/route");
    const res = await GET();
    assert.equal(res.headers.get("cache-control"), "public, s-maxage=300, stale-while-revalidate=600");
    const text = await res.text();
    assert.doesNotMatch(text, /commission/i);
    assert.doesNotMatch(text, /affiliate/i);
    assert.equal(text.includes(String(SECRET)), false);
    const body = JSON.parse(text) as { promotions: { slug: string; rating: number; endDate: string }[] };
    assert.deepEqual(body.promotions.map((p) => p.slug), ["a", "b"]); // order as returned by the "top-rated" query
    assert.equal(typeof body.promotions[0]!.endDate, "string");
    assert.equal(findMany.mock.callCount(), 1);
  } finally {
    if (original) Object.defineProperty(db, "promotion", original);
    else delete (db as unknown as Record<string, unknown>).promotion;
  }
});

test("only server-side data and admin code reference the commission field", () => {
  const srcRoot = join(__dirname, "..", "src");
  const allowed = new Set(
    [
      "app/admin/(dashboard)/promocje/PromotionForm.tsx",
      "app/admin/(dashboard)/promocje/actions.ts",
      "lib/promotionForm.ts",
      "lib/recommended.ts",
      "lib/services/promotionCards.ts",
      "lib/services/promotionWrite.ts",
      "lib/services/promotions.ts",
      "lib/validation/promotion.ts"
    ].map((p) => p.split("/").join(sep))
  );
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(name) && /affiliateCommission/.test(readFileSync(full, "utf8"))) {
        const rel = relative(srcRoot, full);
        if (!allowed.has(rel)) offenders.push(rel);
      }
    }
  };
  walk(srcRoot);
  assert.deepEqual(offenders, [], "these files reference affiliateCommissionCents; public code must not");
});

// ---------------------------------------------------------------- invariant 3

test("without any commission the 'Polecane' order is the rating order (then bonus)", () => {
  const rows = [
    row("low", 8.2, null),
    row("tie-small", 9.0, null, { maxBonusCents: 10_000 }),
    row("top", 9.6, null),
    row("tie-big", 9.0, null, { maxBonusCents: 90_000 })
  ];
  for (const sort of [undefined, "recommended"] as const) {
    assert.deepEqual(finalizeCards(rows, sort).map((c) => c.slug), ["top", "tie-big", "tie-small", "low"]);
  }
});

test("the commission only moves 'Polecane': every other sort keeps the query order", () => {
  const rows = [row("a", 9.0, 1_000), row("b", 9.5, 90_000), row("c", 8.0, null)];
  for (const sort of ["top-rated", "highest-bonus", "easiest", "newest", "ending-soon"] as const) {
    assert.deepEqual(finalizeCards(rows, sort).map((c) => c.slug), ["a", "b", "c"], `sort=${sort}`);
  }
});

test("an offer with no commission is neither boosted nor buried against one with a commission", () => {
  const [known, unknown] = recommendedScores([
    { accountType: "PERSONAL", rating: 9, maxBonusCents: 1, commissionCents: 10_000 },
    { accountType: "PERSONAL", rating: 9, maxBonusCents: 1, commissionCents: null }
  ]);
  assert.ok(known! > unknown!);
  // a clearly better-rated offer without a commission still wins
  const out = finalizeCards([row("paid", 7.0, 90_000), row("unpaid", 9.6, null)], "recommended");
  assert.equal(out[0]!.slug, "unpaid");
});
