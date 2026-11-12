/**
 * Verification date of two offers the OWNER checked in person today (2026-11-11), stated in chat:
 *   "zmień datę weryfikacji na dzisiejszą, bo dzisiaj sprawdzałem" - the mBank mKonto Intensive card, and
 *   "warunki Alior firmowego, tam też możesz zmienić na dzisiejszą" - the Alior business offer.
 *
 * Changes ONLY Promotion.lastVerifiedAt (and the bookkeeping stamps contentUpdatedAt / updatedAt, which is what the
 * admin form does too: lastVerifiedAt is part of the page content, see src/lib/promotionContent.ts). Nothing else.
 * It does NOT go through `verify-offers.ts confirm` (that CLI is on PR #14, not merged) and writes no
 * promotion_verifications row: the source of this date is the owner's own check, not a document read by us.
 *
 *   node scripts/data-corrections/verification-2026-11-11.js                       dry run (default) - writes nothing, records plan-*.json
 *   node scripts/data-corrections/verification-2026-11-11.js --apply --plan <plan> only if the rows still equal the reviewed plan
 *   node scripts/data-corrections/verification-2026-11-11.js --revert <file>       [--force]
 *
 * The value is a literal on purpose (the plan digest must stay identical between the dry run and --apply).
 */
const { loadDb, existingColumns, printPlan, applyChanges, revertFrom, writePlan, assertMatchesPlan } = require("./lib");

// 17:00 UTC = 18:00 in Warsaw: the same calendar day there and in UTC, and never in the future when it is run.
const VERIFIED_AT = new Date("2026-11-11T17:00:00.000Z");

const TARGETS = [
  {
    slug: "mbank-mkonto-intensive-cala-naprzod-2",
    source: "owner, chat 2026-11-11: checked today (the offer card showed 'Zweryfikowano 27 paź 2026')"
  },
  {
    slug: "alior-szybki-bonus-dla-firm-ikonto-biznes",
    source: "owner, chat 2026-11-11: checked the Alior business conditions today"
  }
];

async function main() {
  const db = loadDb();
  try {
    const args = process.argv.slice(2);
    if (args.includes("--revert")) {
      await revertFrom(db, args[args.indexOf("--revert") + 1], args.includes("--force"));
      return;
    }
    const apply = args.includes("--apply");
    const columns = await existingColumns(db, ["promotions"]);
    const hasStamp = columns.has("promotions.contentUpdatedAt");

    const changes = [];
    for (const { slug, source } of TARGETS) {
      const [p] = await db.$queryRawUnsafe(
        `select id, slug, name, status, "lastVerifiedAt", "contentUpdatedAt" from promotions where slug = $1`,
        slug
      );
      if (!p) throw new Error(`Promotion ${slug} not found`);
      changes.push({
        table: "promotions",
        id: p.id,
        label: `${p.name} (${p.slug}, ${p.status})`,
        group: "dane",
        set: { lastVerifiedAt: VERIFIED_AT },
        expect: { lastVerifiedAt: p.lastVerifiedAt },
        ...(hasStamp ? { stamp: ["contentUpdatedAt"], oldStamp: { contentUpdatedAt: p.contentUpdatedAt ?? null } } : {}),
        touchUpdatedAt: true,
        requires: ["promotions.lastVerifiedAt"],
        source
      });
    }

    printPlan("Verification date 2026-11-11", changes, columns);

    // Read-only context, so the "Alior business" target can be checked by eye: every Alior offer and its type.
    const alior = await db.$queryRawUnsafe(
      `select slug, "accountType", status, "lastVerifiedAt" from promotions where slug ilike 'alior%' order by slug`
    );
    console.log("\nAll Alior offers in the database (read-only, for checking that the right one is targeted):");
    for (const a of alior) {
      const target = TARGETS.some((t) => t.slug === a.slug) ? "  <== changed by this script" : "";
      console.log(`  ${a.slug}  [${a.accountType}, ${a.status}]  lastVerifiedAt ${a.lastVerifiedAt.toISOString()}${target}`);
    }
    console.log("\nDeliberately unchanged: every other column, every other offer, checklists, ratings, fees, texts.");

    if (!apply) {
      const planFile = writePlan("verification-2026-11-11", changes);
      console.log(`\nDry run only - nothing written to the database. Plan recorded in ${planFile}.`);
      console.log(`To apply after review:\n  node scripts/data-corrections/verification-2026-11-11.js --apply --plan ${planFile}`);
      return;
    }
    const planArg = args.indexOf("--plan");
    if (planArg === -1) throw new Error("--apply needs --plan <file from the reviewed dry run>.");
    assertMatchesPlan(args[planArg + 1], changes);
    await applyChanges(db, "verification-2026-11-11", changes, columns);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
