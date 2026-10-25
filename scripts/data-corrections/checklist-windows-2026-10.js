/**
 * PROPOSAL (not applied) - when each group of a ściąga opens, checked against the regulamin of the offer
 * (review of 2026-10-25). Moves steps between month groups and gives agreement-date windows to the groups that
 * the regulamin counts from the day of the agreement. Changes only checklist_steps.order / monthLabel /
 * periodStartMonths / periodMonths; no title, reward, status, rating or user data is touched. Users' ticks are
 * keyed by step id, so they survive the moves.
 *
 *   node scripts/data-corrections/checklist-windows-2026-10.js                            dry run (default) - writes nothing, records plan-*.json
 *   node scripts/data-corrections/checklist-windows-2026-10.js --apply --plan <plan-file> only if the data still equals the reviewed plan; one transaction + compare-and-set + revert file
 *   node scripts/data-corrections/checklist-windows-2026-10.js --revert <file>            [--force]
 *
 * Preparing this file is NOT approval to run --apply. Run it only after PR "okresy ściągi od dnia umowy" (migration
 * 20261025100000_checklist_step_contract_periods + the app version that reads the columns) is live; --apply refuses
 * to run while the columns are missing.
 *
 * How the app schedules a group (src/lib/checklistSchedule.ts), which is what decides every choice below:
 *  - no rule: group N opens on the 1st day of the N-th calendar month after the opening month (group = floor(order / 10)),
 *    and is labelled with that month's name; group 0 is open from the agreement date and has no deadline or reminder;
 *  - rule {periodStartMonths, periodMonths}: opens on agreement date + startMonths (+1 day) and lasts periodMonths
 *    whole months; the label becomes "<monthLabel> (<range>)".
 *
 * Findings (regulamin -> what the data did):
 *  1. Alior iKonto Biznes, Credit Agricole Kapitalna premia, Millennium 360 "Do 700 zł": a non-month group sat at index 1,
 *     so EVERY monthly group after it was one month late ("Miesiąc 1" opened on the 1st of month 2, while the real Moneyback /
 *     cashback / Premia II month 1 is the calendar month right after the opening month). Months go back to index = month
 *     number; the non-month groups move out of the way:
 *       - 14-day bonuses (Alior Bonus na START, Millennium Premia I) -> group 0, which is how the other ściągi already
 *         model 7/10/14/30-day windows (Alior Konto, mBank Załóż firmę). A month-based rule would show a window of a
 *         whole month for 14 days, so it is not used;
 *       - CA terminal "aktywujesz do 3 miesięcy od daty otwarcia" -> rule {0,3}, exactly what the regulamin says;
 *       - CA kredyt "12 pełnych miesięcy kalendarzowych od otwarcia" -> rule {0,12}: opens on the agreement date; the
 *         date it shows is the 12-month anniversary, up to ~4 weeks BEFORE the bank's end of the 12th calendar month
 *         (the safe side). The engine cannot say "end of the month";
 *       - CA leasing (three paths with different windows, 6 + 1 + 6 months) -> group 0 with no deadline shown, rather than
 *         a date that is right for one path only. It also stops CA group 1 carrying two reward rows, of which the app
 *         only ever counted the first.
 *  2. Erste Platinum "Nagroda lojalnościowa 9 z 12 miesięcy": sat at index 4, i.e. opened after month 3 - EARLIER than the
 *     9th qualifying month can exist. Moved to index 13 = the first day after the 12 months it is judged over.
 *  3. mBank "Cała naprzód" edycja II, Bonus III (child's account "do końca pierwszego pełnego miesiąca po otwarciu"): sat at
 *     index 8, opening long after its window closed. Rule {0,1}: opens on the agreement date; the end date it shows is
 *     one month after it, i.e. up to ~4 weeks before the bank's end of the first full month (the safe side).
 *
 * Checked and deliberately NOT changed (see the report):
 *  - mBank group 7 "Nagrody zbiorcze (po 6 miesiącach)": opens on the 1st day of month 7 = right after the 6th full month. Correct.
 *  - Nest EUR groups 4 and 5: both are judged after the same 3 full months, so both should open on the 1st of month 4. Group 4
 *    does; group 5 opens one month later because two reward groups cannot share an index. Harmless (late, not early).
 *  - Millennium "Konto Junior dla dziecka" (index 7): a separate promotion whose windows run from the CHILD's account and
 *    which ended on 18.10.2026 ("Tysiąc powodów na start z Kontem 360° Junior", regulamin obowiązuje od 10.08.2026).
 *    No schedule from the parent's agreement date can be right; hiding it is a separate decision for the owner.
 *
 * Guards: every step of the five promotions must still look like the reviewed snapshot below (or already be corrected),
 * otherwise nothing is planned; the planned end state must pass checkInvariants(); --apply needs the plan file of a
 * dry run and is compare-and-set per row (see lib.js).
 */
