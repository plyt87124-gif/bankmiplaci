// Konkurs liczy się do prowizji (a przez nią do oceny serwisu i „Polecane”) tylko w swoim okresie: od pierwszego
// do końca ostatniego dnia (polski kalendarz). Konkurs „do końca listopada” sam przestaje się liczyć 1 grudnia,
// przy najbliższym przeliczeniu, bez niczyjej interwencji. Oceny przelicza też codzienny cron.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  contestsForOffer,
  effectiveCommissionCents,
  isContestRunning,
  type CommissionContest,
  type CommissionOffer
} from "../src/lib/effectiveCommission";

const ROOT = join(__dirname, "..");
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), "utf8");

const offer: CommissionOffer = { network: "EBROKER", externalId: "1", cpsCents: 8_000, cpaCents: 0 };
const contest = (over: Partial<CommissionContest> = {}): CommissionContest => ({
  network: "EBROKER",
  offerExternalIds: ["1"],
  tiers: [{ everyN: 1, bonusCents: 22_000 }],
  startDate: null,
  endDate: new Date("2026-11-30T00:00:00.000Z"),
  ...over
});

test("konkurs liczy się przez cały ostatni dzień i przestaje następnego dnia (czas polski)", () => {
  const c = contest();
  assert.equal(isContestRunning(c, new Date("2026-11-29T10:00:00Z")), true);
  assert.equal(isContestRunning(c, new Date("2026-11-30T12:00:00Z")), true, "w ostatnim dniu jeszcze działa");
  // 22:30 UTC = 23:30 w Polsce 30.11: jeszcze trwa; 23:30 UTC = 00:30 w Polsce 1.12: już po.
  assert.equal(isContestRunning(c, new Date("2026-11-30T22:30:00Z")), true);
  assert.equal(isContestRunning(c, new Date("2026-11-30T23:30:00Z")), false);
  assert.equal(isContestRunning(c, new Date("2026-12-01T09:00:00Z")), false);
});

test("konkurs, który jeszcze się nie zaczął, nie liczy się; brak dat zostawia stronę otwartą", () => {
  const c = contest({ startDate: new Date("2026-12-01T00:00:00.000Z"), endDate: new Date("2026-12-31T00:00:00.000Z") });
  assert.equal(isContestRunning(c, new Date("2026-11-30T12:00:00Z")), false);
  assert.equal(isContestRunning(c, new Date("2026-12-01T09:00:00Z")), true);
  assert.equal(isContestRunning(contest({ startDate: null, endDate: null }), new Date("2030-01-01T00:00:00Z")), true, "bez dat bez końca");
});

test("prowizja z konkursem: 30 listopada wlicza konkurs, 1 grudnia już tylko stawkę", () => {
  const before = effectiveCommissionCents([offer], [contest()], new Date("2026-11-30T12:00:00Z"));
  const after = effectiveCommissionCents([offer], [contest()], new Date("2026-12-01T12:00:00Z"));
  assert.equal(before, 30_000, "80 zł stawki + 220 zł konkursu za każde konto");
  assert.equal(after, 8_000, "po końcu konkursu zostaje sama stawka");
});

test("contestsForOffer pomija zakończone, ukryte (missingSince) i cudze konkursy", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  const list = [
    contest(),
    contest({ endDate: new Date("2026-11-10T00:00:00.000Z") }),
    contest({ missingSince: new Date("2026-11-15T00:00:00Z") }),
    contest({ offerExternalIds: ["2"] })
  ];
  assert.equal(contestsForOffer(offer, list, now).length, 1);
});

test("ocena i Polecane czytają konkursy według daty i przeliczają się codziennie", () => {
  const ratings = read("src", "lib", "services", "ratings.ts");
  assert.match(ratings, /loadEffectiveCommissions\(\{\}, now\)/, "ocena liczona na tę samą datę co reszta");
  const loader = read("src", "lib", "services", "effectiveCommissions.ts");
  assert.match(loader, /startDate: true, endDate: true/, "daty konkursu są pobierane");
  assert.match(loader, /effectiveCommissionCents\(entry\.offers, contests, now\)/);

  const crons = (JSON.parse(read("vercel.json")) as { crons: { path: string; schedule: string }[] }).crons;
  const paths = crons.map((c) => c.path);
  assert.ok(paths.includes("/api/cron/recompute-ratings"), "codzienne przeliczenie ocen jest w harmonogramie");
  assert.ok(paths.indexOf("/api/cron/recompute-ratings") > paths.indexOf("/api/cron/expire-promotions"), "po wygaszeniu promocji");
  const expire = crons.find((c) => c.path === "/api/cron/expire-promotions")!;
  const recompute = crons.find((c) => c.path === "/api/cron/recompute-ratings")!;
  assert.match(expire.schedule, /^0 3 \* \* \*$/);
  assert.match(recompute.schedule, /^\d+ 3 \* \* \*$/, "raz dziennie, w nocy");
});
