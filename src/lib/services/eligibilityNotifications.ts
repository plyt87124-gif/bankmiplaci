import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { PromotionStatus, type PrismaClient } from "@prisma/client";
import { sendEmail } from "@/lib/email";
import { computeEligibility } from "@/lib/services/eligibility";
import { signupCutoff } from "@/lib/promotionAvailability";
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
 * "Elapsed" is decided by computeEligibility() - the same function as the
 * promotion page banner and the checklist restart lock - per promotion, so a
 * cooldownMonths of 0 means "no waiting after the known closure date" (never
 * "no rule"), a closure date still in the future never qualifies, and the
 * independent cooldownCutoffDate is checked too: the user is told about, and
 * linked to, only a promotion they would really clear.
 *
 * Runs daily via /api/cron/check-eligibility (see vercel.json) and via
 * `npm run check:eligibility` for manual/external-crontab use.
 */
export interface EligibilityNotifyDeps {
  client?: PrismaClient;
  /** Replaceable so tests never send real e-mail. */
  send?: typeof sendEmail;
  now?: Date;
  /** Limit the run to these users (tests, manual re-runs); omitted = everyone, as the daily cron runs it. */
  userIds?: string[];
}

export async function checkEligibilityAndNotify({ client = db, send = sendEmail, now = new Date(), userIds }: EligibilityNotifyDeps = {}): Promise<number> {
  const pending = await client.userBankHistory.findMany({
    where: { wasClientUntil: { not: null }, eligibilityNotifiedAt: null, ...(userIds ? { userId: { in: userIds } } : {}) },
    include: { user: true, bank: true }
  });

  if (pending.length === 0) return 0;

  const bankIds = [...new Set(pending.map((p) => p.bankId))];
  const activePromotions = await client.promotion.findMany({
    where: {
      bankId: { in: bankIds },
      status: PromotionStatus.ACTIVE,
      // Same rule as the public listing: an offer whose last day has passed
      // must not be recommended in an email just because its status has not
      // been flipped to EXPIRED yet.
      endDate: { gte: signupCutoff(now) },
      // A monthly rule (0 included) is what makes "the cooldown has elapsed"
      // an event in time; a cutoff-date-only promotion never resolves itself.
      cooldownMonths: { not: null }
    },
    select: {
      id: true,
      slug: true,
      name: true,
      rating: true,
      bankId: true,
      accountType: true,
      cooldownMonths: true,
      cooldownCutoffDate: true
    }
  });

  const promotionsByKey = new Map<string, typeof activePromotions>();
  for (const promo of activePromotions) {
    const key = `${promo.bankId}:${promo.accountType}`;
    promotionsByKey.set(key, [...(promotionsByKey.get(key) ?? []), promo]);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  let notified = 0;

  for (const row of pending) {
    if (!row.wasClientUntil) continue;
    const eligible = (promotionsByKey.get(`${row.bankId}:${row.accountType}`) ?? [])
      .map((promo) => ({
        promo,
        result: computeEligibility(promo.cooldownMonths, promo.cooldownCutoffDate, row.wasClientUntil, now)
      }))
      .filter((x) => x.result.status === "eligible");
    if (eligible.length === 0) continue;

    // The best-rated promotion this user actually clears; the cleared date is
    // the earliest one among them.
    const linkedPromotion = eligible.reduce((best, x) => (Number(x.promo.rating) > Number(best.promo.rating) ? x : best)).promo;
    const eligibleFrom = eligible
      .map((x) => x.result.eligibleFromDate ?? row.wasClientUntil!)
      .reduce((min, d) => (d.getTime() < min.getTime() ? d : min));
    const token = randomUUID();

    await client.$transaction([
      client.adminNotification.create({
        data: {
          type: "ELIGIBILITY_CLEARED",
          title: "Użytkownikowi minął okres karencji",
          body: `${row.user.name || row.user.email} może teraz skorzystać z promocji banku ${row.bank.name} (konto: ${row.accountType}, karencja minęła ${eligibleFrom.toLocaleDateString("pl-PL")}).`,
          relatedUserId: row.userId,
          relatedBankId: row.bankId,
          relatedPromotionId: linkedPromotion.id
        }
      }),
      client.userBankHistory.update({
        where: { id: row.id },
        data: {
          eligibilityNotifiedAt: now,
          eligibilityClearedAt: eligibleFrom,
          eligibilityEmailToken: token,
          eligibilityPromotionId: linkedPromotion.id
        }
      })
    ]);
    notified += 1;

    const linkUrl = `${siteUrl}/api/eligibility-link/${token}`;
    await send({
      to: row.user.email,
      subject: `Możesz już skorzystać z promocji ${row.bank.name}`,
      html: eligibilityReminderEmailHtml({
        userName: row.user.name || row.user.email,
        bankName: row.bank.name,
        promotionName: linkedPromotion.name,
        linkUrl
      })
    });
  }

  return notified;
}
