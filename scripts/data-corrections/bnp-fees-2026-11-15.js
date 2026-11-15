/**
 * PROPOSAL (not applied) - BNP Paribas, the two new promotions of 2026-11-15 (Podroznik ed. 4, personal, and
 * Rozpedz swoj biznes ed. 4, business): rewrite the "Oplaty za konto i karte" texts.
 *
 *   node scripts/data-corrections/bnp-fees-2026-11-15.js                          dry run (default) - writes nothing, records plan-*.json
 *   node scripts/data-corrections/bnp-fees-2026-11-15.js --apply --plan <file>    only if the data still equals the reviewed plan
 *   node scripts/data-corrections/bnp-fees-2026-11-15.js --revert <file> [--force]
 *
 * Why: the offer page prints a fee as "<amount>" and under it "0 zl gdy <waiver condition>". The agent had
 * written the business conditions as "0 zl, gdy ..." (the page then said "0 zl gdy 0 zl, gdy ..."), put the tariff's
 * remarks and the promotion's 3-year exemption into one 270-character sentence, and mentioned ATM withdrawals in
 * otherFee (the owner dropped ATM fees from the pages). The new values are read from the corrected candidate files
 * (data/candidates/bnp-*.json), the single source, so this script and the files can never disagree.
 *
 * Sources, opened and read on 2026-11-15:
 *   business: Taryfa Prowizji i Oplat dla Klientow Biznesowych (pakiety depozytowe), od 01.12.2025,
 *     https://www.bnpparibas.pl/_fileserver/item/1549383 - rozdz. 1 (rachunek 15 zl przy wplywach < 20 tys. zl i saldzie
 *     < 3 tys. zl, inaczej 0 zl) i 2.1 (karta Mastercard Business 9 zl, 0 zl przy transakcjach bezgotowkowych >= 700 zl
 *     w poprzednim miesiacu; wydanie 0 zl); regulamin promocji lp.bnpparibas.pl/rozpedzswojbiznes4/regulamin.pdf, rozdz. 2
 *     ust. 2 a), b) i ust. 3: 0 zl przez 3 lata za rachunek i pierwsza karte od umowy ramowej, bez warunkow z taryfy, a
 *     spelnienie warunkow z taryfy nie wydluza tego okresu.
 *   personal: Dokument dotyczacy oplat "Konto Otwarte na Ciebie" z 1.04.2026 (prowadzenie 0 zl, Karta Otwarta na Swiat
 *     12 zl miesiecznie) i strona lp.bnpparibas.pl/ekstrasumy/ (bezterminowe zwolnienie z oplaty miesiecznej za karte dla
 *     uczestnikow promocji).
 *
 * Changed per promotion: the `fees` row (accountFeeCents, accountFeeWaiverCondition, cardFeeCents,
 * cardFeeWaiverCondition, otherFee, sourceUrl) and the three texts summary (<= 160 characters) / eligibleFor / notEligibleFor (owner's copy rule: say each
 * thing once, no dates in them). Deliberately NOT changed: atmFeeCents, status, lastVerifiedAt, slug,
 * links, rating. A promotion that is not in the database (yet) or has no fees row is reported and skipped.
 */
const fs = require("fs");
const path = require("path");
const { loadDb, existingColumns, printPlan, applyChanges, revertFrom, writePlan, assertMatchesPlan } = require("./lib");

const CANDIDATES = path.join(__dirname, "..", "..", "data", "candidates");
const FILES = ["bnp-konto-otwarte-na-biznes-rozpedz-swoj-biznes-4.json", "bnp-podroznik-edycja-4.json"];
const FIELDS = ["accountFeeCents", "accountFeeWaiverCondition", "cardFeeCents", "cardFeeWaiverCondition", "otherFee", "sourceUrl"];
// Owner's copy rule (7.11.2026): say each thing once. The karencja lives in cooldownMonths / cooldownCutoffDate, so the
// "who may / may not join" texts stay free of dates and periods and do not mirror each other.
const PROMO_FIELDS = ["summary", "eligibleFor", "notEligibleFor"];
const norm = (v) => (v === undefined || v === "" ? null : v);

