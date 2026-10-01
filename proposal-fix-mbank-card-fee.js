/**
 * PROPOSAL — mBank card-fee correction (brief point 1).
 *
 * Do NOT run this against production until the owner has reviewed the
 * diff below and explicitly approves. Preparing this script is not
 * approval to run it.
 *
 * What it fixes, independently re-verified against the live taryfa PDF
 * today (2026-10-01), page 11/86, table "Karty debetowe" →
 * "karta główna / dodatkowa", column "eKonto do usług":
 * https://pdf.mbank.pl/mbankpl/of/tpio/taryfa-osobyfiz-17-04-2026.pdf
 *
 *   The standard eKonto do usług card costs 0 zł ONLY if the account
 *   holder makes cashless card transactions totalling at least 350 zł
 *   in a given month; otherwise the card costs 9 zł that month. The
 *   current promotion record and article both wrongly claim this card
 *   is free "always, with no turnover condition" — and the article
 *   additionally misattributes that exact condition to "eKonto
 *   możliwości" instead. (Account maintenance itself genuinely is 0 zł
 *   unconditionally for eKonto do usług — same page, "prowadzenie
 *   konta" row — that part was already correct and is left untouched.)
 *
 * Usage:
 *   node proposal-fix-mbank-card-fee.js            -> dry run (default), prints before/after, writes nothing
 *   node proposal-fix-mbank-card-fee.js --apply     -> applies inside one transaction, after writing a
 *                                                       revert-*.json backup of the exact previous row values
 *
 * Revert: node proposal-fix-mbank-card-fee.js --revert revert-<timestamp>.json
 */
const fs = require("fs");

const envText = fs.readFileSync(".env.production.check", "utf8");
const m = envText.match(/DATABASE_URL="([^"]+)"/);
if (!m) throw new Error("DATABASE_URL not found in .env.production.check");
process.env.DATABASE_URL = m[1];

const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

const PROMOTION_SLUG = "mbank-cala-naprzod-edycja-2-bony-biedronka";
const ARTICLE_SLUG = "mbank-1000-zl-premii-300-zl-biedronka";

const OLD_PARAGRAPH = `## Czy eKonto do usług jest darmowe?

Według aktualnej taryfy mBanku prowadzenie **eKonta do usług kosztuje 0 zł miesięcznie**.

Standardowa karta do eKonta do usług kosztuje **0 zł miesięcznie zawsze, bez żadnego warunku obrotu** — w przeciwieństwie np. do eKonta możliwości, gdzie brak transakcji za min. 350 zł skutkuje opłatą 9 zł. Przy eKoncie do usług tego ryzyka po prostu nie ma.`;

const NEW_PARAGRAPH = `## Czy eKonto do usług jest darmowe?

Według aktualnej taryfy mBanku (obowiązującej od 17.04.2026 r.) prowadzenie **eKonta do usług kosztuje 0 zł miesięcznie, bez warunku**.

Karta do eKonta do usług kosztuje **0 zł miesięcznie, ale pod warunkiem** wykonania transakcji bezgotówkowych (dowolną kartą debetową i/lub kredytową z oferty mBanku dla klientów indywidualnych) na łączną kwotę minimum **350 zł w danym miesiącu**. Jeśli w danym miesiącu nie zrobisz zakupów kartą na tę kwotę, opłata za ten miesiąc wynosi **9 zł**.

To ważne rozróżnienie: ten warunek **nie jest tym samym**, co warunki samej promocji premiowej opisane wyżej, i obowiązuje **niezależnie od niej** — nawet po zakończeniu okresu zbierania premii (i nawet jeśli w ogóle nie bierzesz udziału w tej promocji), brak aktywności kartą za min. 350 zł w danym miesiącu oznacza opłatę 9 zł za ten miesiąc.

**Źródło:** [Taryfa Prowizji i Opłat dla osób fizycznych, obowiązuje od 17.04.2026 r.](https://pdf.mbank.pl/mbankpl/of/tpio/taryfa-osobyfiz-17-04-2026.pdf), str. 11/86, tabela „Karty debetowe" → „karta główna / dodatkowa", kolumna „eKonto do usług".`;

const SOURCES_SECTION = `## Źródła

- [Regulamin promocji „Cała naprzód – zyskuj z kontem w mBanku – edycja II"](https://www.mbank.pl/pdf/promocje/konta/regulamin-promocji-cala-naprzod-zyskuj-z-kontem-w-mbanku-edycja-ii.pdf)
- [Regulamin promocji „Zgarnij bony do Biedronki z eKontem do usług – edycja I"](https://www.mbank.pl/pdf/promocje/konta/regulamin-promocji-zgarnij-bony-do-biedronki-z-ekontem-do-uslug-edycja-i.pdf)
- [Taryfa Prowizji i Opłat dla osób fizycznych, obowiązuje od 17.04.2026 r.](https://pdf.mbank.pl/mbankpl/of/tpio/taryfa-osobyfiz-17-04-2026.pdf)

`;

