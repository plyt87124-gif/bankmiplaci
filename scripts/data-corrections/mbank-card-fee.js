/**
 * PROPOSAL (not applied) - mBank "Cala naprzod ed. II + Biedronka": the
 * eKonto do uslug card is NOT unconditionally free.
 *
 *   node scripts/data-corrections/mbank-card-fee.js                    dry run (default) - writes nothing
 *   node scripts/data-corrections/mbank-card-fee.js --apply            one transaction + compare-and-set + revert file
 *   node scripts/data-corrections/mbank-card-fee.js --revert <file>    [--force]
 *
 * Preparing this file is NOT approval to run --apply. --apply refuses to run
 * until the schema migrations are deployed (lib.js checks the columns), and
 * should only run after the new application version is live.
 *
 * Source, opened and read: mBank "Taryfa prowizji i oplat dla osob fizycznych",
 * obowiazuje od 17.04.2026,
 * https://pdf.mbank.pl/mbankpl/of/tpio/taryfa-osobyfiz-17-04-2026.pdf
 *   - str. drukowana 11 (11/86), "Karty debetowe", wiersz "karta glowna / dodatkowa",
 *     kolumna "eKonto do uslug": "0 zl jesli w danym miesiacu wykonasz transakcje
 *     bezgotowkowe za min. 350 zl dowolna karta debetowa i/lub kredytowa z oferty dla
 *     klientow indywidualnych; 9 zl w pozostalych przypadkach".
 *   - str. 9 (9/86), "prowadzenie konta (oplata miesieczna)", kolumna "eKonto do uslug":
 *     0 zl, bez warunku -> accountFeeCents = 0 stays correct.
 *   - Column "eKonto mozliwosci 13-24 lata" shows a plain 0 zl for the same card row,
 *     i.e. the opposite of what the article currently says.
 *
 * What it fixes: Fees (card 900 + waiver condition, old "zawsze 0 zl" free text removed),
 * the promotion's ratingReason ("w pelni bezplatnym"), and the article section
 * "Czy eKonto do uslug jest darmowe?" + a "Zrodla" section with the three bank documents.
 * The 350 zl monthly card condition is described as separate from the promotion's own
 * conditions, and as still applying after the promotional months.
 *
 * Deliberately NOT changed: lastVerifiedAt. This check covered the card fee only, not the
 * whole offer, so the verification date is not bumped (an earlier draft of this proposal
 * did bump it; that was wrong and has been removed).
 */
const { loadDb, existingColumns, printPlan, applyChanges, revertFrom } = require("./lib");

const SLUG = "mbank-cala-naprzod-edycja-2-bony-biedronka";
const ARTICLE_SLUG = "mbank-1000-zl-premii-300-zl-biedronka";

const OLD_PARAGRAPH = `## Czy eKonto do usług jest darmowe?

Według aktualnej taryfy mBanku prowadzenie **eKonta do usług kosztuje 0 zł miesięcznie**.

Standardowa karta do eKonta do usług kosztuje **0 zł miesięcznie zawsze, bez żadnego warunku obrotu** — w przeciwieństwie np. do eKonta możliwości, gdzie brak transakcji za min. 350 zł skutkuje opłatą 9 zł. Przy eKoncie do usług tego ryzyka po prostu nie ma.`;

const NEW_PARAGRAPH = `## Czy eKonto do usług jest darmowe?

Według aktualnej taryfy mBanku (obowiązującej od 17.04.2026 r.) prowadzenie **eKonta do usług kosztuje 0 zł miesięcznie, bez warunku**.

Karta do eKonta do usług kosztuje **0 zł miesięcznie, ale pod warunkiem** wykonania w danym miesiącu transakcji bezgotówkowych (dowolną kartą debetową i/lub kredytową z oferty mBanku dla klientów indywidualnych) na łączną kwotę minimum **350 zł**. Jeśli w danym miesiącu tego nie zrobisz, opłata za kartę za ten miesiąc wynosi **9 zł**.

To ważne rozróżnienie: ten warunek **nie jest tym samym**, co warunki premii opisane wyżej, i obowiązuje **niezależnie od nich** — również po zakończeniu miesięcy promocyjnych (i nawet jeśli w ogóle nie bierzesz udziału w promocji) brak aktywności kartą za min. 350 zł w danym miesiącu oznacza opłatę 9 zł za ten miesiąc.

**Źródło:** [Taryfa Prowizji i Opłat dla osób fizycznych, obowiązuje od 17.04.2026 r.](https://pdf.mbank.pl/mbankpl/of/tpio/taryfa-osobyfiz-17-04-2026.pdf), str. 11/86, tabela „Karty debetowe" → „karta główna / dodatkowa", kolumna „eKonto do usług"; prowadzenie konta — str. 9/86.`;