const { loadDb, existingColumns, printPlan, applyChanges, revertFrom, writePlan, assertMatchesPlan } = require("./lib");

const NAME = "checklist-windows-2026-10";
const groupOf = (order) => Math.floor(order / 10);

// ---- reviewed snapshot of production on 2026-10-25: [id, order, monthLabel, rewardCents] ----
const ALIOR_BEFORE = [
  ["alior_cs_open", 0, "Otwarcie konta", null],
  ["alior_cs_start_a", 10, "Bonus na START (14 dni)", null],
  ["alior_cs_start_r", 11, "Bonus na START (14 dni)", 50000],
  ["alior_cs_m1_a", 20, "Miesiąc 1 – Moneyback", null],
  ["alior_cs_m1_r", 21, "Miesiąc 1 – Moneyback", 30000],
  ["alior_cs_m2_a", 30, "Miesiąc 2 – Moneyback", null],
  ["alior_cs_m2_r", 31, "Miesiąc 2 – Moneyback", 30000],
  ["alior_cs_m3_a", 40, "Miesiąc 3 – Moneyback", null],
  ["alior_cs_m3_r", 41, "Miesiąc 3 – Moneyback", 30000],
  ["alior_cs_m4_a", 50, "Miesiąc 4 – Moneyback", null],
  ["alior_cs_m4_r", 51, "Miesiąc 4 – Moneyback", 30000],
  ["alior_cs_m5_a", 60, "Miesiąc 5 – Moneyback", null],
  ["alior_cs_m5_r", 61, "Miesiąc 5 – Moneyback", 30000],
  ["alior_cs_m6_a", 70, "Miesiąc 6 – Moneyback", null],
  ["alior_cs_m6_r", 71, "Miesiąc 6 – Moneyback", 30000],
  ["alior_cs_m7_a", 80, "Miesiąc 7 – Moneyback", null],
  ["alior_cs_m7_r", 81, "Miesiąc 7 – Moneyback", 30000],
  ["alior_cs_m8_a", 90, "Miesiąc 8 – Moneyback", null],
  ["alior_cs_m8_r", 91, "Miesiąc 8 – Moneyback", 30000],
  ["alior_cs_m9_a", 100, "Miesiąc 9 – Moneyback", null],
  ["alior_cs_m9_r", 101, "Miesiąc 9 – Moneyback", 30000],
  ["alior_cs_m10_a", 110, "Miesiąc 10 – Moneyback", null],
  ["alior_cs_m10_r", 111, "Miesiąc 10 – Moneyback", 30000],
  ["alior_cs_year_a", 130, "Miesiąc 13 – Bonus po roku", null],
  ["alior_cs_year_r", 131, "Miesiąc 13 – Bonus po roku", 50000]
];

