/**
 * The database write behind the admin "Zapisz zmiany" button, separated from
 * the server action (which only adds auth, revalidation and redirects) so it
 * can be exercised against a real database in tests/db.
 *
 * Two rules live here because both went wrong before:
 *
 *  1. Clearing a field must WRITE NULL. Prisma skips `undefined` keys on update,
 *     so a cleared fee amount that reaches the update as `undefined` leaves the
 *     old amount in place. Fee amounts therefore always go out as a number or an
 *     explicit `null` (0 stays 0; see optionalFeeCents in validation/promotion.ts).
 *
 *  2. contentUpdatedAt is decided from the stored state versus the EFFECTIVE
 *     state after the write (stored state overlaid with the keys Prisma will
 *     really set). Fields this write leaves alone - additionalSourceUrls,
 *     fees.sourceUrl, and any field whose key is absent from the payload - are
 *     therefore not mistaken for edits.
 *
 * The same rule covers "Źródło warunków" (sourceUrl), "Okres karencji"
 * (cooldownMonths) and "Data graniczna" (cooldownCutoffDate): a blank input is
 * parsed to `null` and written as NULL, a typed 0 months stays 0, and only an
 * absent key (never produced by the form) keeps the stored value. The
 * additionalSourceUrls list is not part of the payload and is never touched.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import type { PromotionFormValues } from "@/lib/validation/promotion";
import { overlayDefined, promotionContentChanged, type PromotionContentLike } from "@/lib/promotionContent";

const blankToNull = (v: string | null | undefined): string | null => {
  if (v == null) return null;
  return v.trim() === "" ? null : v;
};

/** Fees payload: amounts as number|null, text blank -> null. Never `undefined`, never touches fees.sourceUrl. */
export function feesWriteData(fees: PromotionFormValues["fees"]) {
  return {
    accountFeeCents: fees.accountFeeCents ?? null,
    accountFeeWaiverCondition: blankToNull(fees.accountFeeWaiverCondition),
    cardFeeCents: fees.cardFeeCents ?? null,
    cardFeeWaiverCondition: blankToNull(fees.cardFeeWaiverCondition),
    atmFeeCents: fees.atmFeeCents ?? null,
    otherFee: blankToNull(fees.otherFee)
  };
}

/** Scalar columns the admin update sends (exactly what goes to Prisma, minus rating/contentUpdatedAt). */
export function promotionFormScalars(data: PromotionFormValues) {
  return {
    bankId: data.bankId,
    name: data.name,
    slug: data.slug,
    accountType: data.accountType,
    maxBonusCents: data.maxBonusCents,
    difficulty: data.difficulty,
    ratingOverride: data.ratingOverride ?? null,
    ratingReason: data.ratingReason,
    status: data.status,
    startDate: data.startDate,
    endDate: data.endDate,
    affiliateUrl: data.affiliateUrl,
    affiliateLinkEnabled: data.affiliateLinkEnabled,
    sourceUrl: data.sourceUrl,
    lastVerifiedAt: data.lastVerifiedAt,
    eligibleFor: data.eligibleFor,
    notEligibleFor: data.notEligibleFor,
    cooldownMonths: data.cooldownMonths,
    cooldownCutoffDate: data.cooldownCutoffDate,
    summary: data.summary,
    description: data.description
  };
}

type ExistingPromotion = Prisma.PromotionGetPayload<{ include: { conditions: true; bonusParts: true; fees: true } }>;

/** Stored state with this admin write applied the way Prisma will apply it. */
export function effectiveStateAfterFormUpdate(existing: ExistingPromotion, data: PromotionFormValues): PromotionContentLike {
  const scalars = overlayDefined(existing as unknown as PromotionContentLike, promotionFormScalars(data));
  return {
    ...scalars,
    conditions: data.conditions,
    bonusParts: data.bonusParts,
    // upsert.update: amounts/conditions/otherFee are always defined here; fees.sourceUrl is not part
    // of the payload, so the stored value survives.
    fees: overlayDefined((existing.fees ?? {}) as NonNullable<PromotionContentLike["fees"]>, feesWriteData(data.fees))
  };
}

export async function updatePromotionRecord(client: PrismaClient, id: string, data: PromotionFormValues) {
  return client.$transaction(async (tx) => {
    const existing = await tx.promotion.findUnique({
      where: { id },
      include: { conditions: true, bonusParts: true, fees: true }
    });
    if (!existing) throw new Error("Nie znaleziono promocji.");
    const contentChanged = promotionContentChanged(existing as unknown as PromotionContentLike, effectiveStateAfterFormUpdate(existing, data));
    const fees = feesWriteData(data.fees);

    await tx.promotionCondition.deleteMany({ where: { promotionId: id } });
    await tx.bonusPart.deleteMany({ where: { promotionId: id } });
    return tx.promotion.update({
      where: { id },
      data: {
        ...promotionFormScalars(data),
        // Placeholder - recomputeRatings() overwrites this for any ACTIVE
        // promotion; skipped only when ratingOverride pins it.
        rating: data.ratingOverride ?? 9.0,
        ...(contentChanged ? { contentUpdatedAt: new Date() } : {}),
        conditions: { create: data.conditions },
        bonusParts: { create: data.bonusParts },
        fees: { upsert: { create: fees, update: fees } }
      }
    });
  });
}
