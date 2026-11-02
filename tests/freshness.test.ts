import test from "node:test";
import assert from "node:assert/strict";
import {
  AGING_MAX_DAYS,
  DEADLINE_URGENT_DAYS,
  DEADLINE_WARN_DAYS,
  FRESH_MAX_DAYS,
  daysSinceVerified,
  deadlineState,
  describeFreshness,
  freshnessState
} from "../src/lib/freshness";

// "Today" in all tests: 9 Oct 2026, 12:00 in Warsaw (CEST, UTC+2).
const NOW = new Date("2026-10-09T10:00:00Z");

test("freshness thresholds: <=2 fresh (the daily verification promise), 3 aging, >3 stale", () => {
  assert.equal(FRESH_MAX_DAYS, 2);
  assert.equal(AGING_MAX_DAYS, 3);

  const at = (iso: string) => freshnessState(new Date(iso), NOW);
  assert.equal(at("2026-10-09T08:00:00Z"), "fresh"); // today, 0 days
  assert.equal(at("2026-10-08T08:00:00Z"), "fresh"); // 1 day
  assert.equal(at("2026-10-07T08:00:00Z"), "fresh"); // 2 days
  assert.equal(at("2026-10-06T08:00:00Z"), "aging"); // 3 days
  assert.equal(at("2026-10-05T08:00:00Z"), "stale"); // 4 days
  assert.equal(at("2025-01-01T08:00:00Z"), "stale");
});

test("freshness: missing or invalid date is unknown, never 'fresh'", () => {
  assert.equal(freshnessState(null, NOW), "unknown");
  assert.equal(freshnessState(undefined, NOW), "unknown");
  assert.equal(freshnessState("not a date", NOW), "unknown");
  assert.equal(daysSinceVerified(null, NOW), null);
  assert.equal(describeFreshness(null, NOW).text, "Brak daty weryfikacji");
  assert.equal(describeFreshness(null, NOW).dateText, null);
});

test("freshness counts Warsaw calendar days, not UTC days or 24 h blocks", () => {
  // 6 Oct 23:30 UTC is already 7 Oct in Warsaw: 2 days before 9 Oct -> fresh.
  // (By UTC date it would be 3 days, i.e. aging.)
  assert.equal(daysSinceVerified("2026-10-06T23:30:00Z", NOW), 2);
  assert.equal(freshnessState("2026-10-06T23:30:00Z", NOW), "fresh");

  // Just after midnight in Warsaw "today" starts: 22:30 UTC on 8 Oct = 00:30 on 9 Oct.
  assert.equal(daysSinceVerified("2026-10-08T22:30:00Z", NOW), 0);
  // 23 h earlier than NOW but on the previous Warsaw day:
  assert.equal(daysSinceVerified("2026-10-08T09:00:00Z", NOW), 1);
});

test("freshness works across the October DST change", () => {
  // 26 Oct 2026 is after the switch to CET (25 Oct). 28 Sep -> 26 Oct = 28 days.
  const now = new Date("2026-10-26T11:00:00Z");
  assert.equal(daysSinceVerified("2026-09-28T10:00:00Z", now), 28);
});

test("freshness: a date up to a day ahead (clock skew) counts as 0 days; further ahead is invalid data", () => {
  const tomorrow = new Date(NOW.getTime() + 24 * 60 * 60 * 1000).toISOString();
  assert.equal(daysSinceVerified(tomorrow, NOW), 0);
  assert.equal(freshnessState(tomorrow, NOW), "fresh");
  assert.equal(daysSinceVerified("2026-10-20T08:00:00Z", NOW), null);
  assert.equal(freshnessState("2026-10-20T08:00:00Z", NOW), "unknown");
});

