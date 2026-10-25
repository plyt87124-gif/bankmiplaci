/**
 * PROPOSAL (not applied) - account and card fees of the active offers, checked against the banks' own
 * documents (2026-10-25), and the billing periods of the PKO business ściąga.
 *
 *   node scripts/data-corrections/fees-2026-10.js                           dry run (default) - writes nothing, records plan-*.json
 *   node scripts/data-corrections/fees-2026-10.js --apply --plan <plan-file>   only if the data still equals the reviewed plan; one transaction + compare-and-set + revert file
 *   node scripts/data-corrections/fees-2026-10.js --revert <file>           [--force]
 *
 * Preparing this file is NOT approval to run --apply. --apply refuses to run until migration
 * 20261025100000_checklist_step_contract_periods is in the database, and should only run after the
 * application version that reads the new columns is live.
 *
 * Why: offers that showed "od 0 zł" had their real fee only in the (no longer displayed) free text
 * `otherFee`, or no fee at all. The numbers below are the rate charged when the waiver condition is NOT
 * met, plus the condition, exactly as the bank's document words them. Nothing here is estimated:
 *
 *  - PKO Konto Firmowe      Taryfa prowizji i opłat dla MŚP, obowiązuje od 1.12.2025 (pkobp.pl/api/public/e404e48a-...pdf):
 *                           konto 12 zł / 0 zł przy wpływach min. 2000 zł; karta 10 zł / 0 zł przy min. 5 transakcjach.
 *  - Credit Agricole        TOiP/30/2026 (klienci instytucjonalni), od 25.06.2026, Solista Biznes: konto 15 zł, karta 9 zł,
 *                           oba 0 zł przy przelewie do ZUS lub wpływach min. 3000 zł w poprzednim miesiącu.
 *  - Alior iKonto Biznes    Tabela opłat i prowizji dla iKonto Biznes, od 1.04.2026: konto 0 zł, karta 8 zł / 0 zł przy min. 4 transakcjach.
 *  - Millennium Mój Biznes  Cennik usług dla Klientów Biznes, od 12.08.2026: konto "0 PLN" z przypisami (wpływy 1000 zł albo
 *                           przelew do ZUS/US) - kwota przy niespełnieniu warunków NIE jest podana, więc zostaje "brak danych";
 *                           karta Millennium Visa Mój Biznes 7 zł / 0 zł przy transakcjach bezgotówkowych min. 500 zł.
 *  - Millennium 360°        Cennik usług - karty debetowe, od 30.09.2026: obsługa karty 11 zł (5 zł do 26 lat) / 0 zł przy
 *                           5 płatnościach kartą lub BLIKIEM (1 płatność do 26 lat); pierwsze 2 miesiące bez opłaty.
 *  - mBiznes konto Standard strona mbank.pl: konto 19 zł / 0 zł przy min. 1 przelewie do ZUS w miesiącu; karta 5 zł miesięcznie.
 *  - Pekao Konto Przekorzystne  Dokument dotyczący opłat (powyżej 26 lat): złota karta debetowa 9 zł / 0 zł po warunkach.
 *  - Nest BIZnest Konto, Revolut Standard, Alior Konto 18-25: wartości 0/0 (itd.) potwierdzone, poprawione tylko źródło i opis.
 *
 * PKO ściąga: the regulamin counts the three monthly card periods from the day the account is opened
 * (open 6.07 -> 6.07-6.08, 7.08-6.09, 7.09-6.10) and gives the four partner offers "3 months from opening";
 * the old steps were gated by calendar months. Steps get periodStartMonths / periodMonths; titles are reworded.
 *
 * Deliberately NOT changed: lastVerifiedAt, ratings, status, affiliate data. Promotions get contentUpdatedAt
 * stamped because the fee text on their page changes.
 */
const { loadDb, existingColumns, printPlan, applyChanges, revertFrom, writePlan, assertMatchesPlan } = require("./lib");

