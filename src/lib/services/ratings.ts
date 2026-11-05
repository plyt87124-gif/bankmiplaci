import { PromotionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { signupCutoff } from "@/lib/promotionAvailability";
import { buildRatingInput, type RatingSource } from "@/lib/ratingInputs";
import { rateOffers, type RatingInput } from "@/lib/ratingModel";
import { loadEffectiveCommissions } from "@/lib/services/effectiveCommissions";

/**
 * Self-updating "ocena serwisu".
 *
 * The arithmetic lives in lib/ratingModel.ts (weights, curve, scales - the same
 * constants /metodologia describes), the numbers it works on are built in
 * lib/ratingInputs.ts. This file only reads the active offers, asks the model
 * and stores what changed.
 *
 * Every currently ACTIVE, not-yet-expired promotion is scored against offers of
 * the same kind (personal-like or business, never across). A `ratingOverride`
 * set by an administrator wins over the computed value.
 *
 * Runs after every write that can change the active set (admin actions, the
 * import script, expirePastPromotions) and after every affiliate sync, because
 * the commission and the contests we are paid are part of the rating. Never on
 * a timer: nothing else here depends on the passage of time except the
 * karencja date, which moves slowly.
 */

/**
 * Computes the rating of every active promotion without writing anything.
 * Used by recomputeRatings() and by the dry-run script (scripts/rating-dry-run.ts).
 */
export async function computeActiveRatings(now: Date = new Date()): Promise<
  { id: string; slug: string; name: string; accountType: string; stored: number; computed: number; override: number | null; input: RatingInput }[]
> {
  const rows = await db.promotion.findMany({
    where: { status: PromotionStatus.ACTIVE, endDate: { gte: signupCutoff(now) } },
    select: {
      id: true,
      slug: true,
      name: true,
      accountType: true,
      maxBonusCents: true,
      difficulty: true,
      rating: true,
      ratingOverride: true,
      cooldownMonths: true,
      cooldownCutoffDate: true,
      affiliateCommissionCents: true,
      bonusParts: { select: { label: true, amountCents: true }, orderBy: { order: "asc" } },
      checklistSteps: { select: { order: true, title: true, rewardCents: true } },
      fees: {
        select: { accountFeeCents: true, accountFeeWaiverCondition: true, cardFeeCents: true, cardFeeWaiverCondition: true }
      }
    }
  });
  if (rows.length === 0) return [];

  const commissions = await loadEffectiveCommissions();
  const inputs = rows.map((p) => {
    const source: RatingSource = {
      id: p.id,
      slug: p.slug,
      accountType: p.accountType,
      maxBonusCents: p.maxBonusCents,
      difficulty: p.difficulty,
      cooldownMonths: p.cooldownMonths,
      cooldownCutoffDate: p.cooldownCutoffDate,
      bonusParts: p.bonusParts,
      checklistSteps: p.checklistSteps,
      fees: p.fees,
      // The campaigns linked to the promotion; the value stored on the promotion is the fallback.
      commissionCents: commissions.byId.get(p.id) ?? p.affiliateCommissionCents ?? null
    };
    return buildRatingInput(source, now);
  });
  const results = rateOffers(inputs);

  return rows.map((p, i) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    accountType: p.accountType,
    stored: Number(p.rating),
    computed: results.get(p.id)!.rating,
    override: p.ratingOverride === null ? null : Number(p.ratingOverride),
    input: inputs[i]!
  }));
}

/**
 * Recomputes `rating` for every currently-active promotion and persists
 * any changes. Returns how many rows were actually updated. Safe to call
 * as often as needed: a no-op when nothing in the active set changed.
 */
export async function recomputeRatings(): Promise<number> {
  const rated = await computeActiveRatings();
  const updates: { id: string; rating: number }[] = [];
  for (const r of rated) {
    const effective = r.override ?? r.computed;
    if (r.stored !== effective) updates.push({ id: r.id, rating: effective });
  }
  if (updates.length === 0) return 0;

  await db.$transaction(updates.map((u) => db.promotion.update({ where: { id: u.id }, data: { rating: u.rating } })));

  return updates.length;
}