const SOURCES_SECTION = `## Źródła

- [Regulamin promocji „Cała naprzód – zyskuj z kontem w mBanku – edycja II"](https://www.mbank.pl/pdf/promocje/konta/regulamin-promocji-cala-naprzod-zyskuj-z-kontem-w-mbanku-edycja-ii.pdf)
- [Regulamin promocji „Zgarnij bony do Biedronki z eKontem do usług – edycja I"](https://www.mbank.pl/pdf/promocje/konta/regulamin-promocji-zgarnij-bony-do-biedronki-z-ekontem-do-uslug-edycja-i.pdf)
- [Taryfa Prowizji i Opłat dla osób fizycznych, obowiązuje od 17.04.2026 r.](https://pdf.mbank.pl/mbankpl/of/tpio/taryfa-osobyfiz-17-04-2026.pdf)

`;

const NEW_RATING_REASON =
  "Wysoka łączna kwota (do 1300 zł) i bezpłatne prowadzenie konta (karta: 0 zł przy transakcjach za min. 350 zł/mies., inaczej 9 zł), ale warunki trzeba spełniać przez 6-7 miesięcy; Bonus III dotyczy tylko osób otwierających konto dla dziecka.";
if (NEW_RATING_REASON.length > 280) throw new Error("ratingReason longer than the 280 chars the admin form allows");

function buildBody(oldBody) {
  if (!oldBody.includes(OLD_PARAGRAPH)) throw new Error("Article body no longer matches OLD_PARAGRAPH verbatim - it was edited; re-check first.");
  if (oldBody.includes("## Źródła")) throw new Error("Article already has a Źródła section.");
  if (!oldBody.includes("## Podsumowanie")) throw new Error("Anchor '## Podsumowanie' missing.");
  return oldBody.replace(OLD_PARAGRAPH, NEW_PARAGRAPH).replace("## Podsumowanie", SOURCES_SECTION + "## Podsumowanie");
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
    const columns = await existingColumns(db, ["promotions", "fees", "articles"]);
    const has = (c) => columns.has(c);

    const [p] = await db.$queryRawUnsafe(`select * from promotions where slug = $1`, SLUG);
    const [fees] = await db.$queryRawUnsafe(`select * from fees where "promotionId" = $1`, p.id);
    const [article] = await db.$queryRawUnsafe(`select * from articles where slug = $1`, ARTICLE_SLUG);
    if (!p || !fees || !article) throw new Error("promotion, fees or article not found");

    const stampFor = (table, row) =>
      has(`${table}.contentUpdatedAt`) ? { stamp: ["contentUpdatedAt"], oldStamp: { contentUpdatedAt: row.contentUpdatedAt ?? null } } : {};

    const changes = [
      {
        table: "fees",
        id: fees.id,
        label: "Fees: card 0 -> 9 zł unless >= 350 zł cashless card spend that month; drop the false 'zawsze 0 zł' free text",
        source: "mBank Taryfa od 17.04.2026, str. 11/86 (karty) i 9/86 (konto)",
        set: {
          cardFeeCents: 900,
          cardFeeWaiverCondition:
            "przy rozliczonych transakcjach bezgotówkowych kartą (debetową i/lub kredytową z oferty mBanku dla klientów indywidualnych) za min. 350 zł w danym miesiącu",
          otherFee: null
        },
        expect: { cardFeeCents: fees.cardFeeCents, cardFeeWaiverCondition: fees.cardFeeWaiverCondition ?? null, otherFee: fees.otherFee },
        requires: ["fees.cardFeeWaiverCondition"]
      },
      {
        table: "promotions",
        id: p.id,
        label: `Promotion ${SLUG}: ratingReason no longer says "w pełni bezpłatnym" (lastVerifiedAt untouched)`,
        source: "same taryfa",
        set: { ratingReason: NEW_RATING_REASON },
        expect: { ratingReason: p.ratingReason },
        touchUpdatedAt: true,
        ...stampFor("promotions", p)
      },
      {
        table: "articles",
        id: article.id,
        label: 'Article: section "Czy eKonto do usług jest darmowe?" corrected + "Źródła" section',
        source: "same taryfa + the two regulaminy already used as the promotion's sources",
        set: { body: buildBody(article.body) },
        expect: { body: article.body },
        touchUpdatedAt: true,
        requires: ["articles.contentUpdatedAt"],
        ...stampFor("articles", article)
      }
    ];

    printPlan("mBank card fee", changes, columns);
    const plus = (t) => t.split("\n").map((l) => "+ " + l).join("\n");
    const minus = (t) => t.split("\n").map((l) => "- " + l).join("\n");
    console.log(`\n=== ARTICLE DIFF ===\n@@ REMOVED:\n${minus(OLD_PARAGRAPH)}\n\n@@ ADDED:\n${plus(NEW_PARAGRAPH)}\n\n@@ ADDED before "## Podsumowanie":\n${plus(SOURCES_SECTION.trimEnd())}`);
    console.log("\nDeliberately unchanged: lastVerifiedAt, accountFeeCents (0, unconditional per the taryfa), slug, status, affiliateUrl, rating.");

    if (!apply) {
      console.log("\nDry run only - nothing written. Re-run with --apply after review.");
      return;
    }
    await applyChanges(db, "mbank-card-fee", changes, columns);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
