/**
 * Supplying the real account-opening date for an older, unfinished ściąga
 * ("Moje konto"): real database, same service as POST /api/checklist/opened-at.
 * Availability of months, Kantor steps and rewards is never stored - it is
 * derived from accountOpenedAt by checklistAvailability.ts / checklistSchedule.ts -
 * so these tests read it through those functions before and after the save.
 */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { setAccountOpenedAt } from "../../src/lib/services/checklistTracking";
import { earnedCentsFor, resolveGroups, stepAvailability } from "../../src/lib/checklistAvailability";
import { unlockDateForGroup } from "../../src/lib/checklistSchedule";
import { client, cleanup, makePromotion, makeUser, PREFIX } from "./helpers";

before(cleanup);
after(async () => {
  await cleanup();
  await client.$disconnect();
});

const NOW = new Date("2026-10-02T12:00:00Z");
const D = (s: string) => new Date(`${s}T00:00:00Z`);
const KANTOR_DEADLINE = D("2026-09-30");

/** Erste-shaped ściąga: group 0 = account + Kantor (own deadline) + 300 zł reward, group 1 = two steps + 200 zł reward. */
async function sheet(tag: string) {
  const promo = await makePromotion(`oa-${tag}`, {
    checklistSteps: {
      create: [
        { monthLabel: "Otwarcie konta", title: "Otwórz konto", order: 0 },
        { monthLabel: "Otwarcie konta", title: "Kantor", order: 1, availableUntil: KANTOR_DEADLINE },
        { monthLabel: "Otwarcie konta", title: "Odbierz nagrodę: Kantor", order: 2, rewardCents: 30000, availableUntil: KANTOR_DEADLINE },
        { monthLabel: "Miesiąc 1", title: "Płatności kartą", order: 10 },
        { monthLabel: "Miesiąc 1", title: "Wpływ", order: 11 },
        { monthLabel: "Miesiąc 1", title: "Odbierz nagrodę: miesiąc 1", order: 14, rewardCents: 20000 }
      ]
    }
  });
  const steps = await client.checklistStep.findMany({ where: { promotionId: promo.id }, orderBy: { order: "asc" } });
  const byTitle = Object.fromEntries(steps.map((s) => [s.title, s]));
  return { promo, steps, byTitle };
}

/** An older unfinished ściąga: no accountOpenedAt, some ticks already saved (including the Kantor step). */
async function legacyTracking(tag: string, ticks: string[]) {
  const user = await makeUser(tag);
  const s = await sheet(tag);
  const tracking = await client.userPromotionTracking.create({
    data: { userId: user.id, promotionId: s.promo.id, joinedAt: new Date("2026-09-05T10:11:12Z"), remindedGroupIndexes: [1] }
  });
  for (const t of ticks) await client.checklistProgress.create({ data: { userId: user.id, stepId: s.byTitle[t]!.id } });
  return { user, tracking, ...s };
}

const state = async (userId: string, trackingId: string) => {
  const t = await client.userPromotionTracking.findUniqueOrThrow({ where: { id: trackingId } });
  const progress = await client.checklistProgress.findMany({ where: { userId }, orderBy: { stepId: "asc" } });
  return { t, progress };
};
const earned = async (userId: string, openedAt: Date | null, steps: { id: string; order: number; rewardCents: number | null; availableUntil: Date | null }[]) => {
  const checked = new Set((await client.checklistProgress.findMany({ where: { userId } })).map((p) => p.stepId));
  return earnedCentsFor(steps, openedAt, checked);
};

const TICKS = ["Otwórz konto", "Kantor", "Płatności kartą", "Wpływ"];

