import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { importPromotions, ImportAbortError, type ImportEntry } from "../../src/lib/services/promotionImport";
import { isBonusPartOpen } from "../../src/lib/promotionAvailability";
import { client, cleanup, makePromotion, reload, PREFIX } from "./helpers";

before(cleanup);
after(async () => {
  await cleanup();
  await client.$disconnect();
});

const KANTOR_DEADLINE = new Date("2026-09-30T00:00:00Z");

/** An import entry that reproduces the stored promotion exactly, bonus parts WITHOUT any availableUntil key. */
function entryFor(row: Awaited<ReturnType<typeof reload>>, overrides: Record<string, unknown> = {}): ImportEntry {
  return {
    bank: { name: "DBT Bank", slug: `${PREFIX}bank` },
    promotion: {
      slug: row.slug,
      name: row.name,
      accountType: row.accountType,
      maxBonusCents: row.maxBonusCents,
      difficulty: row.difficulty,
      rating: 9,
      status: row.status,
      startDate: row.startDate.toISOString().slice(0, 10),
      endDate: row.endDate.toISOString().slice(0, 10),
      affiliateUrl: row.affiliateUrl,
      lastVerifiedAt: row.lastVerifiedAt.toISOString().slice(0, 10),
      summary: row.summary,
      conditions: row.conditions.map((c) => ({ title: c.title, description: c.description, type: c.type, order: c.order })),
      bonusParts: row.bonusParts.map((b) => ({ label: b.label, amountCents: b.amountCents, order: b.order })), // no availableUntil key
      fees: {
        accountFeeCents: row.fees?.accountFeeCents ?? 0,
        cardFeeCents: row.fees?.cardFeeCents ?? 0,
        atmFeeCents: row.fees?.atmFeeCents ?? 0
      },
      ...overrides
    }
  } as ImportEntry;
}

const deadlines = (row: Awaited<ReturnType<typeof reload>>) =>
  Object.fromEntries(row.bonusParts.map((b) => [b.label, b.availableUntil ? b.availableUntil.toISOString().slice(0, 10) : null]));

async function erste(slug: string) {
  return makePromotion(slug, {
    fees: { create: { accountFeeCents: 0, cardFeeCents: 0, atmFeeCents: 0 } },
    bonusParts: {
      create: [
        { label: "Nagroda za konto", amountCents: 150000, order: 0 },
        { label: "Kantor Erste", amountCents: 30000, order: 1, availableUntil: KANTOR_DEADLINE }
      ]
    }
  });
}

async function snapshot(id: string) {
  const r = await reload(id);
  return JSON.stringify({ updatedAt: r.updatedAt, summary: r.summary, parts: r.bonusParts.map((b) => [b.id, b.label, b.availableUntil]) });
}

test("re-import WITHOUT the new field keeps the 30.09 deadline; on 2 Oct the reward is still closed for new participants", async () => {
  const row = await erste("reimport-keeps");
  assert.deepEqual(deadlines(row), { "Nagroda za konto": null, "Kantor Erste": "2026-09-30" });

  await importPromotions(client, [entryFor(row)]);

  const after = await reload(row.id);
  assert.deepEqual(deadlines(after), { "Nagroda za konto": null, "Kantor Erste": "2026-09-30" }, "deadline must not disappear");
  const kantor = after.bonusParts.find((b) => b.label === "Kantor Erste")!;
  const account = after.bonusParts.find((b) => b.label === "Nagroda za konto")!;
  const oct2 = new Date("2026-10-02T10:00:00Z");
  assert.equal(isBonusPartOpen(kantor, oct2), false, "closed for new participants on 02.10");
  assert.equal(isBonusPartOpen(kantor, new Date("2026-09-30T20:00:00Z")), true, "still open on the last day");
  assert.equal(isBonusPartOpen(account, oct2), true, "the account reward is unaffected");
});

