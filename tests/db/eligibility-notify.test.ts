/**
 * "Karencja minęła" notifications against a real database, with a fake mailer:
 * nothing here can send an e-mail (the default sendEmail is never reached) and
 * every run is limited to the test users. The decision must be the same one the
 * promotion page makes (computeEligibility), including cooldownMonths = 0.
 */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { checkEligibilityAndNotify } from "../../src/lib/services/eligibilityNotifications";
import { computeEligibility } from "../../src/lib/services/eligibility";
import { client, cleanup, makePromotion, makeUser, PREFIX } from "./helpers";

before(cleanup);
after(async () => {
  await cleanup();
  await client.$disconnect();
});

const NOW = new Date("2026-10-02T12:00:00Z");
const D = (s: string) => new Date(`${s}T00:00:00Z`);

interface Mail {
  to: string;
  subject: string;
  html: string;
}
const outbox = () => {
  const sent: Mail[] = [];
  return { sent, send: async (m: Mail) => void sent.push(m) };
};

async function setup(
  tag: string,
  opts: { months: number | null; cutoff?: string | null; closedOn?: string | null; rating?: number; promoTag?: string }
) {
  const user = await makeUser(tag);
  const bankSlug = `${PREFIX}n-${tag}`;
  const promo = await makePromotion(
    `n-${opts.promoTag ?? tag}`,
    {
      cooldownMonths: opts.months,
      cooldownCutoffDate: opts.cutoff ? D(opts.cutoff) : null,
      rating: opts.rating ?? 9
    },
    bankSlug
  );
  const history =
    opts.closedOn === null
      ? null
      : await client.userBankHistory.create({
          data: { userId: user.id, bankId: promo.bankId, accountType: "PERSONAL", wasClientUntil: D(opts.closedOn ?? "2026-08-15") }
        });
  return { user, promo, history };
}

const run = async (userIds: string[]) => {
  const mail = outbox();
  const notified = await checkEligibilityAndNotify({ client, send: mail.send, now: NOW, userIds });
  return { notified, ...mail };
};
const stampOf = (id: string) => client.userBankHistory.findUniqueOrThrow({ where: { id } });

test("0 months + a known closure date in the past: the user is notified (fake mailer), linked to that promotion", async () => {
  const { user, promo, history } = await setup("z1", { months: 0, closedOn: "2026-08-15" });
  const r = await run([user.id]);
  assert.equal(r.notified, 1);
  assert.equal(r.sent.length, 1);
  assert.equal(r.sent[0]!.to, user.email);
  const h = await stampOf(history!.id);
  assert.ok(h.eligibilityNotifiedAt);
  assert.equal(h.eligibilityPromotionId, promo.id);
  assert.equal(h.eligibilityClearedAt?.toISOString(), "2026-08-15T00:00:00.000Z", "cleared on the closure date itself - no extra waiting");
  assert.equal(await client.adminNotification.count({ where: { relatedUserId: user.id, type: "ELIGIBILITY_CLEARED" } }), 1);
});

test("NULL months (no monthly rule): nobody is notified and nothing is stamped", async () => {
  const { user, history } = await setup("n1", { months: null, closedOn: "2026-08-15" });
  const r = await run([user.id]);
  assert.equal(r.notified, 0);
  assert.equal(r.sent.length, 0);
  assert.equal((await stampOf(history!.id)).eligibilityNotifiedAt, null);
});

test("no history at all: nothing to notify, nothing is assumed", async () => {
  const { user } = await setup("h1", { months: 0, closedOn: null });
  const r = await run([user.id]);
  assert.equal(r.notified, 0);
  assert.equal(r.sent.length, 0);
  assert.equal(await client.adminNotification.count({ where: { relatedUserId: user.id } }), 0);
});

test("a history row without a closure date is ignored", async () => {
  const { user, promo } = await setup("h2", { months: 0, closedOn: null });
  await client.userBankHistory.create({ data: { userId: user.id, bankId: promo.bankId, accountType: "PERSONAL", wasClientUntil: null } });
  assert.equal((await run([user.id])).notified, 0);
});

