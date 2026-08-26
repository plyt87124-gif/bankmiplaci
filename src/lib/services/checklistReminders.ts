import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { checklistDeadlineReminderEmailHtml } from "@/lib/emailTemplates";
import { groupIndexFromOrder, isGroupUnlocked, monthGroupLabel, unlockDateForGroup } from "@/lib/checklistSchedule";

const REMIND_WITHIN_DAYS = 7;

/**
 * For every promotion a user is actively tracking (UserPromotionTracking
 * with completedAt: null and an accountOpenedAt set), finds month groups
 * that are currently unlocked, not yet fully checked off, and within
 * REMIND_WITHIN_DAYS of their deadline (the day the next month group
 * unlocks) — then emails a single digest per user listing everything
 * pending, and stamps remindedGroupIndexes so the same month is never
 * emailed twice.
 *
 * Intended to run daily (see /api/cron/checklist-deadline-reminders and
 * scripts/checklist-deadline-reminders.ts).
 */
export async function sendChecklistDeadlineReminders(): Promise<number> {
  const trackings = await db.userPromotionTracking.findMany({
    where: { completedAt: null, accountOpenedAt: { not: null } },
    include: {
      user: true,
      promotion: { include: { bank: true, checklistSteps: { orderBy: { order: "asc" } } } }
    }
  });

  if (trackings.length === 0) return 0;

  const userIds = [...new Set(trackings.map((t) => t.userId))];
  const progressRows = await db.checklistProgress.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, stepId: true }
  });
  const checkedByUser = new Map<string, Set<string>>();
  for (const p of progressRows) {
    const set = checkedByUser.get(p.userId) ?? new Set<string>();
    set.add(p.stepId);
    checkedByUser.set(p.userId, set);
  }

  interface PendingItem {
    bankName: string;
    promotionName: string;
    monthLabel: string;
    daysLeft: number;
    rewardLabel: string | null;
  }
  const byUser = new Map<string, { email: string; name: string | null; items: PendingItem[] }>();
  const trackingUpdates: { trackingId: string; groupIndex: number }[] = [];

  for (const tracking of trackings) {
    const accountOpenedAt = tracking.accountOpenedAt!;
    const checked = checkedByUser.get(tracking.userId) ?? new Set<string>();

    const byGroup = new Map<number, typeof tracking.promotion.checklistSteps>();
    for (const step of tracking.promotion.checklistSteps) {
      const idx = groupIndexFromOrder(step.order);
      const list = byGroup.get(idx) ?? [];
      list.push(step);
      byGroup.set(idx, list);
    }

    for (const [groupIndex, steps] of byGroup) {
      if (groupIndex === 0) continue; // account-opening group has no monthly deadline
      const actionSteps = steps.filter((s) => s.rewardCents === null);
      if (actionSteps.length === 0) continue;
      if (!isGroupUnlocked(accountOpenedAt, groupIndex)) continue;
      if (actionSteps.every((s) => checked.has(s.id))) continue; // already done
      if (tracking.remindedGroupIndexes.includes(groupIndex)) continue; // already reminded

      const deadline = unlockDateForGroup(accountOpenedAt, groupIndex + 1);
      const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysLeft < 0 || daysLeft > REMIND_WITHIN_DAYS) continue;

      const rewardStep = steps.find((s) => s.rewardCents !== null) ?? null;

      const entry = byUser.get(tracking.userId) ?? { email: tracking.user.email, name: tracking.user.name, items: [] };
      entry.items.push({
        bankName: tracking.promotion.bank.name,
        promotionName: tracking.promotion.name,
        monthLabel: monthGroupLabel(accountOpenedAt, groupIndex, steps[0]?.monthLabel ?? ""),
        daysLeft,
        rewardLabel: rewardStep ? `${rewardStep.title.replace(/^Odbierz(?: nagrodę)?:?\s*/i, "")}` : null
      });
      byUser.set(tracking.userId, entry);
      trackingUpdates.push({ trackingId: tracking.id, groupIndex });
    }
  }

  if (byUser.size === 0) return 0;

  const accountUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/konto`;

  for (const [, { email, name, items }] of byUser) {
    await sendEmail({
      to: email,
      subject: `Zostało mniej niż 7 dni — ${items.length > 1 ? "kilka promocji" : items[0]?.promotionName}`,
      html: checklistDeadlineReminderEmailHtml({ userName: name || email, items, accountUrl })
    });
  }

  await db.$transaction(
    trackingUpdates.map((u) =>
      db.userPromotionTracking.update({
        where: { id: u.trackingId },
        data: { remindedGroupIndexes: { push: u.groupIndex } }
      })
    )
  );

  return byUser.size;
}
