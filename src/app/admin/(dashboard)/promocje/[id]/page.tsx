import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PromotionForm } from "../PromotionForm";
import { updatePromotion, setPromotionStatus, deletePromotion } from "../actions";
import type { PromotionFormValues } from "@/lib/validation/promotion";
import Link from "next/link";
import { PromotionStatus } from "@prisma/client";

/**
 * <input type="date"> only shows a "YYYY-MM-DD" string. Handing the form a
 * Date object left every date field blank on edit, which (for the bonus
 * parts' availableUntil) meant that saving the form after re-typing the
 * required dates would silently erase the stored deadline.
 */
function dateInput(d: Date | null | undefined): Date | undefined {
  return d ? (d.toISOString().slice(0, 10) as unknown as Date) : undefined;
}

export default async function EditPromotionPage({ params }: { params: { id: string } }) {
  const promotion = await db.promotion.findUnique({
    where: { id: params.id },
    include: { conditions: true, bonusParts: true, fees: true }
  });

  if (!promotion) notFound();

  const banks = await db.bank.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  const defaultValues: Partial<PromotionFormValues> = {
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

  async function handleSubmit(values: PromotionFormValues) {
    "use server";
    await updatePromotion(params.id, values);
  }

  async function markExpired() {
    "use server";
    await setPromotionStatus(params.id, PromotionStatus.EXPIRED);
  }

  async function markActive() {
    "use server";
    await setPromotionStatus(params.id, PromotionStatus.ACTIVE);
  }

  async function remove() {
    "use server";
    await deletePromotion(params.id);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Edytuj promocję</h1>
          <p className="mt-1 text-sm text-ink-500">
            {promotion.status === "ACTIVE" && (
              <Link href={`/promocje/${promotion.slug}`} target="_blank" className="underline">
                Podgląd na stronie
              </Link>
            )}
            {promotion.status === "DRAFT" && "Wersja robocza — niewidoczna publicznie."}
          </p>
        </div>
        <div className="flex gap-2">
          {promotion.status !== "EXPIRED" && (
            <form action={markExpired}>
              <button className="rounded-full border border-ink-100 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100">
                Oznacz jako wygasłą
              </button>
            </form>
          )}
          {promotion.status !== "ACTIVE" && (
            <form action={markActive}>
              <button className="rounded-full border border-teal-600 px-4 py-2 text-sm font-medium text-teal-700 hover:bg-teal-100">
                Opublikuj (aktywna)
              </button>
            </form>
          )}
          <form action={remove}>
            <button className="rounded-full border border-coral-600 px-4 py-2 text-sm font-medium text-coral-600 hover:bg-coral-100">
              Usuń
            </button>
          </form>
        </div>
      </div>

      <div className="mt-8">
        <PromotionForm
          banks={banks}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          submitLabel="Zapisz zmiany"
          currentRating={Number(promotion.rating)}
        />
      </div>
    </div>
  );
}
