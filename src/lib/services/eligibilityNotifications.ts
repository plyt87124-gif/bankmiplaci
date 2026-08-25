import { db } from "@/lib/db";
import { PromotionStatus } from "@prisma/client";

/**
 * Scans every UserBankHistory row that has a wasClientUntil date and
 * hasn't been notified yet, and checks it against the shortest
 * cooldownMonths among that bank's currently active promotions FOR
 * THE SAME ACCOUNT TYPE (a closed personal account doesn't clear the
 * karencja for a business-account promotion, and vice versa). If the
 * cooldown has passed, raises one ELIGIBILITY_CLEARED admin
 * notification and marks the row as notified so it doesn't fire
 * again. Fixed cooldownCutoffDate rules are intentionally excluded
 * here — they don't resolve with the passage of time, so there's
 * nothing new to notify about once the eligibility page banner has
 * already shown the (likely permanent) result.
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
    select: { bankId: true, accountType: true, cooldownMonths: true }
  });

  // Key: `${bankId}:${accountType}` -> shortest cooldownMonths among
  // that bank's active promotions for that account type.
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
  }

  return notified;
}
