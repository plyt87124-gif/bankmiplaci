import { db } from "@/lib/db";
import { alertItemsFor, type ChecklistAlertItem } from "@/lib/checklistDeadlines";

/**
 * Approaching ściąga deadlines of ONE user, for the bell next to "Moje konto"
 * (GET /api/checklist/alerts). Read-only: unlike the e-mail reminder it stamps
 * nothing, so it can be asked for as often as the page needs it. The rule itself
 * lives in src/lib/checklistDeadlines.ts.
 */
export async function getChecklistAlerts(userId: string, now: Date = new Date()): Promise<ChecklistAlertItem[]> {
  const trackings = await db.userPromotionTracking.findMany({
    where: { userId, completedAt: null, accountOpenedAt: { not: null } },
    select: {
      id: true,
      accountOpenedAt: true,
      promotion: {
        select: {
          slug: true,
          name: true,
          bank: { select: { name: true } },
          checklistSteps: {
            select: {
              id: true,
              order: true,
              rewardCents: true,
              availableUntil: true,
              periodStartMonths: true,
              periodMonths: true,
              monthLabel: true
            },
            orderBy: { order: "asc" }
          }
        }
      }
    }
  });
  if (trackings.length === 0) return [];

  const progress = await db.checklistProgress.findMany({ where: { userId }, select: { stepId: true } });
  const checked = new Set(progress.map((p) => p.stepId));

  return trackings
    .flatMap((t) =>
      alertItemsFor(
        {
          id: t.id,
          promotionSlug: t.promotion.slug,
          promotionName: t.promotion.name,
          bankName: t.promotion.bank.name,
          accountOpenedAt: t.accountOpenedAt,
          steps: t.promotion.checklistSteps
        },
        checked,
        now
      )
    )
    .sort((a, b) => a.daysLeft - b.daysLeft);
}
