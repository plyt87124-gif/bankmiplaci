/**
 * PROPOSAL (not applied) - Erste Platinum: split the account offer from the
 * closed Kantor bonus, correct the payout schedule, fix the account fee.
 *
 *   node scripts/data-corrections/erste-platinum.js                    dry run (default) - writes nothing
 *   node scripts/data-corrections/erste-platinum.js --apply            one transaction + compare-and-set + revert file
 *   node scripts/data-corrections/erste-platinum.js --revert <file>    [--force]
 *
 * Preparing this file is NOT approval to run --apply. Do not run it before the
 * schema migrations are deployed (it refuses to, see lib.js), and only after
 * the application version that understands BonusPart.availableUntil is live.
 *
 * Sources, all opened and read for this proposal (2026-10-02):
 *  [A] https://www.erste.pl/_fileserver/item/1528777  Regulamin "Odkryj Konto Erste Platinum z nagroda do 1500 zl"
 *      (byte-identical to the stored sourceUrl .../1528779)
 *      p.2 "Czas promocji": trwa 1.09.2026-31.12.2027; zapisy 1.09-30.11.2026.
 *      p.3-4 "Zasady promocji" and p.5 "Nagrody": 3x200 zl and 900 zl, payout dates.
 *      p.4 pkt 5: lists the promotions it does NOT combine with - the Kantor one is not among them.
 *  [K] https://www.erste.pl/_fileserver/item/1528604  Regulamin "do 300 zl z walutami w Kantorze Erste"
 *      p.2 "Czas promocji": trwa 1.08-20.12.2026; zapisy 1.08-30.09.2026.
 *      p.4 "Zasady promocji" pkt 2: wymiana do 31.10.2026 (przystapienie w sierpniu) / 30.11.2026 (we wrzesniu).
 *      p.5 "Nagrody" pkt 6: wyplata do 25.11.2026 / do 20.12.2026.
 *      No combination restriction anywhere in the document.
 *  [T] https://www.erste.pl/regulation_file_server/time20260415122006/download?id=167685&lang=pl_PL
 *      Tabela oplat i prowizji, obowiazuje od 25.04.2026: Tabela 2 (Konto Erste Platinum) pkt 1,
 *      p.13/123: "0 zl albo 45 zl; 0 zl, gdy spelnisz warunek: wplywy co najmniej 10 000 zl lub srednie
 *      saldo aktywow co najmniej 150 000 zl"; Tabela 2 - Karty debetowe, Visa Platinum, pkt 1: 0 zl.
 *
 * Deliberately NOT changed: slug, users' trackings / checklist progress / steps' order and ids,
 * `status` (stays EXPIRED = no affiliate link, no redirect - it is only switched back to ACTIVE by a
 * person once eBrokerPartner confirms the campaign is live), affiliateUrl, rating, and lastVerifiedAt
 * (this check covered the dates, rewards and fees above, not the whole offer, so the date is not bumped).
 *
 * Separate dates this correction keeps apart:
 *   sign-up for the account offer .... Promotion.endDate            30.11.2026   [A]
 *   sign-up for the Kantor bonus ..... BonusPart.availableUntil     30.09.2026   [K]
 *   Kantor exchange window ........... 31.10.2026 / 30.11.2026 (people who already joined) [K]
 *   payouts .......................... per-month table in the article, [A] p.5, [K] p.5
 *   affiliate campaign ............... Promotion.status (owner decision, not touched)
 */
const { loadDb, existingColumns, printPlan, applyChanges, revertFrom, fmt } = require("./lib");

const SLUG = "erste-platinum-1500-plus-300-zl";
const ARTICLE_SLUG = "erste-bank-jak-zdobyc-do-1500-zl-premii";

