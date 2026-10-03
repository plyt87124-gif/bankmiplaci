/**
 * ROLLBACK HELPER - makes the data readable and safe for the OLD application
 * version (the one before this branch), for the case where the app is rolled
 * back after the new version has written data. NOT applied by default; used
 * only as part of the rollback procedure in docs/etap1-deployment.md.
 *
 * Why it exists (verified, not assumed - see docs/etap1-deployment.md section 3):
 * the old app was run against the migrated schema with data written the way the
 * new app writes it, and
 *   1. any Fees row with a NULL fee column makes `/`, `/promocje`, `/porownaj`
 *      and `/api/promotions/active` return HTTP 500 (Prisma: 'Error converting
 *      field "accountFeeCents" of expected non-nullable type "Int", found
 *      incompatible value of "null"'), because the old client types those fields
 *      as non-null Int;
 *   2. the old app has no idea Promotion.affiliateLinkEnabled exists. Worse, its
 *      /out/[slug] never checked status or dates at all (the defect fixed in
 *      b97b96b): it redirects to Promotion.affiliateUrl for ANY slug. So for an
 *      offer whose partner link is deliberately OFF, flipping status is not
 *      enough - a direct /out/<slug> URL would still reach the partner.
 * Leaving the new columns in the database proves nothing about either.
 *
 * What it does (dry run by default, same plan/compare-and-set/revert machinery
 * as the other corrections in this folder):
 *   - Fees: every NULL among accountFeeCents / cardFeeCents / atmFeeCents -> 0
 *     (what the old app understands; it will show "0 zl" - the old, known-wrong
 *     behaviour - but it works);
 *   - Promotions with affiliateLinkEnabled = false: affiliateUrl is pointed at the
 *     offer's own page on this site (original kept in the revert file), and an
 *     ACTIVE one also becomes EXPIRED so the old page hides its button. The old
 *     /out/<slug> then lands on our own page, not at the partner.
 *     (Other non-active offers keep the old app's known behaviour: the old /out
 *     redirects them to the partner too. That regression is inherent to going
 *     back to the old version - one more reason to prefer fixing forward.)
 *
 *   node scripts/data-corrections/old-app-rollback.js                      dry run, records plan-*.json
 *   node scripts/data-corrections/old-app-rollback.js --apply --plan <f>   before redeploying the old app
 *   node scripts/data-corrections/old-app-rollback.js --revert <revert-f>  after the NEW app is live again
 */
const { loadDb, existingColumns, printPlan, applyChanges, revertFrom, writePlan, assertMatchesPlan } = require("./lib");

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

    const feeRows = await db.$queryRawUnsafe(
      `select f.id, f."accountFeeCents", f."cardFeeCents", f."atmFeeCents", p.slug
         from fees f join promotions p on p.id = f."promotionId"
        where f."accountFeeCents" is null or f."cardFeeCents" is null or f."atmFeeCents" is null
        order by p.slug`
    );
    for (const f of feeRows) {
      const set = {};
      for (const col of ["accountFeeCents", "cardFeeCents", "atmFeeCents"]) if (f[col] === null) set[col] = 0;
      changes.push({
        group: "fees",
        table: "fees",
        id: f.id,
        label: `Fees of ${f.slug}: NULL -> 0 for the old app (${Object.keys(set).join(", ")})`,
        set,
        expect: Object.fromEntries(Object.keys(set).map((k) => [k, null]))
      });
    }

    if (columns.has("promotions.affiliateLinkEnabled")) {
      const site = (process.env.ROLLBACK_SITE_URL || "https://bankmiplaci.pl").replace(/\/$/, "");
      const promos = await db.$queryRawUnsafe(
        `select id, slug, status, "affiliateUrl" from promotions where "affiliateLinkEnabled" = false order by slug`
      );
      for (const p of promos) {
        const own = `${site}/promocje/${p.slug}`;
        const set = { affiliateUrl: own };
        const expect = { affiliateUrl: p.affiliateUrl };
        if (p.status === "ACTIVE") {
          set.status = "EXPIRED";
          expect.status = "ACTIVE";
        }
        changes.push({
          group: "affiliate",
          table: "promotions",
          id: p.id,
          label: `${p.slug}: partner link OFF -> affiliateUrl = ${own}${p.status === "ACTIVE" ? " and ACTIVE -> EXPIRED" : ""}`,
          set,
          expect,
          touchUpdatedAt: true
        });
      }
    }

    if (changes.length === 0) {
      console.log("Nothing to prepare: no NULL fee columns and no ACTIVE promotion with the partner link off.");
      return;
    }
    printPlan("old-app rollback preparation", changes, columns);
    if (!apply) {
      const planFile = writePlan("old-app-rollback", changes);
      console.log(`\nDry run only - nothing written. Plan recorded in ${planFile}.`);
      console.log(`  node scripts/data-corrections/old-app-rollback.js --apply --plan ${planFile}`);
      return;
    }
    const planArg = args.indexOf("--plan");
    if (planArg === -1) throw new Error("--apply needs --plan <file from the reviewed dry run>.");
    assertMatchesPlan(args[planArg + 1], changes);
    await applyChanges(db, "old-app-rollback", changes, columns);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