const CA_BEFORE = [
  ["ca2_cs_open", 0, "Otwarcie konta", null],
  ["ca2_cs_kredyt_a", 10, "Kredyt firmowy", null],
  ["ca2_cs_kredyt_r", 11, "Kredyt firmowy", 200000],
  ["ca2_cs_leasing_a", 12, "Leasing", null],
  ["ca2_cs_leasing_r", 13, "Leasing", 50000],
  ["ca2_cs_terminal", 14, "Terminal płatniczy", null],
  ["ca2_cs_m1_a1", 20, "Miesiąc 1 – cashback i ZUS/US", null],
  ["ca2_cs_m1_a2", 21, "Miesiąc 1 – cashback i ZUS/US", null],
  ["ca2_cs_m1_r", 22, "Miesiąc 1 – cashback i ZUS/US", 20000],
  ["ca2_cs_m2_a1", 30, "Miesiąc 2 – cashback i ZUS/US", null],
  ["ca2_cs_m2_a2", 31, "Miesiąc 2 – cashback i ZUS/US", null],
  ["ca2_cs_m2_r", 32, "Miesiąc 2 – cashback i ZUS/US", 20000],
  ["ca2_cs_m3_a1", 40, "Miesiąc 3 – cashback i ZUS/US", null],
  ["ca2_cs_m3_a2", 41, "Miesiąc 3 – cashback i ZUS/US", null],
  ["ca2_cs_m3_r", 42, "Miesiąc 3 – cashback i ZUS/US", 20000],
  ["ca2_cs_m4_a1", 50, "Miesiąc 4 – cashback i ZUS/US", null],
  ["ca2_cs_m4_a2", 51, "Miesiąc 4 – cashback i ZUS/US", null],
  ["ca2_cs_m4_r", 52, "Miesiąc 4 – cashback i ZUS/US", 20000],
  ["ca2_cs_m5_a1", 60, "Miesiąc 5 – cashback i ZUS/US", null],
  ["ca2_cs_m5_a2", 61, "Miesiąc 5 – cashback i ZUS/US", null],
  ["ca2_cs_m5_r", 62, "Miesiąc 5 – cashback i ZUS/US", 20000],
  ["ca2_cs_m6_a1", 70, "Miesiąc 6 – cashback i ZUS/US", null],
  ["ca2_cs_m6_a2", 71, "Miesiąc 6 – cashback i ZUS/US", null],
  ["ca2_cs_m6_r", 72, "Miesiąc 6 – cashback i ZUS/US", 20000],
  ["ca2_cs_m7_a1", 80, "Miesiąc 7 – cashback i ZUS/US", null],
  ["ca2_cs_m7_a2", 81, "Miesiąc 7 – cashback i ZUS/US", null],
  ["ca2_cs_m7_r", 82, "Miesiąc 7 – cashback i ZUS/US", 20000],
  ["ca2_cs_m8_a1", 90, "Miesiąc 8 – cashback i ZUS/US", null],
  ["ca2_cs_m8_a2", 91, "Miesiąc 8 – cashback i ZUS/US", null],
  ["ca2_cs_m8_r", 92, "Miesiąc 8 – cashback i ZUS/US", 20000],
  ["ca2_cs_m9_a1", 100, "Miesiąc 9 – cashback i ZUS/US", null],
  ["ca2_cs_m9_a2", 101, "Miesiąc 9 – cashback i ZUS/US", null],
  ["ca2_cs_m9_r", 102, "Miesiąc 9 – cashback i ZUS/US", 20000],
  ["ca2_cs_m10_a1", 110, "Miesiąc 10 – cashback i ZUS/US", null],
  ["ca2_cs_m10_a2", 111, "Miesiąc 10 – cashback i ZUS/US", null],
  ["ca2_cs_m10_r", 112, "Miesiąc 10 – cashback i ZUS/US", 20000],
  ["ca2_cs_m11_a1", 120, "Miesiąc 11 – cashback i ZUS/US", null],
  ["ca2_cs_m11_a2", 121, "Miesiąc 11 – cashback i ZUS/US", null],
  ["ca2_cs_m11_r", 122, "Miesiąc 11 – cashback i ZUS/US", 20000],
  ["ca2_cs_m12_a1", 130, "Miesiąc 12 – cashback i ZUS/US", null],
  ["ca2_cs_m12_a2", 131, "Miesiąc 12 – cashback i ZUS/US", null],
  ["ca2_cs_m12_r", 132, "Miesiąc 12 – cashback i ZUS/US", 20000]
];

const MILLENNIUM_BEFORE = [
  ["mill_cs_1", 0, "Otwarcie konta", null],
  ["mill_cs_2", 1, "Otwarcie konta", null],
  ["mill_cs_10", 10, "Premia I (14 dni)", null],
  ["mill_cs_11", 11, "Premia I (14 dni)", null],
  ["mill_cs_12", 12, "Premia I (14 dni)", null],
  ["mill_cs_13", 13, "Premia I (14 dni)", 20000],
  ["mill_cs_20", 20, "Miesiąc 1", null],
  ["mill_cs_30", 30, "Miesiąc 2", null],
  ["mill_cs_40", 40, "Miesiąc 3", null],
  ["mill_cs_50", 50, "Miesiąc 4", null],
  ["mill_cs_60", 60, "Miesiąc 5", null],
  ["mill_cs_61", 61, "Miesiąc 5", 50000],
  ["mill_cs_70", 70, "Konto Junior dla dziecka", null],
  ["mill_cs_71", 71, "Konto Junior dla dziecka", null],
  ["mill_cs_72", 72, "Konto Junior dla dziecka", 30000]
];