const PEKAO_DDO = "https://www.pekao.com.pl/dam/jcr:d92ca9c2-4721-4fc6-aef6-7f97bfabcd10/DDO_KP_powyzej_26_lat.pdf.2026-07-24-12-06-05.pdf";
const ALIOR_IKONTO = "https://www.aliorbank.pl/dam/jcr:700e105b-bdde-4d9d-8f6e-0dd52e1dad2f/taryfa_oplat-i-prowizji-iKonto-Biznes.pdf";
const CA_TOIP = "https://static.credit-agricole.pl/asset/t/o/i/toip-instytucjonalni-25062026_35774.pdf";
const PKO_TARYFA = "https://www.pkobp.pl/api/public/e404e48a-28df-43d6-a31f-9238f1560ecc.pdf";

/** slug -> the Fees columns to write, with the document each value was read from. */
const FEES = {
  "pekao-konto-przekorzystne-300-zl-i-promocja-podrozna-iii": {
    source: "Pekao, Dokument dotyczący opłat Konta Przekorzystnego (powyżej 26 lat), tabela kart: złota karta debetowa 9 zł / 0 zł (108 zł rocznie)",
    set: {
      cardFeeCents: 900,
      otherFee: "Złota karta debetowa: 9 zł miesięcznie (108 zł rocznie), 0 zł po spełnieniu warunków z Dokumentu dotyczącego opłat. Prowadzenie konta: 0 zł.",
      sourceUrl: PEKAO_DDO
    }
  },
  "alior-konto-18-25-mlodzi-zyskuja": {
    source: "Alior DDO (rachunki od 15.01.2026) i TOiP od 1.06.2026, przypis 12 do karty Alior Konto",
    set: {
      otherFee:
        "Dokument dotyczący opłat (rachunki od 15.01.2026) i Taryfa opłat i prowizji (od 1.06.2026): prowadzenie rachunku 0 zł; karta debetowa 7 zł miesięcznie, bez opłaty w miesiącu wydania karty i przy min. 5 transakcjach bezgotówkowych kartą lub BLIK w miesiącu."
    }
  },
  "alior-plusy-karty-z-plusem-ikonto-biznes": {
    source: "Alior, Tabela opłat i prowizji dla rachunku iKonto Biznes od 1.04.2026: wiersz 2 (0 zł) i wiersz 3 z przypisem 3 (0 zł / 8 zł)",
    set: {
      cardFeeCents: 800,
      cardFeeWaiverCondition: "min. 4 transakcje bezgotówkowe w danym miesiącu (do 21:00 ostatniego dnia miesiąca, liczone osobno dla każdej karty)",
      otherFee:
        "Prowadzenie rachunku podstawowego iKonto Biznes: 0 zł miesięcznie, bez warunków. Opłata za kartę dotyczy kart ze statusem „Aktywna”. Źródło: Tabela opłat i prowizji dla rachunku iKonto Biznes (od 1.04.2026).",
      sourceUrl: ALIOR_IKONTO
    }
  },
  "creditagricole-kapitalna-premia": {
    source: "Credit Agricole TOiP/30/2026 od 25.06.2026, rozdział Konto Biznes: Solista Biznes - prowadzenie 0 zł / 15 zł, karta 0 zł / 9 zł",
    set: {
      accountFeeCents: 1500,
      accountFeeWaiverCondition:
        "przez pierwsze 12 miesięcy od otwarcia w ramach promocji bez warunków; potem: w poprzednim miesiącu min. 1 przelew do ZUS albo wpływy min. 3000 zł (Konto Solista Biznes)",
      cardFeeCents: 900,
      cardFeeWaiverCondition:
        "przez pierwsze 12 miesięcy od otwarcia w ramach promocji bez warunków; potem te same warunki co przy opłacie za konto (min. 1 przelew do ZUS albo wpływy min. 3000 zł w poprzednim miesiącu)",
      otherFee:
        "Dane dla Konta Solista Biznes (TOiP/30/2026, od 25.06.2026). Sonata Biznes: konto 29 zł, 0 zł przy wpływach min. 5000 zł albo średnim saldzie min. 5000 zł; Symfonia Biznes: konto 49 zł, warunki zwolnienia wyższe (w taryfie). Karta 9 zł miesięcznie w każdym pakiecie, bez opłaty przy spełnieniu warunków zwalniających z opłaty za konto.",
      sourceUrl: CA_TOIP
    }
  },
  "pko-rozkrec-firme-premia-do-5-tys-zl": {
    source: "PKO BP, Taryfa prowizji i opłat dla MŚP od 1.12.2025: część I tabela 1 (wiersz 1, przypisy 2 i 3) i część III (karta debetowa, wiersz 1)",
    set: {
      accountFeeCents: 1200,
      accountFeeWaiverCondition:
        "w poprzednim miesiącu wpływy min. 2000 zł (nie liczą się środki z własnych rachunków w PKO BP, lokat i zwrotów); bez opłaty także przez pierwsze 6 miesięcy dla firm działających krócej niż 12 miesięcy",
      cardFeeCents: 1000,
      cardFeeWaiverCondition: "min. 5 transakcji bezgotówkowych w cyklu rozliczeniowym karty",
      otherFee:
        "Dane dla PKO Konto Firmowe (Taryfa dla małych i średnich przedsiębiorstw, od 1.12.2025). PKO Konto Firmowe Premium: 49 zł miesięcznie, 0 zł przy wpływach min. 50 000 zł w poprzednim miesiącu; karta tak samo 10 zł albo 0 zł przy min. 5 transakcjach.",
      sourceUrl: PKO_TARYFA
    }
  },
  "millennium-konto-moj-biznes-bonus-do-6000-zl": {
    source: "Millennium, Cennik usług dla Klientów Biznes od 12.08.2026: tabela II wiersz 3 (przypis 1-3) i tabela III, Visa Mój Biznes, przypis 1",
    set: {
      accountFeeWaiverCondition:
        "przez 24 miesiące od otwarcia w ramach promocji 0 zł; potem 0 zł, jeśli w poprzednim miesiącu był przelew do ZUS/US albo wpływy min. 1000 zł",
      cardFeeCents: 700,
      cardFeeWaiverCondition: "w poprzednim miesiącu transakcje bezgotówkowe kartą na min. 500 zł; bez opłaty w miesiącu wydania karty",
      otherFee:
        "Cennik usług dla Klientów Biznes (od 12.08.2026): prowadzenie Konta Mój Biznes 0 zł z warunkami zwolnienia (wpływy min. 1000 zł albo przelew do ZUS/US), ale cennik nie podaje stawki przy ich niespełnieniu. Karta debetowa Millennium Visa Mój Biznes: 7 zł miesięcznie. Karta kredytowa Millennium Visa Business: 0 zł rocznie przez 2 lata w promocji.",
      sourceUrl: "https://www.bankmillennium.pl/delegate/managedfiles/165/latest"
    }
  },
  "millennium-do-700-zl-na-twoje-przyjemnosci": {
    source: "Millennium, Cennik usług - karty debetowe od 30.09.2026, tabela 1 (Visa/Mastercard Millennium 360°) i wyjaśnienia do tabeli 1",
    set: {
      cardFeeCents: 1100,
      cardFeeWaiverCondition:
        "w poprzednim miesiącu min. 5 płatności kartą lub BLIKIEM; do 26. roku życia wystarczy 1 płatność, a opłata bez niej wynosi 5 zł; przez pierwsze 2 miesiące od wydania karty bez opłaty",
      otherFee:
        "Prowadzenie konta Millennium 360°: 0 zł. Cennik usług – karty debetowe (od 30.09.2026): wydanie karty 0 zł, obsługa karty 11 zł miesięcznie (5 zł do 26. roku życia), bez prowizji od transakcji bezgotówkowych.",
      sourceUrl: "https://www.bankmillennium.pl/delegate/managedfiles/25/latest"
    }
  },
  "mbank-konto-firmowe-mbiznes-bonus-edycja-7": {
    source: "mBank, strona mBiznes konto Standard (mbank.pl/firmy/konta-firmowe/konto-podstawowe/mbiznes-konto-standard/)",
    set: {
      accountFeeCents: 1900,
      accountFeeWaiverCondition: "w danym miesiącu min. 1 przelew do ZUS z rachunku",
      cardFeeCents: 500,
      otherFee:
        "mBiznes konto Standard: 0 zł za przelewy do ZUS i US. Opłata 5 zł miesięcznie dotyczy pierwszej i każdej dodatkowej karty, także wydanej, a nieaktywowanej.",
      sourceUrl: "https://www.mbank.pl/firmy/konta-firmowe/konto-podstawowe/mbiznes-konto-standard/"
    }
  },
  "nest-zyskaj-do-3000-zl-wymiana-saldo-eur": {
    source: "Nest Bank, Tabela opłat i prowizji dla klientów biznesowych od 16.06.2026: rachunki rozliczeniowe i karta plastikowa",
    set: {
      otherFee:
        "Pierwszy rachunek BIZnest Konto w PLN: 0 zł miesięcznie; pierwsza karta VISA w ramach umowy ramowej: wydanie i korzystanie 0 zł. Druga i kolejne karty: 25 zł rocznie. Tabela opłat i prowizji dla klientów biznesowych, od 16.06.2026.",
      sourceUrl: "https://nestbank.pl/assets/gen/57-19-00-toip_kb.pdf"
    }
  },
  "revolut-darmowy-okres-probny-i-nagroda": {
    source: "Revolut, Opłaty dla klientów indywidualnych (Standard), obowiązuje od 8.12.2023",
    set: {
      otherFee:
        "Plan Standard: subskrypcja bezpłatnie, pierwsza karta Revolut bezpłatnie (obowiązuje opłata za dostawę fizycznej karty, jej kwota jest podawana w aplikacji przed zamówieniem); karta zastępcza 25 zł. Inne plany (Plus, Premium, Metal): wg cennika Revolut.",
      sourceUrl: "https://www.revolut.com/pl-PL/legal/standard-fees/"
    }
  }
};

