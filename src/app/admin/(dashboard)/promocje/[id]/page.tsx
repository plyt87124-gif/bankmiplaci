import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PromotionForm } from "../PromotionForm";
import { updatePromotion, setPromotionStatus, deletePromotion } from "../actions";
import { promotionToFormDefaults } from "@/lib/promotionForm";
import type { PromotionFormValues } from "@/lib/validation/promotion";
import Link from "next/link";
import { PromotionStatus } from "@prisma/client";

export default async function EditPromotionPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const promotion = await db.promotion.findUnique({
    where: { id: params.id },
    include: { conditions: true, bonusParts: true, fees: true }
  });

  if (!promotion) notFound();

  const banks = await db.bank.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  const defaultValues = promotionToFormDefaults(promotion);

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