const ERSTE_BEFORE = [
  ["cmtiw56ak000010agi4iyuzmg", 0, "Otwarcie konta", null],
  ["cmtiw56ak000110ag578m82v2", 1, "Otwarcie konta", null],
  ["cmtiw56ak000210agrcmvcsvr", 2, "Otwarcie konta", null],
  ["cmtiw56ak000310agg1jr332b", 3, "Otwarcie konta", 30000],
  ["cmtiw56ak000410agl7dstt5l", 10, "Miesiąc 1 (po otwarciu konta)", null],
  ["cmtiw56ak000510agk9kkqir2", 11, "Miesiąc 1 (po otwarciu konta)", null],
  ["cmtiw56ak000610agjisvye4g", 12, "Miesiąc 1 (po otwarciu konta)", null],
  ["cmtiw56ak000710agv6ntb2zk", 13, "Miesiąc 1 (po otwarciu konta)", null],
  ["cmtiw56ak000810agbevnfxlp", 14, "Miesiąc 1 (po otwarciu konta)", 20000],
  ["cmtiw56ak000910agno0ean1o", 20, "Miesiąc 2", null],
  ["cmtiw56ak000a10agq3yu3wia", 21, "Miesiąc 2", null],
  ["cmtiw56ak000b10ag5a8e2ldb", 22, "Miesiąc 2", null],
  ["cmtiw56ak000c10ag5ko1i32m", 23, "Miesiąc 2", null],
  ["cmtiw56ak000d10agnbzzb18o", 24, "Miesiąc 2", 20000],
  ["cmtiw56ak000e10ag4ye3rhgk", 30, "Miesiąc 3", null],
  ["cmtiw56ak000f10agytai3hmo", 31, "Miesiąc 3", null],
  ["cmtiw56ak000g10agra2184ji", 32, "Miesiąc 3", null],
  ["cmtiw56ak000h10aggz8e66c4", 33, "Miesiąc 3", null],
  ["cmtiw56ak000i10agmx8gaqrx", 34, "Miesiąc 3", 20000],
  ["cmtiw56ak000j10age5gfje1b", 40, "Nagroda lojalnościowa (9 z 12 miesięcy)", null],
  ["cmtiw56ak000k10agpltli24c", 41, "Nagroda lojalnościowa (9 z 12 miesięcy)", 90000]
];

const MBANK_BEFORE = [
  ["cmtucgdfd0000kgdoh9arh7mh", 0, "Otwarcie konta", null],
  ["cmtucgdfe0001kgdo9eh7yxcx", 1, "Otwarcie konta", null],
  ["cmtucgdfe0002kgdohjvmqbku", 10, "Miesiąc 1 (po otwarciu konta)", null],
  ["cmtucgdfe0003kgdodan70toq", 11, "Miesiąc 1 (po otwarciu konta)", null],
  ["cmtucgdfe0004kgdo32dpvcls", 12, "Miesiąc 1 (po otwarciu konta)", null],
  ["cmtucgdfe0005kgdop78fm80e", 13, "Miesiąc 1 (po otwarciu konta)", 15000],
  ["cmtucgdfe0006kgdo75z6rjgw", 20, "Miesiąc 2", null],
  ["cmtucgdfe0007kgdo6c7t9t3m", 21, "Miesiąc 2", null],
  ["cmtucgdfe0008kgdobeufu7hy", 22, "Miesiąc 2", null],
  ["cmtucgdfe0009kgdo7hifuam6", 23, "Miesiąc 2", 5000],
  ["cmtucgdfe000akgdoyn2sydza", 30, "Miesiąc 3", null],
  ["cmtucgdfe000bkgdof9smoxek", 31, "Miesiąc 3", null],
  ["cmtucgdfe000ckgdoiploh1ee", 32, "Miesiąc 3", null],
  ["cmtucgdfe000dkgdozhektayu", 33, "Miesiąc 3", 5000],
  ["cmtucgdfe000ekgdo7c0g80g2", 40, "Miesiąc 4", null],
  ["cmtucgdfe000fkgdovtzsmtcl", 41, "Miesiąc 4", null],
  ["cmtucgdfe000gkgdo1gzkbhr0", 42, "Miesiąc 4", null],
  ["cmtucgdfe000hkgdoeciw7zi8", 43, "Miesiąc 4", 5000],
  ["cmtucgdfe000ikgdoao5zf7zc", 50, "Miesiąc 5", null],
  ["cmtucgdfe000jkgdo9apg8csy", 51, "Miesiąc 5", null],
  ["cmtucgdfe000kkgdo53etr33r", 52, "Miesiąc 5", null],
  ["cmtucgdfe000lkgdohz0a90ap", 53, "Miesiąc 5", 5000],
  ["cmtucgdfe000mkgdow083qn2g", 60, "Miesiąc 6", null],
  ["cmtucgdfe000nkgdo0j2r8c02", 61, "Miesiąc 6", null],
  ["cmtucgdfe000okgdoacqzuvdf", 62, "Miesiąc 6", null],
  ["cmtucgdfe000pkgdotgft27z8", 63, "Miesiąc 6", 5000],
  ["cmtucgdfe000qkgdof0ibmdur", 70, "Nagrody zbiorcze (po 6 miesiącach)", null],
  ["cmtucgdfe000rkgdo4a67bwjp", 71, "Nagrody zbiorcze (po 6 miesiącach)", null],
  ["cmtucgdfe000skgdoma3t2lxh", 72, "Nagrody zbiorcze (po 6 miesiącach)", null],
  ["cmtucgdfe000tkgdoc4zr70h2", 73, "Nagrody zbiorcze (po 6 miesiącach)", 80000],
  ["cmtucgdfe000ukgdorgd8gywx", 80, "Bonus za konto dla dziecka (opcjonalnie)", null],
  ["cmtucgdfe000vkgdosw28zdjp", 81, "Bonus za konto dla dziecka (opcjonalnie)", 10000]
];

