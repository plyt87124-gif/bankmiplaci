/**
 * The write behind POST /api/checklist/join (joinChecklist), against a real
 * database. The route is a thin wrapper around it, so this is the actual write
 * path. It must agree with /opened-at: same date validation (parseAccountOpenedAt,
 * Warsaw calendar day), a saved date is never silently replaced, writes are
 * atomic under concurrent requests, and a permitted restart of a COMPLETED
 * ściąga still sets the date of the new cycle.
 */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { joinChecklist, LOCKED_ERROR, DATE_ALREADY_SAVED_ERROR } from "../../src/lib/services/checklistTracking";
import { client, cleanup, makePromotion, makeUser, PREFIX } from "./helpers";

before(cleanup);
after(async () => {
  await cleanup();
  await client.$disconnect();
});

const NOW = new Date("2026-10-02T12:00:00Z");
const D = (s: string) => new Date(`${s}T00:00:00Z`);
const JOINED = new Date("2026-09-05T10:11:12Z");

async function setup(tag: string, o: { months?: number | null; cutoff?: string | null } = {}) {
  const user = await makeUser(tag);
  const promo = await makePromotion(
    `jn-${tag}`,
    {
      cooldownMonths: o.months ?? null,
      cooldownCutoffDate: o.cutoff ? D(o.cutoff) : null,
      checklistSteps: {
        create: [
          { monthLabel: "Otwarcie konta", title: "Otwórz konto", order: 0 },
          { monthLabel: "Otwarcie konta", title: "Kantor", order: 1, availableUntil: D("2026-09-30") },
          { monthLabel: "Miesiąc 1", title: "Płatności kartą", order: 10 }
        ]
      }
    },
    `${PREFIX}jn-${tag}`
  );
  const steps = await client.checklistStep.findMany({ where: { promotionId: promo.id }, orderBy: { order: "asc" } });
  return { user, promo, steps };
}

const tick = (userId: string, stepIds: string[]) =>
  client.checklistProgress.createMany({ data: stepIds.map((stepId) => ({ userId, stepId })) });

const snapshot = async (userId: string, promotionId: string) => {
  const t = await client.userPromotionTracking.findUnique({ where: { userId_promotionId: { userId, promotionId } } });
  const ticks = (await client.checklistProgress.findMany({ where: { userId }, orderBy: { stepId: "asc" } })).map((p) => ({
    stepId: p.stepId,
    checkedAt: p.checkedAt.toISOString()
  }));
  return { t, ticks };
};
const dayOf = (d: Date | null | undefined) => d?.toISOString().slice(0, 10) ?? null;

// ---------------------------------------------------------------- validation (shared with /opened-at)

test("a new ściąga is created with the date stored as 00:00 UTC", async () => {
  const { user, promo } = await setup("c1");
  assert.deepEqual(await joinChecklist(client, user.id, promo.id, "2026-09-12", NOW), { ok: true, outcome: "created" });
  const { t } = await snapshot(user.id, promo.id);
  assert.equal(t?.accountOpenedAt?.toISOString(), "2026-09-12T00:00:00.000Z");
});

test("an impossible date (2026-02-31) is rejected and nothing is created", async () => {
  const { user, promo } = await setup("v1");
  const r = await joinChecklist(client, user.id, promo.id, "2026-02-31", NOW);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.status, 400);
  assert.equal((await snapshot(user.id, promo.id)).t, null);
});

test("other malformed and future dates are rejected", async () => {
  const { user, promo } = await setup("v2");
  for (const bad of ["2026-10-03", "2027-01-01", "02.10.2026", "", "abc", "2026-13-01", "1999-12-31", null, undefined, 123]) {
    const r = await joinChecklist(client, user.id, promo.id, bad, NOW);
    assert.equal(r.ok, false, String(bad));
    if (!r.ok) assert.equal(r.status, 400, String(bad));
  }
  assert.equal((await snapshot(user.id, promo.id)).t, null);
});

