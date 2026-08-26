/**
 * Run daily via crontab alongside expire-promotions (or trigger the
 * Vercel cron route directly):
 *
 *   30 3 * * * cd /path/to/app && npm run check:eligibility >> /var/log/premia-eligibility.log 2>&1
 */
import { db } from "../src/lib/db";
import { checkEligibilityAndNotify } from "../src/lib/services/eligibilityNotifications";

async function main() {
  const notified = await checkEligibilityAndNotify();
  console.log(`Wysłano ${notified} powiadomień o zakończonej karencji.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
