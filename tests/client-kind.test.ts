// Owner, 2026-11-11: "traktuj konta młodych dla danego banku, że liczy się jak konto osobiste do karencji i do tego,
// czy jesteś już klientem" - a user with a personal account of a bank in karencja was still shown that bank's offers for
// young people, because the history row was matched to the offer by the EXACT account type. The pure rules.
import test from "node:test";
import assert from "node:assert/strict";
import { clientKindOf, clientKindTypes, sameClientKind } from "../src/lib/accountTypes";
import { mostRestrictiveHistory } from "../src/lib/services/eligibility";

const D = (iso: string) => new Date(`${iso}T00:00:00Z`);
const NOW = new Date("2026-10-02T12:00:00Z");

test("a young account counts as a personal one, both ways; savings, joint and business stay apart", () => {
  assert.equal(clientKindOf("YOUNG"), "PERSONAL");
  assert.equal(clientKindOf("PERSONAL"), "PERSONAL");
  assert.equal(clientKindOf("SAVINGS"), "SAVINGS");
  assert.equal(clientKindOf("JOINT"), "JOINT");
  assert.equal(clientKindOf("BUSINESS"), "BUSINESS");
  assert.equal(clientKindOf(null), "PERSONAL");

  assert.equal(sameClientKind("YOUNG", "PERSONAL"), true);
  assert.equal(sameClientKind("PERSONAL", "YOUNG"), true);
  assert.equal(sameClientKind("YOUNG", "YOUNG"), true);
  // a savings account does not exclude anyone from a personal-account offer at several banks: it is not folded in
  assert.equal(sameClientKind("SAVINGS", "PERSONAL"), false);
  assert.equal(sameClientKind("JOINT", "PERSONAL"), false);
  assert.equal(sameClientKind("BUSINESS", "PERSONAL"), false);
  assert.equal(sameClientKind("BUSINESS", "YOUNG"), false);
});

test("clientKindTypes lists every stored type that counts as the same account (for a database `in`)", () => {
  assert.deepEqual([...clientKindTypes("YOUNG")].sort(), ["PERSONAL", "YOUNG"]);
  assert.deepEqual([...clientKindTypes("PERSONAL")].sort(), ["PERSONAL", "YOUNG"]);
  assert.deepEqual(clientKindTypes("SAVINGS"), ["SAVINGS"]);
  assert.deepEqual(clientKindTypes("JOINT"), ["JOINT"]);
  assert.deepEqual(clientKindTypes("BUSINESS"), ["BUSINESS"]);
});

const rules12 = { cooldownMonths: 12, cooldownCutoffDate: null };

test("mostRestrictiveHistory: no rows, no answer", () => {
  assert.equal(mostRestrictiveHistory([], rules12, NOW), null);
});

test("the owner's case: a personal account closed two months ago blocks the young offer of the same bank (12 months)", () => {
  const rows = [{ wasClientFrom: D("2020-01-01"), wasClientUntil: D("2026-08-02") }];
  const worst = mostRestrictiveHistory(rows, rules12, NOW);
  assert.equal(worst?.result.status, "not-eligible");
  assert.equal(worst?.result.eligibleFromDate?.toISOString().slice(0, 10), "2027-08-02");
});

test("two rows of the same kind: the one that stands in the way decides, whatever the order", () => {
  const old = { wasClientFrom: D("2015-01-01"), wasClientUntil: D("2019-01-01") }; // karencja long gone
  const recent = { wasClientFrom: D("2023-01-01"), wasClientUntil: D("2026-08-02") }; // still waiting
  for (const rows of [[old, recent], [recent, old]]) {
    const worst = mostRestrictiveHistory(rows, rules12, NOW);
    assert.equal(worst?.row, recent);
    assert.equal(worst?.result.status, "not-eligible");
  }
  // only the old one: the user is clear
  assert.equal(mostRestrictiveHistory([old], rules12, NOW)?.result.status, "eligible");
});

test("a current client (no closure date) beats everything else, even a karencja that is already over", () => {
  const current = { wasClientFrom: D("2024-01-01"), wasClientUntil: null };
  const old = { wasClientFrom: D("2015-01-01"), wasClientUntil: D("2019-01-01") };
  const worst = mostRestrictiveHistory([old, current], rules12, NOW);
  assert.equal(worst?.row, current);
  assert.equal(worst?.result.currentClient, true);
});

test("a failed fixed cut-off (never resolves) beats a karencja that still ticks; of two waits the longer wins", () => {
  const rules = { cooldownMonths: 6, cooldownCutoffDate: D("2025-09-01") };
  const afterCutoff = { wasClientFrom: D("2024-01-01"), wasClientUntil: D("2025-12-01") }; // closed after the cut-off
  const waiting = { wasClientFrom: D("2020-01-01"), wasClientUntil: D("2025-03-01") }; // before the cut-off, 6 months over
  const worst = mostRestrictiveHistory([waiting, afterCutoff], rules, NOW);
  assert.equal(worst?.row, afterCutoff);
  assert.equal(worst?.result.cutoffFailed, true);

  const shortWait = { wasClientFrom: D("2020-01-01"), wasClientUntil: D("2026-08-01") }; // frees 2027-02-01
  const longWait = { wasClientFrom: D("2020-01-01"), wasClientUntil: D("2026-09-20") }; // frees 2027-03-20
  const picked = mostRestrictiveHistory([shortWait, longWait], { cooldownMonths: 6, cooldownCutoffDate: null }, NOW);
  assert.equal(picked?.row, longWait);
});

test("known beats unknown: an eligible row is returned over a row without any date", () => {
  const eligible = { wasClientFrom: D("2015-01-01"), wasClientUntil: D("2019-01-01") };
  const nothing = { wasClientFrom: null, wasClientUntil: null };
  assert.equal(mostRestrictiveHistory([nothing, eligible], rules12, NOW)?.row, eligible);
  assert.equal(mostRestrictiveHistory([nothing], rules12, NOW)?.result.status, "unknown");
});