test("closure date in the future: not notified and NOT stamped (so it is picked up once the day arrives)", async () => {
  const { user, history } = await setup("f1", { months: 0, closedOn: "2026-10-20" });
  const r = await run([user.id]);
  assert.equal(r.notified, 0);
  assert.equal(r.sent.length, 0);
  assert.equal((await stampOf(history!.id)).eligibilityNotifiedAt, null);

  // ... and on the closure day itself the very same row is notified
  const later = await checkEligibilityAndNotify({ client, send: outbox().send, now: new Date("2026-10-20T08:00:00Z"), userIds: [user.id] });
  assert.equal(later, 1);
});

test("0 months + cutoff date NOT met: not notified (the cutoff is still checked)", async () => {
  const { user, history } = await setup("c1", { months: 0, cutoff: "2024-08-01", closedOn: "2025-03-10" });
  const r = await run([user.id]);
  assert.equal(r.notified, 0);
  assert.equal((await stampOf(history!.id)).eligibilityNotifiedAt, null);
});

test("0 months + cutoff date met: notified", async () => {
  const { user } = await setup("c2", { months: 0, cutoff: "2024-08-01", closedOn: "2024-07-31" });
  const r = await run([user.id]);
  assert.equal(r.notified, 1);
  assert.equal(r.sent.length, 1);
});

test("N months: waiting -> not notified; elapsed -> notified (unchanged behaviour)", async () => {
  const waiting = await setup("m1", { months: 12, closedOn: "2026-03-01" });
  const elapsed = await setup("m2", { months: 12, closedOn: "2025-09-01" });
  const r = await run([waiting.user.id, elapsed.user.id]);
  assert.equal(r.notified, 1);
  assert.deepEqual(r.sent.map((m) => m.to), [elapsed.user.email]);
});

test("the linked promotion is one the user really clears, not merely the best-rated at the bank", async () => {
  const { user, promo, history } = await setup("p1", { months: 0, closedOn: "2026-08-15", rating: 7 });
  // a better-rated promotion at the same bank whose 36-month wait has not passed
  await makePromotion("n-p1-better", { cooldownMonths: 36, rating: 9.9 }, `${PREFIX}n-p1`);
  const r = await run([user.id]);
  assert.equal(r.notified, 1);
  assert.equal((await stampOf(history!.id)).eligibilityPromotionId, promo.id);
});

test("a second run does not notify the same row again", async () => {
  const { user } = await setup("d1", { months: 0, closedOn: "2026-08-15" });
  assert.equal((await run([user.id])).notified, 1);
  const again = await run([user.id]);
  assert.equal(again.notified, 0);
  assert.equal(again.sent.length, 0);
});

test("the notification decision equals the page's computeEligibility for every case", async () => {
  const cases = [
    { tag: "k1", months: 0, cutoff: null, closedOn: "2026-08-15" },
    { tag: "k2", months: 0, cutoff: null, closedOn: "2026-10-20" },
    { tag: "k3", months: 0, cutoff: "2024-08-01", closedOn: "2025-03-10" },
    { tag: "k4", months: 0, cutoff: "2024-08-01", closedOn: "2024-07-31" },
    { tag: "k5", months: 6, cutoff: null, closedOn: "2026-07-01" },
    { tag: "k6", months: 6, cutoff: null, closedOn: "2026-05-01" },
    { tag: "k7", months: 36, cutoff: "2030-01-01", closedOn: "2022-01-01" }
  ];
  for (const c of cases) {
    const { user, promo } = await setup(c.tag, c);
    const expected = computeEligibility(promo.cooldownMonths, promo.cooldownCutoffDate, D(c.closedOn), NOW).status === "eligible";
    const r = await run([user.id]);
    assert.equal(r.notified === 1, expected, `${c.tag}: notification must follow the same rule as the page`);
  }
});
