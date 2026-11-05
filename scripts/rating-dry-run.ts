/**
 * Dry run of the "ocena serwisu": prints, for every active offer, the stored
 * rating, the rating the current model computes and the change of place. Writes
 * NOTHING (recomputeRatings() / npm run recompute:ratings is what stores it).
 *
 *   npx tsx scripts/rating-dry-run.ts
 */
import { db } from "../src/lib/db";
import { computeActiveRatings } from "../src/lib/services/ratings";
import { countedPremiumZl, efficiencyScore, ratingKind } from "../src/lib/ratingModel";

async function main() {
  const rated = await computeActiveRatings();
  for (const kind of ["PERSONAL", "BUSINESS"] as const) {
    const group = rated.filter((r) => ratingKind(r.accountType) === kind);
    if (group.length === 0) continue;
    const effective = (r: (typeof group)[number]) => r.override ?? r.computed;
    const byOld = [...group].sort((a, b) => b.stored - a.stored);
    const byNew = [...group].sort((a, b) => effective(b) - effective(a));
    console.log(`\n== ${kind === "BUSINESS" ? "Firmowe" : "Osobiste"} (${group.length})`);
    console.log("oferta".padEnd(52), "stara", "nowa", "miejsce", "premia", "skut.", "prowizja");
    for (const r of byNew) {
      const oldRank = byOld.indexOf(r) + 1;
      const newRank = byNew.indexOf(r) + 1;
      console.log(
        r.slug.slice(0, 51).padEnd(52),
        r.stored.toFixed(1).padStart(5),
        effective(r).toFixed(1).padStart(4),
        `${String(oldRank).padStart(2)} -> ${String(newRank).padStart(2)}`,
        String(Math.round(countedPremiumZl(r.input))).padStart(6),
        efficiencyScore(r.input).toFixed(2).padStart(5),
        r.input.commissionZl === null ? "brak" : `${Math.round(r.input.commissionZl)} zł`,
        r.override !== null ? "(ręczna ocena)" : ""
      );
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
