import test from "node:test";
import assert from "node:assert/strict";
import {
  EXPIRED_INDEX_WINDOW_DAYS,
  daysSinceDeadline,
  expiredIndexWindowStart,
  isInExpiredIndexWindow,
  isSignupOpen,
  robotsForStatus,
  signupCutoff
} from "../src/lib/promotionAvailability";

const d = (iso: string) => new Date(iso);
const INDEX = { index: true, follow: true };
const NOINDEX = { index: false, follow: true };

// Offer whose last sign-up day is 13 Oct 2026 (stored as 2026-10-13T00:00Z).
const END = d("2026-10-13T00:00:00Z");

test("policy window is 90 days", () => {
  assert.equal(EXPIRED_INDEX_WINDOW_DAYS, 90);
});

test("daysSinceDeadline counts Warsaw calendar days from the last sign-up day", () => {
  assert.equal(daysSinceDeadline(END, d("2026-10-12T10:00:00Z")), -1);
  assert.equal(daysSinceDeadline(END, d("2026-10-13T10:00:00Z")), 0); // last day itself
  assert.equal(daysSinceDeadline(END, d("2026-10-13T21:59:59Z")), 0); // 23:59:59 in Warsaw (CEST)
  assert.equal(daysSinceDeadline(END, d("2026-10-13T22:00:00Z")), 1); // 00:00 14.10 in Warsaw
  assert.equal(daysSinceDeadline(END, d("2026-10-14T12:00:00Z")), 1);
  assert.equal(daysSinceDeadline(null), null);
  assert.equal(daysSinceDeadline(undefined), null);
  assert.equal(daysSinceDeadline("nonsense"), null);
});

test("ACTIVE and open: indexed", () => {
  assert.deepEqual(robotsForStatus("ACTIVE", END, d("2026-10-08T09:00:00Z")), INDEX);
  assert.deepEqual(robotsForStatus("ACTIVE", END, d("2026-10-13T10:00:00Z")), INDEX); // last day
});

test("ended <= 90 days ago: still indexed (page shows an 'ended' banner)", () => {
  // 90 days after 13.10.2026 is 11.01.2027.
  assert.deepEqual(robotsForStatus("EXPIRED", END, d("2026-10-14T10:00:00Z")), INDEX); // day 1
  assert.deepEqual(robotsForStatus("EXPIRED", END, d("2026-12-01T10:00:00Z")), INDEX);
  assert.deepEqual(robotsForStatus("EXPIRED", END, d("2027-01-11T10:00:00Z")), INDEX); // day 90
  // The cron may be late: an ACTIVE row past its deadline ages the same way.
  assert.deepEqual(robotsForStatus("ACTIVE", END, d("2026-10-20T10:00:00Z")), INDEX);
});

test("ended > 90 days ago: noindex,follow", () => {
  assert.deepEqual(robotsForStatus("EXPIRED", END, d("2027-01-12T10:00:00Z")), NOINDEX); // day 91
  assert.deepEqual(robotsForStatus("EXPIRED", END, d("2027-06-01T10:00:00Z")), NOINDEX);
  assert.deepEqual(robotsForStatus("ACTIVE", END, d("2027-01-12T10:00:00Z")), NOINDEX);
});

test("the 90-day boundary follows Poland's calendar day, across the DST switch", () => {
  // Last day 2026-07-02 (summer time); day 90 is 2026-09-30, day 91 is 2026-10-01.
  const end = d("2026-07-02T00:00:00Z");
  assert.deepEqual(robotsForStatus("EXPIRED", end, d("2026-09-30T21:59:59Z")), INDEX); // still 30.09 in Warsaw
  assert.deepEqual(robotsForStatus("EXPIRED", end, d("2026-09-30T22:00:00Z")), NOINDEX); // 01.10 00:00 in Warsaw
  // Across 25 Oct 2026 (CEST -> CET): last day 2026-07-27 -> day 90 = 2026-10-25.
  const end2 = d("2026-07-27T00:00:00Z");
  assert.deepEqual(robotsForStatus("EXPIRED", end2, d("2026-10-25T22:59:59Z")), INDEX); // CET: 23:59:59 on the 25th
  assert.deepEqual(robotsForStatus("EXPIRED", end2, d("2026-10-25T23:00:00Z")), NOINDEX);
});

