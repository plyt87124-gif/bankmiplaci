import test from "node:test";
import assert from "node:assert/strict";
import { computeEligibility, isChecklistRestartLocked, eligibleFromDate } from "../src/lib/services/eligibility";
import { parseAccountOpenedAt } from "../src/lib/services/checklistTracking";

const D = (s: string) => new Date(`${s}T00:00:00Z`);
const NOW = new Date("2026-10-02T12:00:00Z"); // 2 Oct 2026, 14:00 in Poland

// ---------------------------------------------------------------- cooldownMonths = 0

test("0 months with a known closure date in the past: eligible, no extra waiting", () => {
  const r = computeEligibility(0, null, D("2026-08-15"), NOW);
  assert.equal(r.status, "eligible");
  assert.equal(r.cutoffFailed, false);
  assert.equal(r.eligibleFromDate?.toISOString(), "2026-08-15T00:00:00.000Z");
});

test("0 months and the account closed today: eligible the same day", () => {
  assert.equal(computeEligibility(0, null, D("2026-10-02"), NOW).status, "eligible");
});

test("0 months right after midnight in Poland (still the previous day in UTC): a closure dated today is eligible", () => {
  const justAfterWarsawMidnight = new Date("2026-10-01T22:30:00Z"); // 00:30 on 2 Oct in Poland
  assert.equal(computeEligibility(0, null, D("2026-10-02"), justAfterWarsawMidnight).status, "eligible");
});

test("0 months is NOT the same as no rule: with a known date it decides, with NULL it does not", () => {
  assert.equal(computeEligibility(0, null, D("2026-08-15"), NOW).status, "eligible");
  assert.equal(computeEligibility(null, null, D("2026-08-15"), NOW).status, "unknown");
  assert.equal(computeEligibility(undefined, null, D("2026-08-15"), NOW).status, "unknown");
});

test("NULL months without a cutoff date: no rule, so nothing is assumed - even with a closure date", () => {
  assert.deepEqual(computeEligibility(null, null, D("2020-01-01"), NOW), { status: "unknown" });
});

// ---------------------------------------------------------------- missing history

test("no closure date in the user's data: unknown for every kind of rule (qualification is never assumed)", () => {
  assert.deepEqual(computeEligibility(0, null, null, NOW), { status: "unknown" });
  assert.deepEqual(computeEligibility(0, null, undefined, NOW), { status: "unknown" });
  assert.deepEqual(computeEligibility(12, null, null, NOW), { status: "unknown" });
  assert.deepEqual(computeEligibility(null, D("2024-08-01"), null, NOW), { status: "unknown" });
  assert.deepEqual(computeEligibility(0, D("2024-08-01"), null, NOW), { status: "unknown" });
});

// ---------------------------------------------------------------- future closure date

test("a closure date in the future is never eligible (the account is not closed yet)", () => {
  const zero = computeEligibility(0, null, D("2026-10-20"), NOW);
  assert.equal(zero.status, "not-eligible");
  assert.equal(zero.eligibleFromDate?.toISOString(), "2026-10-20T00:00:00.000Z");
  assert.equal(zero.cutoffFailed, false);
  // tomorrow is already "future"
  assert.equal(computeEligibility(0, null, D("2026-10-03"), NOW).status, "not-eligible");
  // the same holds when only a cutoff date is set
  const cutoffOnly = computeEligibility(null, D("2030-01-01"), D("2026-10-20"), NOW);
  assert.equal(cutoffOnly.status, "not-eligible");
  assert.equal(cutoffOnly.eligibleFromDate?.toISOString(), "2026-10-20T00:00:00.000Z");
});

test("a future closure date plus months waits for closure + months", () => {
  const r = computeEligibility(3, null, D("2026-10-20"), NOW);
  assert.equal(r.status, "not-eligible");
  assert.equal(r.eligibleFromDate?.toISOString(), "2027-01-20T00:00:00.000Z");
});

// ---------------------------------------------------------------- 0 months + independent cutoff date

test("0 months with a cutoff date the account met (closed before it): eligible", () => {
  const r = computeEligibility(0, D("2024-08-01"), D("2024-07-31"), NOW);
  assert.equal(r.status, "eligible");
  assert.equal(r.cutoffFailed, false);
});

test("0 months with a cutoff date the account did NOT meet: not eligible, and not because of time", () => {
  const r = computeEligibility(0, D("2024-08-01"), D("2025-03-10"), NOW);
  assert.equal(r.status, "not-eligible");
  assert.equal(r.cutoffFailed, true);
});

