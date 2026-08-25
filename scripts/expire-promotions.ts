/**
 * Run daily via crontab (or any scheduler) to flip ACTIVE promotions
 * whose end_date has passed to EXPIRED:
 *
 *   0 3 * * * cd /path/to/app && npm run expire:promotions >> /var/log/premia-expire.log 2>&1
 *
 * The public site never depends on this having run recently — see the
 * comment on listActivePromotions() in src/lib/services/promotions.ts —
 * but keeping the stored status accurate matters for the admin panel
 * and for historical reporting.
 */
import { PrismaClient, PromotionStatus } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const result = await db.promotion.updateMany({
    where: { status: PromotionStatus.ACTIVE, endDate: { lt: new Date() } },
    data: { status: PromotionStatus.EXPIRED }
  });
  console.log(`Wygaszono ${result.count} promocji.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
