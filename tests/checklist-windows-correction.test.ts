// scripts/data-corrections/checklist-windows-2026-10.js: the corrected ściąga data, read through the real schedule
// (src/lib/checklistSchedule.ts), must open each group where the regulamin of the offer says it does. The dates below
// are the regulaminy's own worked examples or follow directly from their wording.
import test from "node:test";
import assert from "node:assert/strict";
import {
  deadlineForGroup,
  isGroupUnlocked,
  periodLastDay,
  periodRuleOf,
  unlockDateForGroup,
  type PeriodRule
} from "../src/lib/checklistSchedule";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const correction = require("../scripts/data-corrections/checklist-windows-2026-10.js") as {
  PLANS: { slug: string; before: Step[]; wanted: Map<string, Partial<Step>> }[];
  resolveAfter: (plan: { slug: string; before: Step[]; wanted: Map<string, Partial<Step>> }) => Step[];
  checkInvariants: (slug: string, steps: Step[]) => void;
};

interface Step {
  id: string;
  order: number;
  monthLabel: string;
  rewardCents: number | null;
  periodStartMonths: number | null;
  periodMonths: number | null;
}

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const planOf = (slug: string) => {
  const plan = correction.PLANS.find((p) => p.slug === slug);
  assert.ok(plan, `no plan for ${slug}`);
  return plan;
};

/** What the schedule says about group `g` of the corrected promotion for an agreement concluded on `opened`. */
function groupWindow(slug: string, g: number, opened: Date) {
  const after = correction.resolveAfter(planOf(slug));
  const steps = after.filter((s) => Math.floor(s.order / 10) === g);
  assert.ok(steps.length > 0, `${slug}: group ${g} is empty`);
  const rule: PeriodRule | null = periodRuleOf(steps);
  return {
    unlock: iso(unlockDateForGroup(opened, g, rule)),
    deadline: iso(deadlineForGroup(opened, g, rule)),
    lastDay: rule ? iso(periodLastDay(opened, rule)) : null,
    rule
  };
}

const ALIOR = "alior-plusy-karty-z-plusem-ikonto-biznes";
const CA = "creditagricole-kapitalna-premia";
const MILLENNIUM = "millennium-do-700-zl-na-twoje-przyjemnosci";
const ERSTE = "erste-platinum-1500-plus-300-zl";
const MBANK = "mbank-cala-naprzod-edycja-2-bony-biedronka";

test("the corrected end state of every promotion passes the schedule invariants", () => {
  for (const plan of correction.PLANS) {
    correction.checkInvariants(plan.slug, correction.resolveAfter(plan));
  }
});

test("the reviewed snapshots of Alior, Credit Agricole and Millennium were really shifted (the invariants reject them)", () => {
  for (const slug of [ALIOR, CA, MILLENNIUM]) {
    assert.throws(() => correction.checkInvariants(slug, planOf(slug).before), /sits at group|reward rows/, slug);
  }
});

test("Alior: Moneyback runs the 10 calendar months after the application month - Oct 2026 -> Nov 2026 .. Aug 2027 (regulamin §3 ust. 4)", () => {
  const opened = day("2026-10-15");
  assert.equal(groupWindow(ALIOR, 1, opened).unlock, "2026-11-01");
  assert.equal(groupWindow(ALIOR, 10, opened).unlock, "2027-08-01");
  // Bonus po roku is paid in the 13th month counted from the month after the application: Nov 2027.
  assert.equal(groupWindow(ALIOR, 13, opened).unlock, "2027-11-01");
});

test("Alior: Bonus na START (14 days) opens with the account and has no month-long window", () => {
  const start = correction.resolveAfter(planOf(ALIOR)).filter((s) => s.id.startsWith("alior_cs_start"));
  assert.deepEqual(start.map((s) => Math.floor(s.order / 10)), [0, 0]);
  assert.ok(start.every((s) => s.periodStartMonths === null));
  assert.equal(isGroupUnlocked(day("2026-10-15"), 0), true);
});