const PKO_SLUG = "pko-rozkrec-firme-premia-do-5-tys-zl";
const PKO_CARD_TITLE = "Płatności kartą w złotówkach na łącznie min. 2000 zł w tym okresie rozliczeniowym → 5% rozliczonych transakcji (max 1200 zł za okres)";
const PKO_OPEN_TITLE =
  "Otwórz PKO Konto Firmowe przez iPKO, IKO lub stronę banku (1.07–31.10.2026 lub do wyczerpania puli) — NIE w placówce. Zamów i aktywuj kartę PKO Visa Biznes Wielowalutowa, podaj e-mail i telefon firmy, wyraź zgody marketingowe";
const PKO_PERIODS = [
  { ids: ["pkof_cs_m1_a", "pkof_cs_m1_r"], startMonths: 0, months: 1, label: "Okres 1 – transakcje kartą" },
  { ids: ["pkof_cs_m2_a", "pkof_cs_m2_r"], startMonths: 1, months: 1, label: "Okres 2 – transakcje kartą" },
  { ids: ["pkof_cs_m3_a", "pkof_cs_m3_r"], startMonths: 2, months: 1, label: "Okres 3 – transakcje kartą" },
  {
    ids: ["pkof_cs_leasing_a", "pkof_cs_leasing_r", "pkof_cs_najem_a", "pkof_cs_najem_r", "pkof_cs_ubez_a", "pkof_cs_ubez_r", "pkof_cs_eksieg_a", "pkof_cs_eksieg_r"],
    startMonths: 0,
    months: 3
  }
];

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