const fromTable = (rows) =>
  rows.map(([id, order, monthLabel, rewardCents]) => ({ id, order, monthLabel, rewardCents, periodStartMonths: null, periodMonths: null }));

// ---- the corrections: id -> wanted values (anything not listed stays as it is) ----
function aliorWanted() {
  const w = new Map();
  const g0 = "Otwarcie konta i Bonus na START (14 dni)";
  w.set("alior_cs_open", { order: 0, monthLabel: g0 });
  w.set("alior_cs_start_a", { order: 1, monthLabel: g0 });
  w.set("alior_cs_start_r", { order: 2, monthLabel: g0 });
  // Moneyback month k = k-th calendar month after the month of the card application (regulamin §3 ust. 4): group k.
  for (let k = 1; k <= 10; k++) {
    w.set(`alior_cs_m${k}_a`, { order: k * 10 });
    w.set(`alior_cs_m${k}_r`, { order: k * 10 + 1 });
  }
  // Bonus po roku (130/131) already sits at group 13 = after 12 full calendar months (§5 ust. 3-4): unchanged.
  return w;
}

function caWanted() {
  const w = new Map();
  const g0 = "Otwarcie konta i leasing EFL";
  w.set("ca2_cs_open", { order: 0, monthLabel: g0 });
  w.set("ca2_cs_leasing_a", { order: 1, monthLabel: g0 });
  w.set("ca2_cs_leasing_r", { order: 2, monthLabel: g0 });
  // Cashback and ZUS/US: 12 calendar months "licząc od następnego miesiąca po otwarciu" (pkt 5.2 b-c): group k.
  for (let k = 1; k <= 12; k++) {
    w.set(`ca2_cs_m${k}_a1`, { order: k * 10 });
    w.set(`ca2_cs_m${k}_a2`, { order: k * 10 + 1 });
    w.set(`ca2_cs_m${k}_r`, { order: k * 10 + 2 });
  }
  // Kredyt: "w ciągu 12 pełnych miesięcy kalendarzowych od otwarcia" (pkt 5.2 a). Own group, own reward row.
  w.set("ca2_cs_kredyt_a", { order: 130, periodStartMonths: 0, periodMonths: 12 });
  w.set("ca2_cs_kredyt_r", { order: 131, periodStartMonths: 0, periodMonths: 12 });
  // Terminal: "aktywujesz terminal POS do 3 miesięcy od daty otwarcia Konta Biznes" (pkt 5.3 c).
  w.set("ca2_cs_terminal", { order: 140, periodStartMonths: 0, periodMonths: 3 });
  return w;
}