const NEW_PAYOUT_SECTION = `### Kiedy dostaniesz te 600 zł?

Warto rozróżnić trzy rzeczy: **miesiąc złożenia wniosku**, **trzy miesiące, w których wykonujesz warunki** (to trzy miesiące następujące bezpośrednio po miesiącu wniosku — sam miesiąc wniosku się do nich nie liczy) oraz **termin wypłaty**. Bank wypłaca każde 200 zł najpóźniej w ostatnim dniu miesiąca następującego po miesiącu, w którym spełniłeś/aś warunki:

| Wniosek złożony w | Miesiące wykonania warunków | 1. nagroda 200 zł | 2. nagroda 200 zł | 3. nagroda 200 zł |
|---|---|---|---|---|
| wrześniu 2026 | październik, listopad, grudzień 2026 | do 30 listopada 2026 | do 31 grudnia 2026 | do 31 stycznia 2027 |
| październiku 2026 | listopad, grudzień 2026, styczeń 2027 | do 31 grudnia 2026 | do 31 stycznia 2027 | do 28 lutego 2027 |
| listopadzie 2026 | grudzień 2026, styczeń, luty 2027 | do 31 stycznia 2027 | do 28 lutego 2027 | do 31 marca 2027 |

Przykład: wniosek we wrześniu, warunki spełnione w październiku → 200 zł najpóźniej 30 listopada.

Żeby nagroda została wypłacona, w dniu wypłaty Konto Erste Platinum, karta debetowa i usługi Erste online muszą być aktywne, a zgody wymagane przy składaniu wniosku — nadal udzielone. Nie możesz też w trakcie promocji zmienić typu konta na inne konto w złotych.

**Źródło:** [Regulamin promocji „Odkryj Konto Erste Platinum z nagrodą do 1500 zł"](https://www.erste.pl/_fileserver/item/1528777), sekcje „Zasady promocji" (pkt 2) i „Nagrody" (pkt 3–4), str. 3–6.`;

const KANTOR_OLD_TAIL = `Promocja walutowa pozwala przystąpić do niej do 30 września 2026 r., a regulamin przewiduje również możliwość uczestnictwa nowych klientów otwierających konto w odpowiednim kanale.

Przed przedstawieniem 1500 zł + 300 zł jako jednej łącznej korzyści sprawdź jednak aktualne zasady łączenia obu promocji. Dostarczone regulaminy potwierdzają warunki obu ofert, ale nie będę na tej podstawie dopisywał pewności, której dokumenty jednoznacznie nie dają.`;

const KANTOR_NEW_TAIL = `**Zapisy do promocji walutowej zakończyły się 30 września 2026 r.** Osoba, która otwiera Konto Erste Platinum teraz, nie może już do niej przystąpić — dla nowego klienta realna premia z konta to **do 1500 zł**, a nie 1800 zł.

Informacja dla osób, które przystąpiły wcześniej (według regulaminu Kantoru):

* przystąpienie w sierpniu 2026 r. — wymiana walut do 31 października 2026 r., nagroda najpóźniej 25 listopada 2026 r.,
* przystąpienie we wrześniu 2026 r. — wymiana walut do 30 listopada 2026 r., nagroda najpóźniej 20 grudnia 2026 r.

Żaden z dwóch regulaminów (konta i Kantoru) nie zabrania łączenia obu promocji: regulamin konta wymienia z nazwy promocje, z którymi się nie łączy, i promocji kantorowej wśród nich nie ma.

**Źródła:** [regulamin promocji „Do 300 zł z walutami w Kantorze Erste"](https://www.erste.pl/_fileserver/item/1528604) (str. 2, 4, 5) oraz [regulamin promocji konta](https://www.erste.pl/_fileserver/item/1528777) (str. 4, pkt 5).`;

const OLD_PAYOUT_SECTION_END = `W każdym takim miesiącu trzeba spełnić komplet warunków.`;

