import test from "node:test";
import assert from "node:assert/strict";
import {
  dayKey,
  stepAvailability,
  resolveGroups,
  isRewardEarned,
  earnedCentsFor,
  type AvailabilityStep
} from "../src/lib/checklistAvailability";

const KANTOR_DEADLINE = new Date("2026-09-30T00:00:00Z");

// Shape of the real Erste ściąga: group 0 = account opening (2 plain steps)
// + the Kantor step + its 300 zl reward row; group 1 = month 1 with a 200 zl reward.
const steps: AvailabilityStep[] = [
  { id: "open1", order: 0, rewardCents: null },
  { id: "open2", order: 1, rewardCents: null },
  { id: "kantor", order: 2, rewardCents: null, availableUntil: KANTOR_DEADLINE },
  { id: "kantorReward", order: 3, rewardCents: 30000, availableUntil: KANTOR_DEADLINE },
  { id: "m1a", order: 10, rewardCents: null },
  { id: "m1b", order: 11, rewardCents: null },
  { id: "m1Reward", order: 14, rewardCents: 20000 }
];
const ids = (list: AvailabilityStep[]) => list.map((s) => s.id);
const group = (opened: Date | null, index: number) => resolveGroups(steps, opened).find((g) => g.groupIndex === index)!;

test("participant who took up the offer BEFORE the deadline keeps the Kantor steps and reward", () => {
  const opened = new Date("2026-09-12T00:00:00Z");
  const g0 = group(opened, 0);
  assert.deepEqual(ids(g0.requiredSteps), ["open1", "open2", "kantor"]);
  assert.equal(g0.rewardStep?.id, "kantorReward");
  const all = new Set(["open1", "open2", "kantor"]);
  assert.equal(isRewardEarned(g0, all), true);
  assert.equal(isRewardEarned(g0, new Set(["open1", "open2"])), false, "reward still needs the Kantor step");
  assert.equal(earnedCentsFor(steps, opened, new Set([...all, "m1a", "m1b"])), 30000 + 20000);
});

test("the last day itself still counts; the next day does not", () => {
  assert.equal(stepAvailability(steps[2]!, new Date("2026-09-30T00:00:00Z")), "available");
  assert.equal(stepAvailability(steps[2]!, "2026-09-30T23:59:59Z"), "available");
  assert.equal(stepAvailability(steps[2]!, new Date("2026-10-01T00:00:00Z")), "unavailable");
});

test("participant AFTER the deadline has no Kantor step to tick and no Kantor reward", () => {
  const opened = new Date("2026-10-05T00:00:00Z");
  const g0 = group(opened, 0);
  assert.deepEqual(ids(g0.visibleSteps), ["open1", "open2"], "Kantor step hidden");
  assert.deepEqual(ids(g0.requiredSteps), ["open1", "open2"]);
  assert.equal(g0.rewardStep, null, "Kantor reward hidden");
  // Finishing the rest is enough for the month; nothing is owed on Kantor.
  assert.equal(isRewardEarned(g0, new Set(["open1", "open2"])), false);
  assert.equal(earnedCentsFor(steps, opened, new Set(["open1", "open2", "m1a", "m1b"])), 20000);
});

test("a stale tick on an unavailable step never earns its reward (progress rows are kept, just ignored)", () => {
  const opened = new Date("2026-10-05T00:00:00Z");
  assert.equal(earnedCentsFor(steps, opened, new Set(["open1", "open2", "kantor"])), 0);
});

test("NO date: eligibility is not assumed - Kantor step is optional, reward needs it ticked explicitly", () => {
  const g0 = group(null, 0);
  assert.deepEqual(ids(g0.visibleSteps), ["open1", "open2", "kantor"]);
  assert.deepEqual(ids(g0.requiredSteps), ["open1", "open2"]);
  assert.deepEqual(ids(g0.unknownSteps), ["kantor"]);
  assert.deepEqual(ids(g0.bulkSteps), ["open1", "open2"], "'check the whole month' never ticks the unknown step");
  assert.equal(g0.rewardAvailability, "unknown");
  assert.equal(isRewardEarned(g0, new Set(["open1", "open2"])), false, "not auto-credited");
  assert.equal(isRewardEarned(g0, new Set(["open1", "open2", "kantor"])), true, "only after the user ticks it");
  assert.equal(earnedCentsFor(steps, null, new Set(["open1", "open2"])), 0);
});

test("steps without a deadline behave exactly as before (all required, reward when all ticked)", () => {
  for (const opened of [null, new Date("2026-09-01T00:00:00Z"), new Date("2027-01-01T00:00:00Z")]) {
    const g1 = group(opened, 1);
    assert.deepEqual(ids(g1.requiredSteps), ["m1a", "m1b"]);
    assert.equal(isRewardEarned(g1, new Set(["m1a"])), false);
    assert.equal(isRewardEarned(g1, new Set(["m1a", "m1b"])), true);
  }
});

test("joinedAt (registration on the site) plays no part: only accountOpenedAt is an input", () => {
  // Same account-opening date -> same result, whatever day the user registered here.
  assert.equal(stepAvailability(steps[2]!, "2026-09-20"), "available");
  assert.equal(dayKey("2026-09-20T22:30:00Z"), "2026-09-20");
});