test("freshness labels are Polish and use the Warsaw date", () => {
  const fresh = describeFreshness("2026-10-07T08:30:00Z", NOW);
  assert.equal(fresh.state, "fresh");
  assert.equal(fresh.days, 2);
  assert.equal(fresh.text, "Zweryfikowano 7 paź 2026");
  assert.equal(fresh.iso, "2026-10-07");
  assert.equal(fresh.suffix, null);

  const aging = describeFreshness("2026-10-06T08:30:00Z", NOW);
  assert.equal(aging.state, "aging");
  assert.equal(aging.text, "Zweryfikowano 6 paź 2026");

  const stale = describeFreshness("2026-06-01T08:30:00Z", NOW);
  assert.equal(stale.state, "stale");
  assert.equal(stale.text, "Zweryfikowano 1 cze 2026 – dane mogą być nieaktualne");

  // 23:30 UTC is already the next day in Warsaw - the label follows Poland's calendar.
  assert.equal(describeFreshness("2026-10-05T23:30:00Z", NOW).dateText, "6 paź 2026");
});

test("deadline thresholds: >14 open, 4-14 soon, 0-3 urgent, <0 ended", () => {
  assert.equal(DEADLINE_WARN_DAYS, 14);
  assert.equal(DEADLINE_URGENT_DAYS, 3);

  const at = (day: string) => deadlineState(new Date(`${day}T00:00:00Z`), NOW);
  assert.deepEqual([at("2026-10-24").state, at("2026-10-24").days], ["open", 15]);
  assert.deepEqual([at("2026-10-23").state, at("2026-10-23").days], ["soon", 14]);
  assert.deepEqual([at("2026-10-13").state, at("2026-10-13").days], ["soon", 4]);
  assert.deepEqual([at("2026-10-12").state, at("2026-10-12").days], ["urgent", 3]);
  assert.deepEqual([at("2026-10-09").state, at("2026-10-09").days], ["urgent", 0]);
  assert.deepEqual([at("2026-10-08").state, at("2026-10-08").days], ["ended", -1]);
});

test("deadline labels", () => {
  const at = (day: string, now = NOW) => deadlineState(day, now);
  assert.equal(at("2026-10-31").label, "Ważna do 31.10.2026");
  assert.equal(at("2026-10-14").label, "Koniec za 5 dni");
  assert.equal(at("2026-10-10").label, "Koniec za 1 dzień");
  assert.equal(at("2026-10-11").label, "Koniec za 2 dni");
  assert.equal(at("2026-10-09").label, "Koniec dziś");
  assert.equal(at("2026-10-01").label, "Zakończona");
});

test("deadline detailed labels add the missing half, with correct Polish agreement", () => {
  const at = (day: string) => deadlineState(day, NOW).detailedLabel;
  assert.equal(at("2026-10-31"), "Ważna do 31.10.2026, zostały 22 dni");
  assert.equal(at("2026-10-30"), "Ważna do 30.10.2026, zostało 21 dni");
  assert.equal(at("2026-11-04"), "Ważna do 04.11.2026, zostało 26 dni");
  assert.equal(at("2026-10-14"), "Koniec za 5 dni (do 14.10.2026)");
  assert.equal(at("2026-10-01"), "Zakończona 01.10.2026");
});

test("deadline: the whole last day counts, Warsaw midnight closes it", () => {
  // 21:30 UTC on 9 Oct = 23:30 in Warsaw: still the last day.
  assert.equal(deadlineState("2026-10-09", new Date("2026-10-09T21:30:00Z")).state, "urgent");
  // 22:30 UTC = 00:30 on 10 Oct in Warsaw: ended.
  assert.equal(deadlineState("2026-10-09", new Date("2026-10-09T22:30:00Z")).state, "ended");
});

test("deadline days are exact across the DST change (25 Oct 2026)", () => {
  const now = new Date("2026-10-20T10:00:00Z");
  const info = deadlineState("2026-11-03", now);
  assert.equal(info.days, 14);
  assert.equal(info.state, "soon");
});

test("deadline: missing or invalid end date is unknown (no invented deadline)", () => {
  for (const value of [null, undefined, "garbage"]) {
    const info = deadlineState(value, NOW);
    assert.equal(info.state, "unknown");
    assert.equal(info.days, null);
    assert.equal(info.label, "");
  }
});