function millenniumWanted() {
  const w = new Map();
  const g0 = "Otwarcie konta i Premia I (14 dni)";
  w.set("mill_cs_1", { order: 0, monthLabel: g0 });
  w.set("mill_cs_2", { order: 1, monthLabel: g0 });
  // Premia I: "w ciągu pierwszych 14 dni od dnia otwarcia konta" (pkt 4).
  w.set("mill_cs_10", { order: 2, monthLabel: g0 });
  w.set("mill_cs_11", { order: 3, monthLabel: g0 });
  w.set("mill_cs_12", { order: 4, monthLabel: g0 });
  w.set("mill_cs_13", { order: 5, monthLabel: g0 });
  // Premia II: "w każdym z 5 miesięcy następujących po miesiącu otwarcia konta" (pkt 4): groups 1-5.
  w.set("mill_cs_20", { order: 10 });
  w.set("mill_cs_30", { order: 20 });
  w.set("mill_cs_40", { order: 30 });
  w.set("mill_cs_50", { order: 40 });
  w.set("mill_cs_60", { order: 50 });
  w.set("mill_cs_61", { order: 51 });
  // mill_cs_70-72 (Konto Junior) stay at group 7, see the header.
  return w;
}

function ersteWanted() {
  const w = new Map();
  // "w ciągu 9 dowolnych z 12 miesięcy kalendarzowych następujących bezpośrednio po miesiącu złożenia wniosku"
  // (Zasady promocji pkt 4): judged once the 12 months are over = first day of month 13.
  w.set("cmtiw56ak000j10age5gfje1b", { order: 130 });
  w.set("cmtiw56ak000k10agpltli24c", { order: 131 });
  return w;
}

function mbankWanted() {
  const w = new Map();
  // Bonus III: eKonto Junior / eKonto możliwości for the child "do końca pierwszego pełnego miesiąca po otwarciu
  // swojego rachunku" (Warunki promocji pkt 5): opens with the agreement, lasts a month.
  w.set("cmtucgdfe000ukgdorgd8gywx", { order: 80, periodStartMonths: 0, periodMonths: 1 });
  w.set("cmtucgdfe000vkgdosw28zdjp", { order: 81, periodStartMonths: 0, periodMonths: 1 });
  return w;
}

const PLANS = [
  {
    slug: "alior-plusy-karty-z-plusem-ikonto-biznes",
    before: fromTable(ALIOR_BEFORE),
    wanted: aliorWanted(),
    source:
      "Alior, Regulamin promocji „Plusy Karty z Plusem…iKonto Biznes”: §3 ust. 4 (10 Miesięcy rozliczeniowych = miesiące kalendarzowe od miesiąca po złożeniu wniosku o kartę), §4 ust. 3 lit. a (Bonus na START: 14 dni kalendarzowych od otwarcia), §5 ust. 3-4 (Bonus po roku: 12 pełnych miesięcy, wypłata w 13. miesiącu)"
  },
  {
    slug: "creditagricole-kapitalna-premia",
    before: fromTable(CA_BEFORE),
    wanted: caWanted(),
    source:
      "Credit Agricole, Regulamin promocji „Kapitalna premia”: pkt 5 ust. 2 lit. a (kredyt: 12 pełnych miesięcy kalendarzowych od otwarcia), lit. b-c (cashback i ZUS/US: 12 miesięcy od następnego miesiąca po otwarciu), lit. d (leasing: 6 + 6 miesięcy, trzy ścieżki), ust. 3 lit. c (terminal: do 3 miesięcy od daty otwarcia)"
  },
  {
    slug: "millennium-do-700-zl-na-twoje-przyjemnosci",
    before: fromTable(MILLENNIUM_BEFORE),
    wanted: millenniumWanted(),
    source:
      "Millennium, Regulamin promocji „Do 700 zł na Twoje przyjemności z kontem Millennium 360°” (od 1.04.2026), pkt 4: Premia I w ciągu pierwszych 14 dni od dnia otwarcia konta, Premia II w każdym z 5 miesięcy następujących po miesiącu otwarcia konta"
  },
  {
    slug: "erste-platinum-1500-plus-300-zl",
    before: fromTable(ERSTE_BEFORE),
    wanted: ersteWanted(),
    source:
      "Erste, Regulamin promocji „Odkryj Konto Erste Platinum z nagrodą do 1500 zł”, Zasady promocji pkt 4 i Nagrody pkt 3 d (9 z 12 miesięcy kalendarzowych następujących po miesiącu złożenia wniosku)"
  },
  {
    slug: "mbank-cala-naprzod-edycja-2-bony-biedronka",
    before: fromTable(MBANK_BEFORE),
    wanted: mbankWanted(),
    source:
      "mBank, Regulamin promocji „Cała naprzód – zyskuj z kontem w mBanku – edycja II”, Warunki promocji pkt 5 (Bonus III: dziecko do końca pierwszego pełnego miesiąca po otwarciu rachunku)"
  }
];

