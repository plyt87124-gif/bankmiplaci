import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { PromotionStatus } from "@prisma/client";
import { sendEmail } from "@/lib/email";
import { eligibilityReminderEmailHtml } from "@/lib/emailTemplates";

/**
 * Finds every UserBankHistory row whose karencja (cooldown) has just
 * elapsed, and for each one:
 *   1. picks the best currently-ACTIVE promotion for that bank+accountType
 *      to point them at (highest rating),
 *   2. creates an in-app AdminNotification (powers the admin bell badge),
 *   3. stamps eligibilityNotifiedAt + a fresh eligibilityEmailToken,
 *   4. emails the user a tracked link (see /api/eligibility-link/[token])
 *      that, when clicked, stamps eligibilityLinkClickedAt and forwards
 *      them to that promotion's page — letting the admin panel show both
 *      "opened the email" and "then clicked Przejdź do promocji" as two
 *      separate funnel steps (the latter via the existing Click table,
 *      matched on campaign = token).
 *
 * Runs daily via /api/cron/check-eligibility (see vercel.json) and via
 * `npm run check:eligibility` for manual/external-crontab use.
 */
export async function checkEligibilityAndNotify(): Promise<number> {
  const pending = await db.userBankHistory.findMany({
    where: { wasClientUntil: { not: null }, eligibilityNotifiedAt: null },
    include: { user: true, bank: true }
  });

  if (pending.length === 0) return 0;

  const bankIds = [...new Set(pending.map((p) => p.bankId))];
  const activePromotions = await db.promotion.findMany({
    where: { bankId: { in: bankIds }, status: PromotionStatus.ACTIVE, cooldownMonths: { not: null } },
    select: { id: true, slug: true, name: true, rating: true, bankId: true, accountType: true, cooldownMonths: true }
  });

  const minCooldownByKey = new Map<string, number>();
  const bestPromotionByKey = new Map<string, (typeof activePromotions)[number]>();
  for (const promo of activePromotions) {
    if (promo.cooldownMonths == null) continue;
    const key = `${promo.bankId}:${promo.accountType}`;

    const currentMin = minCooldownByKey.get(key);
    if (currentMin === undefined || promo.cooldownMonths < currentMin) {
      minCooldownByKey.set(key, promo.cooldownMonths);
    }

    const currentBest = bestPromotionByKey.get(key);
    if (!currentBest || Number(promo.rating) > Number(currentBest.rating)) {
      bestPromotionByKey.set(key, promo);
    }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  let notified = 0;

  for (const row of pending) {
    const key = `${row.bankId}:${row.accountType}`;
    const cooldownMonths = minCooldownByKey.get(key);
    if (cooldownMonths === undefined || !row.wasClientUntil) continue;

    const eligibleFrom = new Date(row.wasClientUntil);
    eligibleFrom.setMonth(eligibleFrom.getMonth() + cooldownMonths);
    if (eligibleFrom.getTime() > Date.now()) continue;

    const linkedPromotion = bestPromotionByKey.get(key) ?? null;
    const token = randomUUID();

    await db.$transaction([
      db.adminNotification.create({
        data: {
          type: "ELIGIBILITY_CLEARED",
          title: "Użytkownikowi minął okres karencji",
          body: `${row.user.name || row.user.email} może teraz skorzystać z promocji banku ${row.bank.name} (konto: ${row.accountType}, karencja minęła ${eligibleFrom.toLocaleDateString("pl-PL")}).`,
          relatedUserId: row.userId,
          relatedBankId: row.bankId,
          relatedPromotionId: linkedPromotion?.id
        }
      }),
      db.userBankHistory.update({
        where: { id: row.id },
        data: {
          eligibilityNotifiedAt: new Date(),
          eligibilityClearedAt: eligibleFrom,
          eligibilityEmailToken: token,
          eligibilityPromotionId: linkedPromotion?.id
        }
      })
    ]);
    notified += 1;

    const linkUrl = `${siteUrl}/api/eligibility-link/${token}`;
    await sendEmail({
      to: row.user.email,
      subject: `Możesz już skorzystać z promocji ${row.bank.name}`,
      html: eligibilityReminderEmailHtml({
        userName: row.user.name || row.user.email,
        bankName: row.bank.name,
        promotionName: linkedPromotion?.name ?? null,
        linkUrl
      })
    });
  }

  return notified;
}