async function loadCurrent() {
  const [promo] = await db.$queryRawUnsafe(`
    select p.id as "promotionId", p."lastVerifiedAt",
           f.id as "feesId", f."accountFeeCents", f."cardFeeCents", f."atmFeeCents", f."otherFee", f."sourceUrl"
    from promotions p left join fees f on f."promotionId" = p.id
    where p.slug = $1
  `, PROMOTION_SLUG);

  // "contentUpdatedAt" deliberately not selected here: it only exists
  // once the fees_nullable_and_waiver_conditions / article_content_
  // updated_at migrations are deployed to this database. This script's
  // --apply step depends on that migration having been deployed first;
  // the dry run works against today's (pre-migration) prod schema.
  const [article] = await db.$queryRawUnsafe(`
    select id, body from articles where slug = $1
  `, ARTICLE_SLUG);

  return { promo, article: article ? { ...article, contentUpdatedAt: null } : null };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const revertIdx = process.argv.indexOf("--revert");

  if (revertIdx !== -1) {
    const file = process.argv[revertIdx + 1];
    const backup = JSON.parse(fs.readFileSync(file, "utf8"));
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `update fees set "accountFeeCents" = $1, "cardFeeCents" = $2, "atmFeeCents" = $3, "otherFee" = $4, "sourceUrl" = $5 where id = $6`,
        backup.promo.accountFeeCents, backup.promo.cardFeeCents, backup.promo.atmFeeCents,
        backup.promo.otherFee, backup.promo.sourceUrl, backup.promo.feesId
      );
      await tx.$executeRawUnsafe(
        `update promotions set "lastVerifiedAt" = $1 where id = $2`,
        backup.promo.lastVerifiedAt, backup.promo.promotionId
      );
      await tx.$executeRawUnsafe(
        `update articles set body = $1, "contentUpdatedAt" = $2 where id = $3`,
        backup.article.body, backup.article.contentUpdatedAt, backup.article.id
      );
    });
    console.log("Reverted from", file);
    await db.$disconnect();
    return;
  }

  const { promo, article } = await loadCurrent();
  if (!promo?.feesId) throw new Error(`No fees row found for promotion ${PROMOTION_SLUG}`);
  if (!article) throw new Error(`Article ${ARTICLE_SLUG} not found`);
  if (!article.body.includes(OLD_PARAGRAPH)) {
    throw new Error(
      "Article body no longer matches the expected OLD_PARAGRAPH verbatim — someone edited it since this " +
      "proposal was written. Refusing to guess; re-check the body and update this script's OLD_PARAGRAPH first."
    );
  }

  const newBody = article.body.includes(SOURCES_SECTION.trim())
    ? article.body.replace(OLD_PARAGRAPH, NEW_PARAGRAPH)
    : article.body.replace(OLD_PARAGRAPH, NEW_PARAGRAPH).replace(
        "## Podsumowanie",
        SOURCES_SECTION + "## Podsumowanie"
      );

  console.log("=== FEES: before -> after ===");
  console.log("accountFeeCents:", promo.accountFeeCents, "-> (unchanged)", promo.accountFeeCents, "(confirmed unconditional 0 zł — correct already)");
  console.log("cardFeeCents:   ", promo.cardFeeCents, "-> 900 (9 zł when the 350 zł/month condition isn't met)");
  console.log("cardFeeWaiverCondition: null -> 'przy rozliczonych transakcjach bezgotówkowych kartą (debetową i/lub kredytową z oferty mBanku dla klientów indywidualnych) za min. 350 zł w danym miesiącu'");
  console.log("otherFee:       ", JSON.stringify(promo.otherFee), "-> null (now fully captured by the structured waiver fields)");
  console.log("lastVerifiedAt: ", promo.lastVerifiedAt, "-> today (2026-10-01) — this re-check actually happened today");
  console.log();
  console.log("=== ARTICLE BODY: paragraph replaced ===");
  console.log("--- OLD ---\n" + OLD_PARAGRAPH);
  console.log("\n--- NEW ---\n" + NEW_PARAGRAPH);
  console.log("\n+ a '## Źródła' section added before '## Podsumowanie' (3 source links), if not already present.");
  console.log("\ncontentUpdatedAt: ", article.contentUpdatedAt, "-> today (2026-10-01) — this is a genuine content correction");

  if (!apply) {
    console.log("\nDry run only — nothing written. Re-run with --apply to execute, after review.");
    await db.$disconnect();
    return;
  }

  const backupFile = `revert-mbank-card-fee-${Date.now()}.json`;
  fs.writeFileSync(backupFile, JSON.stringify({ promo, article }, null, 2));
  console.log(`\nBackup of previous values written to ${backupFile} — keep this to revert.`);

  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `update fees set "cardFeeCents" = 900, "cardFeeWaiverCondition" = $1, "otherFee" = null where id = $2`,
      "przy rozliczonych transakcjach bezgotówkowych kartą (debetową i/lub kredytową z oferty mBanku dla klientów indywidualnych) za min. 350 zł w danym miesiącu",
      promo.feesId
    );
    await tx.$executeRawUnsafe(
      `update promotions set "lastVerifiedAt" = now() where id = $1`,
      promo.promotionId
    );
    await tx.$executeRawUnsafe(
      `update articles set body = $1, "contentUpdatedAt" = now() where id = $2`,
      newBody, article.id
    );
  });

  console.log("Applied.");
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
