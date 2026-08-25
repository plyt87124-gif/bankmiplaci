/**
 * ChecklistStep.order encodes its month group as `groupIndex * 10 + stepInGroup`
 * (0 = "Otwarcie konta", 1 = first month after opening, 2+ = later months).
 * Kept in one place because both the toggle API (anti-abuse gate) and the
 * ściąga UI (labels + locked state) need the exact same schedule.
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

/** First real-world date at which a given month group becomes actionable. */
export function unlockDateForGroup(accountOpenedAt: Date, groupIndex: number): Date {
  if (groupIndex <= 0) return accountOpenedAt;
  // Group 1 = the calendar month right after the account was opened.
  const firstMonthAnchor = addMonths(accountOpenedAt, 1);
  return addMonths(firstMonthAnchor, groupIndex - 1);
}

export function isGroupUnlocked(accountOpenedAt: Date | null, groupIndex: number): boolean {
  if (!accountOpenedAt) return groupIndex === 0;
  return Date.now() >= unlockDateForGroup(accountOpenedAt, groupIndex).getTime();
}

const MONTH_FORMATTER = new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric" });

/** Human label for a month group — real calendar names once we know when the account opened. */
export function monthGroupLabel(accountOpenedAt: Date | null, groupIndex: number, fallbackLabel: string): string {
  if (groupIndex === 0) return fallbackLabel || "Otwarcie konta";
  if (groupIndex === 1) return "Pierwszy miesiąc po otwarciu konta";
  if (!accountOpenedAt) return fallbackLabel;
  const label = MONTH_FORMATTER.format(unlockDateForGroup(accountOpenedAt, groupIndex));
  return label.charAt(0).toUpperCase() + label.slice(1);
}
