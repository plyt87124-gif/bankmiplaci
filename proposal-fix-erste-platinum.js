/**
 * PROPOSAL — Erste Platinum: article payout-timing gap + a date
 * discrepancy that needs YOUR decision (not auto-fixable).
 *
 * Do NOT run --apply until reviewed. Preparing this is not approval.
 *
 * =========================================================================
 * PART A — date discrepancy (informational only, this script never writes
 * it — no --apply flag touches it; decide, then edit it yourself in
 * /admin/promocje or tell me which value is correct):
 * =========================================================================
 *
 * promotions.erste-platinum-1500-plus-300-zl currently has:
 *   status: EXPIRED, endDate: 2026-09-30
 *
 * But the regulamin that's this exact promotion's own sourceUrl
 * (https://www.erste.pl/_fileserver/item/1528779), page 2/13, section
 * "Czas promocji", says:
 *   "Promocja trwa od 1 września 2026 r. do 31 grudnia 2027 r."
 *   "Możesz przystąpić do promocji od 1 września do 30 listopada 2026 r."
 *
 * I.e. per the bank's own document, new applications are accepted through
 * 30.11.2026 — two months later than what's stored. Today is 2026-10-01,
 * so if 30.11.2026 is the right reading, this promotion is being hidden
 * from /promocje and marked noindex while real customers can still apply.
 *
 * Why I'm not just fixing it: this promotion's slug bundles BOTH the
 * 1500 zł account promo above AND a separate "Do 300 zł z walutami w
 * Kantorze Erste" promo, which the article says closes to new entrants
 * 30.09.2026 (matching the stored endDate exactly) — additionalSourceUrls
 * on this same promotion record:
 *   https://www.erste.pl/_fileserver/item/1528604
 *   https://www.erste.pl/_fileserver/item/1528601
 * I have not opened those two to confirm which promo each governs. It's
 * plausible endDate was deliberately set to the EARLIER of two bundled
 * deadlines (the currency promo) rather than a plain data-entry mistake.
 * I won't guess which reading you intended for one combined record —
 * that's a product decision (and possibly a reason to split this into
 * two separate Promotion rows instead), not something a regex fix
 * should silently decide.
 *
 * =========================================================================
 * PART B — article content: this script's --apply only touches this
 * =========================================================================
 *
 * The article already explains the 900 zł loyalty-bonus payout date, but
 * never states WHEN the 3×200 zł (600 zł) part is actually paid — it only
 * says "w trzech kolejnych miesiącach" (the months you have to be
 * active in), not the later months the money actually arrives. Two GSC
 * queries ("kiedy erste wyplaca premie", "kiedy erste wypłaca nagrody",
 * 2 impressions each, avg. position 8-10) are exactly this question.
 *
 * Source, same PDF as above, page 5/13, section "Nagrody", point 3:
 *   200 zł for month 1 of activity -> paid by the end of the 2nd
 *   following month (e.g. wniosek wrzesień -> wypłata do 30 listopada)
 *   200 zł for month 2 of activity -> paid by the end of the 3rd
 *   following month (wniosek wrzesień -> do 31 grudnia)
 *   200 zł for month 3 of activity -> paid by the end of the 4th
 *   following month (wniosek wrzesień -> do 31 stycznia)
 *
 * Usage:
 *   node proposal-fix-erste-platinum.js            -> dry run (default)
 *   node proposal-fix-erste-platinum.js --apply     -> writes the article body only, after a revert-*.json backup
 *   node proposal-fix-erste-platinum.js --revert <file>
 */
const fs = require("fs");

const envText = fs.readFileSync(".env.production.check", "utf8");
const m = envText.match(/DATABASE_URL="([^"]+)"/);
if (!m) throw new Error("DATABASE_URL not found in .env.production.check");
process.env.DATABASE_URL = m[1];

const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

const ARTICLE_SLUG = "erste-bank-jak-zdobyc-do-1500-zl-premii";

const OLD_SECTION = `## Jak zdobyć pierwsze 600 zł?

Tutaj zaczyna się najważniejsza część promocji.

Za każdy z 3 kolejnych miesięcy następujących po miesiącu złożenia wniosku możesz otrzymać 200 zł.

Łącznie daje to:

3 × 200 zł = 600 zł.

W każdym takim miesiącu trzeba spełnić komplet warunków.`;

const NEW_SECTION = `## Jak zdobyć pierwsze 600 zł?

Tutaj zaczyna się najważniejsza część promocji.

Za każdy z 3 kolejnych miesięcy następujących po miesiącu złożenia wniosku możesz otrzymać 200 zł.

Łącznie daje to:

3 × 200 zł = 600 zł.

W każdym takim miesiącu trzeba spełnić komplet warunków.

### Kiedy dostaniesz te 600 zł?

Nagrody za aktywność nie wpadają na konto od razu — regulamin przewiduje około dwumiesięczne opóźnienie między miesiącem aktywności a wypłatą. Jeśli złożysz wniosek **we wrześniu 2026 r.**, harmonogram wygląda tak:

* 200 zł za 1. miesiąc aktywności → do **30 listopada 2026 r.**,
* 200 zł za 2. miesiąc aktywności → do **31 grudnia 2026 r.**,
* 200 zł za 3. miesiąc aktywności → do **31 stycznia 2027 r.**

Złożenie wniosku w innym miesiącu przesuwa cały harmonogram o tyle samo — każda z trzech nagród trafia na konto pod koniec drugiego miesiąca następującego po miesiącu, w którym spełniłeś/aś warunki.`;

async function main() {
  const apply = process.argv.includes("--apply");
  const revertIdx = process.argv.indexOf("--revert");

  if (revertIdx !== -1) {
    const backup = JSON.parse(fs.readFileSync(process.argv[revertIdx + 1], "utf8"));
    await db.$executeRawUnsafe(`update articles set body = $1 where id = $2`, backup.body, backup.id);
    console.log("Reverted.");
    await db.$disconnect();
    return;
  }

  const [article] = await db.$queryRawUnsafe(`select id, body from articles where slug = $1`, ARTICLE_SLUG);
  if (!article) throw new Error(`Article ${ARTICLE_SLUG} not found`);
  if (!article.body.includes(OLD_SECTION)) {
    throw new Error("Article body no longer matches OLD_SECTION verbatim — it was edited since this proposal was written. Re-check and update the script.");
  }
  const newBody = article.body.replace(OLD_SECTION, NEW_SECTION);

  console.log("=== ARTICLE BODY: section added ===");
  console.log(NEW_SECTION);
  console.log("\nPART A (date discrepancy) is informational only — see the file header. This script does not touch it.");

  if (!apply) {
    console.log("\nDry run only — nothing written. Re-run with --apply after review.");
    await db.$disconnect();
    return;
  }

  const backupFile = `revert-erste-article-${Date.now()}.json`;
  fs.writeFileSync(backupFile, JSON.stringify(article, null, 2));
  console.log(`Backup written to ${backupFile}.`);

  // contentUpdatedAt only exists once this branch's migrations are
  // deployed (see Article.contentUpdatedAt in prisma/schema.prisma) —
  // same dependency as proposal-fix-mbank-card-fee.js.
  await db.$executeRawUnsafe(
    `update articles set body = $1, "contentUpdatedAt" = now() where id = $2`,
    newBody, article.id
  );
  console.log("Applied (article body + contentUpdatedAt).");
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
