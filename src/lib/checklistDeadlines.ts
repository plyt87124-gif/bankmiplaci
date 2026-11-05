import { resolveGroups, type AvailabilityStep } from "@/lib/checklistAvailability";
import {
  deadlineForGroup,
  groupIndexFromOrder,
  monthGroupLabel,
  periodRuleOf,
  unlockDateForGroup,
  type PeriodStep
} from "@/lib/checklistSchedule";

/**
 * "A deadline is coming up and the steps are not ticked": the rule behind the
 * bell icon on a ściąga card and next to "Moje konto" in the header.
 *
 * It is deliberately the SAME rule as the e-mail reminder
 * (src/lib/services/checklistReminders.ts): a month group counts when it is
 *  - not the account-opening group (that one has no monthly deadline),
 *  - already unlocked,
 *  - not fully ticked (only the steps THIS participant can do are counted, see
 *    checklistAvailability.ts),
 *  - and its deadline (the moment the group stops being open) is at most
 *    DEADLINE_WARNING_DAYS days away, counted the way the e-mail counts them.
 * The bell and the e-mail therefore agree. The difference: the e-mail goes out
 * once per group, the bell stays while the condition holds.
 *
 * Pure (no Date.now(), no database): the server (GET /api/checklist/alerts) and
 * the live ściąga on /konto call the same function.
 */
export const DEADLINE_WARNING_DAYS = 7;

/** From this many days or fewer the warning is the "red" one. */
export const DEADLINE_URGENT_DAYS = 2;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The fields of a ChecklistStep this rule reads. */
export interface DeadlineStep extends AvailabilityStep, PeriodStep {
  /** Generic label of the group; only the fallback of the group name. */
  monthLabel?: string;
}

export interface GroupDeadline {
  groupIndex: number;
  /** Group name as the ściąga shows it ("Pierwszy miesiąc po otwarciu konta", "Grudzień 2026", "Okres 2 (7.08–6.09.2026)"). */
  label: string;
  /** Whole days left, counted like the e-mail does: 1 = the last day is today. */
  daysLeft: number;
  /** Last day (inclusive) as 00:00 UTC of that calendar day. */
  lastDay: Date;
  /** Required steps of the group that are not ticked yet. */
  openSteps: number;
}

export function upcomingGroupDeadlines(
  steps: readonly DeadlineStep[],
  accountOpenedAt: Date | string | null | undefined,
  checked: ReadonlySet<string>,
  now: Date = new Date(),
  withinDays: number = DEADLINE_WARNING_DAYS
): GroupDeadline[] {
  if (accountOpenedAt == null) return [];
  const opened = new Date(accountOpenedAt);
  if (Number.isNaN(opened.getTime())) return [];

  const result: GroupDeadline[] = [];
  for (const group of resolveGroups([...steps], opened)) {
    if (group.groupIndex === 0) continue;
    const required = group.requiredSteps;
    if (required.length === 0) continue;
    const groupSteps = steps.filter((s) => groupIndexFromOrder(s.order) === group.groupIndex);
    const rule = periodRuleOf(groupSteps);
    if (now.getTime() < unlockDateForGroup(opened, group.groupIndex, rule).getTime()) continue;
    const open = required.filter((s) => !checked.has(s.id)).length;
    if (open === 0) continue;

    const deadline = deadlineForGroup(opened, group.groupIndex, rule);
    const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / DAY_MS);
    if (daysLeft < 1 || daysLeft > withinDays) continue;

    const lastDay = new Date(deadline.getTime() - DAY_MS);
    result.push({
      groupIndex: group.groupIndex,
      label: monthGroupLabel(opened, group.groupIndex, groupSteps[0]?.monthLabel ?? "", rule),
      daysLeft,
      lastDay: new Date(Date.UTC(lastDay.getUTCFullYear(), lastDay.getUTCMonth(), lastDay.getUTCDate())),
      openSteps: open
    });
  }
  return result.sort((a, b) => a.daysLeft - b.daysLeft || a.groupIndex - b.groupIndex);
}

/** What the bell shows for one approaching group; plain JSON, so the API can send it as it is. */
export interface ChecklistAlertItem {
  trackingId: string;
  promotionSlug: string;
  promotionName: string;
  bankName: string;
  groupLabel: string;
  daysLeft: number;
  /** Last day, "YYYY-MM-DD". */
  lastDay: string;
  openSteps: number;
}

export interface AlertTracking {
  id: string;
  promotionSlug: string;
  promotionName: string;
  bankName: string;
  accountOpenedAt: Date | string | null;
  steps: readonly DeadlineStep[];
}

/** The alerts of one tracked promotion, soonest first. */
export function alertItemsFor(
  tracking: AlertTracking,
  checked: ReadonlySet<string>,
  now: Date = new Date()
): ChecklistAlertItem[] {
  return upcomingGroupDeadlines(tracking.steps, tracking.accountOpenedAt, checked, now).map((d) => ({
    trackingId: tracking.id,
    promotionSlug: tracking.promotionSlug,
    promotionName: tracking.promotionName,
    bankName: tracking.bankName,
    groupLabel: d.label,
    daysLeft: d.daysLeft,
    lastDay: d.lastDay.toISOString().slice(0, 10),
    openSteps: d.openSteps
  }));
}

/** "10.11" - the last day of the window, no year (it is always within the next week). */
export function lastDayText(lastDay: Date | string): string {
  const d = new Date(lastDay);
  return `${d.getUTCDate()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "Dziś ostatni dzień", "Zostały 3 dni", "Zostało 6 dni". */
export function daysLeftText(daysLeft: number): string {
  if (daysLeft <= 1) return "Dziś ostatni dzień";
  return `${daysLeft < 5 ? "Zostały" : "Zostało"} ${daysLeft} dni`;
}

export function isUrgent(daysLeft: number): boolean {
  return daysLeft <= DEADLINE_URGENT_DAYS;
}
