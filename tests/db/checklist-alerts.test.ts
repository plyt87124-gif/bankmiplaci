/**
 * GET /api/checklist/alerts reads through getChecklistAlerts (src/lib/services/checklistAlerts.ts),
 * against a real database: one user's approaching ściąga deadlines, never someone else's, never for a
 * finished ściąga, and without writing anything (unlike the e-mail reminder it stamps no group index).
 */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { getChecklistAlerts } from "../../src/lib/services/checklistAlerts";
import { client, cleanup, makePromotion, makeUser } from "./helpers";

before(cleanup);
after(async () => {
  await cleanup();
  await client.$disconnect();
});

// Opened 15.09.2026 (calendar schedule): group 1 = October, open 1.10 - 31.10.
const OPENED = new Date("2026-09-15T00:00:00Z");
const NOW = new Date("2026-10-27T12:00:00Z"); // 5 days left

async function setup(tag: string) {
  const user = await makeUser(tag);
  const promo = await makePromotion(`al-${tag}`);
  const mk = (monthLabel: string, order: number, title: string, rewardCents: number | null = null) =>
    client.checklistStep.create({ data: { promotionId: promo.id, monthLabel, order, title, rewardCents } });
  const open = await mk("Otwarcie konta", 0, "Złóż wniosek");
  const a = await mk("Miesiąc 1", 10, "Zrób 7 płatności kartą");
  const b = await mk("Miesiąc 1", 11, "Wpłać 1000 zł");
  await mk("Miesiąc 1", 12, "Odbierz: 75 zł", 7500);
  const tracking = await client.userPromotionTracking.create({
    data: { userId: user.id, promotionId: promo.id, accountOpenedAt: OPENED }
  });
  return { user, promo, tracking, open, a, b };
}

test("alerty: niezaznaczone kroki miesiąca z terminem za 5 dni dają jeden alert z nazwą banku i promocji", async () => {
  const { user, tracking, promo } = await setup("one");
  const items = await getChecklistAlerts(user.id, NOW);
  assert.equal(items.length, 1);
  assert.equal(items[0]!.trackingId, tracking.id);
  assert.equal(items[0]!.promotionSlug, promo.slug);
  assert.equal(items[0]!.bankName, "DBT Bank");
  assert.equal(items[0]!.daysLeft, 5);
  assert.equal(items[0]!.lastDay, "2026-10-31");
  assert.equal(items[0]!.openSteps, 2);
});

test("alerty: zaznaczenie kroków gasi alert, a odczyt niczego nie zapisuje (remindedGroupIndexes bez zmian)", async () => {
  const { user, tracking, a, b } = await setup("ticked");
  await client.checklistProgress.create({ data: { userId: user.id, stepId: a.id } });
  assert.equal((await getChecklistAlerts(user.id, NOW)).length, 1, "jeden krok jeszcze czeka");
  await client.checklistProgress.create({ data: { userId: user.id, stepId: b.id } });
  assert.deepEqual(await getChecklistAlerts(user.id, NOW), []);
  const after = await client.userPromotionTracking.findUniqueOrThrow({ where: { id: tracking.id } });
  assert.deepEqual(after.remindedGroupIndexes, []);
});

test("alerty: zakończona ściąga, ściąga bez daty otwarcia i termin dalej niż 7 dni nie dają alertu", async () => {
  const done = await setup("done");
  await client.userPromotionTracking.update({ where: { id: done.tracking.id }, data: { completedAt: new Date("2026-10-20T00:00:00Z") } });
  assert.deepEqual(await getChecklistAlerts(done.user.id, NOW), []);

  const nodate = await setup("nodate");
  await client.userPromotionTracking.update({ where: { id: nodate.tracking.id }, data: { accountOpenedAt: null } });
  assert.deepEqual(await getChecklistAlerts(nodate.user.id, NOW), []);

  const far = await setup("far");
  assert.deepEqual(await getChecklistAlerts(far.user.id, new Date("2026-10-10T12:00:00Z")), []);
});

test("alerty: widać tylko własne ściągi użytkownika, a postęp innej osoby nie gasi cudzego alertu", async () => {
  const mine = await setup("mine");
  const other = await makeUser("other");
  // The other user ticks the very same steps of the very same promotion: that must not touch mine.
  await client.userPromotionTracking.create({ data: { userId: other.id, promotionId: mine.promo.id, accountOpenedAt: OPENED } });
  await client.checklistProgress.createMany({
    data: [
      { userId: other.id, stepId: mine.a.id },
      { userId: other.id, stepId: mine.b.id }
    ]
  });
  assert.equal((await getChecklistAlerts(mine.user.id, NOW)).length, 1);
  assert.deepEqual(await getChecklistAlerts(other.id, NOW), []);
  assert.deepEqual(await getChecklistAlerts("no-such-user", NOW), []);
});
