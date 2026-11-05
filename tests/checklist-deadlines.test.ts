// The rule behind the bell icon (header + ściąga card): src/lib/checklistDeadlines.ts.
// It must agree with the e-mail reminder (src/lib/services/checklistReminders.ts), so the cases below
// follow that service's conditions one by one: not group 0, already unlocked, not fully ticked, within 7 days.
import test from "node:test";
import assert from "node:assert/strict";
import {
  DEADLINE_WARNING_DAYS,
  alertItemsFor,
  daysLeftText,
  isUrgent,
  lastDayText,
  upcomingGroupDeadlines,
  type DeadlineStep
} from "../src/lib/checklistDeadlines";
import { ambientToneForCard } from "../src/lib/accountAmbient";

const step = (id: string, order: number, rewardCents: number | null = null, extra: Partial<DeadlineStep> = {}): DeadlineStep => ({
  id,
  order,
  rewardCents,
  monthLabel: "Miesiąc",
  ...extra
});

// Calendar schedule: opened 15.09.2026 -> group 1 = October (opens 1.10, closes 1.11), group 2 = November (closes 1.12).
const calendarSteps = [
  step("o1", 0),
  step("a1", 10),
  step("a2", 11),
  step("r1", 12, 7500),
  step("b1", 20),
  step("b2", 21),
  step("r2", 22, 7500)
];
const OPENED = "2026-09-15T00:00:00.000Z";
const at = (iso: string) => new Date(iso);

test("termin: 5 dni przed końcem miesiąca i niezaznaczone kroki = jeden alert z etykietą, dniem końca i liczbą kroków", () => {
  const result = upcomingGroupDeadlines(calendarSteps, OPENED, new Set(["o1"]), at("2026-10-27T12:00:00Z"));
  assert.equal(result.length, 1);
  const [october] = result;
  assert.equal(october!.groupIndex, 1);
  assert.equal(october!.label, "Pierwszy miesiąc po otwarciu konta");
  assert.equal(october!.daysLeft, 5);
  assert.equal(october!.openSteps, 2);
  assert.equal(october!.lastDay.toISOString().slice(0, 10), "2026-10-31");
});

test("termin: zaznaczone wszystkie kroki miesiąca gaszą alert, jeden niezaznaczony zostawia go", () => {
  const now = at("2026-10-27T12:00:00Z");
  assert.equal(upcomingGroupDeadlines(calendarSteps, OPENED, new Set(["a1", "a2"]), now).length, 0);
  const partial = upcomingGroupDeadlines(calendarSteps, OPENED, new Set(["a1"]), now);
  assert.equal(partial.length, 1);
  assert.equal(partial[0]!.openSteps, 1);
});

test("termin: dalej niż 7 dni, po terminie albo dla miesiąca, który jeszcze się nie zaczął - bez alertu", () => {
  assert.equal(upcomingGroupDeadlines(calendarSteps, OPENED, new Set(), at("2026-10-15T12:00:00Z")).length, 0, "16 dni do końca");
  assert.equal(upcomingGroupDeadlines(calendarSteps, OPENED, new Set(), at("2026-10-24T12:00:00Z")).length, 0, "24.10 w południe: 8 dni do końca");
  assert.equal(upcomingGroupDeadlines(calendarSteps, OPENED, new Set(), at("2026-10-25T12:00:00Z")).length, 1, "25.10 w południe: dokładnie 7 dni");
  // 1.11 00:00 (Warsaw) is the moment October stops being open.
  assert.equal(upcomingGroupDeadlines(calendarSteps, OPENED, new Set(), at("2026-11-02T12:00:00Z")).filter((d) => d.groupIndex === 1).length, 0, "po terminie października");
  // November is unlocked on 1.11 only: on 20.10 it is neither open nor due.
  assert.equal(upcomingGroupDeadlines(calendarSteps, OPENED, new Set(), at("2026-10-27T12:00:00Z")).filter((d) => d.groupIndex === 2).length, 0);
});

test("termin: grupa 0 (otwarcie konta) nie ma terminu miesięcznego, a bez daty otwarcia nic się nie liczy", () => {
  const now = at("2026-10-27T12:00:00Z");
  assert.ok(upcomingGroupDeadlines(calendarSteps, OPENED, new Set(), now).every((d) => d.groupIndex !== 0));
  assert.deepEqual(upcomingGroupDeadlines(calendarSteps, null, new Set(), now), []);
  assert.deepEqual(upcomingGroupDeadlines(calendarSteps, undefined, new Set(), now), []);
  assert.deepEqual(upcomingGroupDeadlines(calendarSteps, "not a date", new Set(), now), []);
});

