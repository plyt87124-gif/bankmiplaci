// Billing windows counted from the day the agreement was concluded (ChecklistStep.periodStartMonths /
// periodMonths), as opposed to the original calendar-month schedule. The worked example is the one in the
// PKO "Rozkręć firmę z premią do 5 tys. zł" regulamin: account opened 6.07.2026 -> periods 6.07-6.08,
// 7.08-6.09, 7.09-6.10, and "within 3 months" tasks until 6.10.
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import {
  deadlineForGroup,
  isGroupUnlocked,
  isMonthGroup,
  isMonthLabel,
  monthGroupLabel,
  periodLastDay,
  periodRangeText,
  periodRuleOf,
  periodStartDate,
  unlockDateForGroup
} from "../src/lib/checklistSchedule";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const OPENED = day("2026-07-06");

const PERIOD_1 = { startMonths: 0, months: 1 };
const PERIOD_2 = { startMonths: 1, months: 1 };
const PERIOD_3 = { startMonths: 2, months: 1 };
const THREE_MONTHS = { startMonths: 0, months: 3 };

test("okresy z regulaminu PKO: 6.07-6.08, 7.08-6.09, 7.09-6.10", () => {
  assert.deepEqual([iso(periodStartDate(OPENED, PERIOD_1)), iso(periodLastDay(OPENED, PERIOD_1))], ["2026-07-06", "2026-08-06"]);
  assert.deepEqual([iso(periodStartDate(OPENED, PERIOD_2)), iso(periodLastDay(OPENED, PERIOD_2))], ["2026-08-07", "2026-09-06"]);
  assert.deepEqual([iso(periodStartDate(OPENED, PERIOD_3)), iso(periodLastDay(OPENED, PERIOD_3))], ["2026-09-07", "2026-10-06"]);
});

test("zadania „w ciągu 3 miesięcy od otwarcia” trwają od dnia umowy do 6.10 włącznie", () => {
  assert.equal(iso(periodStartDate(OPENED, THREE_MONTHS)), "2026-07-06");
  assert.equal(iso(periodLastDay(OPENED, THREE_MONTHS)), "2026-10-06");
  assert.equal(iso(deadlineForGroup(OPENED, 4, THREE_MONTHS)), "2026-10-07");
});

test("dzień, którego nie ma w miesiącu docelowym, to jego ostatni dzień; następny okres zaczyna się dzień po", () => {
  const jan31 = day("2026-01-31");
  assert.equal(iso(periodLastDay(jan31, PERIOD_1)), "2026-02-28");
  assert.equal(iso(periodStartDate(jan31, PERIOD_2)), "2026-03-01");
  assert.equal(iso(periodLastDay(jan31, PERIOD_2)), "2026-03-31");
  assert.equal(iso(periodLastDay(day("2027-11-30"), THREE_MONTHS)), "2028-02-29");
});

test("okres 1 odblokowuje się w dniu umowy, nie 1. dnia następnego miesiąca", () => {
  assert.equal(iso(unlockDateForGroup(OPENED, 1, PERIOD_1)), "2026-07-06");
  // bez reguły zostaje dotychczasowy harmonogram: 1. dzień miesiąca po miesiącu otwarcia
  const legacy = unlockDateForGroup(OPENED, 1);
  assert.equal(legacy.getMonth(), 7);
  assert.equal(legacy.getDate(), 1);
});

