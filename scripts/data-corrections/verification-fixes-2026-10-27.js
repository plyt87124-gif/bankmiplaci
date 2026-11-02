/**
 * PROPOSAL (not applied) - four things the first full verification of the active offers (2026-10-27) found
 * to be wrong or stale while comparing them with the banks' documents. Each is confirmed in the document named.
 *
 *   node scripts/data-corrections/verification-fixes-2026-10-27.js                              dry run (default)
 *   node scripts/data-corrections/verification-fixes-2026-10-27.js --apply --plan <plan-file>   one transaction + compare-and-set + revert file
 *   node scripts/data-corrections/verification-fixes-2026-10-27.js --revert <file>              [--force]
 *
 * 1. mBank eKonto możliwości 13-17 ("Zgarnij premię IV", 16.09-16.12.2026): sourceUrl pointed at the regulamin of
 *    edition III (promotion 11.06.2026-31.01.2027). The edition IV regulamin exists and matches the offer
 *    (przystąpienie 16.09-16.12.2026, trwa do 31.03.2027, premia I 50 zł, premia II 50 zł, bonus 200 zł):
 *    https://www.mbank.pl/pdf/promocje/konta/regulamin-promocji-zgarnij-premie-bo-masz-mozliwosci-iv-edycja.pdf
 * 2. mBank mBiznes edycja 7: sourceUrl was the eBroker tracking redirect, i.e. no document at all. The regulamin of the
 *    action is https://bonus.ebrokerpartner.pl/strona/regulamin-mbank-firmowe-edycja7 (read in a browser; the page is
 *    script-rendered, so the daily verification attests it with --browser-read).
 * 3. Millennium 360° ("Do 700 zł"): the 300 zł for Konto 360° Junior comes from a SEPARATE promotion ("Tysiąc powodów
 *    na start", 10.08-18.10.2026) that ended on 18.10.2026. The part gets availableUntil = 2026-10-18 (the site then shows it
 *    as no longer available), the headline maximum drops from 1000 zł to 700 zł (200 + 500), summary and condition title say so.
 *    The ściąga steps for Junior (mill_cs_70-72) are left to the ściąga correction.
 * 4. PKO Konto za Zero + Allegro Klik: the condition "Podkręcamy cashback z Allegro Klik 2" (10% on marked offers) ran
 *    21.09-25.10.2026 and ended two days ago (regulamin: "Promocja trwa od 21.09.2026 r. do 25.10.2026 r."). It is
 *    reworded as ended; the basic cashback (up to 100 zł a month for 12 months, to 19.11.2026) is untouched.
 *
 * Deliberately NOT changed: lastVerifiedAt (moved only by scripts/verify-offers.ts), ratings (recomputed afterwards by
 * scripts/recompute-ratings.ts because the Millennium maximum changed), status, affiliate data.
 */
const { loadDb, existingColumns, printPlan, applyChanges, revertFrom, writePlan, assertMatchesPlan } = require("./lib");

const MB_IV = "https://www.mbank.pl/pdf/promocje/konta/regulamin-promocji-zgarnij-premie-bo-masz-mozliwosci-iv-edycja.pdf";
const MB_ED7 = "https://bonus.ebrokerpartner.pl/strona/regulamin-mbank-firmowe-edycja7";

const MILL_SUMMARY =
  "Do 700 zł: 200 zł za pierwsze 14 dni (Premia I) i 500 zł za 5 kolejnych miesięcy (Premia II) z kontem Millennium 360°. Osobna promocja Konta 360° Junior dla dziecka (do 300 zł, „Tysiąc powodów na start”) zakończyła się 18.10.2026.";
const MILL_COND_TITLE = "Konto 360° Junior dla dziecka (osobna promocja zakończona 18.10.2026)";
const PKO_COND_TITLE = "Promocja „Podkręcamy cashback z Allegro Klik 2” zakończyła się 25.10.2026";
const PKO_COND_DESC =
  "Dodatkowa kampania (10% zwrotu za produkty oznaczone na Allegro jako oferty promocyjne) trwała od 21.09 do 25.10.2026 lub do wyczerpania puli 400 tys. zł cashbacku. Obowiązuje już tylko cashback podstawowy opisany powyżej.";

