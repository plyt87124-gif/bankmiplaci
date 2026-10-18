import test from "node:test";
import assert from "node:assert/strict";
import { computeEligibility, isCurrentClient } from "../src/lib/services/eligibility";

const NOW = new Date("2026-10-18T10:00:00Z");

test("a current client (start date, no closure date) is not eligible for an offer with a karencja rule", () => {
  const row = { wasClientFrom: new Date("2026-10-18T00:00:00Z"), wasClientUntil: null };
  assert.equal(isCurrentClient(row), true);
  assert.deepEqual(computeEligibility(36, null, null, NOW, true), { status: "not-eligible", currentClient: true });
});

test("no rule at all stays unknown, and no dates at all is not a current client", () => {
  assert.equal(computeEligibility(null, null, null, NOW, true).status, "unknown");
  assert.equal(isCurrentClient({ wasClientFrom: null, wasClientUntil: null }), false);
  assert.equal(isCurrentClient({ wasClientFrom: new Date(), wasClientUntil: new Date() }), false);
  assert.equal(isCurrentClient(null), false);
  assert.equal(computeEligibility(36, null, null, NOW).status, "unknown");
});