test("today's date right after midnight in Poland (still yesterday in UTC) is accepted; tomorrow is not", async () => {
  const justAfterWarsawMidnight = new Date("2026-10-02T22:30:00Z"); // 00:30 on 3 Oct in Poland
  const a = await setup("m1");
  assert.deepEqual(await joinChecklist(client, a.user.id, a.promo.id, "2026-10-03", justAfterWarsawMidnight), { ok: true, outcome: "created" });
  assert.equal(dayOf((await snapshot(a.user.id, a.promo.id)).t?.accountOpenedAt), "2026-10-03");

  const b = await setup("m2");
  const r = await joinChecklist(client, b.user.id, b.promo.id, "2026-10-04", justAfterWarsawMidnight);
  assert.equal(r.ok, false);
  assert.equal((await snapshot(b.user.id, b.promo.id)).t, null);
});

test("an unknown promotion is a 404", async () => {
  const { user } = await setup("v3");
  const r = await joinChecklist(client, user.id, "no-such-promotion", "2026-09-12", NOW);
  assert.deepEqual(r, { ok: false, status: 404, error: "Nie znaleziono promocji." });
});

// ---------------------------------------------------------------- a saved date is never replaced

test("repeating the request with a DIFFERENT date does not overwrite the saved one; ticks and joinedAt stay", async () => {
  const { user, promo, steps } = await setup("o1");
  await client.userPromotionTracking.create({ data: { userId: user.id, promotionId: promo.id, joinedAt: JOINED, accountOpenedAt: D("2026-09-12") } });
  await tick(user.id, [steps[0]!.id, steps[1]!.id, steps[2]!.id]);
  const before = await snapshot(user.id, promo.id);

  const r = await joinChecklist(client, user.id, promo.id, "2026-10-01", NOW);
  assert.deepEqual(r, { ok: false, status: 409, error: DATE_ALREADY_SAVED_ERROR });
  assert.deepEqual(await snapshot(user.id, promo.id), before, "tracking row and every tick exactly as before");
});

test("the Kantor step stays available: a later request cannot move the date past the 30.09 deadline", async () => {
  const { user, promo, steps } = await setup("o2");
  assert.equal((await joinChecklist(client, user.id, promo.id, "2026-09-20", NOW)).ok, true);
  await tick(user.id, [steps[1]!.id]);
  assert.equal((await joinChecklist(client, user.id, promo.id, "2026-10-02", NOW)).ok, false);
  assert.equal(dayOf((await snapshot(user.id, promo.id)).t?.accountOpenedAt), "2026-09-20");
});

test("repeating the request with the SAME date is an idempotent success and changes nothing", async () => {
  const { user, promo, steps } = await setup("i1");
  await joinChecklist(client, user.id, promo.id, "2026-09-12", NOW);
  await tick(user.id, [steps[0]!.id, steps[2]!.id]);
  const before = await snapshot(user.id, promo.id);

  assert.deepEqual(await joinChecklist(client, user.id, promo.id, "2026-09-12", NOW), { ok: true, outcome: "unchanged" });
  assert.deepEqual(await joinChecklist(client, user.id, promo.id, "2026-09-12", new Date("2026-10-02T20:00:00Z")), { ok: true, outcome: "unchanged" });
  assert.deepEqual(await snapshot(user.id, promo.id), before);
});

test("an older ściąga WITHOUT a date can be filled once through /join (ticks kept); a second, different date is refused", async () => {
  const { user, promo, steps } = await setup("l1");
  await client.userPromotionTracking.create({ data: { userId: user.id, promotionId: promo.id, joinedAt: JOINED } });
  await tick(user.id, [steps[0]!.id, steps[1]!.id]);
  const before = await snapshot(user.id, promo.id);

  assert.deepEqual(await joinChecklist(client, user.id, promo.id, "2026-09-12", NOW), { ok: true, outcome: "date-saved" });
  const after = await snapshot(user.id, promo.id);
  assert.equal(dayOf(after.t?.accountOpenedAt), "2026-09-12");
  assert.equal(after.t?.id, before.t?.id);
  assert.equal(after.t?.joinedAt.toISOString(), JOINED.toISOString());
  assert.deepEqual(after.ticks, before.ticks);

  const again = await joinChecklist(client, user.id, promo.id, "2026-09-25", NOW);
  assert.deepEqual(again, { ok: false, status: 409, error: DATE_ALREADY_SAVED_ERROR });
  assert.equal(dayOf((await snapshot(user.id, promo.id)).t?.accountOpenedAt), "2026-09-12");
});

// ---------------------------------------------------------------- concurrency