async function one(db, table, id) {
  const [row] = await db.$queryRawUnsafe(`select * from "${table}" where id = $1`, id);
  if (!row) throw new Error(`${table} ${id} not found`);
  return row;
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
    const columns = await existingColumns(db, ["promotions", "bonus_parts", "promotion_conditions"]);
    const stamp = (row) => (columns.has("promotions.contentUpdatedAt") ? { stamp: ["contentUpdatedAt"], oldStamp: { contentUpdatedAt: row.contentUpdatedAt ?? null }, touchUpdatedAt: true } : {});
    const changes = [];

    const mb = await db.$queryRawUnsafe(`select * from promotions where slug = $1`, "mbank-ekonto-mozliwosci-13-17-zgarnij-premie-iv");
    if (!mb[0]) throw new Error("mBank 13-17 not found");
    changes.push({
      table: "promotions",
      id: mb[0].id,
      label: "mBank 13-17: sourceUrl -> regulamin edition IV (was edition III)",
      source: MB_IV,
      set: { sourceUrl: MB_IV },
      expect: { sourceUrl: mb[0].sourceUrl },
      ...stamp(mb[0])
    });

    const e7 = await db.$queryRawUnsafe(`select * from promotions where slug = $1`, "mbank-konto-firmowe-mbiznes-bonus-edycja-7");
    if (!e7[0]) throw new Error("mBank ed7 not found");
    changes.push({
      table: "promotions",
      id: e7[0].id,
      label: "mBank mBiznes ed. 7: sourceUrl -> the action's regulamin (was the tracking redirect)",
      source: MB_ED7,
      set: { sourceUrl: MB_ED7 },
      expect: { sourceUrl: e7[0].sourceUrl },
      ...stamp(e7[0])
    });

    const mill = await one(db, "promotions", "millennium_promo700");
    changes.push({
      table: "promotions",
      id: mill.id,
      label: "Millennium 360: maximum 1000 -> 700 zł and summary (Junior promotion ended 18.10.2026)",
      source: "Millennium regulamin 'Do 700 zł na Twoje przyjemności' + the offer's own text: Junior promotion 10.08-18.10.2026",
      set: { maxBonusCents: 70000, summary: MILL_SUMMARY },
      expect: { maxBonusCents: mill.maxBonusCents, summary: mill.summary },
      ...stamp(mill)
    });
    const part = await one(db, "bonus_parts", "millennium_bp_3");
    changes.push({
      table: "bonus_parts",
      id: part.id,
      label: "Millennium 360: Junior part availableUntil = 2026-10-18",
      source: "Junior promotion 'Tysiąc powodów na start' 10.08-18.10.2026",
      set: { availableUntil: new Date("2026-10-18T00:00:00Z") },
      expect: { availableUntil: part.availableUntil ?? null }
    });
    const cond = await one(db, "promotion_conditions", "millennium_pc_4");
    changes.push({
      table: "promotion_conditions",
      id: cond.id,
      label: "Millennium 360: Junior condition title says the promotion ended",
      source: "same",
      set: { title: MILL_COND_TITLE },
      expect: { title: cond.title }
    });

    const pkoCond = await one(db, "promotion_conditions", "cmvf4evkp00fx10h9kt17zntz");
    changes.push({
      table: "promotion_conditions",
      id: pkoCond.id,
      label: "PKO Allegro Klik: 'Podkręcamy cashback 2' reworded as ended (25.10.2026)",
      source: "PKO regulamin 'Podkręcamy cashback z Allegro Klik 2': Promocja trwa od 21.09.2026 r. do 25.10.2026 r.",
      set: { title: PKO_COND_TITLE, description: PKO_COND_DESC },
      expect: { title: pkoCond.title, description: pkoCond.description }
    });
    const pko = await one(db, "promotions", pkoCond.promotionId);
    changes.push({
      table: "promotions",
      id: pko.id,
      label: "PKO Allegro Klik: contentUpdatedAt (condition reworded)",
      source: "same",
      set: { ratingReason: pko.ratingReason ?? null },
      expect: { ratingReason: pko.ratingReason ?? null },
      ...stamp(pko)
    });

    printPlan("verification fixes 2026-10-27", changes, columns);
    if (!apply) {
      const planFile = writePlan("verification-fixes-2026-10-27", changes);
      console.log(`\nDry run only - nothing written. Plan recorded in ${planFile}.`);
      console.log(`  node scripts/data-corrections/verification-fixes-2026-10-27.js --apply --plan ${planFile}`);
      return;
    }
    const planArg = args.indexOf("--plan");
    if (planArg === -1) throw new Error("--apply needs --plan <file from the reviewed dry run>.");
    assertMatchesPlan(args[planArg + 1], changes);
    await applyChanges(db, "verification-fixes-2026-10-27", changes, columns);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
