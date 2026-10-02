import test from "node:test";
import assert from "node:assert/strict";
import {
  warsawTodayAsUtcMidnight,
  signupCutoff,
  isDeadlinePassed,
  isSignupOpen,
  isBonusPartOpen,
  robotsForStatus
} from "../src/lib/promotionAvailability";

const d = (iso: string) => new Date(iso);
// A promotion whose last day is 30 Nov 2026 is stored as 2026-11-30T00:00Z.
const END = d("2026-11-30T00:00:00Z");

test("last day: open from its very first minute until Polish midnight", () => {
  // 00:00:00 UTC on the last day (01:00 in Warsaw, winter) - the old
  // `endDate >= now` check already called this "expired".
  assert.equal(isDeadlinePassed(END, d("2026-11-30T00:00:00Z")), false);
  assert.equal(isDeadlinePassed(END, d("2026-11-30T12:00:00Z")), false);
  // 22:59:59 UTC = 23:59:59 Warsaw (CET, UTC+1): still the last day.
  assert.equal(isDeadlinePassed(END, d("2026-11-30T22:59:59Z")), false);
  // 23:00:00 UTC = 00:00:00 on 1 Dec in Warsaw: now closed.
  assert.equal(isDeadlinePassed(END, d("2026-11-30T23:00:00Z")), true);
});

test("summer time (CEST, UTC+2): closes at 22:00 UTC", () => {
  const end = d("2026-08-31T00:00:00Z");
  assert.equal(isDeadlinePassed(end, d("2026-08-31T21:59:59Z")), false);
  assert.equal(isDeadlinePassed(end, d("2026-08-31T22:00:00Z")), true);
});

test("DST switch weekend (25 Oct 2026, CEST -> CET)", () => {
  const end = d("2026-10-25T00:00:00Z");
  // After the switch Warsaw is UTC+1, so the day ends at 23:00 UTC.
  assert.equal(isDeadlinePassed(end, d("2026-10-25T22:59:59Z")), false);
  assert.equal(isDeadlinePassed(end, d("2026-10-25T23:00:00Z")), true);
});

test("the cutoff is today's Polish date as 00:00 UTC", () => {
  assert.equal(warsawTodayAsUtcMidnight(d("2026-11-30T23:30:00Z")).toISOString(), "2026-12-01T00:00:00.000Z");
  assert.equal(signupCutoff(d("2026-07-01T21:59:00Z")).toISOString(), "2026-07-01T00:00:00.000Z");
  assert.equal(signupCutoff(d("2026-07-01T22:00:00Z")).toISOString(), "2026-07-02T00:00:00.000Z");
});

test("status and date must both allow sign-up", () => {
  const now = d("2026-10-02T09:00:00Z");
  const future = d("2026-11-30T00:00:00Z");
  const past = d("2026-09-30T00:00:00Z");
  assert.equal(isSignupOpen({ status: "ACTIVE", endDate: future }, now), true);
  assert.equal(isSignupOpen({ status: "ACTIVE", endDate: past }, now), false);
  for (const status of ["DRAFT", "EXPIRED", "ARCHIVED"]) {
    assert.equal(isSignupOpen({ status, endDate: future }, now), false, status);
  }
});

test("bonus part with its own earlier deadline closes independently", () => {
  const kantor = { availableUntil: d("2026-09-30T00:00:00Z") };
  assert.equal(isBonusPartOpen(kantor, d("2026-09-30T20:00:00Z")), true);
  assert.equal(isBonusPartOpen(kantor, d("2026-10-01T00:30:00Z")), false);
  assert.equal(isBonusPartOpen({ availableUntil: null }, d("2030-01-01T00:00:00Z")), true);
  assert.equal(isBonusPartOpen({}, d("2030-01-01T00:00:00Z")), true);
});

test("indexing is independent of the deadline; noindex pages keep follow", () => {
  assert.deepEqual(robotsForStatus("ACTIVE"), { index: true, follow: true });
  for (const status of ["DRAFT", "EXPIRED", "ARCHIVED"]) {
    assert.deepEqual(robotsForStatus(status), { index: false, follow: true }, status);
  }
  // robotsForStatus takes no date at all: a past-deadline ACTIVE page is not
  // dropped from the index by this function (sign-up is blocked elsewhere).
  assert.equal(robotsForStatus.length, 1);
});