/** The reviewed snapshot with the wanted values applied: what the database will look like afterwards. */
function resolveAfter(plan) {
  for (const id of plan.wanted.keys()) {
    if (!plan.before.some((s) => s.id === id)) throw new Error(`${plan.slug}: wanted step ${id} is not in the reviewed snapshot`);
  }
  return plan.before.map((s) => ({ ...s, ...(plan.wanted.get(s.id) ?? {}) }));
}

/** Throws when the end state of a promotion would break a rule of the schedule. */
function checkInvariants(slug, steps) {
  const fail = (msg) => {
    throw new Error(`${slug}: ${msg}`);
  };
  const orders = new Set();
  const groups = new Map();
  for (const s of steps) {
    if (orders.has(s.order)) fail(`two steps share order ${s.order}`);
    orders.add(s.order);
    const g = groupOf(s.order);
    groups.set(g, [...(groups.get(g) ?? []), s]);
  }
  for (const [g, list] of groups) {
    const rewards = list.filter((s) => s.rewardCents !== null);
    if (rewards.length > 1) fail(`group ${g} has ${rewards.length} reward rows (the app counts only the first)`);
    const rules = new Set(list.map((s) => `${s.periodStartMonths ?? "-"}/${s.periodMonths ?? "-"}`));
    if (rules.size > 1) fail(`group ${g} mixes window rules ${[...rules].join(", ")}`);
    const hasRule = list.some((s) => s.periodStartMonths !== null);
    if (hasRule && g < 1) fail(`group ${g} cannot carry a window rule (group 0 ignores it)`);
    if (hasRule && list.some((s) => s.periodStartMonths === null || s.periodMonths === null)) fail(`group ${g} has a half-set window rule`);
    if (!hasRule) {
      // "Miesiąc N" on the calendar schedule must sit at group N.
      for (const s of list) {
        const m = /^Miesiąc (\d+)\b/.exec(s.monthLabel);
        if (m && Number(m[1]) !== g) fail(`"${s.monthLabel}" (${s.id}) sits at group ${g}`);
      }
    }
  }
}

function describeSchedule(steps) {
  const groups = new Map();
  for (const s of steps) {
    const g = groupOf(s.order);
    groups.set(g, [...(groups.get(g) ?? []), s]);
  }
  const lines = [];
  for (const [g, list] of [...groups].sort((a, b) => a[0] - b[0])) {
    const rule = list.find((s) => s.periodStartMonths !== null);
    const when = rule
      ? `od dnia umowy${rule.periodStartMonths > 0 ? ` + ${rule.periodStartMonths} mies. + 1 dzień` : ""}, do dnia umowy + ${rule.periodStartMonths + rule.periodMonths} mies. włącznie`
      : g === 0
        ? "od dnia otwarcia, bez terminu"
        : `od 1. dnia ${g}. miesiąca kalendarzowego po miesiącu otwarcia`;
    const reward = list.find((s) => s.rewardCents !== null);
    lines.push(`  group ${String(g).padStart(2)}  "${list[0].monthLabel}"  ${list.length} step(s)${reward ? `, reward ${reward.rewardCents / 100} zł` : ""}  ${when}`);
  }
  return lines.join("\n");
}

/** Only the columns whose value really changes, with the value seen in this dry run as the guard. */
function diffOf(row, wanted) {
  const set = {};
  const expect = {};
  for (const [k, v] of Object.entries(wanted)) {
    const current = row[k] ?? null;
    if (current !== v) {
      set[k] = v;
      expect[k] = current;
    }
  }
  return { set, expect };
}

