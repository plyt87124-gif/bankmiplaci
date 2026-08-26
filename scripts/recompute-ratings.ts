/**
 * Manual/cron entry point for the "ocena serwisu" algorithm. Every admin
 * write path (create/update/status change/delete, bulk import, and
 * expire-promotions) already calls recomputeRatings() directly, so this
 * is mainly a safety net / manual re-run tool:
 *
 *   npm run recompute:ratings
 */
import { db } from "../src/lib/db";
import { recomputeRatings } from "../src/lib/services/ratings";

async function main() {
  const count = await recomputeRatings();
  console.log(`Zaktualizowano ocenę ${count} promocji.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
