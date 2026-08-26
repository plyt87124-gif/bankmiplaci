/**
 * Run daily via crontab (or any scheduler) to flip ACTIVE promotions
 * whose end_date has passed to EXPIRED, and recompute ratings for
 * whatever remains active:
 *
 *   0 3 * * * cd /path/to/app && npm run expire:promotions >> /var/log/premia-expire.log 2>&1
 *
 * The public site never depends on this having run recently — see the
 * comment on listActivePromotions() in src/lib/services/promotions.ts —
 * but keeping the stored status (and rating) accurate matters for the
 * admin panel and for historical reporting.
 */
import { db } from "../src/lib/db";
import { expirePastPromotions } from "../src/lib/services/promotions";

async function main() {
  const count = await expirePastPromotions();
  console.log(`Wygaszono ${count} promocji.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