test("isGroupUnlocked: okres 2 otwiera się 7.08, okres 3 - 7.09, zadania 3-miesięczne od razu", () => {
  const at = (when: string) => mock.timers.enable({ apis: ["Date"], now: new Date(`${when}T12:00:00Z`) });
  try {
    at("2026-07-06");
    assert.equal(isGroupUnlocked(OPENED, 1, PERIOD_1), true);
    assert.equal(isGroupUnlocked(OPENED, 2, PERIOD_2), false);
    assert.equal(isGroupUnlocked(OPENED, 4, THREE_MONTHS), true);
    mock.timers.reset();

    at("2026-08-06");
    assert.equal(isGroupUnlocked(OPENED, 2, PERIOD_2), false);
    mock.timers.reset();

    at("2026-08-07");
    assert.equal(isGroupUnlocked(OPENED, 2, PERIOD_2), true);
    assert.equal(isGroupUnlocked(OPENED, 3, PERIOD_3), false);
    mock.timers.reset();

    at("2026-09-07");
    assert.equal(isGroupUnlocked(OPENED, 3, PERIOD_3), true);
  } finally {
    mock.timers.reset();
  }
});

test("bez daty umowy odblokowane jest tylko otwarcie konta, także dla grup z regułą", () => {
  assert.equal(isGroupUnlocked(null, 0), true);
  assert.equal(isGroupUnlocked(null, 1, PERIOD_1), false);
  assert.equal(isGroupUnlocked(null, 4, THREE_MONTHS), false);
});

test("termin przypomnienia: koniec okna (dzień po ostatnim dniu), a bez reguły - początek następnej grupy", () => {
  assert.equal(iso(deadlineForGroup(OPENED, 1, PERIOD_1)), "2026-08-07");
  assert.equal(iso(deadlineForGroup(OPENED, 3, PERIOD_3)), "2026-10-07");
  assert.equal(deadlineForGroup(OPENED, 1).getTime(), unlockDateForGroup(OPENED, 2).getTime());
});

test("etykiety: zakres dat z umowy; bez daty - sama etykieta z bazy", () => {
  assert.equal(monthGroupLabel(OPENED, 1, "Okres 1 – transakcje kartą", PERIOD_1), "Okres 1 – transakcje kartą (6.07–6.08.2026)");
  assert.equal(monthGroupLabel(OPENED, 3, "Okres 3 – transakcje kartą", PERIOD_3), "Okres 3 – transakcje kartą (7.09–6.10.2026)");
  assert.equal(monthGroupLabel(OPENED, 4, "Leasing PKO Leasing", THREE_MONTHS), "Leasing PKO Leasing (do 6.10.2026)");
  assert.equal(monthGroupLabel(null, 1, "Okres 1 – transakcje kartą", PERIOD_1), "Okres 1 – transakcje kartą");
  assert.equal(monthGroupLabel(OPENED, 0, "Otwarcie konta", null), "Otwarcie konta");
});

test("etykiety grup bez reguły: „Miesiąc N” dalej daje nazwę miesiąca kalendarzowego (oferty się nie zmieniają)", () => {
  assert.equal(monthGroupLabel(OPENED, 1, "Miesiąc 1"), "Pierwszy miesiąc po otwarciu konta");
  assert.equal(monthGroupLabel(OPENED, 1, "Miesiąc 1 (po otwarciu konta)"), "Pierwszy miesiąc po otwarciu konta");
  assert.equal(monthGroupLabel(null, 1, "Miesiąc 1"), "Pierwszy miesiąc po otwarciu konta");
  // otwarcie 6.07.2026: grupa 1 = sierpień, grupa 2 = wrzesień, grupa 7 = luty 2027
  assert.equal(monthGroupLabel(OPENED, 2, "Miesiąc 2"), "Wrzesień 2026");
  assert.equal(monthGroupLabel(OPENED, 7, "Miesiąc 7"), "Luty 2027");
  assert.equal(monthGroupLabel(OPENED, 3, "miesiąc 3"), "Październik 2026", "wielkość liter nie ma znaczenia");
  // bez daty otwarcia - etykieta z bazy
  assert.equal(monthGroupLabel(null, 2, "Miesiąc 2"), "Miesiąc 2");
  // pusta etykieta w bazie nie daje pustego nagłówka
  assert.equal(monthGroupLabel(OPENED, 2, ""), "Wrzesień 2026");
});