async function main() {
  const db = loadDb();
  try {
    const args = process.argv.slice(2);
    if (args.includes("--revert")) {
      await revertFrom(db, args[args.indexOf("--revert") + 1], args.includes("--force"));
      return;
    }
    const apply = args.includes("--apply");
    const columns = await existingColumns(db, ["promotions", "fees"]);

    const changes = [];
    for (const file of FILES) {
      const candidate = JSON.parse(fs.readFileSync(path.join(CANDIDATES, file), "utf8"));
      const slug = candidate.promotion.slug;
      const target = candidate.promotion.fees;
      const [p] = await db.$queryRawUnsafe(`select id, slug, status from promotions where slug = $1`, slug);
      if (!p) {
        console.log(`SKIP ${slug}: nie ma jej w bazie (agent jeszcze jej nie zapisal).`);
        continue;
      }
      const [full] = await db.$queryRawUnsafe(`select * from promotions where id = $1`, p.id);
      const [fees] = await db.$queryRawUnsafe(`select * from fees where "promotionId" = $1`, p.id);
      const before = changes.length;

      if (!fees) {
        console.log(`SKIP oplaty ${slug}: promocja istnieje (${p.status}), ale nie ma wiersza oplat. Dodaj oplaty w panelu admina (sekcja Oplaty).`);
      } else {
        const set = {};
        const expect = {};
        for (const f of FIELDS) {
          const next = norm(target[f]);
          const now = norm(fees[f]);
          if (next !== now) {
            set[f] = next;
            expect[f] = now;
          }
        }
        if (Object.keys(set).length) {
          changes.push({
            table: "fees",
            id: fees.id,
            label: `${slug} (${p.status}): oplaty za konto i karte`,
            source: "BNP: Taryfa Prowizji i Oplat (od 01.12.2025) / Dokument dotyczacy oplat (1.04.2026) + regulamin i strona promocji, czytane 15.11.2026",
            set,
            expect
          });
        }
      }

      const pset = {};
      const pexpect = {};
      for (const f of PROMO_FIELDS) {
        const next = norm(candidate.promotion[f]);
        const now = norm(full[f]);
        if (next !== now) {
          pset[f] = next;
          pexpect[f] = now;
        }
      }
      if (Object.keys(pset).length) {
        const stamp = columns.has("promotions.contentUpdatedAt")
          ? { stamp: ["contentUpdatedAt"], oldStamp: { contentUpdatedAt: full.contentUpdatedAt ?? null } }
          : {};
        changes.push({
          table: "promotions",
          id: p.id,
          label: `${slug} (${p.status}): krotki opis oraz teksty "kto moze" / "kto nie moze" bez dat i bez lustra`,
          source: "regulamin i strona promocji BNP, zasada wlasciciela z 7.11.2026 (kazda rzecz raz)",
          set: pset,
          expect: pexpect,
          touchUpdatedAt: true,
          ...stamp
        });
      }
      if (changes.length === before) console.log(`OK   ${slug}: oplaty i teksty juz takie, jak w pliku kandydata.`);
    }

    if (!changes.length) {
      console.log("\nNic do zmiany.");
      return;
    }
    printPlan("BNP opłaty", changes, columns);
    console.log("\nDeliberately unchanged: atmFeeCents, status, lastVerifiedAt, slug, linki, ocena.");

    if (!apply) {
      const planFile = writePlan("bnp-fees-2026-11-15", changes);
      console.log(`\nDry run only - nothing written to the database. Plan recorded in ${planFile}.`);
      console.log("To apply after review:");
      console.log(`  node scripts/data-corrections/bnp-fees-2026-11-15.js --apply --plan ${planFile}`);
      return;
    }
    const planArg = args.indexOf("--plan");
    if (planArg === -1) throw new Error("--apply needs --plan <file from the reviewed dry run>.");
    assertMatchesPlan(args[planArg + 1], changes);
    await applyChanges(db, "bnp-fees-2026-11-15", changes, columns);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