test("two simultaneous first joins with different dates: exactly one wins, the other is refused", async () => {
  const { user, promo } = await setup("k1");
  const results = await Promise.all([
    joinChecklist(client, user.id, promo.id, "2026-09-10", NOW),
    joinChecklist(client, user.id, promo.id, "2026-09-11", NOW)
  ]);
  assert.equal(results.filter((r) => r.ok).length, 1, JSON.stringify(results));
  const loser = results.find((r) => !r.ok)!;
  assert.equal(loser.ok === false && loser.status, 409);
  const stored = dayOf((await snapshot(user.id, promo.id)).t?.accountOpenedAt);
  assert.ok(["2026-09-10", "2026-09-11"].includes(stored!));
  assert.equal(await client.userPromotionTracking.count({ where: { userId: user.id, promotionId: promo.id } }), 1);
});

test("two simultaneous first joins with the SAME date both succeed (idempotent), one row", async () => {
  const { user, promo } = await setup("k2");
  const results = await Promise.all([
    joinChecklist(client, user.id, promo.id, "2026-09-10", NOW),
    joinChecklist(client, user.id, promo.id, "2026-09-10", NOW),
    joinChecklist(client, user.id, promo.id, "2026-09-10", NOW)
  ]);
  assert.ok(results.every((r) => r.ok), JSON.stringify(results));
  assert.equal(await client.userPromotionTracking.count({ where: { userId: user.id, promotionId: promo.id } }), 1);
});

test("simultaneous requests filling an older date-less ściąga: one date wins and is never replaced", async () => {
  const { user, promo } = await setup("k3");
  await client.userPromotionTracking.create({ data: { userId: user.id, promotionId: promo.id } });
  const results = await Promise.all(
    ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"].map((d) => joinChecklist(client, user.id, promo.id, d, NOW))
  );
  assert.equal(results.filter((r) => r.ok).length, 1, JSON.stringify(results));
  assert.equal(results.filter((r) => !r.ok && r.status === 409).length, 3);
  const winner = (await snapshot(user.id, promo.id)).t!.accountOpenedAt;
  assert.ok(winner);
  assert.equal((await joinChecklist(client, user.id, promo.id, "2026-09-30", NOW)).ok, false);
  assert.equal((await snapshot(user.id, promo.id)).t!.accountOpenedAt!.toISOString(), winner!.toISOString());
});

// ---------------------------------------------------------------- restart of a COMPLETED ściąga

async function completedSheet(tag: string, o: { months: number | null; closedOn: string | null; cutoff?: string | null }) {
  const s = await setup(tag, { months: o.months, cutoff: o.cutoff });
  await client.userPromotionTracking.create({
    data: { userId: s.user.id, promotionId: s.promo.id, joinedAt: JOINED, accountOpenedAt: D("2026-06-01"), completedAt: D("2026-08-15"), remindedGroupIndexes: [1, 2] }
  });
  await tick(s.user.id, s.steps.map((x) => x.id));
  if (o.closedOn) {
    await client.userBankHistory.create({
      data: { userId: s.user.id, bankId: s.promo.bankId, accountType: "PERSONAL", wasClientUntil: D(o.closedOn) }
    });
  }
  return s;
}

test("a permitted restart sets the date of the NEW cycle, reopens the ściąga, wipes its ticks", async () => {
  const { user, promo } = await completedSheet("r1", { months: 0, closedOn: "2026-08-15" });
  const before = await snapshot(user.id, promo.id);
  assert.equal(before.ticks.length, 3);

  assert.deepEqual(await joinChecklist(client, user.id, promo.id, "2026-09-12", NOW), { ok: true, outcome: "restarted" });
  const after = await snapshot(user.id, promo.id);
  assert.equal(after.t?.id, before.t?.id);
  assert.equal(after.t?.completedAt, null);
  assert.equal(dayOf(after.t?.accountOpenedAt), "2026-09-12", "the old 2026-06-01 is replaced by the new cycle's date");
  assert.equal(after.t?.joinedAt.toISOString(), NOW.toISOString());
  assert.equal(after.ticks.length, 0);

  // the new cycle's date is now protected like any other
  assert.equal((await joinChecklist(client, user.id, promo.id, "2026-09-20", NOW)).ok, false);
  assert.deepEqual(await joinChecklist(client, user.id, promo.id, "2026-09-12", NOW), { ok: true, outcome: "unchanged" });
});

