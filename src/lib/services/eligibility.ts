export interface EligibilityResult {
  status: "eligible" | "not-eligible" | "unknown";
  // Meaningful only for the rolling cooldownMonths rule — the date
  // from which the user becomes eligible.
  eligibleFromDate?: Date;
  // True if the fixed cooldownCutoffDate rule is the (or a) reason
  // for ineligibility — this rule doesn't resolve itself over time,
  // so the banner phrases it differently from eligibleFromDate.
  cutoffFailed?: boolean;
}

/**
 * Combines up to two independent karencja (cooldown) rules a bank can
 * set on a promotion:
 *   - cooldownMonths: "N months since your account closed"
 *   - cooldownCutoffDate: "your account must have closed before DD.MM.RRRR"
 * Both may be set at once — the user must pass BOTH checks to be
 * shown as eligible. Deliberately simple: a real edge case (e.g. a
 * user who is still an active client, with no closure date at all)
 * isn't modeled — this banner is a helpful estimate, not a
 * substitute for reading the bank's actual terms.
 */
export function computeEligibility(
  cooldownMonths: number | null | undefined,
  cooldownCutoffDate: Date | null | undefined,
  wasClientUntil: Date | null | undefined
): EligibilityResult {
  if (!cooldownMonths && !cooldownCutoffDate) return { status: "unknown" };
  if (!wasClientUntil) return { status: "unknown" };

  let notEligible = false;
  let eligibleFromDate: Date | undefined;
  let cutoffFailed = false;

  if (cooldownMonths) {
    const d = new Date(wasClientUntil);
    d.setMonth(d.getMonth() + cooldownMonths);
    eligibleFromDate = d;
    if (d.getTime() > Date.now()) notEligible = true;
  }

  if (cooldownCutoffDate) {
    if (wasClientUntil.getTime() >= cooldownCutoffDate.getTime()) {
      notEligible = true;
      cutoffFailed = true;
    }
  }

  return { status: notEligible ? "not-eligible" : "eligible", eligibleFromDate, cutoffFailed };
}