async function main() {
  const db = loadDb();
  try {
    const args = process.argv.slice(2);
    if (args.includes("--revert")) {
      await revertFrom(db, args[args.indexOf("--revert") + 1], args.includes("--force"));
      return;
    }
    const apply = args.includes("--apply");
    const columns = await existingColumns(db, ["promotions", "fees", "checklist_steps"]);
    const hasStamp = columns.has("promotions.contentUpdatedAt");

    const changes = [];

    for (const [slug, patch] of Object.entries(FEES)) {
      const [p] = await db.$queryRawUnsafe(`select * from promotions where slug = $1`, slug);
      if (!p) throw new Error(`promotion not found: ${slug}`);
      const [fees] = await db.$queryRawUnsafe(`select * from fees where "promotionId" = $1`, p.id);
      if (!fees) throw new Error(`no fees row: ${slug}`);
      const { set, expect } = diffOf(fees, patch.set);
      if (Object.keys(set).length === 0) continue;
      changes.push({
        table: "fees",
        id: fees.id,
        label: `Fees ${slug}`,
        source: patch.source,
        set,
        expect
      });
      // Real content change on the offer page: stamp contentUpdatedAt. The guard is the (unchanged) ratingReason.
      if (hasStamp) {
        changes.push({
          table: "promotions",
          id: p.id,
          label: `Promotion ${slug}: contentUpdatedAt (fees changed)`,
          source: patch.source,
          set: { ratingReason: p.ratingReason ?? null },
          expect: { ratingReason: p.ratingReason ?? null },
          stamp: ["contentUpdatedAt"],
          oldStamp: { contentUpdatedAt: p.contentUpdatedAt ?? null },
          touchUpdatedAt: true
        });
      }
    }

    // PKO business ściąga
    const stepIds = PKO_PERIODS.flatMap((g) => g.ids).concat("pkof_cs_open");
    const steps = await db.$queryRawUnsafe(`select * from checklist_steps where id = any($1::text[])`, stepIds);
    const stepById = new Map(steps.map((s) => [s.id, s]));
    const [pko] = await db.$queryRawUnsafe(`select * from promotions where slug = $1`, PKO_SLUG);
    for (const id of stepIds) {
      const step = stepById.get(id);
      if (!step || step.promotionId !== pko.id) throw new Error(`step ${id} not found in ${PKO_SLUG}`);
    }
    {
      const { set, expect } = diffOf(stepById.get("pkof_cs_open"), { title: PKO_OPEN_TITLE });
      if (Object.keys(set).length) {
        changes.push({
          table: "checklist_steps",
          id: "pkof_cs_open",
          label: "PKO ściąga: opening step also asks for the card, contact data and consents",
          source: "Regulamin promocji „Rozkręć firmę z premią do 5 tys. zł”, rozdz. 6",
          set,
          expect
        });
      }
    }
    for (const grp of PKO_PERIODS) {
      for (const id of grp.ids) {
        const step = stepById.get(id);
        const wanted = { periodStartMonths: grp.startMonths, periodMonths: grp.months };
        if (grp.label) wanted.monthLabel = grp.label;
        if (grp.label && step.rewardCents === null) wanted.title = PKO_CARD_TITLE;
        const { set, expect } = diffOf(step, wanted);
        if (Object.keys(set).length === 0) continue;
        changes.push({
          table: "checklist_steps",
          id,
          label: `PKO ściąga ${id}: window ${grp.startMonths}+${grp.months} month(s) counted from the agreement date`,
          source: "Regulamin promocji, rozdz. 5 pkt 2 i przykład (umowa 6.07: okresy 6.07-6.08, 7.08-6.09, 7.09-6.10; zadania partnerów do 6.10)",
          set,
          expect,
          requires: ["checklist_steps.periodStartMonths", "checklist_steps.periodMonths"]
        });
      }
    }

    printPlan("fees 2026-10 + PKO ściąga", changes, columns);
    console.log("\nDeliberately unchanged: lastVerifiedAt, ratings, status, affiliate data, Millennium Mój Biznes account fee amount (the bank's tariff does not give it).");

    if (!apply) {
      const planFile = writePlan("fees-2026-10", changes);
      console.log(`\nDry run only - nothing written to the database. Plan recorded in ${planFile}.`);
      console.log("To apply after review (migration + new app version must be live):");
      console.log(`  node scripts/data-corrections/fees-2026-10.js --apply --plan ${planFile}`);
      return;
    }
    const planArg = args.indexOf("--plan");
    if (planArg === -1) throw new Error("--apply needs --plan <file from the reviewed dry run>.");
    assertMatchesPlan(args[planArg + 1], changes);
    await applyChanges(db, "fees-2026-10", changes, columns);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