test("a restart wipes only this promotion's ticks", async () => {
  const { user, promo } = await completedSheet("r2", { months: 0, closedOn: "2026-08-15" });
  const other = await makePromotion("jn-r2-other", { checklistSteps: { create: [{ monthLabel: "x", title: "Inny krok", order: 0 }] } }, `${PREFIX}jn-r2-other`);
  const otherStep = await client.checklistStep.findFirstOrThrow({ where: { promotionId: other.id } });
  await tick(user.id, [otherStep.id]);

  await joinChecklist(client, user.id, promo.id, "2026-09-12", NOW);
  assert.deepEqual((await client.checklistProgress.findMany({ where: { userId: user.id } })).map((p) => p.stepId), [otherStep.id]);
});

test("a locked restart is refused with 409 and nothing changes (no history / future closure / cutoff failed / still waiting)", async () => {
  const cases = [
    { tag: "r3", months: 0, closedOn: null },
    { tag: "r4", months: 0, closedOn: "2026-12-01" },
    { tag: "r5", months: 0, closedOn: "2026-08-15", cutoff: "2024-08-01" },
    { tag: "r6", months: 12, closedOn: "2026-08-15" },
    { tag: "r7", months: null, closedOn: "2026-08-15" }
  ];
  for (const c of cases) {
    const { user, promo } = await completedSheet(c.tag, c);
    const before = await snapshot(user.id, promo.id);
    const r = await joinChecklist(client, user.id, promo.id, "2026-09-12", NOW);
    assert.deepEqual(r, { ok: false, status: 409, error: LOCKED_ERROR }, c.tag);
    assert.deepEqual(await snapshot(user.id, promo.id), before, `${c.tag}: completed ściąga and its ticks untouched`);
  }
});

test("the restart date is validated too (impossible date: refused, completed ściąga untouched)", async () => {
  const { user, promo } = await completedSheet("r8", { months: 0, closedOn: "2026-08-15" });
  const before = await snapshot(user.id, promo.id);
  assert.equal((await joinChecklist(client, user.id, promo.id, "2026-02-31", NOW)).ok, false);
  assert.deepEqual(await snapshot(user.id, promo.id), before);
});

test("simultaneous restarts: the ściąga is restarted once; a request with another date is refused afterwards", async () => {
  const { user, promo, steps } = await completedSheet("r9", { months: 0, closedOn: "2026-08-15" });
  const results = await Promise.all([
    joinChecklist(client, user.id, promo.id, "2026-09-12", NOW),
    joinChecklist(client, user.id, promo.id, "2026-09-13", NOW),
    joinChecklist(client, user.id, promo.id, "2026-09-12", NOW)
  ]);
  assert.equal(results.filter((r) => r.ok && r.outcome === "restarted").length, 1, JSON.stringify(results));
  const stored = dayOf((await snapshot(user.id, promo.id)).t?.accountOpenedAt);
  assert.ok(["2026-09-12", "2026-09-13"].includes(stored!));
  for (const r of results) if (!r.ok) assert.equal(r.status, 409);
  // ticks made after the restart are not wiped by a late duplicate request
  await tick(user.id, [steps[0]!.id]);
  await joinChecklist(client, user.id, promo.id, stored!, NOW);
  assert.equal((await snapshot(user.id, promo.id)).ticks.length, 1);
});

// ---------------------------------------------------------------- reminder markers (remindedGroupIndexes)

const markers = async (userId: string, promotionId: string) => (await snapshot(userId, promotionId)).t?.remindedGroupIndexes;

test("markers [1, 2]: a permitted restart clears them together with the rest of the old cycle", async () => {
  const { user, promo } = await completedSheet("q1", { months: 0, closedOn: "2026-08-15" });
  assert.deepEqual(await markers(user.id, promo.id), [1, 2]);
  assert.deepEqual(await joinChecklist(client, user.id, promo.id, "2026-09-12", NOW), { ok: true, outcome: "restarted" });
  const t = (await snapshot(user.id, promo.id)).t!;
  assert.deepEqual(t.remindedGroupIndexes, []);
  assert.equal(t.completedAt, null);
  assert.equal(dayOf(t.accountOpenedAt), "2026-09-12");
});