test("DRAFT and ARCHIVED are never indexed, whatever the dates; unknown statuses neither", () => {
  for (const status of ["DRAFT", "ARCHIVED", "PUBLISHED", "", "active"]) {
    assert.deepEqual(robotsForStatus(status, END, d("2026-10-08T09:00:00Z")), NOINDEX, status);
    assert.deepEqual(robotsForStatus(status, d("2030-01-01T00:00:00Z"), d("2026-10-08T09:00:00Z")), NOINDEX, `${status} future`);
    assert.deepEqual(robotsForStatus(status), NOINDEX, `${status} no date`);
  }
});

test("EXPIRED whose end date is still ahead (closed early) is indexed with the banner", () => {
  assert.deepEqual(robotsForStatus("EXPIRED", d("2026-11-30T00:00:00Z"), d("2026-10-08T09:00:00Z")), INDEX);
});

test("missing or invalid end date: ACTIVE keeps the old behaviour, EXPIRED stays noindex", () => {
  assert.deepEqual(robotsForStatus("ACTIVE"), INDEX);
  assert.deepEqual(robotsForStatus("ACTIVE", null), INDEX);
  assert.deepEqual(robotsForStatus("ACTIVE", "garbage"), INDEX);
  assert.deepEqual(robotsForStatus("EXPIRED"), NOINDEX);
  assert.deepEqual(robotsForStatus("EXPIRED", null), NOINDEX);
});

test("every result keeps follow=true so links to current offers stay discoverable", () => {
  const now = d("2027-03-01T10:00:00Z");
  for (const status of ["ACTIVE", "EXPIRED", "DRAFT", "ARCHIVED"]) {
    assert.equal(robotsForStatus(status, END, now).follow, true, status);
  }
});

test("string end dates (serialised) behave like Date objects", () => {
  assert.deepEqual(robotsForStatus("EXPIRED", "2026-10-13T00:00:00.000Z", d("2026-12-01T10:00:00Z")), INDEX);
  assert.deepEqual(robotsForStatus("EXPIRED", "2026-10-13T00:00:00.000Z", d("2027-02-01T10:00:00Z")), NOINDEX);
});

test("expiredIndexWindowStart matches robotsForStatus exactly (sitemap DB filter == page robots)", () => {
  const now = d("2026-12-01T10:00:00Z");
  const start = expiredIndexWindowStart(now);
  assert.equal(start.toISOString(), "2026-09-02T00:00:00.000Z"); // 1 Dec minus 90 days
  assert.equal(start.getTime(), signupCutoff(now).getTime() - 90 * 24 * 3600 * 1000);
  const dayBefore = new Date(start.getTime() - 24 * 3600 * 1000);
  assert.deepEqual(robotsForStatus("EXPIRED", start, now), INDEX);
  assert.deepEqual(robotsForStatus("EXPIRED", dayBefore, now), NOINDEX);
  assert.equal(isInExpiredIndexWindow(start, now), true);
  assert.equal(isInExpiredIndexWindow(dayBefore, now), false);
});

test("isInExpiredIndexWindow excludes open offers and unknown dates", () => {
  const now = d("2026-10-13T10:00:00Z"); // last day
  assert.equal(isInExpiredIndexWindow(END, now), false);
  assert.equal(isInExpiredIndexWindow(END, d("2026-10-14T10:00:00Z")), true);
  assert.equal(isInExpiredIndexWindow(null, now), false);
});

test("sign-up availability and indexing are independent decisions", () => {
  const now = d("2026-11-01T10:00:00Z"); // 19 days after the end
  const offer = { status: "EXPIRED", endDate: END };
  assert.equal(isSignupOpen(offer, now), false);
  assert.deepEqual(robotsForStatus(offer.status, offer.endDate, now), INDEX);
});
