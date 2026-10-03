import { warsawTodayAsUtcMidnight } from "@/lib/promotionAvailability";

export interface EligibilityResult {
  status: "eligible" | "not-eligible" | "unknown";
  // The date from which the monthly rule (or, failing that, the closure of the
  // account itself) no longer stands in the way. Absent when only a cutoff
  // date is set and the account is already closed.
  eligibleFromDate?: Date;
  // True if the fixed cooldownCutoffDate rule is the (or a) reason
  // for ineligibility — this rule doesn't resolve itself over time,
  // so the banner phrases it differently from eligibleFromDate.
  cutoffFailed?: boolean;
}

const hasMonths = (m: number | null | undefined): m is number => typeof m === "number" && Number.isFinite(m);

/** wasClientUntil + N calendar months (UTC, JS month rollover), the date the monthly rule is satisfied from. */
export function eligibleFromDate(wasClientUntil: Date, cooldownMonths: number): Date {
  const d = new Date(wasClientUntil);
  d.setUTCMonth(d.getUTCMonth() + cooldownMonths);
  return d;
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/**
 * The single place that decides whether a user (identified only by the date
 * their account at the bank was closed) can take part again. Used by the
 * promotion page banner, the checklist restart lock and the "karencja minęła"
 * notifications, so they can never disagree.
 *
 * Two independent rules a bank can set on a promotion:
 *   - cooldownMonths: "N months since your account closed".
 *       NULL = no monthly rule. 0 = a monthly rule that adds NO waiting time:
 *       eligible from the (known) closure date itself. Never treated as NULL.
 *   - cooldownCutoffDate: "your account must have closed before DD.MM.RRRR".
 * Both may be set; the user must pass BOTH to be eligible.
 *
 * Inputs that are never turned into a "yes":
 *   - no rule at all                    -> unknown
 *   - no closure date in the user's data -> unknown (qualification is not assumed)
 *   - closure date still in the future   -> not-eligible until that day (the account
 *     is not closed yet), whatever the rules are
 *
 * Days are compared as calendar days in Poland (the same clock as the sign-up
 * deadline), so a closure date of "today" is already in the past.
 *
 * Deliberately simple: this is a helpful estimate, not a substitute for
 * reading the bank's actual terms.
 */
export function computeEligibility(
  cooldownMonths: number | null | undefined,
  cooldownCutoffDate: Date | null | undefined,
  wasClientUntil: Date | null | undefined,
  now: Date = new Date()
): EligibilityResult {
  const monthRule = hasMonths(cooldownMonths);
  if (!monthRule && !cooldownCutoffDate) return { status: "unknown" };
  if (!wasClientUntil) return { status: "unknown" };

  const today = dayKey(warsawTodayAsUtcMidnight(now));
  const from = monthRule ? eligibleFromDate(wasClientUntil, cooldownMonths) : wasClientUntil;
  const waiting = dayKey(from) > today || dayKey(wasClientUntil) > today;
  const cutoffFailed = Boolean(cooldownCutoffDate) && dayKey(wasClientUntil) >= dayKey(cooldownCutoffDate!);

  return {
    status: waiting || cutoffFailed ? "not-eligible" : "eligible",
    eligibleFromDate: monthRule || waiting ? from : undefined,
    cutoffFailed
  };
}

/**
 * Whether the ściąga of an already COMPLETED promotion stays locked for this
 * participant: only a clear "eligible" (known closure date, rules satisfied)
 * lets them start a fresh round. Not completed -> not locked here.
 */
export function isChecklistRestartLocked(completedAt: Date | null | undefined, eligibility: EligibilityResult): boolean {
  return Boolean(completedAt) && eligibility.status !== "eligible";
}