test("markers [1, 2] are kept when the same date is repeated on an unfinished ściąga", async () => {
  const { user, promo } = await setup("q2");
  await client.userPromotionTracking.create({ data: { userId: user.id, promotionId: promo.id, accountOpenedAt: D("2026-09-12"), remindedGroupIndexes: [1, 2] } });
  assert.deepEqual(await joinChecklist(client, user.id, promo.id, "2026-09-12", NOW), { ok: true, outcome: "unchanged" });
  assert.deepEqual(await markers(user.id, promo.id), [1, 2]);
});

test("markers [1, 2] are kept when a different date is refused", async () => {
  const { user, promo } = await setup("q3");
  await client.userPromotionTracking.create({ data: { userId: user.id, promotionId: promo.id, accountOpenedAt: D("2026-09-12"), remindedGroupIndexes: [1, 2] } });
  assert.equal((await joinChecklist(client, user.id, promo.id, "2026-09-25", NOW)).ok, false);
  assert.deepEqual(await markers(user.id, promo.id), [1, 2]);
});

test("markers [1, 2] are kept when a locked restart is refused", async () => {
  for (const c of [
    { tag: "q4", months: 12, closedOn: "2026-08-15" },
    { tag: "q5", months: 0, closedOn: null as string | null }
  ]) {
    const { user, promo } = await completedSheet(c.tag, c);
    assert.equal((await joinChecklist(client, user.id, promo.id, "2026-09-12", NOW)).ok, false, c.tag);
    const t = (await snapshot(user.id, promo.id)).t!;
    assert.deepEqual(t.remindedGroupIndexes, [1, 2], c.tag);
    assert.ok(t.completedAt, c.tag);
  }
});

test("markers [1, 2] are kept when an empty date of an older unfinished ściąga is filled", async () => {
  const { user, promo } = await setup("q6");
  await client.userPromotionTracking.create({ data: { userId: user.id, promotionId: promo.id, remindedGroupIndexes: [1, 2] } });
  assert.deepEqual(await joinChecklist(client, user.id, promo.id, "2026-09-12", NOW), { ok: true, outcome: "date-saved" });
  assert.deepEqual(await markers(user.id, promo.id), [1, 2]);
});

test("a repeated request after a restart does not wipe a marker already written in the new cycle", async () => {
  const { user, promo } = await completedSheet("q7", { months: 0, closedOn: "2026-08-15" });
  assert.equal((await joinChecklist(client, user.id, promo.id, "2026-09-12", NOW)).ok, true);
  assert.deepEqual(await markers(user.id, promo.id), []);

  // the reminder job records a month of the NEW cycle
  await client.userPromotionTracking.updateMany({ where: { userId: user.id, promotionId: promo.id }, data: { remindedGroupIndexes: [1] } });

  assert.deepEqual(await joinChecklist(client, user.id, promo.id, "2026-09-12", NOW), { ok: true, outcome: "unchanged" });
  assert.deepEqual(await markers(user.id, promo.id), [1], "same date repeated");
  assert.equal((await joinChecklist(client, user.id, promo.id, "2026-09-13", NOW)).ok, false);
  assert.deepEqual(await markers(user.id, promo.id), [1], "other date refused");
});

test("duplicate restart requests: the markers are cleared once, and a marker written afterwards survives a late duplicate", async () => {
  const { user, promo } = await completedSheet("q8", { months: 0, closedOn: "2026-08-15" });
  const results = await Promise.all([
    joinChecklist(client, user.id, promo.id, "2026-09-12", NOW),
    joinChecklist(client, user.id, promo.id, "2026-09-12", NOW)
  ]);
  assert.equal(results.filter((r) => r.ok && r.outcome === "restarted").length, 1, JSON.stringify(results));
  assert.ok(results.every((r) => r.ok));
  assert.deepEqual(await markers(user.id, promo.id), []);

  await client.userPromotionTracking.updateMany({ where: { userId: user.id, promotionId: promo.id }, data: { remindedGroupIndexes: [2] } });
  assert.deepEqual(await joinChecklist(client, user.id, promo.id, "2026-09-12", NOW), { ok: true, outcome: "unchanged" });
  assert.deepEqual(await markers(user.id, promo.id), [2]);
});
