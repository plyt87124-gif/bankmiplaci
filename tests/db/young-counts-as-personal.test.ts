/**
 * Owner, 2026-11-11: a young account of a bank counts as a personal account of that bank for karencja and for "I am
 * already a client". The user's mBank history (personal account, in karencja) must now close the same bank's offer for
 * young people, in the marks on the cards, in the "only those I can join" filter, in the ściąga restart lock and in the
 * offer page's history row. The offer keeps its real type (the badge says "Konto dla młodych"). Real database.
 */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { getBankHistory } from "../../src/app/promocje/[slug]/offerData";
import { listBlockedPromotionSlugs, listEligibilityMarks } from "../../src/lib/services/blockedPromotions";
import { checklistRestartAllowed } from "../../src/lib/services/checklistTracking";
import { client, cleanup, makePromotion, makeUser, PREFIX } from "./helpers";

before(cleanup);
after(async () => {
  await cleanup();
  await client.$disconnect();
});

const NOW = new Date("2026-10-02T12:00:00Z");
const D = (s: string) => new Date(`${s}T00:00:00Z`);
const FAR = { endDate: D("2099-12-31") }; // the marks read the live "open offers" rule: never let a fixture expire

async function setup(tag: string, history: Array<{ accountType: "PERSONAL" | "YOUNG" | "SAVINGS" | "BUSINESS" | "JOINT"; from?: string; until?: string }>) {
  const bankSlug = `${PREFIX}ycp-${tag}`;
  const personal = await makePromotion(`ycp-${tag}-personal`, { accountType: "PERSONAL", cooldownMonths: 12, ...FAR }, bankSlug);
  const young = await makePromotion(`ycp-${tag}-young`, { accountType: "YOUNG", cooldownMonths: 12, ...FAR }, bankSlug);
  const business = await makePromotion(`ycp-${tag}-business`, { accountType: "BUSINESS", cooldownMonths: 12, ...FAR }, bankSlug);
  // another bank: never touched by the history of the first
  const other = await makePromotion(`ycp-${tag}-other`, { accountType: "YOUNG", cooldownMonths: 12, ...FAR }, `${bankSlug}-other`);
  const user = await makeUser(`ycp-${tag}`);
  for (const h of history) {
    await client.userBankHistory.create({
      data: {
        userId: user.id,
        bankId: personal.bankId,
        accountType: h.accountType,
        wasClientFrom: h.from ? D(h.from) : null,
        wasClientUntil: h.until ? D(h.until) : null
      }
    });
  }
  return { user, personal, young, business, other };
}

const reasons = async (userId: string) =>
  Object.fromEntries((await listEligibilityMarks(userId, NOW)).map((m) => [m.slug, m.reason]));

test("a personal account in karencja closes the young offer of the same bank (the owner's mBank case)", async () => {
  const { user, personal, young, business, other } = await setup("a", [{ accountType: "PERSONAL", from: "2020-01-01", until: "2026-08-15" }]);
  const marks = await reasons(user.id);
  assert.equal(marks[personal.slug], "karencja");
  assert.equal(marks[young.slug], "karencja", "the young offer is closed too");
  assert.equal(marks[business.slug], undefined, "a business offer is a different account");
  assert.equal(marks[other.slug], undefined, "another bank is untouched");
  assert.ok((await listBlockedPromotionSlugs(user.id, NOW)).includes(young.slug), "the 'only those I can join' filter hides it");
  // the offer keeps its real type
  const row = await client.promotion.findUniqueOrThrow({ where: { id: young.id }, select: { accountType: true } });
  assert.equal(row.accountType, "YOUNG");
});

test("a current personal client is a current client of the young offer too", async () => {
  const { user, personal, young } = await setup("b", [{ accountType: "PERSONAL", from: "2024-01-01" }]);
  const marks = await reasons(user.id);
  assert.equal(marks[personal.slug], "client");
  assert.equal(marks[young.slug], "client");
});

test("it works the other way round: a young account in karencja closes the personal offer", async () => {
  const { user, personal, young } = await setup("c", [{ accountType: "YOUNG", from: "2022-01-01", until: "2026-08-15" }]);
  const marks = await reasons(user.id);
  assert.equal(marks[young.slug], "karencja");
  assert.equal(marks[personal.slug], "karencja");
});

test("a savings or a business account is not folded in: it closes neither the personal nor the young offer", async () => {
  const { user, personal, young } = await setup("d", [
    { accountType: "SAVINGS", from: "2024-01-01" },
    { accountType: "BUSINESS", from: "2024-01-01", until: "2026-08-15" }
  ]);
  const marks = await reasons(user.id);
  assert.equal(marks[personal.slug], undefined);
  assert.equal(marks[young.slug], undefined);
});

test("two rows of the same kind: the one that stands in the way decides (old closure + recent closure)", async () => {
  const { user, personal, young } = await setup("e", [
    { accountType: "PERSONAL", from: "2010-01-01", until: "2015-01-01" },
    { accountType: "YOUNG", from: "2022-01-01", until: "2026-08-15" }
  ]);
  const marks = await reasons(user.id);
  assert.equal(marks[personal.slug], "karencja");
  assert.equal(marks[young.slug], "karencja");
});

test("the ściąga restart lock and the offer page row read the same kind-aware rule", async () => {
  const { user, personal, young } = await setup("f", [{ accountType: "PERSONAL", from: "2020-01-01", until: "2026-08-15" }]);
  await client.userPromotionTracking.create({
    data: { userId: user.id, promotionId: young.id, accountOpenedAt: D("2026-01-10"), completedAt: D("2026-02-20") }
  });
  const restart = await checklistRestartAllowed(client, user.id, young.id, NOW);
  assert.equal(restart.allowed, false, "completed young ściąga stays locked while the personal account is in karencja");
  assert.equal(restart.eligibility?.status, "not-eligible");

  const row = await getBankHistory(user.id, young.bankId, "YOUNG", { cooldownMonths: 12, cooldownCutoffDate: null }, NOW);
  assert.equal(row?.accountType, "PERSONAL", "the offer page banner is driven by the personal row");
  assert.equal(row?.wasClientUntil?.toISOString().slice(0, 10), "2026-08-15");
  void personal;
});
