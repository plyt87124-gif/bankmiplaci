/**
 * The verification regime against a real database: lastVerifiedAt moves only
 * together with a CONFIRMED record, nothing is confirmed on unread documents or
 * without a description of a manual review, the baseline is the last CONFIRMED
 * check, and the watchdog raises each overdue offer once per day.
 */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import {
  offersToVerify,
  overdueOffers,
  raiseOverdueNotifications,
  recordVerification
} from "../../src/lib/services/verification";
import { decideFromSnapshots, type SourceSnapshot } from "../../src/lib/verification";
import { client, cleanup, makePromotion, reload } from "./helpers";

async function wipe() {
  const promos = await client.promotion.findMany({ where: { slug: { startsWith: "dbt-ver-" } }, select: { id: true } });
  await client.adminNotification.deleteMany({ where: { relatedPromotionId: { in: promos.map((p) => p.id) } } });
  await cleanup();
}
before(wipe);
after(async () => {
  await wipe();
  await client.$disconnect();
});

const NOW = new Date("2026-10-26T09:00:00Z");
const DOC_A = "https://bank.example/ver/regulamin.pdf";
const DOC_B = "https://bank.example/ver/taryfa.pdf";
const read = (url: string, sha256: string): SourceSnapshot => ({ url, ok: true, status: 200, sha256, chars: 9000 });

test("a CONFIRMED check moves lastVerifiedAt in the same transaction; CHANGED and UNREACHABLE do not", async () => {
  const p = await makePromotion("ver-move", { lastVerifiedAt: new Date("2026-08-22T00:00:00Z") });

  await recordVerification(client, { promotionId: p.id, result: "CHANGED", method: "REVIEW", sources: [read(DOC_A, "x")], note: "regulamin ma nową kwotę", now: NOW });
  await recordVerification(client, {
    promotionId: p.id,
    result: "UNREACHABLE",
    method: "SOURCE_UNCHANGED",
    sources: [{ url: DOC_B, ok: false, status: 403, sha256: null, chars: null, problem: "HTTP 403" }],
    now: NOW
  });
  assert.equal((await reload(p.id)).lastVerifiedAt.toISOString(), "2026-08-22T00:00:00.000Z");

  const res = await recordVerification(client, { promotionId: p.id, result: "CONFIRMED", method: "SOURCE_UNCHANGED", sources: [read(DOC_A, "h1"), read(DOC_B, "h2")], now: NOW });
  assert.equal(res.confirmed, true);
  assert.equal((await reload(p.id)).lastVerifiedAt.toISOString(), NOW.toISOString());
  assert.equal(await client.promotionVerification.count({ where: { promotionId: p.id } }), 3);
});

test("nothing is confirmed on no documents, on unread documents, or on a manual review without a note", async () => {
  const p = await makePromotion("ver-refuse", { lastVerifiedAt: new Date("2026-08-22T00:00:00Z") });
  const unread: SourceSnapshot = { url: DOC_B, ok: false, status: 403, sha256: null, chars: null, problem: "HTTP 403" };

  await assert.rejects(recordVerification(client, { promotionId: p.id, result: "CONFIRMED", method: "SOURCE_UNCHANGED", sources: [], now: NOW }), /ani jednego dokumentu/);
  await assert.rejects(recordVerification(client, { promotionId: p.id, result: "CONFIRMED", method: "REVIEW", sources: [read(DOC_A, "h"), unread], note: "ok", now: NOW }), /nieodczytane dokumenty/);
  await assert.rejects(recordVerification(client, { promotionId: p.id, result: "CONFIRMED", method: "REVIEW", sources: [read(DOC_A, "h")], note: "  ", now: NOW }), /wymaga opisu/);

  assert.equal(await client.promotionVerification.count({ where: { promotionId: p.id } }), 0, "a refused check leaves no record");
  assert.equal((await reload(p.id)).lastVerifiedAt.toISOString(), "2026-08-22T00:00:00.000Z");

  // a document read in a browser is accepted when the review says what was compared
  const viaBrowser: SourceSnapshot = { url: DOC_B, ok: true, status: null, sha256: null, chars: null, viaBrowser: true };
  await recordVerification(client, { promotionId: p.id, result: "CONFIRMED", method: "REVIEW", sources: [read(DOC_A, "h"), viaBrowser], note: "regulamin i strona banku porównane z warunkami oferty", now: NOW });
  assert.equal((await reload(p.id)).lastVerifiedAt.toISOString(), NOW.toISOString());
});