test("termin: kroki podofert, na które uczestnik się spóźnił, nie liczą się (jak w przypominaniu e-mail)", () => {
  const late = [
    step("a1", 10, null, { availableUntil: "2026-09-10T00:00:00Z" }), // opened 15.09: too late, not required
    step("a2", 11),
    step("r1", 12, 5000)
  ];
  const result = upcomingGroupDeadlines(late, OPENED, new Set(), at("2026-10-27T12:00:00Z"));
  assert.equal(result[0]!.openSteps, 1, "tylko krok dostępny");
  assert.equal(upcomingGroupDeadlines(late, OPENED, new Set(["a2"]), at("2026-10-27T12:00:00Z")).length, 0);
});

test("termin: okno liczone od dnia umowy (PKO) - koniec okna to jego ostatni dzień włącznie", () => {
  // Agreement 6.07: period 2 = 7.08-6.09, so its last day is 6.09 and it closes 7.09 00:00.
  const windows = [
    step("w1", 10, null, { periodStartMonths: 0, periodMonths: 1, monthLabel: "Okres 1" }),
    step("w2", 20, null, { periodStartMonths: 1, periodMonths: 1, monthLabel: "Okres 2" })
  ];
  const result = upcomingGroupDeadlines(windows, "2026-07-06T00:00:00Z", new Set(["w1"]), at("2026-09-03T10:00:00Z"));
  assert.equal(result.length, 1);
  assert.equal(result[0]!.groupIndex, 2);
  assert.equal(result[0]!.lastDay.toISOString().slice(0, 10), "2026-09-06");
  assert.match(result[0]!.label, /Okres 2/);
  assert.equal(result[0]!.daysLeft, 4);
});

test("termin: ostatni dzień okna to daysLeft 1 („Dziś ostatni dzień”), a po nim już nic", () => {
  const windows = [step("w2", 20, null, { periodStartMonths: 1, periodMonths: 1, monthLabel: "Okres 2" })];
  const last = upcomingGroupDeadlines(windows, "2026-07-06T00:00:00Z", new Set(), at("2026-09-06T08:00:00Z"));
  assert.equal(last[0]!.daysLeft, 1);
  assert.equal(daysLeftText(1), "Dziś ostatni dzień");
  assert.equal(upcomingGroupDeadlines(windows, "2026-07-06T00:00:00Z", new Set(), at("2026-09-07T00:00:00Z")).length, 0);
});

test("termin: alertItemsFor niesie dane do dzwonka jako zwykły JSON", () => {
  const items = alertItemsFor(
    { id: "t1", promotionSlug: "p", promotionName: "Promocja", bankName: "Bank", accountOpenedAt: OPENED, steps: calendarSteps },
    new Set(["o1"]),
    at("2026-10-27T12:00:00Z")
  );
  assert.equal(items.length, 1);
  const { groupLabel, ...rest } = items[0]!;
  assert.equal(groupLabel, "Pierwszy miesiąc po otwarciu konta");
  assert.deepEqual(rest, {
    trackingId: "t1",
    promotionSlug: "p",
    promotionName: "Promocja",
    bankName: "Bank",
    daysLeft: 5,
    lastDay: "2026-10-31",
    openSteps: 2
  });
  assert.deepEqual(JSON.parse(JSON.stringify(items)), items, "da się wysłać przez JSON bez zmian");
});

test("termin: dwie grupy z terminem naraz są posortowane od najbliższej", () => {
  // Agreement 6.07: period 2 closes 7.09, period 3 (7.09-6.10) closes 7.10 - both within 7 days only for a short overlap,
  // so build it from two windows that end 1 day apart.
  const windows = [
    step("p1", 10, null, { periodStartMonths: 0, periodMonths: 2, monthLabel: "Do 6.09" }), // last day 6.09
    step("p2", 20, null, { periodStartMonths: 1, periodMonths: 1, monthLabel: "Okres 2" }) // 7.08-6.09
  ];
  const result = upcomingGroupDeadlines(windows, "2026-07-06T00:00:00Z", new Set(), at("2026-09-03T10:00:00Z"));
  assert.equal(result.length, 2);
  assert.ok(result[0]!.daysLeft <= result[1]!.daysLeft);
});

test("termin: teksty - liczba mnoga dni, data bez roku, czerwony alert od 2 dni", () => {
  assert.equal(daysLeftText(2), "Zostały 2 dni");
  assert.equal(daysLeftText(4), "Zostały 4 dni");
  assert.equal(daysLeftText(5), "Zostało 5 dni");
  assert.equal(daysLeftText(7), "Zostało 7 dni");
  assert.equal(lastDayText("2026-10-31"), "31.10");
  assert.equal(lastDayText(new Date("2026-09-06T00:00:00Z")), "6.09");
  assert.equal(DEADLINE_WARNING_DAYS, 7, "to samo okno co w mailu przypominającym");
  assert.equal(isUrgent(2), true);
  assert.equal(isUrgent(3), false);
});

test("tło konta: ściągi dostają kolejno trzy tony, a numeracja się zawija", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(ambientToneForCard), ["sciaga-0", "sciaga-1", "sciaga-2", "sciaga-0", "sciaga-1"]);
  assert.equal(ambientToneForCard(-1), "sciaga-2");
});