test("explicit null removes the deadline; an explicit date sets it (omitted != null)", async () => {
  const row = await erste("explicit");
  const removed = entryFor(row);
  removed.promotion.bonusParts = row.bonusParts.map((b) => ({
    label: b.label,
    amountCents: b.amountCents,
    order: b.order,
    ...(b.label === "Kantor Erste" ? { availableUntil: null } : {})
  }));
  await importPromotions(client, [removed]);
  assert.deepEqual(deadlines(await reload(row.id)), { "Nagroda za konto": null, "Kantor Erste": null });

  const set = entryFor(await reload(row.id));
  set.promotion.bonusParts = set.promotion.bonusParts.map((b) => (b.label === "Kantor Erste" ? { ...b, availableUntil: "2026-10-15" } : b));
  await importPromotions(client, [set]);
  assert.deepEqual(deadlines(await reload(row.id)), { "Nagroda za konto": null, "Kantor Erste": "2026-10-15" });
});

test("ambiguous match with a stored deadline aborts BEFORE any change", async () => {
  const row = await makePromotion("ambiguous", {
    fees: { create: { accountFeeCents: 0, cardFeeCents: 0, atmFeeCents: 0 } },
    bonusParts: {
      create: [
        { label: "Kantor", amountCents: 20000, order: 0, availableUntil: KANTOR_DEADLINE },
        { label: "Kantor", amountCents: 10000, order: 1 }
      ]
    }
  });
  const before = await snapshot(row.id);
  const entry = entryFor(row, { summary: "ZMIENIONY OPIS" });
  await assert.rejects(
    () => importPromotions(client, [entry]),
    (e: unknown) => {
      assert.ok(e instanceof ImportAbortError);
      assert.match((e as Error).message, /cannot be matched unambiguously/);
      return true;
    }
  );
  assert.equal(await snapshot(row.id), before, "nothing changed - not even the summary of the same entry");
});

test("a stored deadline whose part is missing from the file aborts BEFORE any change", async () => {
  const row = await erste("dropped");
  const before = await snapshot(row.id);
  const entry = entryFor(row, { summary: "ZMIENIONY OPIS" });
  entry.promotion.bonusParts = entry.promotion.bonusParts.filter((b) => b.label !== "Kantor Erste");
  await assert.rejects(() => importPromotions(client, [entry]), /would delete it together with its deadline/);
  assert.equal(await snapshot(row.id), before);
});

test("atomic across entries: a valid change in entry 1 is NOT applied when entry 2 aborts", async () => {
  const good = await makePromotion("atomic-good", { fees: { create: { accountFeeCents: 0, cardFeeCents: 0, atmFeeCents: 0 } } });
  const bad = await erste("atomic-bad");
  const goodBefore = await snapshot(good.id);
  const badEntry = entryFor(bad);
  badEntry.promotion.bonusParts = [{ label: "Kantor Erste", amountCents: 30000, order: 1, availableUntil: "not-a-date" }];
  await assert.rejects(
    () => importPromotions(client, [entryFor(good, { summary: "ZMIANA, KTÓRA NIE MOŻE PRZEJŚĆ" }), badEntry]),
    ImportAbortError
  );
  assert.equal(await snapshot(good.id), goodBefore, "entry 1 untouched");
});

test("a failure during the WRITE phase rolls everything back too", async () => {
  const first = await makePromotion("rollback-first", { fees: { create: { accountFeeCents: 0, cardFeeCents: 0, atmFeeCents: 0 } } });
  const second = await makePromotion("rollback-second", { fees: { create: { accountFeeCents: 0, cardFeeCents: 0, atmFeeCents: 0 } } });
  const before = await snapshot(first.id);
  const e1 = entryFor(first, { summary: "ZMIANA 1" });
  const e2 = entryFor(second, { slug: `${PREFIX}brand-new`, summary: "NOWA PROMOCJA" });
  // planning passes (a new slug has nothing stored), but the database rejects the invalid enum value on write
  const e3 = entryFor(second, { slug: `${PREFIX}other-new`, status: "NOT_A_STATUS" });
  await assert.rejects(() => importPromotions(client, [e1, e2, e3]));
  assert.equal(await snapshot(first.id), before, "first entry rolled back");
  assert.equal(await client.promotion.count({ where: { slug: `${PREFIX}brand-new` } }), 0, "no half-created promotion");
});
