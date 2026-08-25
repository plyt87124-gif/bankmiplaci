/**
 * Run daily via crontab alongside expire-promotions:
 *
 *   30 3 * * * cd /path/to/app && npm run check:eligibility >> /var/log/premia-eligibility.log 2>&1
 */
import { PrismaClient, PromotionStatus } from "@prisma/client";
import { sendEmail } from "../src/lib/email";
import { eligibilityReminderEmailHtml } from "../src/lib/emailTemplates";

const db = new PrismaClient();

async function main() {
  const pending = await db.userBankHistory.findMany({
    where: { wasClientUntil: { not: null }, eligibilityNotifiedAt: null },
    include: { user: true, bank: true }
  });

  if (pending.length === 0) {
    console.log("Brak nowych wpisów historii bankowej do sprawdzenia.");
    return;
  }

  const bankIds = [...new Set(pending.map((p) => p.bankId))];
  const activePromotions = await db.promotion.findMany({
    where: { bankId: { in: bankIds }, status: PromotionStatus.ACTIVE, cooldownMonths: { not: null } },
    select: { bankId: true, accountType: true, cooldownMonths: true }
  });

  const minCooldownByBankAndType = new Map<string, number>();
  for (const promo of activePromotions) {
    if (promo.cooldownMonths == null) continue;
    const key = `${promo.bankId}:${promo.accountType}`;
    const current = minCooldownByBankAndType.get(key);
    if (current === undefined || promo.cooldownMonths < current) {
      minCooldownByBankAndType.set(key, promo.cooldownMonths);
    }
  }

  let notified = 0;
  for (const row of pending) {
    const key = `${row.bankId}:${row.accountType}`;
    const cooldownMonths = minCooldownByBankAndType.get(key);
    if (cooldownMonths === undefined || !row.wasClientUntil) continue;

    const eligibleFrom = new Date(row.wasClientUntil);
    eligibleFrom.setMonth(eligibleFrom.getMonth() + cooldownMonths);
    if (eligibleFrom.getTime() > Date.now()) continue;

    await db.$transaction([
      db.adminNotification.create({
        data: {
          type: "ELIGIBILITY_CLEARED",
          title: "Użytkownikowi minął okres karencji",
          body: `${row.user.name || row.user.email} może teraz skorzystać z promocji banku ${row.bank.name} (konto: ${row.accountType}, karencja minęła ${eligibleFrom.toLocaleDateString("pl-PL")}).`,
          relatedUserId: row.userId,
          relatedBankId: row.bankId
        }
      }),
      db.userBankHistory.update({ where: { id: row.id }, data: { eligibilityNotifiedAt: new Date() } })
    ]);
    notified += 1;

    const promotionsUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/promocje?bank=${row.bank.slug}`;
    await sendEmail({
      to: row.user.email,
      subject: `Możesz już skorzystać z promocji ${row.bank.name}`,
      html: eligibilityReminderEmailHtml({
        userName: row.user.name || row.user.email,
        bankName: row.bank.name,
        promotionsUrl
      })
    });
  }

  console.log(`Utworzono ${notified} powiadomień o zakończonej karencji.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
