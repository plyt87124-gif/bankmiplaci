/**
 * Which ściąga steps a given participant can actually use, decided by the
 * REAL date they took up the offer - UserPromotionTracking.accountOpenedAt
 * ("date the account was opened for this promotion", entered when joining
 * the ściąga) - and never by `joinedAt`, which is only when they registered
 * the checklist on this site and says nothing about whether they were in time
 * for a sub-offer with its own sign-up deadline (ChecklistStep.availableUntil).
 *
 * Three outcomes per step:
 *   available    no deadline, or accountOpenedAt is on/before availableUntil
 *   unavailable  accountOpenedAt is after availableUntil -> hidden, never
 *                required, its reward never counted
 *   unknown      the step has a deadline but accountOpenedAt is missing -> the
 *                eligibility is NOT assumed: the step is shown as optional,
 *                is not part of "check the whole month", and a reward that
 *                depends on it only counts once every visible step of that
 *                group has been ticked by the user.
 *
 * Step ids, order, rows and users' saved progress are never touched - this is
 * purely how the existing rows are read. Dates are compared as calendar days
 * (UTC date of the stored value; deadlines are stored as 00:00 UTC of the day).
 */

export type StepAvailability = "available" | "unavailable" | "unknown";

type DateLike = Date | string;

export interface AvailabilityStep {
  id: string;
  order: number;
  rewardCents: number | null;
  availableUntil?: DateLike | null;
}

/** UTC calendar day of a date or ISO string, e.g. "2026-09-30". */
export function dayKey(d: DateLike): string {
  return new Date(d).toISOString().slice(0, 10);
}

export function stepAvailability(
  step: { availableUntil?: DateLike | null },
  accountOpenedAt: DateLike | null | undefined
): StepAvailability {
  if (step.availableUntil == null) return "available";
  if (accountOpenedAt == null) return "unknown";
  return dayKey(accountOpenedAt) <= dayKey(step.availableUntil) ? "available" : "unavailable";
}

export interface ResolvedGroup<S extends AvailabilityStep> {
  groupIndex: number;
  /** Action steps the user should see (available + unknown). */
  visibleSteps: S[];
  /** Action steps that count as required for the month (available only). */
  requiredSteps: S[];
  /** Visible steps whose eligibility can't be told (no accountOpenedAt). */
  unknownSteps: S[];
  /** What "Zaznacz cały miesiąc" toggles - never the unknown ones. */
  bulkSteps: S[];
  /** The group's reward row, or null when it is unavailable to this user. */
  rewardStep: S | null;
  rewardAvailability: StepAvailability | null;
}

const groupIndexFromOrder = (order: number) => Math.floor(order / 10);

export function resolveGroups<S extends AvailabilityStep>(
  steps: S[],
  accountOpenedAt: DateLike | null | undefined
): ResolvedGroup<S>[] {
  const byGroup = new Map<number, S[]>();
  for (const s of steps) {
    const idx = groupIndexFromOrder(s.order);
    byGroup.set(idx, [...(byGroup.get(idx) ?? []), s]);
  }
  return [...byGroup.entries()]
    .sort(([a], [b]) => a - b)
    .map(([groupIndex, groupSteps]) => {
      const actionAll = groupSteps.filter((s) => s.rewardCents === null);
      const rewardRaw = groupSteps.find((s) => s.rewardCents !== null) ?? null;
      const withAvailability = actionAll.map((s) => ({ s, a: stepAvailability(s, accountOpenedAt) }));
      const rewardAvailability = rewardRaw ? stepAvailability(rewardRaw, accountOpenedAt) : null;
      return {
        groupIndex,
        visibleSteps: withAvailability.filter((x) => x.a !== "unavailable").map((x) => x.s),
        requiredSteps: withAvailability.filter((x) => x.a === "available").map((x) => x.s),
        unknownSteps: withAvailability.filter((x) => x.a === "unknown").map((x) => x.s),
        bulkSteps: withAvailability.filter((x) => x.a === "available").map((x) => x.s),
        rewardStep: rewardRaw && rewardAvailability !== "unavailable" ? rewardRaw : null,
        rewardAvailability
      };
    });
}

/**
 * Is the group's reward earned given the ticked step ids?
 *  - reward available: every REQUIRED step ticked (at least one exists)
 *  - reward of unknown eligibility: every VISIBLE step ticked, i.e. the user
 *    has explicitly done the step that proves it (eligibility not assumed)
 *  - reward unavailable / absent: never
 */
export function isRewardEarned<S extends AvailabilityStep>(group: ResolvedGroup<S>, checked: Set<string>): boolean {
  if (!group.rewardStep) return false;
  const needed = group.rewardAvailability === "unknown" ? group.visibleSteps : group.requiredSteps;
  return needed.length > 0 && needed.every((s) => checked.has(s.id));
}

export function earnedCentsFor<S extends AvailabilityStep>(
  steps: S[],
  accountOpenedAt: DateLike | null | undefined,
  checked: Set<string>
): number {
  return resolveGroups(steps, accountOpenedAt).reduce(
    (sum, g) => sum + (isRewardEarned(g, checked) ? g.rewardStep!.rewardCents ?? 0 : 0),
    0
  );
}