test("a date BEFORE the Kantor deadline: saved, Kantor required and its reward counted, ticks/id/joinedAt untouched", async () => {
  const { user, tracking, steps } = await legacyTracking("a1", TICKS);
  const before = await state(user.id, tracking.id);
  assert.equal(before.t.accountOpenedAt, null);
  // unknown date: a deadline reward counts only because the user explicitly ticked the Kantor step (nothing is assumed)
  assert.equal(await earned(user.id, null, steps), 30000 + 20000);

  const r = await setAccountOpenedAt(client, user.id, tracking.id, "2026-09-12", NOW);
  assert.deepEqual(r, { ok: true });

  const after = await state(user.id, tracking.id);
  assert.equal(after.t.accountOpenedAt?.toISOString(), "2026-09-12T00:00:00.000Z");
  assert.equal(after.t.id, before.t.id);
  assert.equal(after.t.joinedAt.toISOString(), before.t.joinedAt.toISOString(), "joinedAt is not the opening date and is never touched");
  assert.deepEqual(after.t.remindedGroupIndexes, [1]);
  assert.equal(after.t.completedAt, null);
  assert.deepEqual(after.progress, before.progress, "every saved tick is exactly as it was (same rows, same checkedAt)");

  const groups = resolveGroups(steps, after.t.accountOpenedAt);
  assert.deepEqual(groups[0]!.requiredSteps.map((s) => s.title), ["Otwórz konto", "Kantor"]);
  assert.equal(groups[0]!.rewardAvailability, "available");
  assert.equal(await earned(user.id, after.t.accountOpenedAt, steps), 30000 + 20000, "both rewards now counted");
});

test("a user who never ticked Kantor: the date does not invent the Kantor reward", async () => {
  const { user, tracking, steps } = await legacyTracking("a3", ["Otwórz konto", "Płatności kartą", "Wpływ"]);
  assert.equal(await earned(user.id, null, steps), 20000);
  await setAccountOpenedAt(client, user.id, tracking.id, "2026-09-12", NOW);
  const opened = (await state(user.id, tracking.id)).t.accountOpenedAt;
  assert.equal(await earned(user.id, opened, steps), 20000, "eligible for Kantor now, but the step is still unticked");
});

