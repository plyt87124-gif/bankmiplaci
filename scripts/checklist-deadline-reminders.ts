/**
 * Run daily via crontab (or trigger the Vercel cron route directly):
 *
 *   45 3 * * * cd /path/to/app && npm run checklist:reminders >> /var/log/premia-checklist-reminders.log 2>&1
 *
 * Emails every user tracking a ściąga with an unlocked, unfinished month
 * group due within 7 days — see src/lib/services/checklistReminders.ts.
 */
import { db } from "../src/lib/db";
import { sendChecklistDeadlineReminders } from "../src/lib/services/checklistReminders";

async function main() {
  const count = await sendChecklistDeadlineReminders();
  console.log(`Wysłano ${count} przypomnień o zbliżającym się terminie.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
