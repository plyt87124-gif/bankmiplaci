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
    affiliateCommissionCents: promotion.affiliateCommissionCents ?? undefined,
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

/**
 * Soft editorial checks for the admin form. They only warn, never block a save.
 */

/** Longest summary that still fits a search-result snippet / a card without being cut. */
export const SUMMARY_SOFT_LIMIT = 160;

// Relative claims go stale the moment the set of offers changes (or when the
// site-wide ranking is recomputed), so the rating reason should not make them.
const RELATIVE_CLAIM = /najwyższ|najwyzsz|najniższ|najnizsz|w\s+tej\s+turze|w\s+tym\s+zestawieniu/i;

export function ratingReasonWarning(reason: string | null | undefined): string | null {
  if (!reason || !RELATIVE_CLAIM.test(reason)) return null;
  return "Uzasadnienie oceny porównuje tę ofertę z innymi („najwyższa”, „najniższa”, „w tej turze”, „w tym zestawieniu”). Takie stwierdzenie przestaje być prawdziwe, gdy zmieni się zestaw ofert. Opisz raczej samą ofertę (premia, liczba i trudność warunków).";
}

export function summaryLengthWarning(summary: string | null | undefined): string | null {
  const length = summary?.trim().length ?? 0;
  if (length <= SUMMARY_SOFT_LIMIT) return null;
  return `Krótki opis ma ${length} znaków. Powyżej ${SUMMARY_SOFT_LIMIT} wyszukiwarki i karty ucinają tekst. Skróć go, jeśli możesz (zapis nie jest blokowany).`;
}
