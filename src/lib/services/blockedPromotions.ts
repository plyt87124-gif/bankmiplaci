import { db } from "@/lib/db";
import { computeEligibility } from "@/lib/services/eligibility";
import { activeWhere } from "@/lib/services/promotions";

/**
 * Slugs of the open offers this user clearly cannot take part in right now:
 * the closure date the user gave for that bank + account type fails the
 * offer's karencja rule (computeEligibility says "not-eligible"). Offers
 * whose rules are unknown, or for banks the user gave no date for, are never
 * listed - "no data" is not "blocked". Feeds the red glow of the offer cards.
 */
export async function listBlockedPromotionSlugs(userId: string, now: Date = new Date()): Promise<string[]> {
  const history = await db.userBankHistory.findMany({
    where: { userId, wasClientUntil: { not: null } },
    select: { bankId: true, accountType: true, wasClientUntil: true }
  });
  if (history.length === 0) return [];

  const promotions = await db.promotion.findMany({
    where: {
      ...activeWhere(),
      bankId: { in: [...new Set(history.map((h) => h.bankId))] },
      OR: [{ cooldownMonths: { not: null } }, { cooldownCutoffDate: { not: null } }]
    },
    select: { slug: true, bankId: true, accountType: true, cooldownMonths: true, cooldownCutoffDate: true }
  });

  const blocked: string[] = [];
  for (const promotion of promotions) {
    const row = history.find((h) => h.bankId === promotion.bankId && h.accountType === promotion.accountType);
    if (!row) continue;
    const result = computeEligibility(promotion.cooldownMonths, promotion.cooldownCutoffDate, row.wasClientUntil, now);
    if (result.status === "not-eligible") blocked.push(promotion.slug);
  }
  return blocked;
}