test("a date AFTER the Kantor deadline: Kantor step and reward drop out, but the saved Kantor tick is kept", async () => {
  const { user, tracking, steps, byTitle } = await legacyTracking("a2", TICKS);
  const before = await state(user.id, tracking.id);

  const r = await setAccountOpenedAt(client, user.id, tracking.id, "2026-10-01", NOW);
  assert.deepEqual(r, { ok: true });

  const after = await state(user.id, tracking.id);
  assert.equal(after.t.accountOpenedAt?.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.deepEqual(after.progress, before.progress, "the Kantor tick is NOT deleted");
  assert.ok(after.progress.some((p) => p.stepId === byTitle["Kantor"]!.id));

  assert.equal(stepAvailability(byTitle["Kantor"]!, after.t.accountOpenedAt), "unavailable");
  const groups = resolveGroups(steps, after.t.accountOpenedAt);
  assert.deepEqual(groups[0]!.visibleSteps.map((s) => s.title), ["Otwórz konto"], "Kantor hidden");
  assert.equal(groups[0]!.rewardStep, null, "Kantor reward unavailable");
  assert.equal(await earned(user.id, after.t.accountOpenedAt, steps), 20000, "only the month-1 reward counts");
});

test("the last day of the Kantor offer (30.09) is still before the deadline; 01.10 is after it", async () => {
  const { user: u1, tracking: t1, byTitle } = await legacyTracking("b1", []);
  await setAccountOpenedAt(client, u1.id, t1.id, "2026-09-30", NOW);
  const d1 = (await state(u1.id, t1.id)).t.accountOpenedAt;
  assert.equal(stepAvailability(byTitle["Kantor"]!, d1), "available");

  const { user: u2, tracking: t2, byTitle: bt2 } = await legacyTracking("b2", []);
  await setAccountOpenedAt(client, u2.id, t2.id, "2026-10-01", NOW);
  assert.equal(stepAvailability(bt2["Kantor"]!, (await state(u2.id, t2.id)).t.accountOpenedAt), "unavailable");
});

test("months open according to the saved date (existing schedule rules), ticks of later months stay", async () => {
  const { user, tracking } = await legacyTracking("m1", TICKS);
  await setAccountOpenedAt(client, user.id, tracking.id, "2026-08-20", NOW);
  const opened = (await state(user.id, tracking.id)).t.accountOpenedAt!;
  // month 1 opens on the first day of the month after opening: 1 Sep 2026 - already past on NOW
  assert.ok(unlockDateForGroup(opened, 1).getTime() <= NOW.getTime());
  const later = await setAccountOpenedAt(client, (await makeUser("m2")).id, "does-not-exist", "2026-08-20", NOW);
  assert.equal(later.ok, false);
});

test("future, impossible and malformed dates are rejected and nothing is written", async () => {
  const { user, tracking } = await legacyTracking("r1", TICKS);
  const before = await state(user.id, tracking.id);
  for (const bad of ["2026-10-03", "2027-01-01", "2026-02-31", "02.10.2026", "", "abc", null, undefined, 1790000000000, "1999-01-01"]) {
    const r = await setAccountOpenedAt(client, user.id, tracking.id, bad, NOW);
    assert.equal(r.ok, false, String(bad));
    if (!r.ok) assert.equal(r.status, 400, String(bad));
  }
  assert.deepEqual(await state(user.id, tracking.id), before);
});

test("someone else's ściąga cannot be changed (reported as not found, row untouched)", async () => {
  const owner = await legacyTracking("o1", TICKS);
  const intruder = await makeUser("o2");
  const before = await state(owner.user.id, owner.tracking.id);

  const r = await setAccountOpenedAt(client, intruder.id, owner.tracking.id, "2026-09-12", NOW);
  assert.deepEqual(r, { ok: false, status: 404, error: "Nie znaleziono ściągi." });
  assert.deepEqual(await state(owner.user.id, owner.tracking.id), before);
  assert.equal(await client.checklistProgress.count({ where: { userId: intruder.id } }), 0);

  // an id that does not exist looks identical to the intruder
  assert.deepEqual(await setAccountOpenedAt(client, intruder.id, "no-such-id", "2026-09-12", NOW), r);
});

test("an already saved date is never overwritten", async () => {
  const { user, tracking } = await legacyTracking("w1", TICKS);
  assert.equal((await setAccountOpenedAt(client, user.id, tracking.id, "2026-09-12", NOW)).ok, true);
  const again = await setAccountOpenedAt(client, user.id, tracking.id, "2026-10-01", NOW);
  assert.equal(again.ok, false);
  if (!again.ok) assert.equal(again.status, 409);
  assert.equal((await state(user.id, tracking.id)).t.accountOpenedAt?.toISOString(), "2026-09-12T00:00:00.000Z");
});

test("a tracking created WITH a date (the join flow) is not touched by this endpoint", async () => {
  const user = await makeUser("w2");
  const { promo } = await sheet("w2");
  const t = await client.userPromotionTracking.create({ data: { userId: user.id, promotionId: promo.id, accountOpenedAt: D("2026-09-01") } });
  const r = await setAccountOpenedAt(client, user.id, t.id, "2026-09-25", NOW);
  assert.equal(r.ok, false);
  assert.equal((await state(user.id, t.id)).t.accountOpenedAt?.toISOString(), "2026-09-01T00:00:00.000Z");
});

test("a completed ściąga is not changed", async () => {
  const user = await makeUser("w3");
  const { promo } = await sheet("w3");
  const t = await client.userPromotionTracking.create({ data: { userId: user.id, promotionId: promo.id, completedAt: D("2026-09-20") } });
  const r = await setAccountOpenedAt(client, user.id, t.id, "2026-09-01", NOW);
  assert.equal(r.ok, false);
  assert.equal((await state(user.id, t.id)).t.accountOpenedAt, null);
});

test("two saves racing for the same ściąga: exactly one wins", async () => {
  const { user, tracking } = await legacyTracking("x1", []);
  const results = await Promise.all([
    setAccountOpenedAt(client, user.id, tracking.id, "2026-09-10", NOW),
    setAccountOpenedAt(client, user.id, tracking.id, "2026-09-11", NOW)
  ]);
  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.ok(["2026-09-10", "2026-09-11"].includes((await state(user.id, tracking.id)).t.accountOpenedAt!.toISOString().slice(0, 10)));
});

test("test users are namespaced (sanity: this file only touches dbt- data)", async () => {
  assert.ok((await client.user.findMany({ where: { email: { startsWith: PREFIX } } })).length > 0);
});