function buildArticleBody(oldBody) {
  if (!oldBody.includes(KANTOR_OLD_TAIL)) throw new Error("Article: Kantor paragraph no longer matches verbatim - re-check before editing.");
  if (!oldBody.includes(OLD_PAYOUT_SECTION_END)) throw new Error("Article: '600 zl' section anchor no longer matches verbatim.");
  if (oldBody.includes("### Kiedy dostaniesz te 600 zł?")) throw new Error("Article already contains the payout section.");
  return oldBody
    .replace(OLD_PAYOUT_SECTION_END, OLD_PAYOUT_SECTION_END + "\n\n" + NEW_PAYOUT_SECTION)
    .replace(KANTOR_OLD_TAIL, KANTOR_NEW_TAIL);
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

    const columns = await existingColumns(db, ["promotions", "bonus_parts", "promotion_conditions", "checklist_steps", "fees", "articles"]);
    const has = (c) => columns.has(c);

    const [p] = await db.$queryRawUnsafe(`select * from promotions where slug = $1`, SLUG);
    if (!p) throw new Error(`Promotion ${SLUG} not found`);
    const parts = await db.$queryRawUnsafe(`select * from bonus_parts where "promotionId" = $1 order by "order"`, p.id);
    const conds = await db.$queryRawUnsafe(`select * from promotion_conditions where "promotionId" = $1 order by "order"`, p.id);
    const steps = await db.$queryRawUnsafe(`select * from checklist_steps where "promotionId" = $1`, p.id);
    const [fees] = await db.$queryRawUnsafe(`select * from fees where "promotionId" = $1`, p.id);
    const [article] = await db.$queryRawUnsafe(`select * from articles where slug = $1`, ARTICLE_SLUG);
    if (!fees || !article) throw new Error("fees row or article not found");

    const stampFor = (table, row) => {
      const col = `${table}.contentUpdatedAt`;
      return has(col) ? { stamp: ["contentUpdatedAt"], oldStamp: { contentUpdatedAt: row.contentUpdatedAt ?? null } } : {};
    };
    const reqs = (table, cols) => cols.map((c) => `${table}.${c}`);
    const changes = [];

    // --- promotion -----------------------------------------------------------------
    const newName = "Odkryj Konto Erste Platinum z nagrodą do 1500 zł";
    const set = {
      name: newName,
      maxBonusCents: 150000,
      endDate: new Date("2026-11-30T00:00:00.000Z"),
      sourceUrl: "https://www.erste.pl/_fileserver/item/1528777",
      summary:
        "Do 1500 zł za aktywność na Koncie Erste Platinum: 3 × 200 zł w pierwszych trzech miesiącach i 900 zł nagrody lojalnościowej. Zapisy do 30.11.2026.",
      ratingReason:
        "Wysoka premia (do 1500 zł), ale wymaga regularnej aktywności (wpływ 10 000 zł/mies., 10 płatności/mies.) przez wiele miesięcy."
    };
    changes.push({
      table: "promotions",
      id: p.id,
      label: `Promotion ${SLUG} (slug unchanged; status stays ${p.status})`,
      source: "[A] p.2 Czas promocji; [K] p.2 (Kantor sign-ups closed 30.09 -> no longer part of the headline amount)",
      set,
      expect: Object.fromEntries(Object.keys(set).map((k) => [k, p[k]])),
      touchUpdatedAt: true,
      ...stampFor("promotions", p)
    });

    // --- bonus parts: Kantor rewards closed for new participants -----------------------
    for (const part of parts.filter((x) => x.label.startsWith("Kantor Erste"))) {
      changes.push({
        table: "bonus_parts",
        id: part.id,
        label: `Bonus part "${part.label}" (${part.amountCents / 100} zł) - sign-up closes 30.09.2026`,
        source: "[K] p.2 Czas promocji (przystapienie 1.08-30.09.2026)",
        set: { availableUntil: new Date("2026-09-30T00:00:00.000Z") },
        expect: { availableUntil: part.availableUntil ?? null },
        requires: reqs("bonus_parts", ["availableUntil"])
      });
    }

    // --- conditions ----------------------------------------------------------------------
    const cPayout = conds.find((c) => c.order === 1);
    const cKantor = conds.find((c) => c.order === 3);
    if (cPayout) {
      const add = " Każde 200 zł bank wypłaca najpóźniej w ostatnim dniu miesiąca następującego po miesiącu wykonania warunków (np. za październik — do 30 listopada).";
      changes.push({
        table: "promotion_conditions",
        id: cPayout.id,
        label: "Condition #2 (3 months of activity): add payout timing",
        source: "[A] p.5 Nagrody pkt 3",
        set: { description: cPayout.description + add },
        expect: { description: cPayout.description }
      });
    }
    if (cKantor) {
      changes.push({
        table: "promotion_conditions",
        id: cKantor.id,
        label: "Condition #4 (Kantor): sign-ups closed; keep the rules for people who already joined",
        source: "[K] p.2, p.4 pkt 2, p.5 pkt 6",
        set: {
          title: "Kantor Erste — zapisy zakończone 30.09.2026 (tylko dla osób, które już przystąpiły)",
          description:
            "Nowi klienci nie mogą już przystąpić do tej promocji. Uczestnicy, którzy przystąpili w sierpniu: wymiana min. 200 jednostek waluty obcej (200 zł), opcjonalnie +100 jednostek innej waluty (+100 zł), do 31.10.2026; nagroda do 25.11.2026. Przystąpienie we wrześniu: wymiana do 30.11.2026; nagroda do 20.12.2026."
        },
        expect: { title: cKantor.title, description: cKantor.description }
      });
    }

    // --- checklist: same ids/orders/progress, only the wording ----------------------------
    const stepByOrder = (o) => steps.find((s) => s.order === o);
    const stepTitles = {
      2: "Tylko jeśli przystąpiłeś/aś do promocji Kantor Erste do 30.09.2026 (zapisy zamknięte): wymień min. 200 jednostek waluty obcej w Kantorze Erste — do 31.10.2026 (przystąpienie w sierpniu) lub do 30.11.2026 (we wrześniu); opcjonalnie +100 jednostek innej waluty",
      3: "Kantor Erste: odbierz nagrodę do 300 zł (do 25.11.2026 przy przystąpieniu w sierpniu, do 20.12.2026 — we wrześniu)",
      14: "Odbierz nagrodę: 200 zł (do końca miesiąca następującego po miesiącu wykonania warunków)",
      24: "Odbierz nagrodę: 200 zł (do końca miesiąca następującego po miesiącu wykonania warunków)",
      34: "Odbierz nagrodę: 200 zł (do końca miesiąca następującego po miesiącu wykonania warunków)",
      41: "Odbierz nagrodę: 900 zł (do końca miesiąca następującego po 9. miesiącu spełnienia warunków)"
    };
    for (const [order, title] of Object.entries(stepTitles)) {
      const s = stepByOrder(Number(order));
      if (!s) continue;
      changes.push({
        table: "checklist_steps",
        id: s.id,
        label: `Checklist step order ${order} (id and progress untouched)`,
        source: Number(order) <= 3 ? "[K]" : "[A] p.5 Nagrody",
        set: { title },
        expect: { title: s.title }
      });
    }

    // --- fees: account fee is conditional, not 0 -------------------------------------------
    changes.push({
      table: "fees",
      id: fees.id,
      label: "Fees: Konto Erste Platinum is 0 zł only with 10 000 zł inflow or 150 000 zł average assets, else 45 zł",
      source: "[T] Tabela 2 - Konto Erste Platinum, pkt 1 (p.13/123); Visa Platinum card 0 zł pkt 1",
      set: {
        accountFeeCents: 4500,
        accountFeeWaiverCondition: "wpływy na rachunek co najmniej 10 000 zł w miesiącu lub średnie saldo aktywów co najmniej 150 000 zł",
        otherFee: "Karta debetowa Visa Platinum: 0 zł, bez warunku. Źródło: Tabela opłat i prowizji obowiązująca od 25.04.2026 r."
      },
      expect: {
        accountFeeCents: fees.accountFeeCents,
        accountFeeWaiverCondition: fees.accountFeeWaiverCondition ?? null,
        otherFee: fees.otherFee
      },
      requires: reqs("fees", ["accountFeeWaiverCondition"])
    });

    // --- article ------------------------------------------------------------------------------
    changes.push({
      table: "articles",
      id: article.id,
      label: "Article: payout schedule (3 x 200 zł) + Kantor closed for new customers",
      source: "[A] p.4-5, [K] p.2,4,5 (cited inline in the article)",
      set: { body: buildArticleBody(article.body) },
      expect: { body: article.body },
      touchUpdatedAt: true,
      ...stampFor("articles", article),
      requires: reqs("articles", ["contentUpdatedAt"])
    });

    printPlan("Erste Platinum", changes, columns);
    const plus = (t) => t.split("\n").map((l) => "+ " + l).join("\n");
    const minus = (t) => t.split("\n").map((l) => "- " + l).join("\n");
    console.log("\n=== ARTICLE DIFF (only these blocks change; the rest of the body is byte-identical) ===");
    console.log(`@@ directly after the line "${OLD_PAYOUT_SECTION_END}" - ADDED:\n${plus(NEW_PAYOUT_SECTION)}`);
    console.log(`\n@@ section "Czy można dostać dodatkowe 300 zł za wymianę walut?" - REMOVED:\n${minus(KANTOR_OLD_TAIL)}`);
    console.log(`\n@@ same place - ADDED:\n${plus(KANTOR_NEW_TAIL)}`);
    console.log("\nDeliberately unchanged: slug, status, affiliateUrl, rating, lastVerifiedAt, trackings, checklist ids/order/progress.");
    console.log(`Current status stays ${p.status}; flipping it to ACTIVE (links, listing, sitemap, redirect all return together) is a separate owner decision.`);
    console.log(`Tracking rows on this promotion: ${(await db.$queryRawUnsafe(`select count(*)::int n from user_promotion_tracking where "promotionId" = $1`, p.id))[0].n}`);
    void fmt;

    if (!apply) {
      console.log("\nDry run only - nothing written. Re-run with --apply after review (schema migrations + new app version must be live).");
      return;
    }
    await applyChanges(db, "erste-platinum", changes, columns);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
