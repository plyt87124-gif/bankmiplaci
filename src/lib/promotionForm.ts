import type { Prisma } from "@prisma/client";
import type { PromotionFormValues } from "@/lib/validation/promotion";

/**
 * <input type="date"> only shows a "YYYY-MM-DD" string. Handing the form a
 * Date object left every date field blank on edit, which (for the bonus
 * parts' availableUntil) meant that saving the form after re-typing the
 * required dates would silently erase the stored deadline.
 */
function dateInput(d: Date | null | undefined): Date | undefined {
  return d ? (d.toISOString().slice(0, 10) as unknown as Date) : undefined;
}

type PromotionForForm = Prisma.PromotionGetPayload<{ include: { conditions: true; bonusParts: true; fees: true } }>;

/**
 * Stored promotion -> the admin form's default values (what the edit page
 * hands to <PromotionForm>). Kept out of the page so tests can replay exactly
 * what a "Zapisz zmiany" click without any edit submits.
 */
export function promotionToFormDefaults(promotion: PromotionForForm): Partial<PromotionFormValues> {
  return {
    bankId: promotion.bankId,
    name: promotion.name,
    slug: promotion.slug,
    accountType: promotion.accountType,
    maxBonusCents: promotion.maxBonusCents,
    difficulty: promotion.difficulty,
    ratingOverride: promotion.ratingOverride != null ? Number(promotion.ratingOverride) : undefined,
    ratingReason: promotion.ratingReason ?? undefined,
    status: promotion.status,
    startDate: dateInput(promotion.startDate),
    endDate: dateInput(promotion.endDate),
    affiliateUrl: promotion.affiliateUrl,
    affiliateLinkEnabled: promotion.affiliateLinkEnabled,
    sourceUrl: promotion.sourceUrl ?? undefined,
    lastVerifiedAt: dateInput(promotion.lastVerifiedAt),
    eligibleFor: promotion.eligibleFor ?? undefined,
    notEligibleFor: promotion.notEligibleFor ?? undefined,
    cooldownMonths: promotion.cooldownMonths ?? undefined,
    cooldownCutoffDate: dateInput(promotion.cooldownCutoffDate),
    summary: promotion.summary ?? undefined,
    description: promotion.description ?? undefined,
    conditions: promotion.conditions.map((c) => ({
      title: c.title,
      description: c.description ?? undefined,
      type: c.type as never,
      order: c.order
    })),
    bonusParts: promotion.bonusParts.map((b) => ({
      label: b.label,
      amountCents: b.amountCents,
      order: b.order,
      // Kept in the form so saving never wipes it (see bonusPartSchema).
      availableUntil: dateInput(b.availableUntil)
    })),
    // No Fees row yet -> every field unset ("nieustalone"), never 0.
    fees: promotion.fees
      ? {
          accountFeeCents: promotion.fees.accountFeeCents ?? undefined,
          accountFeeWaiverCondition: promotion.fees.accountFeeWaiverCondition ?? undefined,
          cardFeeCents: promotion.fees.cardFeeCents ?? undefined,
          cardFeeWaiverCondition: promotion.fees.cardFeeWaiverCondition ?? undefined,
          atmFeeCents: promotion.fees.atmFeeCents ?? undefined,
          otherFee: promotion.fees.otherFee ?? undefined
        }
      : {}
  };
}