test("Credit Agricole: the regulamin's own example - account opened 5.07.2026, first cashback month is August", () => {
  const opened = day("2026-07-05");
  assert.equal(groupWindow(CA, 1, opened).unlock, "2026-08-01");
  assert.equal(groupWindow(CA, 12, opened).unlock, "2027-07-01"); // 12 months "licząc od następnego miesiąca po otwarciu": Aug 2026 .. Jul 2027
});

test("Credit Agricole: terminal 'do 3 miesięcy od daty otwarcia' = 5.07.2026 -> 5.10.2026; kredyt opens on the agreement date", () => {
  const opened = day("2026-07-05");
  const terminal = groupWindow(CA, 14, opened);
  assert.deepEqual([terminal.unlock, terminal.lastDay], ["2026-07-05", "2026-10-05"]);
  const kredyt = groupWindow(CA, 13, opened);
  assert.equal(kredyt.unlock, "2026-07-05");
  // 12 full calendar months from the opening end no earlier than the 12-month anniversary: the date shown is on the safe side.
  assert.ok(kredyt.lastDay! <= "2027-07-31");
  assert.equal(kredyt.lastDay, "2027-07-05");
});

test("Credit Agricole: leasing sits in the opening group (no deadline), each reward has its own group", () => {
  const after = correction.resolveAfter(planOf(CA));
  const group = (id: string) => Math.floor(after.find((s) => s.id === id)!.order / 10);
  assert.equal(group("ca2_cs_leasing_a"), 0);
  assert.equal(group("ca2_cs_leasing_r"), 0);
  assert.notEqual(group("ca2_cs_kredyt_r"), group("ca2_cs_terminal"));
});

test("Millennium: Premia II = the 5 months after the opening month (Oct 2026 -> Nov 2026 .. Mar 2027); Premia I (14 days) opens with the account", () => {
  const opened = day("2026-10-15");
  assert.equal(groupWindow(MILLENNIUM, 1, opened).unlock, "2026-11-01");
  assert.equal(groupWindow(MILLENNIUM, 5, opened).unlock, "2027-03-01");
  const after = correction.resolveAfter(planOf(MILLENNIUM));
  assert.deepEqual(
    ["mill_cs_10", "mill_cs_11", "mill_cs_12", "mill_cs_13"].map((id) => Math.floor(after.find((s) => s.id === id)!.order / 10)),
    [0, 0, 0, 0]
  );
});

test("Erste Platinum: months 1-3 stay on the calendar (Sep application -> Oct, Nov, Dec); the 9-of-12 reward opens after the 12th month", () => {
  const opened = day("2026-09-14");
  assert.equal(groupWindow(ERSTE, 1, opened).unlock, "2026-10-01");
  assert.equal(groupWindow(ERSTE, 3, opened).unlock, "2026-12-01");
  // 12 calendar months following the application month: Oct 2026 .. Sep 2027, judged from 1.10.2027.
  assert.equal(groupWindow(ERSTE, 13, opened).unlock, "2027-10-01");
});

test("mBank edycja II: Bonus III (child's account) opens with the agreement and ends no later than the bank's end of the first full month", () => {
  const opened = day("2026-10-15");
  const child = groupWindow(MBANK, 8, opened);
  assert.deepEqual([child.unlock, child.lastDay], ["2026-10-15", "2026-11-15"]);
  assert.ok(child.lastDay! <= "2026-11-30"); // first full month after October = November
  // The aggregate group opens right after the 6th full month (Nov .. Apr) = 1.05.2027 - unchanged and correct.
  assert.equal(groupWindow(MBANK, 7, opened).unlock, "2027-05-01");
});

test("every window rule in the correction is complete and only used by groups 1 and up", () => {
  for (const plan of correction.PLANS) {
    for (const s of correction.resolveAfter(plan)) {
      if (s.periodStartMonths === null && s.periodMonths === null) continue;
      assert.ok(s.periodStartMonths !== null && s.periodMonths !== null && s.periodMonths >= 1, `${s.id}: half-set rule`);
      assert.ok(Math.floor(s.order / 10) >= 1, `${s.id}: rule in group 0 would be ignored`);
    }
  }
});
