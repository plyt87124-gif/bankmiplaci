/**
 * ChecklistStep.order encodes its month group as `groupIndex * 10 + stepInGroup`
 * (0 = "Otwarcie konta", 1 = first month after opening, 2+ = later months).
 * Kept in one place because both the toggle API (anti-abuse gate) and the
 * ściąga UI (labels + locked state) need the exact same schedule.
 *
 * Two schedules exist:
 *  - the original one (no PeriodRule): month groups follow CALENDAR months -
 *    group 1 is the calendar month after the opening month;
 *  - contract-date windows (a PeriodRule from ChecklistStep.periodStartMonths /
 *    periodMonths): the regulamin counts from the day the agreement was
 *    concluded, e.g. PKO Konto Firmowe for an account opened 6.07: period 1 =
 *    6.07-6.08, period 2 = 7.08-6.09, period 3 = 7.09-6.10, and "within 3 months"
 *    tasks run 6.07-6.10. Dates are 00:00 UTC calendar days, like accountOpenedAt.
 */
export function groupIndexFromOrder(order: number): number {
  return Math.floor(order / 10);
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setDate(1); // avoid month-length rollover (e.g. Jan 31 + 1 month)
  d.setMonth(d.getMonth() + months);
  return d;
}

/** A group's window counted from the agreement date: starts `startMonths` months after it and lasts `months` months. */
export interface PeriodRule {
  startMonths: number;
  months: number;
}

/** The fields of a ChecklistStep that describe its window (both null = original calendar-month schedule). */
export interface PeriodStep {
  periodStartMonths?: number | null;
  periodMonths?: number | null;
}

/** The window rule shared by the steps of one month group, or null when the group follows calendar months. */
export function periodRuleOf(groupSteps: PeriodStep[]): PeriodRule | null {
  const withRule = groupSteps.find((s) => s.periodStartMonths != null);
  if (!withRule) return null;
  const startMonths = Math.max(0, withRule.periodStartMonths ?? 0);
  const months = Math.max(1, withRule.periodMonths ?? 1);
  return { startMonths, months };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function midnightUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Same day of the month `months` later; a day that does not exist there (31 Jan + 1 month) becomes the last day of that month. */
function addMonthsUtc(date: Date, months: number): Date {
  const month = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(date.getUTCFullYear(), month, Math.min(date.getUTCDate(), lastDay)));
}

/** First day of the window: the agreement date itself, or the day after the previous window's last day. */
export function periodStartDate(accountOpenedAt: Date, rule: PeriodRule): Date {
  if (rule.startMonths === 0) return midnightUtc(accountOpenedAt);
  return new Date(addMonthsUtc(accountOpenedAt, rule.startMonths).getTime() + DAY_MS);
}

/** Last day (inclusive) of the window: the same day of the month, `startMonths + months` months after the agreement. */
export function periodLastDay(accountOpenedAt: Date, rule: PeriodRule): Date {
  return addMonthsUtc(accountOpenedAt, rule.startMonths + rule.months);
}

/** First real-world date at which a given month group becomes actionable. */
export function unlockDateForGroup(accountOpenedAt: Date, groupIndex: number, rule?: PeriodRule | null): Date {
  if (groupIndex <= 0) return accountOpenedAt;
  if (rule) return periodStartDate(accountOpenedAt, rule);
  // Group 1 = the calendar month right after the account was opened.
  const firstMonthAnchor = addMonths(accountOpenedAt, 1);
  return addMonths(firstMonthAnchor, groupIndex - 1);
}

/** The moment a group stops being open: the next group's unlock for calendar months, the day after the window's last day otherwise. */
export function deadlineForGroup(accountOpenedAt: Date, groupIndex: number, rule?: PeriodRule | null): Date {
  if (rule) return new Date(periodLastDay(accountOpenedAt, rule).getTime() + DAY_MS);
  return unlockDateForGroup(accountOpenedAt, groupIndex + 1);
}

export function isGroupUnlocked(accountOpenedAt: Date | null, groupIndex: number, rule?: PeriodRule | null): boolean {
  if (!accountOpenedAt) return groupIndex === 0;
  return Date.now() >= unlockDateForGroup(accountOpenedAt, groupIndex, rule).getTime();
}

const dayMonth = (d: Date) => `${d.getUTCDate()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const fullDate = (d: Date) => `${dayMonth(d)}.${d.getUTCFullYear()}`;

/** "6.07-6.08.2026" for a monthly period, "do 6.10.2026" for a task that has three months from the agreement. */
export function periodRangeText(accountOpenedAt: Date, rule: PeriodRule): string {
  const start = periodStartDate(accountOpenedAt, rule);
  const end = periodLastDay(accountOpenedAt, rule);
  if (rule.startMonths === 0 && rule.months > 1) return `do ${fullDate(end)}`;
  return start.getUTCFullYear() === end.getUTCFullYear() ? `${dayMonth(start)}–${fullDate(end)}` : `${fullDate(start)}–${fullDate(end)}`;
}

const MONTH_FORMATTER = new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric" });

/** A stored label of the plain "Miesiąc N" kind ("Miesiąc 3", "Miesiąc 1 (po otwarciu konta)"); an empty label counts too, there is nothing else to show. */
export function isMonthLabel(label: string): boolean {
  const trimmed = label.trim();
  return trimmed === "" || /^Miesiąc\s+\d+/i.test(trimmed);
}

/**
 * Whether a group is a calendar month ("ten miesiąc"). The opening group, groups
 * counted from the agreement date and groups whose stored label says something
 * else ("Nagrody zbiorcze (po 6 miesiącach)") are stages ("ten etap").
 */
export function isMonthGroup(groupIndex: number, storedLabel: string, rule?: PeriodRule | null): boolean {
  return groupIndex > 0 && !rule && isMonthLabel(storedLabel);
}

/**
 * Human label for a month group — real calendar names once we know when the account opened.
 * A group whose stored label is not a plain "Miesiąc N" (an aggregate reward after 6 months, a
 * loyalty reward for 9 of 12 months) keeps that label: it is not one calendar month.
 */
export function monthGroupLabel(
  accountOpenedAt: Date | null,
  groupIndex: number,
  fallbackLabel: string,
  rule?: PeriodRule | null
): string {
  if (groupIndex === 0) return fallbackLabel || "Otwarcie konta";
  if (rule) return accountOpenedAt ? `${fallbackLabel} (${periodRangeText(accountOpenedAt, rule)})` : fallbackLabel;
  if (!isMonthLabel(fallbackLabel)) return fallbackLabel;
  if (groupIndex === 1) return "Pierwszy miesiąc po otwarciu konta";
  if (!accountOpenedAt) return fallbackLabel;
  const label = MONTH_FORMATTER.format(unlockDateForGroup(accountOpenedAt, groupIndex));
  return label.charAt(0).toUpperCase() + label.slice(1);
}