test("offersToVerify: active and still open only, with the last CONFIRMED check as the baseline", async () => {
  const open = await makePromotion("ver-open", {
    sourceUrl: DOC_A,
    additionalSourceUrls: [DOC_B],
    lastVerifiedAt: new Date("2026-10-20T00:00:00Z"),
    fees: { create: { accountFeeCents: 0, sourceUrl: "https://bank.example/ver/fees.pdf" } }
  });
  await makePromotion("ver-ended", { endDate: new Date("2026-10-01T00:00:00Z") });
  await makePromotion("ver-draft", { status: "DRAFT" });

  await recordVerification(client, { promotionId: open.id, result: "CONFIRMED", method: "SOURCE_UNCHANGED", sources: [read(DOC_A, "old")], now: new Date("2026-10-21T08:00:00Z") });
  await recordVerification(client, { promotionId: open.id, result: "CONFIRMED", method: "SOURCE_UNCHANGED", sources: [read(DOC_A, "h1"), read(DOC_B, "h2")], now: new Date("2026-10-22T08:00:00Z") });
  await recordVerification(client, { promotionId: open.id, result: "CHANGED", method: "REVIEW", sources: [read(DOC_A, "newer")], note: "zmiana", now: new Date("2026-10-23T08:00:00Z") });

  const offers = (await offersToVerify(client, NOW)).filter((o) => o.slug.startsWith("dbt-ver-"));
  const slugs = offers.map((o) => o.slug);
  assert.ok(slugs.includes("dbt-ver-open"));
  assert.ok(!slugs.includes("dbt-ver-ended"), "a closed sign-up window is not verified any more");
  assert.ok(!slugs.includes("dbt-ver-draft"));

  const o = offers.find((x) => x.slug === "dbt-ver-open")!;
  assert.deepEqual(o.sourceUrls, [DOC_A, DOC_B, "https://bank.example/ver/fees.pdf"]);
  assert.deepEqual(o.baseline?.map((s) => s.sha256), ["h1", "h2"], "the newest CONFIRMED check, not a later CHANGED one");
  assert.equal(decideFromSnapshots([read(DOC_A, "h1"), read(DOC_B, "h2"), read("https://bank.example/ver/fees.pdf", "f")], o.baseline).decision, "CHANGED");
});

test("overdue watchdog: only active, open offers older than 36 h; one notification per offer per day", async () => {
  const stale = await makePromotion("ver-stale", { lastVerifiedAt: new Date("2026-10-22T09:00:00Z") });
  await makePromotion("ver-fresh", { lastVerifiedAt: new Date("2026-10-26T06:00:00Z") });
  await makePromotion("ver-stale-ended", { lastVerifiedAt: new Date("2026-08-01T00:00:00Z"), endDate: new Date("2026-10-01T00:00:00Z") });

  const list = (await overdueOffers(client, NOW)).filter((o) => o.slug.startsWith("dbt-ver-"));
  assert.ok(list.some((o) => o.slug === "dbt-ver-stale"));
  assert.ok(!list.some((o) => o.slug === "dbt-ver-fresh"));
  assert.ok(!list.some((o) => o.slug === "dbt-ver-stale-ended"));
  assert.equal(list.find((o) => o.slug === "dbt-ver-stale")!.hours, 96);

  const first = await raiseOverdueNotifications(client, NOW);
  assert.ok(first.created.some((o) => o.slug === "dbt-ver-stale"));
  const second = await raiseOverdueNotifications(client, new Date(NOW.getTime() + 3600_000));
  assert.ok(!second.created.some((o) => o.slug === "dbt-ver-stale"), "already raised today");
  const nextDay = await raiseOverdueNotifications(client, new Date(NOW.getTime() + 24 * 3600_000));
  assert.ok(nextDay.created.some((o) => o.slug === "dbt-ver-stale"), "raised again the next day while it stays overdue");

  const notes = await client.adminNotification.findMany({ where: { relatedPromotionId: stale.id } });
  assert.equal(notes.length, 2);
  assert.ok(notes.every((n) => n.type === "PROMOTION_CHECK_NEEDED" && /Weryfikacja po terminie/.test(n.title)));
});