/** Live rows must be the reviewed snapshot, or already corrected - never something nobody looked at. */
function verifyLive(plan, after, rows) {
  const beforeById = new Map(plan.before.map((s) => [s.id, s]));
  const afterById = new Map(after.map((s) => [s.id, s]));
  const liveIds = new Set(rows.map((r) => r.id));
  const missing = plan.before.filter((s) => !liveIds.has(s.id)).map((s) => s.id);
  const extra = rows.filter((r) => !beforeById.has(r.id)).map((r) => r.id);
  if (missing.length || extra.length) {
    throw new Error(
      `${plan.slug}: the ściąga is not the reviewed one (missing: ${missing.join(", ") || "-"}; unknown: ${extra.join(", ") || "-"}). Nothing was planned; review it again.`
    );
  }
  for (const r of rows) {
    const b = beforeById.get(r.id);
    const a = afterById.get(r.id);
    const same = (s) =>
      s.order === r.order &&
      s.monthLabel === r.monthLabel &&
      s.rewardCents === (r.rewardCents ?? null) &&
      s.periodStartMonths === (r.periodStartMonths ?? null) &&
      s.periodMonths === (r.periodMonths ?? null);
    if (!same(b) && !same(a)) {
      throw new Error(
        `${plan.slug}: step ${r.id} differs from the reviewed state (order ${r.order}, label ${JSON.stringify(r.monthLabel)}, reward ${r.rewardCents ?? null}, ` +
          `window ${r.periodStartMonths ?? "-"}/${r.periodMonths ?? "-"}). Nothing was planned; review it again.`
      );
    }
  }
}

async function main() {
  const db = loadDb();
  try {
    const args = process.argv.slice(2);
    if (args.includes("--revert")) {
      await revertFrom(db, args[args.indexOf("--revert") + 1], args.includes("--force"));
      return;
    }
    const apply = args.includes("--apply");
    const columns = await existingColumns(db, ["checklist_steps"]);

    const changes = [];
    const summaries = [];
    for (const plan of PLANS) {
      const after = resolveAfter(plan);
      checkInvariants(plan.slug, after); // the target itself must be sound
      const [promo] = await db.$queryRawUnsafe(`select id, slug from promotions where slug = $1`, plan.slug);
      if (!promo) throw new Error(`promotion not found: ${plan.slug}`);
      const rows = await db.$queryRawUnsafe(`select * from checklist_steps where "promotionId" = $1 order by "order"`, promo.id);
      verifyLive(plan, after, rows);
      const rowById = new Map(rows.map((r) => [r.id, r]));
      let sourceShown = false;
      for (const [id, wanted] of plan.wanted) {
        const { set, expect } = diffOf(rowById.get(id), wanted);
        if (Object.keys(set).length === 0) continue;
        const touchesWindow = "periodStartMonths" in set || "periodMonths" in set;
        changes.push({
          table: "checklist_steps",
          id,
          label: `${plan.slug} / ${id}`,
          source: sourceShown ? undefined : plan.source, // one citation per promotion keeps the dry run readable
          set,
          expect,
          ...(touchesWindow ? { requires: ["checklist_steps.periodStartMonths", "checklist_steps.periodMonths"] } : {})
        });
        sourceShown = true;
      }
      summaries.push(`\n${plan.slug} - schedule after the correction:\n${describeSchedule(after)}`);
    }

    printPlan("ściąga windows 2026-10", changes, columns);
    console.log(summaries.join("\n"));
    console.log(
      "\nDeliberately unchanged: titles, rewards, ratings, status, dates of the offers, user data (ticks are keyed by step id), " +
        "mBank group 7, Nest EUR groups 4-5, Millennium Konto Junior (see the header)."
    );

    if (!apply) {
      const planFile = writePlan(NAME, changes);
      console.log(`\nDry run only - nothing written to the database. Plan recorded in ${planFile}.`);
      console.log("To apply after review (migration + new app version must be live):");
      console.log(`  node scripts/data-corrections/${NAME}.js --apply --plan ${planFile}`);
      return;
    }
    const planArg = args.indexOf("--plan");
    if (planArg === -1) throw new Error("--apply needs --plan <file from the reviewed dry run>.");
    assertMatchesPlan(args[planArg + 1], changes);
    await applyChanges(db, NAME, changes, columns);
  } finally {
    await db.$disconnect();
  }
}

module.exports = { PLANS, resolveAfter, checkInvariants, describeSchedule, groupOf };

if (require.main === module) {
  main().catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  });
}
