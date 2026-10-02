/**
 * The lock on starting a COMPLETED ściąga again must use the same eligibility
 * rule as the promotion page and the notifications. checklistRestartAllowed is
 * what POST /api/checklist/join consults; the page uses isChecklistRestartLocked
 * on computeEligibility. Real database.
 */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { checklistRestartAllowed } from "../../src/lib/services/checklistTracking";
import { computeEligibility, isChecklistRestartLocked } from "../../src/lib/services/eligibility";
import { client, cleanup, makePromotion, makeUser, PREFIX } from "./helpers";

before(cleanup);
after(async () => {
  await cleanup();
  await client.$disconnect();
});

const NOW = new Date("2026-10-02T12:00:00Z");
const D = (s: string) => new Date(`${s}T00:00:00Z`);

async function completed(
  tag: string,
  o: { months: number | null; cutoff?: string | null; closedOn?: string | null; completed?: boolean }
) {
  const user = await makeUser(tag);
  const promo = await makePromotion(
    `rs-${tag}`,
    { cooldownMonths: o.months, cooldownCutoffDate: o.cutoff ? D(o.cutoff) : null },
    `${PREFIX}rs-${tag}`
  );
  await client.userPromotionTracking.create({
    data: {
      userId: user.id,
      promotionId: promo.id,
      accountOpenedAt: D("2026-06-01"),
      completedAt: o.completed === false ? null : D("2026-08-15")
    }
  });
  if (o.closedOn) {
    await client.userBankHistory.create({
      data: { userId: user.id, bankId: promo.bankId, accountType: "PERSONAL", wasClientUntil: D(o.closedOn) }
    });
  }
  return { user, promo };
}

const allowed = async (tag: string, o: Parameters<typeof completed>[1]) => {
  const { user, promo } = await completed(tag, o);
  const { allowed, eligibility } = await checklistRestartAllowed(client, user.id, promo.id, NOW);
  // the promotion page: the same rule through computeEligibility + isChecklistRestartLocked
  const history = o.closedOn ? D(o.closedOn) : null;
  const pageLocked = isChecklistRestartLocked(
    o.completed === false ? null : D("2026-08-15"),
    computeEligibility(promo.cooldownMonths, promo.cooldownCutoffDate, history, NOW)
  );
  assert.equal(allowed, !pageLocked, `${tag}: join route and promotion page must agree`);
  return { allowed, eligibility };
};

test("0 months + known closure date: the completed ściąga can be started again", async () => {
  const r = await allowed("a", { months: 0, closedOn: "2026-08-15" });
  assert.equal(r.allowed, true);
  assert.equal(r.eligibility?.status, "eligible");
});

test("NULL months and no cutoff: stays locked (no rule, nothing assumed)", async () => {
  const r = await allowed("b", { months: null, closedOn: "2026-08-15" });
  assert.equal(r.allowed, false);
  assert.equal(r.eligibility?.status, "unknown");
});

test("no bank history: stays locked", async () => {
  const r = await allowed("c", { months: 0, closedOn: null });
  assert.equal(r.allowed, false);
  assert.equal(r.eligibility?.status, "unknown");
});

test("closure date in the future: stays locked", async () => {
  assert.equal((await allowed("d", { months: 0, closedOn: "2026-12-01" })).allowed, false);
});

test("0 months with the cutoff date failed: locked; with the cutoff met: open", async () => {
  assert.equal((await allowed("e", { months: 0, cutoff: "2024-08-01", closedOn: "2026-08-15" })).allowed, false);
  assert.equal((await allowed("f", { months: 0, cutoff: "2027-01-01", closedOn: "2026-08-15" })).allowed, true);
});

test("N months still waiting: locked; elapsed: open (unchanged behaviour)", async () => {
  assert.equal((await allowed("g", { months: 12, closedOn: "2026-08-15" })).allowed, false);
  assert.equal((await allowed("h", { months: 12, closedOn: "2025-08-15" })).allowed, true);
});

test("a ściąga that was never completed is not subject to the lock", async () => {
  const r = await allowed("i", { months: null, closedOn: null, completed: false });
  assert.equal(r.allowed, true);
  assert.equal(r.eligibility, null);
});

test("a user with no ściąga at all is not blocked", async () => {
  const user = await makeUser("j");
  const promo = await makePromotion("rs-j", { cooldownMonths: null }, `${PREFIX}rs-j`);
  assert.equal((await checklistRestartAllowed(client, user.id, promo.id, NOW)).allowed, true);
});

test("another user's history does not unlock my ściąga", async () => {
  const mine = await completed("k1", { months: 0, closedOn: null });
  const other = await makeUser("k2");
  await client.userBankHistory.create({ data: { userId: other.id, bankId: mine.promo.bankId, accountType: "PERSONAL", wasClientUntil: D("2026-08-15") } });
  assert.equal((await checklistRestartAllowed(client, mine.user.id, mine.promo.id, NOW)).allowed, false);
});