test("etykiety grup bez reguły: zbiorcza grupa (np. „po 6 miesiącach”) pokazuje etykietę z bazy, a nie nazwę miesiąca", () => {
  const mbank = "Nagrody zbiorcze (po 6 miesiącach)";
  const erste = "Nagroda lojalnościowa (9 z 12 miesięcy)";
  const nest = "Wymiana walut / Saldo EUR (podsumowanie po 3 mies.)";
  assert.equal(monthGroupLabel(OPENED, 7, mbank), mbank);
  assert.equal(monthGroupLabel(OPENED, 12, erste), erste);
  assert.equal(monthGroupLabel(OPENED, 4, nest), nest);
  assert.equal(monthGroupLabel(null, 7, mbank), mbank, "tak samo bez daty otwarcia");
  // także grupa 1: zbiorcza etykieta nie zamienia się w „Pierwszy miesiąc po otwarciu konta”
  assert.equal(monthGroupLabel(OPENED, 1, nest), nest);
  // otwarcie konta i grupy z regułą - bez zmian
  assert.equal(monthGroupLabel(OPENED, 0, "Otwarcie konta"), "Otwarcie konta");
  assert.equal(monthGroupLabel(OPENED, 7, mbank, PERIOD_1), `${mbank} (6.07–6.08.2026)`);
});

test("etykiety grup nie ruszają odblokowania ani terminu - te zależą tylko od numeru grupy i reguły", () => {
  // the calendar schedule works in local time (see the legacy check above), so compare local fields
  const local = (d: Date) => [d.getFullYear(), d.getMonth() + 1, d.getDate()];
  assert.deepEqual(local(unlockDateForGroup(OPENED, 7)), [2027, 2, 1]);
  assert.deepEqual(local(deadlineForGroup(OPENED, 7)), [2027, 3, 1]);});

test("isMonthLabel / isMonthGroup: tylko „Miesiąc N…” (i pusta etykieta) to miesiąc kalendarzowy", () => {
  for (const label of ["Miesiąc 1", "Miesiąc 12", "miesiąc 3", "Miesiąc 1 (po otwarciu konta)", "  Miesiąc 2", ""]) {
    assert.equal(isMonthLabel(label), true, label);
  }
  for (const label of ["Otwarcie konta", "Nagrody zbiorcze (po 6 miesiącach)", "Miesięczne zestawienie", "Okres 1 – transakcje kartą"]) {
    assert.equal(isMonthLabel(label), false, label);
  }
  assert.equal(isMonthGroup(1, "Miesiąc 1"), true);
  assert.equal(isMonthGroup(7, "Nagrody zbiorcze (po 6 miesiącach)"), false);
  assert.equal(isMonthGroup(0, "Miesiąc 0"), false, "otwarcie konta to nigdy miesiąc");
  assert.equal(isMonthGroup(1, "Miesiąc 1", PERIOD_1), false, "okno od dnia umowy to etap");
});

test("zakres w jednym roku ma rok raz, a przez przełom roku - przy obu datach", () => {
  assert.equal(periodRangeText(day("2026-12-10"), PERIOD_2), "11.01–10.02.2027");
  assert.equal(periodRangeText(day("2026-11-20"), PERIOD_2), "21.12.2026–20.01.2027");
});

test("periodRuleOf: brak pól = harmonogram miesięcy kalendarzowych (null); wartości graniczne są poprawiane", () => {
  assert.equal(periodRuleOf([{}, { periodStartMonths: null, periodMonths: null }]), null);
  assert.deepEqual(periodRuleOf([{ periodStartMonths: 1, periodMonths: 1 }]), PERIOD_2);
  assert.deepEqual(periodRuleOf([{ periodStartMonths: 0 }]), PERIOD_1);
  assert.deepEqual(periodRuleOf([{ periodStartMonths: -3, periodMonths: 0 }]), PERIOD_1);
});