test("the cutoff day itself fails ('closed before DD.MM'), the day before passes", () => {
  assert.equal(computeEligibility(0, D("2024-08-01"), D("2024-08-01"), NOW).cutoffFailed, true);
  assert.equal(computeEligibility(0, D("2024-08-01"), D("2024-07-31"), NOW).cutoffFailed, false);
});

test("cutoff only (months NULL) still works, and a failed cutoff + a future date report both", () => {
  assert.equal(computeEligibility(null, D("2024-08-01"), D("2024-01-01"), NOW).status, "eligible");
  assert.equal(computeEligibility(null, D("2024-08-01"), D("2025-01-01"), NOW).status, "not-eligible");
  const both = computeEligibility(0, D("2024-08-01"), D("2026-10-20"), NOW);
  assert.equal(both.status, "not-eligible");
  assert.equal(both.cutoffFailed, true);
});

// ---------------------------------------------------------------- positive months (unchanged behaviour)

test("N months: eligible exactly on closure + N months, not the day before", () => {
  assert.equal(computeEligibility(12, null, D("2025-10-02"), NOW).status, "eligible");
  const notYet = computeEligibility(12, null, D("2025-10-03"), NOW);
  assert.equal(notYet.status, "not-eligible");
  assert.equal(notYet.eligibleFromDate?.toISOString(), "2026-10-03T00:00:00.000Z");
});

test("eligibleFromDate adds calendar months in UTC", () => {
  assert.equal(eligibleFromDate(D("2025-10-15"), 0).toISOString(), "2025-10-15T00:00:00.000Z");
  assert.equal(eligibleFromDate(D("2025-10-15"), 36).toISOString(), "2028-10-15T00:00:00.000Z");
});

// ---------------------------------------------------------------- restart lock

test("restart lock: a completed ściąga unlocks only on a clear 'eligible'", () => {
  const done = D("2026-08-01");
  assert.equal(isChecklistRestartLocked(done, computeEligibility(0, null, D("2026-08-01"), NOW)), false, "0 months, known date");
  assert.equal(isChecklistRestartLocked(done, computeEligibility(0, D("2026-01-01"), D("2026-08-01"), NOW)), true, "cutoff failed");
  assert.equal(isChecklistRestartLocked(done, computeEligibility(0, D("2027-01-01"), D("2026-08-01"), NOW)), false, "cutoff met");
  assert.equal(isChecklistRestartLocked(done, computeEligibility(null, null, D("2026-08-01"), NOW)), true, "NULL rule: stays locked");
  assert.equal(isChecklistRestartLocked(done, computeEligibility(0, null, null, NOW)), true, "no history: stays locked");
  assert.equal(isChecklistRestartLocked(done, computeEligibility(0, null, D("2026-12-01"), NOW)), true, "future closure date");
  assert.equal(isChecklistRestartLocked(done, computeEligibility(12, null, D("2026-08-01"), NOW)), true, "still waiting");
  assert.equal(isChecklistRestartLocked(null, computeEligibility(null, null, null, NOW)), false, "not completed: no lock");
});

// ---------------------------------------------------------------- account-opening date input

test("accountOpenedAt input: a real past day or today is accepted and stored as 00:00 UTC", () => {
  for (const day of ["2026-09-12", "2026-10-02", "2026-09-30", "2026-10-01"]) {
    const r = parseAccountOpenedAt(day, NOW);
    assert.equal(r.ok, true, day);
    if (r.ok) assert.equal(r.date.toISOString(), `${day}T00:00:00.000Z`);
  }
});

test("accountOpenedAt input: future dates are rejected (calendar day in Poland)", () => {
  assert.equal(parseAccountOpenedAt("2026-10-03", NOW).ok, false);
  assert.equal(parseAccountOpenedAt("2027-01-01", NOW).ok, false);
  // 00:30 on 3 Oct in Poland is still 2 Oct in UTC: the 3rd is today there, the 4th is future
  const earlyThird = new Date("2026-10-02T22:30:00Z");
  assert.equal(parseAccountOpenedAt("2026-10-03", earlyThird).ok, true);
  assert.equal(parseAccountOpenedAt("2026-10-04", earlyThird).ok, false);
});

test("accountOpenedAt input: malformed or impossible values are rejected", () => {
  const bad = ["", "   ", "02.10.2026", "2026-2-3", "2026-02-31", "2026-13-01", "2026-10-02T10:00:00Z", "0026-05-01", "1999-12-31", null, undefined, 20260901, {}];
  for (const value of bad) {
    assert.equal(parseAccountOpenedAt(value, NOW).ok, false, String(value));
  }
});
